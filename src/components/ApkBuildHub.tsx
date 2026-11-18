import { useState } from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { ANDROID_OVERLAY_FILES } from '../data/androidFiles';

interface ApkBuildHubProps {
  onBack: () => void;
}

export function ApkBuildHub({ onBack }: ApkBuildHubProps) {
  const [selectedId, setSelectedId] = useState<string>(ANDROID_OVERLAY_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile =
    ANDROID_OVERLAY_FILES.find((f) => f.id === selectedId) ?? ANDROID_OVERLAY_FILES[0];

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <div className="h-screen w-screen bg-[#000000] text-[#F5F5F7] flex flex-col overflow-hidden">
      <header className="h-14 px-4 sm:px-6 border-b border-[#1C1C21] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-[#F5F5F7] hover:text-[#00CAE0] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="font-display text-sm font-semibold">Android APK Build</div>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2 border-b border-[#1C1C21] pb-5">
            <h1 className="font-display text-2xl font-bold text-[#F5F5F7]">
              TG7 Editor Android APK (GitHub Auto-Build)
            </h1>
            <p className="text-sm text-[#8E8E98] leading-relaxed">
              Your workspace includes an automated GitHub Actions build workflow (
              <span className="font-mono text-[#F5F5F7]">.github/workflows/build-apk.yml</span>)
              that compiles <span className="font-mono text-[#F5F5F7]">com.tg7.editor</span> using
              the open-source LibreCuts Android engine. Also check{' '}
              <span className="font-mono text-[#00CAE0]">artcraft-android/capcraft-android</span> on
              GitHub if you want a Rust + Jetpack Compose CapCut Android codebase.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#121215] border border-[#1E1E24] rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-mono text-[#00CAE0]">01 · SYNC</div>
              <div className="text-sm font-semibold">Push to GitHub</div>
              <p className="text-xs text-[#8E8E98]">
                Push this project from AI Studio GitHub settings to your GitHub repo.
              </p>
            </div>
            <div className="bg-[#121215] border border-[#1E1E24] rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-mono text-[#00CAE0]">02 · ACTIONS</div>
              <div className="text-sm font-semibold">Auto Compile APK</div>
              <p className="text-xs text-[#8E8E98]">
                GitHub Actions runs Gradle in the cloud and generates your debug APK.
              </p>
            </div>
            <div className="bg-[#121215] border border-[#1E1E24] rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-mono text-[#00CAE0]">03 · INSTALL</div>
              <div className="text-sm font-semibold">Download Artifact</div>
              <p className="text-xs text-[#8E8E98]">
                Open Actions &rarr; latest run &rarr; download TG7-Editor-APK on your phone.
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {ANDROID_OVERLAY_FILES.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedId(file.id)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg border cursor-pointer ${
                    file.id === activeFile.id
                      ? 'bg-[#00CAE0] border-[#00CAE0] text-black font-semibold'
                      : 'bg-[#121215] border-[#24242C] text-[#8E8E98] hover:text-white'
                  }`}
                >
                  {file.filename}
                </button>
              ))}
            </div>

            <div className="bg-[#121215] border border-[#1E1E24] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E1E24] flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-[#F5F5F7] truncate">{activeFile.path}</div>
                  <div className="text-xs text-[#8E8E98] mt-0.5">{activeFile.summary}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(activeFile.id, activeFile.content)}
                  className="px-3 py-1.5 bg-[#1C1C22] border border-[#2C2C34] rounded-lg text-xs font-medium text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedId === activeFile.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#34D399]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-[#F5F5F7] overflow-x-auto leading-relaxed bg-[#09090B]">
                <code>{activeFile.content}</code>
              </pre>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
