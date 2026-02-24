import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from '../theme';

interface TerminalPanelProps {
  workspaceId: string;
  onClose: () => void;
}

export default function TerminalPanel({ workspaceId, onClose }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [status, setStatus] = useState<string>('Starting...');
  const { tokens, theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: theme === 'dark' ? '#1a1a2e' : '#f5f5f5',
        foreground: theme === 'dark' ? '#e0e0e0' : '#222222',
        cursor: theme === 'dark' ? '#e0e0e0' : '#222222',
      },
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
  }, [theme, workspaceId]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderLeft: `1px solid ${tokens.border}`,
    }}>
      <div style={{
        padding: '4px 8px',
        borderBottom: `1px solid ${tokens.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: tokens.textMuted }}>Terminal</span>
        <span style={{ fontSize: 10, color: tokens.textDim }}>{status}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          title="Close terminal"
          style={{
            background: 'transparent',
            border: 'none',
            color: tokens.textMuted,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '2px 4px',
          }}
        >
          ×
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1, padding: 4 }} />
    </div>
  );
}
