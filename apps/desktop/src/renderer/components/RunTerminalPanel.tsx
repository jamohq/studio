import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from '../theme';

const TERM_THEMES = {
  dark: { background: '#1a1a2e', foreground: '#e0e0e0', cursor: '#e0e0e0' },
  light: { background: '#f5f5f5', foreground: '#222222', cursor: '#222222' },
} as const;

/** Strip ANSI escape sequences so we can regex-match plain text. */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/** Match localhost/127.0.0.1 URLs with port numbers. */
const LOCALHOST_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/?/;

interface RunTerminalPanelProps {
  workspaceId: string;
  onSessionReady: (sessionId: string) => void;
  onSessionEnd: () => void;
}

export default function RunTerminalPanel({ workspaceId, onSessionReady, onSessionEnd }: RunTerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const { theme } = useTheme();
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.theme = TERM_THEMES[theme];
  }, [theme]);

  useEffect(() => {
    if (!containerRef.current) return;

    let outputBuf = '';
    let lastDetectedUrl: string | null = null;

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

    // Cmd/Ctrl+C copies selected text (falls through to terminal SIGINT if no selection)
    term.attachCustomKeyEventHandler((ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'c' && ev.type === 'keydown') {
        const sel = term.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel);
          return false;
        }
      }
      return true;
    });

    term.onData((data) => {
      if (sessionRef.current) {
        window.jamo.sendTerminalInput(sessionRef.current, btoa(data));
      }
    });

    const offData = window.jamo.onTerminalData(({ sessionId, data }) => {
      if (sessionId === sessionRef.current) {
        const decoded = atob(data);
        term.write(new Uint8Array(decoded.split('').map((c) => c.charCodeAt(0))));

        // Strip ANSI codes then look for localhost URLs
        outputBuf += decoded;
        if (outputBuf.length > 4096) outputBuf = outputBuf.slice(-2048);

        const clean = stripAnsi(outputBuf);
        const match = clean.match(LOCALHOST_URL_RE);
        if (match && match[0] !== lastDetectedUrl) {
          lastDetectedUrl = match[0];
          setDetectedUrl(match[0]);
          // Auto-open in browser
          window.jamo.openExternal(match[0]);
        }
      }
    });

    const offEnd = window.jamo.onTerminalEnd((sessionId) => {
      if (sessionId === sessionRef.current) {
        sessionRef.current = null;
        setDetectedUrl(null);
        onSessionEnd();
      }
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
      if (sessionRef.current) {
        window.jamo.resizeTerminal(sessionRef.current, term.cols, term.rows);
      }
    });
    ro.observe(containerRef.current);

    (async () => {
      try {
        const sessionId = await window.jamo.createTerminal(workspaceId, term.cols, term.rows);
        sessionRef.current = sessionId;
        window.jamo.startTerminalStream(sessionId);
        onSessionReady(sessionId);
      } catch (err: any) {
        term.write(`\r\nFailed to start run terminal: ${err.message}\r\n`);
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

  /** Expose fit so parent can trigger it on tab switch. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      if (el.offsetParent !== null) fitRef.current?.fit();
    });
    observer.observe(el.parentElement!, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col flex-1 h-full">
      {detectedUrl && (
        <div className="flex items-center gap-2 px-2 py-1 border-b text-[11px] bg-background-deep">
          <span className="text-foreground-muted">Running at</span>
          <button
            onClick={() => window.jamo.openExternal(detectedUrl)}
            className="text-accent hover:underline font-medium"
          >
            {detectedUrl}
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex-1 p-1" />
    </div>
  );
}
