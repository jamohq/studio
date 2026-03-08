import React from 'react';
import { Code2, Paintbrush, Zap, GitBranch, Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export type SidePanel = 'explorer' | 'creator' | 'actions' | 'changes';

interface ActivityBarProps {
  activePanel: SidePanel | null;
  onPanelChange: (panel: SidePanel) => void;
}

export default function ActivityBar({ activePanel, onPanelChange }: ActivityBarProps) {
  const { theme, toggleTheme } = useTheme();

  const items: { panel: SidePanel; icon: React.ReactNode; title: string }[] = [
    { panel: 'explorer', icon: <Code2 className="h-[22px] w-[22px]" />, title: 'Files' },
    { panel: 'creator', icon: <Paintbrush className="h-[22px] w-[22px]" />, title: 'Design' },
    { panel: 'actions', icon: <Zap className="h-[22px] w-[22px]" />, title: 'Build' },
    { panel: 'changes', icon: <GitBranch className="h-[22px] w-[22px]" />, title: 'History' },
  ];

  return (
    <div className="w-12 bg-background-surface border-r flex flex-col items-center pt-2">
      {items.map(({ panel, icon, title }) => {
        const isActive = activePanel === panel;
        return (
          <Button
            key={panel}
            variant="ghost"
            size="icon"
            onClick={() => onPanelChange(panel)}
            title={title}
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
      })}

      <div className="flex-1" />

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
