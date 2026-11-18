// Lightweight client-side ZIP font extractor (supports DaFont/1001Fonts .zip archives)

function readUint16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('ZIP deflate decompression is not supported in this browser.');
  }
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

export interface ExtractedFontEntry {
  name: string;
  buffer: ArrayBuffer;
}

export async function extractFontFromZip(zipFile: File): Promise<ExtractedFontEntry> {
  const raw = await zipFile.arrayBuffer();
  const bytes = new Uint8Array(raw);
  const view = new DataView(raw);

  // Locate End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (readUint32LE(view, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP file.');
  }

  const centralCount = readUint16LE(view, eocdOffset + 10);
  let cdOffset = readUint32LE(view, eocdOffset + 16);
  const decoder = new TextDecoder('utf-8');

  const candidates: {
    fileName: string;
    method: number;
    compressedSize: number;
    localHeaderOffset: number;
  }[] = [];

  for (let i = 0; i < centralCount; i++) {
    if (cdOffset + 46 > bytes.length || readUint32LE(view, cdOffset) !== 0x02014b50) {
      break;
    }
    const method = readUint16LE(view, cdOffset + 10);
    const compressedSize = readUint32LE(view, cdOffset + 20);
    const nameLen = readUint16LE(view, cdOffset + 28);
    const extraLen = readUint16LE(view, cdOffset + 30);
    const commentLen = readUint16LE(view, cdOffset + 32);
    const localHeaderOffset = readUint32LE(view, cdOffset + 42);
    const fileName = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));

    if (/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/.test(fileName) && !fileName.startsWith('__MACOSX/')) {
      candidates.push({ fileName, method, compressedSize, localHeaderOffset });
    }
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  if (candidates.length === 0) {
    throw new Error('No .ttf, .otf, or .woff2 font found inside this ZIP.');
  }

  // Prefer TTF or OTF first
  candidates.sort((a, b) => {
    const score = (n: string) => (/\.ttf$/i.test(n) ? 0 : /\.otf$/i.test(n) ? 1 : 2);
    return score(a.fileName) - score(b.fileName);
  });

  const pick = candidates[0];
  const lfh = pick.localHeaderOffset;
  if (readUint32LE(view, lfh) !== 0x04034b50) {
    throw new Error('Corrupt ZIP entry.');
  }
  const localNameLen = readUint16LE(view, lfh + 26);
  const localExtraLen = readUint16LE(view, lfh + 28);
  const dataStart = lfh + 30 + localNameLen + localExtraLen;
  const slice = bytes.subarray(dataStart, dataStart + pick.compressedSize);

  let outBytes: Uint8Array;
  if (pick.method === 0) {
    outBytes = slice;
  } else if (pick.method === 8) {
    outBytes = await inflateRawBytes(slice);
  } else {
    throw new Error(`Unsupported ZIP compression method (${pick.method}).`);
  }

  const outBuf = new ArrayBuffer(outBytes.byteLength);
  new Uint8Array(outBuf).set(outBytes);

  const base = pick.fileName.split('/').pop() || zipFile.name;
  const cleanName = base.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
  return { name: cleanName, buffer: outBuf };
}
