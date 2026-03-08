import { useState, useCallback, useRef } from 'react';
import { createPortfolioScaffold, createEmptyScaffold, ScaffoldResult } from '../scaffold';

export interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

const RECENT_WS_KEY = 'jamo-recent-workspaces';
const MAX_RECENT = 10;

function loadRecentWorkspaces(): RecentWorkspace[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_WS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentWorkspace(path: string): RecentWorkspace[] {
  const name = path.split('/').pop() || path;
  const existing = loadRecentWorkspaces().filter((w) => w.path !== path);
  const updated = [{ path, name, openedAt: Date.now() }, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_WS_KEY, JSON.stringify(updated));
  return updated;
}

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>(loadRecentWorkspaces);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [creatorRefreshKey, setCreatorRefreshKey] = useState(0);

  const openWorkspace = useCallback(async (dirPath?: string) => {
    try {
      const path = dirPath || await window.jamo.selectDirectory();
      if (!path) return;
      const res = await window.jamo.openWorkspace(path);
      setWorkspaceId(res.workspaceId);
      setRecentWorkspaces(saveRecentWorkspace(res.path));
      setOpenFile(null);
    } catch (err: any) {
      console.error('Failed to open project:', err);
    }
  }, []);

  const scaffoldAndOpen = useCallback(async (dirPath: string, scaffold: ScaffoldResult) => {
    try {
      const res = await window.jamo.openWorkspace(dirPath);
      setWorkspaceId(res.workspaceId);
      setRecentWorkspaces(saveRecentWorkspace(res.path));
      setOpenFile(null);

      for (const file of scaffold.files) {
        await window.jamo.writeFile(res.workspaceId, file.path, JSON.stringify(file.content, null, 2));
      }

      for (const bin of scaffold.binaryFiles) {
        try {
          const resp = await fetch(bin.fetchUrl);
          const blob = await resp.blob();
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const b64 = btoa(binary);
          await window.jamo.writeFileBinary(res.workspaceId, bin.path, b64);
        } catch (err) {
          console.warn(`Failed to write binary file ${bin.path}:`, err);
        }
      }

      await window.jamo.gitInit(res.workspaceId);
      await window.jamo.gitCommit(res.workspaceId, 'Initial project scaffold');

      setCreatorRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error('Failed to create project:', err);
    }
  }, []);

  const createEmptyProject = useCallback((dirPath: string) => {
    return scaffoldAndOpen(dirPath, createEmptyScaffold());
  }, [scaffoldAndOpen]);

  const createSampleProject = useCallback((dirPath: string) => {
    return scaffoldAndOpen(dirPath, createPortfolioScaffold());
  }, [scaffoldAndOpen]);

  const handleOpenFile = useCallback((relPath: string) => {
    setOpenFile(relPath);
  }, []);

  const handleOpenCreatorFile = useCallback((relPath: string) => {
    setOpenFile(relPath);
  }, []);

  const handleCloseFile = useCallback(() => {
    setOpenFile(null);
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleFileRenamed = useCallback((_oldPath: string, newPath: string) => {
    setOpenFile(newPath);
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleFileDeleted = useCallback((relPath: string) => {
    setOpenFile((current) => {
      if (current === relPath || current?.startsWith(relPath + '/')) return null;
      return current;
    });
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const refreshCreator = useCallback(() => {
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  return {
    workspaceId,
    openFile,
    recentWorkspaces,
    creatorRefreshKey,
    openWorkspace,
    createEmptyProject,
    createSampleProject,
    handleOpenFile,
    handleOpenCreatorFile,
    handleCloseFile,
    handleFileRenamed,
    handleFileDeleted,
    refreshCreator,
  };
}
