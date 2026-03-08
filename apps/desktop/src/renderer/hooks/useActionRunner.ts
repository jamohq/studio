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

/** The shell command to execute the wrapper script and capture exit status. */
const CLAUDE_CMD =
  'rm -f .jamo/.exit_status .jamo/.output; bash .jamo/.run.sh; printf "%d\\n" "$?" > .jamo/.exit_status';

/** Content of the wrapper script written before launching the action.
 *  Uses -p (print mode) so claude exits after completing instead of waiting for input.
 *  Pipes through tee to capture output; pipefail ensures claude's exit code is preserved. */
const RUN_SCRIPT =
  '#!/bin/bash\nset -o pipefail\nclaude -p --append-system-prompt "$(cat .jamo/.prompt)" "Begin." | tee .jamo/.output\n';

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

    // Write prompt and wrapper script to hidden files.
    await window.jamo.writeFile(workspaceId, '.jamo/.prompt', prompt);
    await window.jamo.writeFile(workspaceId, '.jamo/.run.sh', RUN_SCRIPT);
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
        // List .jamo/ first to check if .exit_status exists, avoiding noisy
        // gRPC NotFound errors that Electron logs for rejected ipcMain handles.
        const dir = await window.jamo.listDirectory(workspaceId, '.jamo');
        if (!dir.entries.some((e) => e.name === '.exit_status')) return;

        const res = await window.jamo.readFile(workspaceId, '.jamo/.exit_status');
        // Extract first sequence of digits from the file (handles trailing newlines, whitespace, escape chars).
        const match = res.content.match(/(\d+)/);
        if (match) {
          const code = parseInt(match[1], 10);
          setActionStatus(code === 0 ? 'done' : 'error');
          setTimeout(
            () => setActionStatus((s) => (s === 'done' || s === 'error' ? 'idle' : s)),
            STATUS_RESET_DELAY_MS,
          );
        }
      } catch {
        // Directory or file not readable — action still running.
      }
    }, ACTION_POLL_MS);

    return () => clearInterval(interval);
  }, [actionStatus, workspaceId]);

  return { actionStatus, actionLabel, sendActionToTerminal };
}
