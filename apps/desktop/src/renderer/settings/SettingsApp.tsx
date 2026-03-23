import React, { useState, useEffect, useCallback } from 'react';
import './types'; // ensure global types are loaded

interface ClaudeStatus {
  available: boolean;
  version?: string;
}

export default function SettingsApp() {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.jamoSettings.checkEnvironment();
      const claudeDep = result.deps.find((d: any) => d.name === 'claude');
      setStatus({
        available: claudeDep?.found ?? false,
        version: claudeDep?.version,
      });
    } catch {
      setStatus({ available: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <span className="text-[13px] text-foreground-dim">Checking status...</span>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground overflow-auto">
      {/* Drag region for macOS hidden title bar */}
      {navigator.platform.includes('Mac') && (
        <div className="h-8 w-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      )}

      <div className="max-w-[540px] mx-auto px-6 pb-8">
        <h1 className="text-[18px] font-semibold text-foreground mb-6">Settings</h1>

        <section>
          <h2 className="text-[14px] font-semibold text-foreground mb-4">Claude Code CLI</h2>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${status?.available ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-[13px] text-foreground">
                {status?.available ? 'Connected' : 'Not found'}
              </span>
              {status?.version && (
                <span className="text-[11px] text-foreground-dim">v{status.version}</span>
              )}
            </div>
            {!status?.available && (
              <p className="mt-3 text-[12px] text-foreground-muted">
                Install Claude Code CLI: <code className="bg-background-deep px-1.5 py-0.5 rounded text-[11px]">npm install -g @anthropic-ai/claude-code</code>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
