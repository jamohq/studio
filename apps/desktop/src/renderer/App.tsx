import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Theme, ThemeContext } from './theme';
import WelcomePage, { RecentWorkspace } from './components/WelcomePage';
import ActivityBar, { SidePanel } from './components/ActivityBar';
import ExplorerPanel from './components/ExplorerPanel';
import CreatorPanel from './components/CreatorPanel';
import CanvasPanel from './canvas/CanvasPanel';
import RichTextPanel from './richtext/RichTextPanel';
import TerminalPanel from './components/TerminalPanel';
import ActionsPanel from './components/ActionsPanel';
import ChangesPanel from './components/ChangesPanel';
import { useSyncStatus } from './hooks/useSyncStatus';
import { createPortfolioScaffold } from './scaffold';
import { findSection } from './sections';
import { Button } from './components/ui/button';
import { cn } from '@/lib/utils';

/** UTF-8 safe base64 encode (btoa only handles Latin1). */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

function saveRecentWorkspace(path: string) {
  const name = path.split('/').pop() || path;
  const existing = loadRecentWorkspaces().filter((w) => w.path !== path);
  const updated = [{ path, name, openedAt: Date.now() }, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_WS_KEY, JSON.stringify(updated));
  return updated;
}

export default function App() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel | null>('explorer');
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [creatorRefreshKey, setCreatorRefreshKey] = useState(0);
  const [terminalSessionId, setTerminalSessionId] = useState<string | null>(null);
  const pendingActionRef = useRef<string | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>(loadRecentWorkspaces);
  const { mode: syncMode, lastAction, setMode: setSyncMode } = useSyncStatus(workspaceId);

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('jamo-theme') as Theme) || 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('jamo-theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  // Set initial dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const themeCtx = useMemo(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  const openWorkspace = useCallback(async (dirPath?: string) => {
    try {
      const path = dirPath || await window.jamo.selectDirectory();
      if (!path) return;
      const res = await window.jamo.openWorkspace(path);
      setWorkspaceId(res.workspaceId);
      setRecentWorkspaces(saveRecentWorkspace(res.path));
      setOpenFile(null);
      setActivePanel('explorer');
    } catch (err: any) {
      console.error('Failed to open workspace:', err);
    }
  }, []);

  const createProject = useCallback(async (parentPath: string, name: string) => {
    try {
      const projectPath = await window.jamo.createProjectDirectory(parentPath, name);
      const res = await window.jamo.openWorkspace(projectPath);
      setWorkspaceId(res.workspaceId);
      setRecentWorkspaces(saveRecentWorkspace(res.path));
      setOpenFile(null);
      setActivePanel('creator');

      // Scaffold sample creator files.
      const files = createPortfolioScaffold();
      for (const file of files) {
        await window.jamo.writeFile(res.workspaceId, file.path, JSON.stringify(file.content, null, 2));
      }

      // Init git with the scaffolded files.
      await window.jamo.gitInit(res.workspaceId);
      await window.jamo.gitCommit(res.workspaceId, 'Initial project scaffold');

      setCreatorRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error('Failed to create project:', err);
    }
  }, []);

  const handleOpenCreatorFile = useCallback((relPath: string) => {
    setOpenFile(relPath);
  }, []);

  const handleCloseFile = useCallback(() => {
    setOpenFile(null);
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleFileRenamed = useCallback((oldPath: string, newPath: string) => {
    setOpenFile(newPath);
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleFileDeleted = useCallback((relPath: string) => {
    if (openFile === relPath || openFile?.startsWith(relPath + '/')) {
      setOpenFile(null);
    }
    setCreatorRefreshKey((k) => k + 1);
  }, [openFile]);

  const handleToggleTerminal = useCallback(() => {
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

  const handleModeChange = useCallback((mode: 'synced' | 'creator_mode' | 'code_mode', actionId: string) => {
    setSyncMode(mode, actionId);
  }, [setSyncMode]);

  const handleCommit = useCallback(() => {
    setSyncMode('synced', null);
  }, [setSyncMode]);

  const sendActionToTerminal = useCallback((prompt: string) => {
    if (!terminalOpen) {
      pendingActionRef.current = prompt;
      setTerminalMounted(true);
      setTerminalOpen(true);
    } else if (terminalSessionId) {
      window.jamo.sendTerminalInput(terminalSessionId, toBase64(prompt + '\r'));
    } else {
      pendingActionRef.current = prompt;
    }
  }, [terminalOpen, terminalSessionId]);

  // When terminal session becomes ready and there's a pending action, send it
  useEffect(() => {
    if (terminalSessionId && pendingActionRef.current) {
      const prompt = pendingActionRef.current;
      pendingActionRef.current = null;
      const timer = setTimeout(() => {
        window.jamo.sendTerminalInput(terminalSessionId, toBase64(prompt + '\r'));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [terminalSessionId]);

  // Auto-refresh creator panel while terminal is active
  useEffect(() => {
    if (!terminalSessionId) return;
    const interval = setInterval(() => {
      setCreatorRefreshKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [terminalSessionId]);

  // No workspace -> welcome screen
  if (!workspaceId) {
    return (
      <ThemeContext.Provider value={themeCtx}>
        <div className="flex h-screen bg-background text-foreground">
          <WelcomePage
            onOpenFolder={() => openWorkspace()}
            onCreateProject={createProject}
            recentWorkspaces={recentWorkspaces}
            onOpenRecent={(path) => openWorkspace(path)}
          />
        </div>
      </ThemeContext.Provider>
    );
  }

  // Workspace open -> VS Code-like layout
  return (
    <ThemeContext.Provider value={themeCtx}>
      <div className="flex h-screen bg-background text-foreground">
        {/* Activity Bar */}
        <ActivityBar activePanel={activePanel} onPanelChange={(p) => setActivePanel(activePanel === p ? null : p)} />

        {/* Side Panel */}
        {activePanel && (
          <div className="w-60 border-r overflow-hidden shrink-0">
            {activePanel === 'explorer' && <ExplorerPanel workspaceId={workspaceId} />}
            {activePanel === 'creator' && <CreatorPanel workspaceId={workspaceId} activeFile={openFile} onOpenFile={handleOpenCreatorFile} onFileDeleted={handleFileDeleted} refreshKey={creatorRefreshKey} />}
            {activePanel === 'actions' && <ActionsPanel workspaceId={workspaceId} onExecuteAction={sendActionToTerminal} terminalReady={!!terminalSessionId} syncMode={syncMode} onModeChange={handleModeChange} />}
            {activePanel === 'changes' && <ChangesPanel workspaceId={workspaceId} syncMode={syncMode} lastAction={lastAction} onCommit={handleCommit} />}
          </div>
        )}

        {/* Main editor area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top bar */}
          <div className="flex items-center px-3 py-1 border-b gap-2 shrink-0">
            <span className="text-xs text-foreground-muted">
              {openFile
                ? (findSection(openFile)?.label ?? openFile.split('/').pop()?.replace(/\.json$/, ''))
                : 'Jamo Studio'}
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openWorkspace()}
              title="Open Folder"
              className="text-foreground-muted text-[11px] h-7"
            >
              Open Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleTerminal}
              title={terminalOpen ? 'Close terminal' : 'Open terminal'}
              className={cn(
                'text-[11px] h-7',
                terminalOpen && 'text-accent',
              )}
            >
              Terminal
            </Button>
          </div>

          {/* Editor + Terminal side-by-side */}
          <div className="flex-1 flex overflow-hidden">
            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              {openFile ? (
                findSection(openFile)?.editorType === 'richtext' ? (
                  <RichTextPanel workspaceId={workspaceId} filePath={openFile} onClose={handleCloseFile} readOnly={syncMode === 'code_mode' && openFile.startsWith('.jamo/creator/')} />
                ) : (
                  <CanvasPanel workspaceId={workspaceId} filePath={openFile} onClose={handleCloseFile} onFileRenamed={handleFileRenamed} readOnly={syncMode === 'code_mode' && openFile.startsWith('.jamo/creator/')} />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-foreground-dim text-[13px]">
                  Select a file from the sidebar to get started
                </div>
              )}
            </div>

            {/* Terminal (right side - stays mounted once opened to preserve session) */}
            {terminalMounted && (
              <div
                className={cn('shrink-0 overflow-hidden', !terminalOpen && 'hidden')}
                style={{ width: 480 }}
              >
                <TerminalPanel workspaceId={workspaceId} onClose={() => setTerminalOpen(false)} onSessionReady={handleSessionReady} onSessionEnd={handleSessionEnd} />
              </div>
            )}
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
