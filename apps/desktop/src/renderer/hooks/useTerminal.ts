import { useState, useCallback } from 'react';

export function useTerminal() {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [terminalSessionId, setTerminalSessionId] = useState<string | null>(null);
  const [activeTerminalTab, setActiveTerminalTab] = useState<'claude' | 'run'>('claude');

  const openTerminal = useCallback((tab?: 'claude' | 'run') => {
    setTerminalMounted(true);
    setTerminalOpen(true);
    if (tab) setActiveTerminalTab(tab);
  }, []);

  const closeTerminal = useCallback(() => {
    setTerminalOpen(false);
  }, []);

  const toggleTerminal = useCallback(() => {
    setTerminalOpen((prev) => {
      if (!prev) setTerminalMounted(true);
      return !prev;
    });
  }, []);

  const handleSessionReady = useCallback((sessionId: string) => {
    setTerminalSessionId(sessionId);
  }, []);

  const handleSessionEnd = useCallback(() => {
    setTerminalSessionId(null);
  }, []);

  const mountTerminal = useCallback(() => {
    setTerminalMounted(true);
  }, []);

  return {
    terminalOpen,
    terminalMounted,
    terminalSessionId,
    activeTerminalTab,
    setActiveTerminalTab,
    openTerminal,
    closeTerminal,
    toggleTerminal,
    mountTerminal,
    handleSessionReady,
    handleSessionEnd,
  };
}
