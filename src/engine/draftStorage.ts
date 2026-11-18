import { MediaAsset, ProjectState } from '../types/editor';

const DB_NAME = 'tg7_studio_drafts_v1';
const DB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_BLOBS = 'media_blobs';
const STORE_FONTS = 'font_blobs';
const LS_FALLBACK_KEY = 'tg7_studio_draft_fallback_v1';

export interface SavedStudioSnapshot {
  projects: ProjectState[];
  activeProjectId: string;
  customFonts: string[];
  deviceAssets: MediaAsset[];
  savedAt: number;
}

interface StoredFontBlob {
  name: string;
  buffer: ArrayBuffer;
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS);
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
      if (!db.objectStoreNames.contains(STORE_FONTS)) {
        db.createObjectStore(STORE_FONTS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open error'));
  });
}

export async function saveMediaBlobToDraftDb(assetId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      tx.objectStore(STORE_BLOBS).put(blob, assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal if storage quota exceeded
  }
}

export async function saveCustomFontBlobToDraftDb(name: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FONTS, 'readwrite');
      tx.objectStore(STORE_FONTS).put({ name, buffer } satisfies StoredFontBlob, name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota errors
  }
}

export async function saveStudioDraftSnapshot(snapshot: SavedStudioSnapshot): Promise<void> {
  const sanitizedProjects = snapshot.projects.map((p) => ({
    ...p,
    isPlaying: false,
  }));
  const payload: SavedStudioSnapshot = {
    ...snapshot,
    projects: sanitizedProjects,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(
      LS_FALLBACK_KEY,
      JSON.stringify({
        projects: sanitizedProjects,
        activeProjectId: payload.activeProjectId,
        customFonts: payload.customFonts,
        savedAt: payload.savedAt,
      })
    );
  } catch {
    // localStorage might be full if thumbnails are large; IndexedDB below handles full snapshot
  }

  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, 'readwrite');
      tx.objectStore(STORE_DRAFTS).put(payload, 'latest');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Safe ignore
  }
}

export async function loadStudioDraftSnapshot(): Promise<{
  snapshot: SavedStudioSnapshot | null;
  blobUrlMap: Map<string, string>;
}> {
  const blobUrlMap = new Map<string, string>();
  let snapshot: SavedStudioSnapshot | null = null;

  try {
    const db = await openDraftDb();

    // 1. Re-register saved custom FontFaces
    try {
      const fontEntries = await new Promise<StoredFontBlob[]>((resolve) => {
        const tx = db.transaction(STORE_FONTS, 'readonly');
        const req = tx.objectStore(STORE_FONTS).getAll();
        req.onsuccess = () => resolve((req.result as StoredFontBlob[]) || []);
        req.onerror = () => resolve([]);
      });
      for (const entry of fontEntries) {
        try {
          const ff = new FontFace(entry.name, entry.buffer.slice(0));
          const loaded = await ff.load();
          document.fonts.add(loaded);
        } catch {
          // ignore broken font
        }
      }
    } catch {
      // ignore
    }

    // 2. Load snapshot
    snapshot = await new Promise<SavedStudioSnapshot | null>((resolve) => {
      const tx = db.transaction(STORE_DRAFTS, 'readonly');
      const req = tx.objectStore(STORE_DRAFTS).get('latest');
      req.onsuccess = () => resolve((req.result as SavedStudioSnapshot) || null);
      req.onerror = () => resolve(null);
    });

    // 3. Rehydrate saved media blobs -> working ObjectURLs
    if (snapshot && snapshot.deviceAssets.length > 0) {
      for (const asset of snapshot.deviceAssets) {
        try {
          const blob = await new Promise<Blob | null>((resolve) => {
            const tx = db.transaction(STORE_BLOBS, 'readonly');
            const req = tx.objectStore(STORE_BLOBS).get(asset.id);
            req.onsuccess = () => resolve((req.result as Blob) || null);
            req.onerror = () => resolve(null);
          });
          if (blob) {
            const freshUrl = URL.createObjectURL(blob);
            blobUrlMap.set(asset.id, freshUrl);
          }
        } catch {
          // ignore single blob failure
        }
      }
    }
  } catch {
    // Try localStorage fallback
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedStudioSnapshot>;
        if (parsed.projects && parsed.projects.length > 0) {
          snapshot = {
            projects: parsed.projects,
            activeProjectId: parsed.activeProjectId || parsed.projects[0].id,
            customFonts: parsed.customFonts || [],
            deviceAssets: [],
            savedAt: parsed.savedAt || Date.now(),
          };
        }
      }
    } catch {
      snapshot = null;
    }
  }

  if (snapshot) {
    // Rebind stale blob: URLs to rehydrated fresh ObjectURLs
    snapshot.deviceAssets = snapshot.deviceAssets.map((a) => ({
      ...a,
      url: blobUrlMap.get(a.id) ?? a.url,
    }));

    snapshot.projects = snapshot.projects.map((proj) => ({
      ...proj,
      isPlaying: false,
      clips: proj.clips.map((c) => {
        if (c.assetId && blobUrlMap.has(c.assetId)) {
          return { ...c, mediaUrl: blobUrlMap.get(c.assetId) };
        }
        return c;
      }),
    }));
  }

  return { snapshot, blobUrlMap };
}
