import { useState, useCallback, useEffect, useRef } from 'react';

/** UTF-8 safe base64 encode (btoa only handles Latin1). */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function sendShellCommand(sessionId: string, cmd: string): void {
  window.jamo.sendTerminalInput(sessionId, toBase64(cmd + '\r'));
}

/** Polling interval (ms) for checking action completion via exit-status file. */
const ACTION_POLL_MS = 2000;

/** Delay (ms) before sending command to a newly-ready terminal session. */
const TERMINAL_INIT_DELAY_MS = 500;

/** Delay (ms) between Ctrl+C and sending the next command. */
const CTRL_C_DELAY_MS = 200;

/** Duration (ms) to show the completion status before resetting to idle. */
const STATUS_RESET_DELAY_MS = 6000;

/** The shell command that runs Claude with the hidden prompt file. */
const CLAUDE_CMD =
  'rm -f .jamo/.exit_status; claude --append-system-prompt "$(cat .jamo/.prompt)" "Begin."; echo $? > .jamo/.exit_status';

export type ActionStatus = 'idle' | 'running' | 'done' | 'error';

export function useActionRunner(
  workspaceId: string | null,
  terminalSessionId: string | null,
  terminalOpen: boolean,
  openTerminal: (tab?: 'claude' | 'run') => void,
) {
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionLabel, setActionLabel] = useState('');
  const pendingActionRef = useRef<string | null>(null);

  const sendActionToTerminal = useCallback(async (prompt: string, label: string) => {
    if (!workspaceId) return;

    // Write prompt to hidden file.
    await window.jamo.writeFile(workspaceId, '.jamo/.prompt', prompt);
    try { await window.jamo.deleteFile(workspaceId, '.jamo/.exit_status'); } catch { /* ignore */ }

    setActionStatus('running');
    setActionLabel(label);

    if (!terminalOpen) {
      pendingActionRef.current = CLAUDE_CMD;
      openTerminal('claude');
    } else if (terminalSessionId) {
      window.jamo.sendTerminalInput(terminalSessionId, toBase64('\x03'));
      setTimeout(() => sendShellCommand(terminalSessionId, CLAUDE_CMD), CTRL_C_DELAY_MS);
    } else {
      pendingActionRef.current = CLAUDE_CMD;
    }
  }, [terminalOpen, terminalSessionId, workspaceId, openTerminal]);

  // Send pending action when terminal session becomes ready.
  useEffect(() => {
    if (terminalSessionId && pendingActionRef.current) {
      const cmd = pendingActionRef.current;
      pendingActionRef.current = null;
      const timer = setTimeout(() => sendShellCommand(terminalSessionId, cmd), TERMINAL_INIT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [terminalSessionId]);

  // Poll exit status.
  useEffect(() => {
    if (actionStatus !== 'running' || !workspaceId) return;

    const interval = setInterval(async () => {
      try {
        const res = await window.jamo.readFile(workspaceId, '.jamo/.exit_status');
        const code = parseInt(res.content.trim(), 10);
        if (!isNaN(code)) {
          setActionStatus(code === 0 ? 'done' : 'error');
          setTimeout(
            () => setActionStatus((s) => (s === 'done' || s === 'error' ? 'idle' : s)),
            STATUS_RESET_DELAY_MS,
          );
        }
      } catch {
        // File doesn't exist yet — action still running.
      }
    }, ACTION_POLL_MS);

    return () => clearInterval(interval);
  }, [actionStatus, workspaceId]);

  return { actionStatus, actionLabel, sendActionToTerminal };
}
