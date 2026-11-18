import React from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class StudioErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected workspace error.',
    };
  }

  componentDidCatch(error: Error) {
    // Keep console warning only; drafts are already continuously synced to IndexedDB/localStorage
    console.warn('TG7 Studio recovered from render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#060608] text-[#F5F5F7] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#101015] border border-[#24242E] p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#00CAE0]/15 border border-[#00CAE0]/30 text-[#00CAE0] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-bold text-white">
                Your Draft Was Safely Preserved
              </h2>
              <p className="text-xs text-[#9A9AA8] leading-relaxed">
                TG7 Editor caught an unexpected glitch and protected your active timeline in draft storage.
              </p>
              {this.state.errorMessage && (
                <p className="text-[11px] font-mono text-[#7C7C88] bg-[#08080B] border border-[#1C1C24] rounded-lg px-3 py-2 break-words">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="w-full py-2.5 px-4 rounded-xl bg-[#00CAE0] hover:brightness-110 text-black text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Resume Saved Draft</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
