import { useState, useCallback, useEffect } from 'react';

export type SyncMode = 'synced' | 'creator_mode' | 'code_mode';

export interface SyncStatus {
  mode: SyncMode;
  lastAction: string | null;
}

const SYNC_FILE = '.jamo/sync-status.json';
const DEFAULT_STATUS: SyncStatus = { mode: 'synced', lastAction: null };

export function useSyncStatus(workspaceId: string | null) {
  const [status, setStatus] = useState<SyncStatus>(DEFAULT_STATUS);

  const loadStatus = useCallback(async () => {
    if (!workspaceId) return;
    try {
      // Check if .jamo/ directory exists first to avoid noisy gRPC errors.
      const dir = await window.jamo.listDirectory(workspaceId, '.jamo').catch(() => null);
      if (!dir || !dir.entries.some((e) => e.name === 'sync-status.json')) {
        setStatus(DEFAULT_STATUS);
        return;
      }
      const res = await window.jamo.readFile(workspaceId, SYNC_FILE);
      const parsed = JSON.parse(res.content);
      setStatus(parsed);
    } catch {
      setStatus(DEFAULT_STATUS);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const setMode = useCallback(async (mode: SyncMode, lastAction: string | null) => {
    if (!workspaceId) return;
    const newStatus: SyncStatus = { mode, lastAction };
    setStatus(newStatus);
    try {
      await window.jamo.writeFile(workspaceId, SYNC_FILE, JSON.stringify(newStatus, null, 2));
    } catch (err) {
      console.error('Failed to save sync status:', err);
    }
  }, [workspaceId]);

  return {
    mode: status.mode,
    lastAction: status.lastAction,
    setMode,
    isSynced: status.mode === 'synced',
    isCreatorMode: status.mode === 'creator_mode',
    isCodeMode: status.mode === 'code_mode',
  };
}
