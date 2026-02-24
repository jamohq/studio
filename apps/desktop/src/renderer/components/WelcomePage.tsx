import React from 'react';
import { useTheme } from '../theme';

interface RecentWorkspace {
  path: string;
  name: string;
  openedAt: number;
}

interface WelcomePageProps {
  onOpenFolder: () => void;
  recentWorkspaces: RecentWorkspace[];
  onOpenRecent: (path: string) => void;
}

export type { RecentWorkspace };

export default function WelcomePage({ onOpenFolder, recentWorkspaces, onOpenRecent }: WelcomePageProps) {
  const { tokens } = useTheme();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 24,
      padding: 40,
    }}>
      {/* Logo / Title */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1, color: tokens.text }}>
          J
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: tokens.text, marginTop: 4 }}>
          Jamo Studio
        </div>
      </div>

      {/* Primary action */}
      <button
        onClick={onOpenFolder}
        style={{
          padding: '12px 48px',
          background: tokens.accent,
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          minWidth: 280,
        }}
      >
        Open Folder
      </button>

      {/* Recent workspaces */}
      {recentWorkspaces.length > 0 && (
        <div style={{ width: '100%', maxWidth: 400, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tokens.textMuted, marginBottom: 12 }}>
            Workspaces
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentWorkspaces.map((ws) => {
              const parts = ws.path.split('/');
              const parent = parts.length > 1 ? parts.slice(0, -1).join('/').replace(/^\/Users\/[^/]+/, '~') : '';
              return (
                <button
                  key={ws.path}
                  onClick={() => onOpenRecent(ws.path)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 16px',
                    background: 'transparent',
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 6,
                    color: tokens.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{ws.name}</span>
                  <span style={{ fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>{parent}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
