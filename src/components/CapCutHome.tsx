import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Copy,
  Film,
  Flame,
  FolderOpen,
  Gauge,
  Globe,
  Laugh,
  Layers,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { fetchOnlineTemplates, OnlineTemplateItem } from '../data/onlineLibraries';
import { AspectRatio, ProjectState } from '../types/editor';

export type QuickPresetKind =
  | 'mrbeast-shorts'
  | 'velocity'
  | 'glitch-intro'
  | 'chroma-lab'
  | 'meme-vault';

interface CapCutHomeProps {
  projects: ProjectState[];
  lastSavedAt?: number | null;
  onOpenProject: (projectId: string) => void;
  onOpenNewProjectPicker: (aspectRatio: AspectRatio) => void;
  onCreateBlankProject: (aspectRatio: AspectRatio) => void;
  onLaunchPreset: (preset: QuickPresetKind, aspectRatio: AspectRatio) => void;
  onLaunchOnlineTemplate?: (tpl: OnlineTemplateItem) => Promise<void>;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

const PRO_PRESETS: {
  id: QuickPresetKind;
  title: string;
  desc: string;
  accent: string;
  icon: typeof Gauge;
}[] = [
  {
    id: 'mrbeast-shorts',
    title: 'MrBeast Shorts',
    desc: 'Bold gradient captions + Shake + Zoom cuts',
    accent: '#FFE600',
    icon: Flame,
  },
  {
    id: 'velocity',
    title: 'Velocity Montage',
    desc: 'Speed curve ramp + beat pulse',
    accent: '#00CAE0',
    icon: Gauge,
  },
  {
    id: 'glitch-intro',
    title: 'Cyber Intro FX',
    desc: 'Animated title + 54 WebGL shaders',
    accent: '#A78BFA',
    icon: Wand2,
  },
  {
    id: 'chroma-lab',
    title: 'Keyframes & Chroma',
    desc: 'Multi-layer green screen + motion',
    accent: '#34D399',
    icon: Layers,
  },
  {
    id: 'meme-vault',
    title: 'Online Memes & SFX',
    desc: 'MyInstants + Mixkit live audio/VFX',
    accent: '#F59E0B',
    icon: Laugh,
  },
];

export function CapCutHome({
  projects,
  lastSavedAt,
  onOpenProject,
  onOpenNewProjectPicker,
  onCreateBlankProject,
  onLaunchPreset,
  onLaunchOnlineTemplate,
  onDuplicateProject,
  onDeleteProject,
}: CapCutHomeProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [onlineTemplates, setOnlineTemplates] = useState<OnlineTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [busyTplId, setBusyTplId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchOnlineTemplates()
      .then((list) => {
        if (!cancelled) setOnlineTemplates(list);
      })
      .catch(() => {
        // offline fallback gracefully handled by Quick Launch presets below
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-[#000000] text-[#F5F5F7] flex flex-col overflow-hidden">
      {/* Clean Beast Studio Header */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-[#18181F] bg-[#050507] shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/tg7-logo.png"
            alt="TG7 Editor"
            className="w-9 h-9 rounded-xl object-cover border border-[#00CAE0]/40 shadow-[0_0_16px_rgba(0,202,224,0.28)]"
          />
          <div>
            <div className="font-display text-lg font-extrabold tracking-tight leading-none">
              TG7 <span className="text-[#00CAE0]">EDITOR</span>
            </div>
            <div className="text-[10px] font-mono text-[#7E7E8D] tracking-wider uppercase mt-0.5">
              1080P · 60FPS STUDIO
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCreateBlankProject(aspectRatio)}
          className="px-3.5 py-2 min-h-[36px] bg-[#141419] hover:bg-[#1E1E26] border border-[#282832] rounded-lg text-xs font-semibold text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#00CAE0]" />
          <span>Blank Project</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-6xl w-full mx-auto space-y-7">
        {/* VIP Hero Create Banner */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Create new project"
          className="relative rounded-2xl bg-gradient-to-br from-[#0F181D] via-[#0B0D12] to-[#08080B] border border-[#1E2E35] p-5 sm:p-6 overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
        >
          <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-[#00CAE0]/12 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-[#00CAE0]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>54 WEBGL FX · 225 GLSL TRANSITIONS · LIVE ONLINE MATERIALS</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Create Your Next Viral Edit
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[#8E8E98] mr-1">Canvas:</span>
                {(
                  [
                    { id: '9:16', label: '9:16 Reels' },
                    { id: '16:9', label: '16:9 YouTube' },
                    { id: '1:1', label: '1:1 Square' },
                  ] as { id: AspectRatio; label: string }[]
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setAspectRatio(r.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-colors ${
                      aspectRatio === r.id
                        ? 'bg-[#00CAE0] text-black font-bold'
                        : 'bg-[#16161C] text-[#9A9AA8] hover:text-white border border-[#25252E]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenNewProjectPicker(aspectRatio)}
              className="sm:w-56 h-16 sm:h-20 rounded-xl bg-gradient-to-r from-[#00CAE0] via-[#22D3EE] to-[#34D399] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 text-black font-display text-base font-extrabold shadow-[0_0_28px_rgba(0,202,224,0.32)] cursor-pointer shrink-0"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>New Project</span>
            </button>
          </div>
        </motion.section>

        {/* Live Online Creator Templates (Mixkit HD Videos + Real Beats + Shaders) */}
        {(loadingTemplates || onlineTemplates.length > 0) && onLaunchOnlineTemplate && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Live online creator templates"
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-[#00CAE0]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#F5F5F7]">
                  Online Viral Templates (HD Video + Music)
                </h2>
              </div>
              {loadingTemplates && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E98]">
                  <Loader2 className="w-3 h-3 animate-spin text-[#00CAE0]" />
                  <span>Fetching live...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {onlineTemplates.map((tpl) => {
                const isBusy = busyTplId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={Boolean(busyTplId)}
                    onClick={async () => {
                      setBusyTplId(tpl.id);
                      try {
                        await onLaunchOnlineTemplate(tpl);
                      } finally {
                        setBusyTplId(null);
                      }
                    }}
                    className="rounded-xl bg-[#0F0F14] hover:bg-[#16161E] border border-[#1E1E28] hover:border-[#00CAE0]/60 overflow-hidden text-left transition-all cursor-pointer group flex flex-col"
                  >
                    <div className="relative h-28 w-full bg-[#09090D] overflow-hidden">
                      {tpl.thumbUrl && (
                        <img
                          src={tpl.thumbUrl}
                          alt={tpl.title}
                          loading="lazy"
                          className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      <span
                        className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/75 border"
                        style={{ color: tpl.accentHex, borderColor: `${tpl.accentHex}55` }}
                      >
                        {tpl.tag} · {tpl.aspectRatio}
                      </span>
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">{tpl.title}</span>
                        <span className="px-2 py-1 rounded-md bg-[#00CAE0] text-black text-[10px] font-bold flex items-center gap-1 shrink-0">
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Play className="w-2.5 h-2.5 fill-black" />
                              <span>Use</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2 text-[11px] text-[#8E8E98] truncate">
                      {tpl.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Creator Quick-Start Templates */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Pro workflows"
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
              Creator Quick Launch
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {PRO_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onLaunchPreset(preset.id, aspectRatio)}
                  className="p-3.5 rounded-xl bg-[#0F0F14] hover:bg-[#16161E] border border-[#1E1E26] hover:border-[#2E2E3A] text-left transition-all cursor-pointer group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                    style={{ backgroundColor: `${preset.accent}1A`, color: preset.accent }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#00CAE0] transition-colors">
                    {preset.title}
                  </div>
                  <div className="text-[11px] text-[#7E7E8C] mt-0.5 leading-snug">
                    {preset.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Visual Projects & Drafts Grid */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Your projects"
          className="space-y-3 pb-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
              Saved Drafts ({projects.length})
            </h2>
            {lastSavedAt && (
              <span className="text-[11px] font-mono text-[#6E6E7C]">
                Auto-saved locally
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((proj) => {
              const totalLen =
                proj.clips.length > 0
                  ? Math.max(...proj.clips.map((c) => c.startSec + c.durationSec))
                  : 0;
              const firstThumb = proj.clips.find((c) => c.thumbnails && c.thumbnails.length > 0)
                ?.thumbnails?.[0];

              return (
                <div
                  key={proj.id}
                  className="rounded-xl bg-[#101014] border border-[#1E1E26] hover:border-[#00CAE0]/50 overflow-hidden transition-colors flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProject(proj.id)}
                    className="relative h-32 w-full bg-[#09090C] overflow-hidden group cursor-pointer"
                  >
                    {firstThumb ? (
                      <img
                        src={firstThumb}
                        alt={proj.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#121820] to-[#08080A]">
                        <Film className="w-8 h-8 text-[#3A3A48]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                      <div className="text-left min-w-0">
                        <div className="text-sm font-bold text-white truncate">{proj.name}</div>
                        <div className="text-[11px] font-mono tabular-nums text-[#A1A1B0]">
                          {totalLen.toFixed(1)}s · {proj.aspectRatio} · {proj.clips.length} clips
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#00CAE0] text-black flex items-center justify-center shrink-0 shadow">
                        <Play className="w-3.5 h-3.5 ml-0.5 fill-black" />
                      </div>
                    </div>
                  </button>

                  <div className="px-3 py-2 bg-[#0D0D11] border-t border-[#1A1A22] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-[#7C7C8A]">
                      {proj.fps} FPS · {proj.tracks.length} Tracks
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(proj.id)}
                        title="Duplicate project"
                        aria-label={`Duplicate ${proj.name}`}
                        className="p-1.5 text-[#8E8E98] hover:text-[#00CAE0] rounded-md cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj.id)}
                          title="Delete project"
                          aria-label={`Delete ${proj.name}`}
                          className="p-1.5 text-[#8E8E98] hover:text-[#F87171] rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      </main>
    </div>
  );
}
