import React from 'react';
import { Code2, Paintbrush, GitBranch, Sun, Moon, HelpCircle } from 'lucide-react';
import { useTheme } from '../theme';
import { Button } from './ui/button';
import HintTooltip, { HINTS } from './HintTooltip';
import { cn } from '@/lib/utils';

export type SidePanel = 'explorer' | 'creator' | 'source-control';

/** Tour target attribute names for each panel button. */
const TOUR_ATTRS: Partial<Record<SidePanel, string>> = {
  explorer: 'explorer-btn',
  creator: 'creator-btn',
  'source-control': 'source-control-btn',
};

/** Hint definitions keyed by panel name. */
const PANEL_HINTS: Partial<Record<SidePanel, typeof HINTS[keyof typeof HINTS]>> = {
  creator: HINTS.creatorBtn,
  explorer: HINTS.explorerBtn,
  'source-control': HINTS.changesBtn,
};

interface ActivityBarProps {
  activePanel: SidePanel | null;
  onPanelChange: (panel: SidePanel) => void;
  /** Hide hints while guided tour is active. */
  tourActive?: boolean;
  /** Callback to restart the guided tour. */
  onStartTour?: () => void;
}

export default function ActivityBar({ activePanel, onPanelChange, tourActive, onStartTour }: ActivityBarProps) {
  const { theme, toggleTheme } = useTheme();

  const items: { panel: SidePanel; icon: React.ReactNode; title: string }[] = [
    { panel: 'explorer', icon: <Code2 className="h-[22px] w-[22px]" />, title: 'Files' },
    { panel: 'creator', icon: <Paintbrush className="h-[22px] w-[22px]" />, title: 'Design' },
    { panel: 'source-control', icon: <GitBranch className="h-[22px] w-[22px]" />, title: 'Source Control' },
  ];

  return (
    <div className="w-12 bg-background-surface border-r flex flex-col items-center pt-2">
      {items.map(({ panel, icon, title }) => {
        const isActive = activePanel === panel;
        const tourAttr = TOUR_ATTRS[panel];
        const hint = PANEL_HINTS[panel];

        const btn = (
          <Button
            key={panel}
            variant="ghost"
            size="icon"
            onClick={() => onPanelChange(panel)}
            title={title}
            data-tour={tourAttr}
            className={cn(
              'w-10 h-10 mb-1 rounded-none border-l-2',
              isActive
                ? 'border-l-accent opacity-100'
                : 'border-l-transparent opacity-50',
            )}
          >
            {icon}
          </Button>
        );

        if (hint && !tourActive) {
          return (
            <HintTooltip key={panel} id={hint.id} content={hint.content} side={hint.side}>
              {btn}
            </HintTooltip>
          );
        }

        return <React.Fragment key={panel}>{btn}</React.Fragment>;
      })}

      <div className="flex-1" />

      {onStartTour && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onStartTour}
          title="Replay guided tour"
          className="w-10 h-10 mb-1 opacity-40 hover:opacity-70"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="w-10 h-10 mb-2 opacity-50"
      >
        {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </Button>
    </div>
  );
}
