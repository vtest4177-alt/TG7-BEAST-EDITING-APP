import { useState } from 'react';
import { Film, FolderOpen, Plus, Smartphone, Trash2 } from 'lucide-react';
import { AspectRatio, ProjectState } from '../types/editor';

interface CapCutHomeProps {
  projects: ProjectState[];
  onOpenProject: (projectId: string) => void;
  onOpenNewProjectPicker: (aspectRatio: AspectRatio) => void;
  onCreateBlankProject: (aspectRatio: AspectRatio) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenApkHub: () => void;
}

export function CapCutHome({
  projects,
  onOpenProject,
  onOpenNewProjectPicker,
  onCreateBlankProject,
  onDeleteProject,
  onOpenApkHub,
}: CapCutHomeProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');

  return (
    <div className="h-screen w-screen bg-[#000000] text-[#F5F5F7] flex flex-col overflow-hidden">
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-[#1C1C21] shrink-0">
        <div className="font-display text-xl font-bold tracking-tight">TG7 Editor</div>
        <button
          type="button"
          onClick={onOpenApkHub}
          className="px-3.5 py-2 min-h-[38px] bg-[#16161A] hover:bg-[#202026] border border-[#282830] rounded-lg text-xs font-medium text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#00CAE0]" />
          <span>Android APK</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-3xl w-full mx-auto space-y-8">
        <section aria-label="Create new project" className="space-y-3">
          <button
            type="button"
            onClick={() => onOpenNewProjectPicker(aspectRatio)}
            className="w-full h-32 sm:h-36 rounded-2xl bg-gradient-to-r from-[#00CAE0] to-[#34D399] hover:brightness-105 active:scale-[0.99] transition-all flex flex-col items-center justify-center gap-2 text-black shadow-lg cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-black/15 flex items-center justify-center">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">New project</span>
            <span className="text-xs font-medium text-black/75">
              Open in-app gallery to pick videos, photos, or stock clips
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#8E8E98] mr-1">Ratio:</span>
              {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAspectRatio(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono cursor-pointer transition-colors ${
                    aspectRatio === r
                      ? 'bg-[#26262C] text-white'
                      : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onCreateBlankProject(aspectRatio)}
              className="text-xs text-[#00CAE0] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Start empty project</span>
            </button>
          </div>
        </section>

        <section aria-label="Projects" className="space-y-3">
          <h2 className="text-sm font-semibold text-[#F5F5F7]">Projects ({projects.length})</h2>

          <div className="divide-y divide-[#1C1C21] bg-[#121215] border border-[#1E1E24] rounded-xl overflow-hidden">
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
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#18181D] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProject(proj.id)}
                    className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="w-16 h-12 rounded-lg bg-[#1E1E26] overflow-hidden flex items-center justify-center shrink-0 border border-[#2C2C34]">
                      {firstThumb ? (
                        <img
                          src={firstThumb}
                          alt={proj.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-5 h-5 text-[#8E8E98]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#F5F5F7] truncate">
                        {proj.name}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-[#8E8E98] mt-0.5">
                        {totalLen.toFixed(1)}s · {proj.aspectRatio} · {proj.clips.length} clips
                      </div>
                    </div>
                  </button>

                  {projects.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete ${proj.name}`}
                      onClick={() => onDeleteProject(proj.id)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#8E8E98] hover:text-white rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
