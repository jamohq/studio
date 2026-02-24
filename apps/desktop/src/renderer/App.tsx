import React, { useState, useMemo, useCallback } from 'react';
import { Theme, ThemeContext, themeTokens } from './theme';
import WelcomePage, { RecentWorkspace } from './components/WelcomePage';
import ActivityBar, { SidePanel } from './components/ActivityBar';
import ExplorerPanel from './components/ExplorerPanel';
import CreatorPanel from './components/CreatorPanel';
import CanvasPanel from './canvas/CanvasPanel';
import TerminalPanel from './components/TerminalPanel';

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
  const [openFile, setOpenFile] = useState<string | null>(null); // relative path to open canvas file
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [creatorRefreshKey, setCreatorRefreshKey] = useState(0);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>(loadRecentWorkspaces);

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('jamo-theme') as Theme) || 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('jamo-theme', next);
      return next;
    });
  }, []);

  const tokens = themeTokens[theme];

  const themeCtx = useMemo(
    () => ({ theme, tokens, toggleTheme }),
    [theme, tokens, toggleTheme],
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

  const handleOpenCreatorFile = useCallback((relPath: string) => {
    setOpenFile(relPath);
  }, []);

  const handleCloseFile = useCallback(() => {
    setOpenFile(null);
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleRenamed = useCallback(() => {
    setCreatorRefreshKey((k) => k + 1);
  }, []);

  const handleToggleTerminal = useCallback(() => {
    setTerminalOpen((prev) => !prev);
  }, []);

  // No workspace → welcome screen
  if (!workspaceId) {
    return (
      <ThemeContext.Provider value={themeCtx}>
        <div style={{ display: 'flex', height: '100vh', background: tokens.bg, color: tokens.text }}>
          <WelcomePage
            onOpenFolder={() => openWorkspace()}
            recentWorkspaces={recentWorkspaces}
            onOpenRecent={(path) => openWorkspace(path)}
          />
        </div>
      </ThemeContext.Provider>
    );
  }

  // Workspace open → VS Code-like layout
  return (
    <ThemeContext.Provider value={themeCtx}>
      <div style={{ display: 'flex', height: '100vh', background: tokens.bg, color: tokens.text }}>
        {/* Activity Bar */}
        <ActivityBar activePanel={activePanel} onPanelChange={(p) => setActivePanel(activePanel === p ? null : p)} />

        {/* Side Panel */}
        {activePanel && (
          <div style={{ width: 240, borderRight: `1px solid ${tokens.border}`, overflow: 'hidden', flexShrink: 0 }}>
            {activePanel === 'explorer' && <ExplorerPanel workspaceId={workspaceId} />}
            {activePanel === 'creator' && <CreatorPanel workspaceId={workspaceId} activeFile={openFile} onOpenFile={handleOpenCreatorFile} refreshKey={creatorRefreshKey} />}
          </div>
        )}

        {/* Main editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Top bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 12px',
            borderBottom: `1px solid ${tokens.border}`,
            gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: tokens.textMuted }}>
              {openFile ? openFile.split('/').pop()?.replace(/\.json$/, '') : 'Jamo Studio'}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => openWorkspace()}
              title="Open Folder"
              style={{ background: 'transparent', border: 'none', color: tokens.textMuted, cursor: 'pointer', fontSize: 11 }}
            >
              Open Folder
            </button>
            <button
              onClick={handleToggleTerminal}
              title={terminalOpen ? 'Close terminal' : 'Open terminal'}
              style={{
                background: 'transparent',
                border: `1px solid ${tokens.border}`,
                borderRadius: 4,
                color: terminalOpen ? tokens.accent : tokens.textMuted,
                cursor: 'pointer',
                fontSize: 11,
                padding: '2px 8px',
              }}
            >
              Terminal
            </button>
          </div>

          {/* Editor + Terminal side-by-side */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Editor */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {openFile ? (
                <CanvasPanel workspaceId={workspaceId} filePath={openFile} onClose={handleCloseFile} onRenamed={handleRenamed} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: tokens.textDim, fontSize: 13 }}>
                  Select a file from the sidebar to get started
                </div>
              )}
            </div>

            {/* Terminal (right side) */}
            {terminalOpen && (
              <div style={{ width: 480, flexShrink: 0, overflow: 'hidden' }}>
                <TerminalPanel workspaceId={workspaceId} onClose={() => setTerminalOpen(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
