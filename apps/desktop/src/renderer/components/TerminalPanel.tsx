import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from '../theme';
import { Button } from './ui/button';

const TERM_THEMES = {
  dark: { background: '#1a1a2e', foreground: '#e0e0e0', cursor: '#e0e0e0' },
  light: { background: '#f5f5f5', foreground: '#222222', cursor: '#222222' },
} as const;

interface TerminalPanelProps {
  workspaceId: string;
  onClose: () => void;
  onSessionReady?: (sessionId: string) => void;
  onSessionEnd?: () => void;
}

export default function TerminalPanel({ workspaceId, onClose, onSessionReady, onSessionEnd }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [status, setStatus] = useState<string>('Starting...');
  const { theme } = useTheme();

  // Update xterm colors in place when theme changes (without recreating the session)
  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.theme = TERM_THEMES[theme];
  }, [theme]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: TERM_THEMES[theme],
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, monospace',
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => {
      if (sessionRef.current) {
        window.jamo.sendTerminalInput(sessionRef.current, btoa(data));
      }
    });

    const offData = window.jamo.onTerminalData(({ sessionId, data }) => {
      if (sessionId === sessionRef.current) {
        term.write(new Uint8Array(atob(data).split('').map((c) => c.charCodeAt(0))));
      }
    });

    const offEnd = window.jamo.onTerminalEnd((sessionId) => {
      if (sessionId === sessionRef.current) {
        setStatus('Session ended');
        sessionRef.current = null;
        onSessionEnd?.();
      }
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
      if (sessionRef.current) {
        window.jamo.resizeTerminal(sessionRef.current, term.cols, term.rows);
      }
    });
    ro.observe(containerRef.current);

    // Auto-create terminal session and run claude
    (async () => {
      try {
        const sessionId = await window.jamo.createTerminal(workspaceId, term.cols, term.rows);
        sessionRef.current = sessionId;
        setStatus('Connected');
        window.jamo.startTerminalStream(sessionId);
        onSessionReady?.(sessionId);

        // Send claude command after a short delay for shell init
        setTimeout(() => {
          if (sessionRef.current) {
            window.jamo.sendTerminalInput(sessionRef.current, btoa('claude\n'));
          }
        }, 500);
      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
      }
    })();

    return () => {
      offData();
      offEnd();
      ro.disconnect();
      term.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return (
    <div className="flex flex-col h-full border-l">
      <div className="px-2 py-1 border-b flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-semibold uppercase text-foreground-muted">Terminal</span>
        <span className="text-[10px] text-foreground-dim">{status}</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title="Close terminal"
          className="h-6 w-6 text-foreground-muted"
        >
          <span className="text-sm leading-none">&times;</span>
        </Button>
      </div>
      <div ref={containerRef} className="flex-1 p-1" />
    </div>
  );
}
