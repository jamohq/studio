import React from 'react';
import { useTheme } from '../theme';

export type SidePanel = 'explorer' | 'creator';

interface ActivityBarProps {
  activePanel: SidePanel | null;
  onPanelChange: (panel: SidePanel) => void;
}

// Simple SVG icons
const CodeIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const CreatorIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

export default function ActivityBar({ activePanel, onPanelChange }: ActivityBarProps) {
  const { theme, tokens, toggleTheme } = useTheme();

  const items: { panel: SidePanel; Icon: typeof CodeIcon; title: string }[] = [
    { panel: 'explorer', Icon: CodeIcon, title: 'Explorer' },
    { panel: 'creator', Icon: CreatorIcon, title: 'Creator' },
  ];

  return (
    <div style={{
      width: 48,
      background: tokens.bgSurface,
      borderRight: `1px solid ${tokens.border}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 8,
    }}>
      {items.map(({ panel, Icon, title }) => {
        const isActive = activePanel === panel;
        return (
          <button
            key={panel}
            onClick={() => onPanelChange(panel)}
            title={title}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderLeft: isActive ? `2px solid ${tokens.accent}` : '2px solid transparent',
              cursor: 'pointer',
              opacity: isActive ? 1 : 0.5,
              marginBottom: 4,
            }}
          >
            <Icon color={tokens.text} />
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Theme toggle at bottom */}
      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          opacity: 0.5,
          marginBottom: 8,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {theme === 'dark' ? (
            <>
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </>
          ) : (
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          )}
        </svg>
      </button>
    </div>
  );
}
