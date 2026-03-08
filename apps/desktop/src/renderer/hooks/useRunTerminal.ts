import { useState, useCallback, useRef } from 'react';

/** Delay (ms) before sending `make run` to a newly-mounted run terminal. */
const RUN_INIT_DELAY_MS = 500;

/** Delay (ms) between Ctrl+C and re-sending `make run` for a rerun. */
const RERUN_DELAY_MS = 300;

export function useRunTerminal(
  terminalOpen: boolean,
  openTerminal: (tab?: 'claude' | 'run') => void,
) {
  const [runState, setRunState] = useState<'idle' | 'running'>('idle');
  const [runSessionId, setRunSessionId] = useState<string | null>(null);
  const [runTerminalMounted, setRunTerminalMounted] = useState(false);
  const pendingRunRef = useRef(false);

  const handleRun = useCallback(() => {
    openTerminal('run');

    if (runState === 'running' && runSessionId) {
      // Rerun: Ctrl+C, wait, then send make run.
      window.jamo.sendTerminalInput(runSessionId, btoa('\x03'));
      setTimeout(() => {
        if (runSessionId) {
          window.jamo.sendTerminalInput(runSessionId, btoa('make run\r'));
        }
      }, RERUN_DELAY_MS);
      return;
    }

    if (runSessionId) {
      window.jamo.sendTerminalInput(runSessionId, btoa('make run\r'));
      setRunState('running');
    } else {
      pendingRunRef.current = true;
      setRunTerminalMounted(true);
    }
  }, [runState, runSessionId, openTerminal]);

  const handleStop = useCallback(() => {
    if (runSessionId) {
      window.jamo.sendTerminalInput(runSessionId, btoa('\x03'));
    }
    setRunState('idle');
  }, [runSessionId]);

  const handleRunSessionReady = useCallback((sessionId: string) => {
    setRunSessionId(sessionId);
    if (pendingRunRef.current) {
      pendingRunRef.current = false;
      setTimeout(() => {
        window.jamo.sendTerminalInput(sessionId, btoa('make run\r'));
        setRunState('running');
      }, RUN_INIT_DELAY_MS);
    }
  }, []);

  const handleRunSessionEnd = useCallback(() => {
    setRunSessionId(null);
    setRunState('idle');
  }, []);

  return {
    runState,
    runSessionId,
    runTerminalMounted,
    handleRun,
    handleStop,
    handleRunSessionReady,
    handleRunSessionEnd,
  };
}
