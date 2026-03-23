import React, { useState, useCallback, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'jamo-hints-seen';

function loadSeenHints(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveSeenHint(id: string) {
  const seen = loadSeenHints();
  seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

export function resetAllHints() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// HintTooltip component
// ---------------------------------------------------------------------------

interface HintTooltipProps {
  /** Unique hint identifier for persistence. */
  id: string;
  /** Tooltip content text. */
  content: string;
  /** Which side to show the tooltip on. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** The element to attach the hint to. Rendered as children. */
  children: React.ReactNode;
  /** If true, never show (e.g. while guided tour is active). */
  disabled?: boolean;
}

export default function HintTooltip({
  id,
  content,
  side = 'bottom',
  children,
  disabled = false,
}: HintTooltipProps) {
  const [seen, setSeen] = useState(() => loadSeenHints().has(id));
  const [open, setOpen] = useState(false);

  // Mark as seen when the tooltip opens.
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && !seen) {
        setSeen(true);
        saveSeenHint(id);
      }
    },
    [id, seen],
  );

  // Also dismiss hints after the user has been in the app for a while.
  useEffect(() => {
    if (seen) return;
    const timer = setTimeout(() => {
      setSeen(true);
      saveSeenHint(id);
    }, 120_000); // 2 minutes
    return () => clearTimeout(timer);
  }, [id, seen]);

  if (disabled || seen) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <div className="relative inline-flex">
            {children}
            {/* Pulsing indicator dot */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[240px] text-[12px] leading-relaxed bg-background-surface border-border text-foreground"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Hint definitions
// ---------------------------------------------------------------------------

export interface HintDef {
  id: string;
  content: string;
  side: 'top' | 'bottom' | 'left' | 'right';
}

export const HINTS: Record<string, HintDef> = {
  creatorBtn: {
    id: 'hint-creator-btn',
    content: 'Start here! Describe your app in the Design panel — this is the blueprint for code generation.',
    side: 'right',
  },
  explorerBtn: {
    id: 'hint-explorer-btn',
    content: 'Browse your project files. After building, your generated code appears here.',
    side: 'right',
  },
  changesBtn: {
    id: 'hint-changes-btn',
    content: 'Review and save your changes. AI auto-commits after actions, but you can save manually too.',
    side: 'right',
  },
  chatBtn: {
    id: 'hint-chat-btn',
    content: 'Chat with AI about your code. It knows your project context and can make changes.',
    side: 'bottom',
  },
  runBtn: {
    id: 'hint-run-btn',
    content: 'Preview your app by running "make run". Works after you\'ve built your project.',
    side: 'bottom',
  },
  buildCode: {
    id: 'hint-build-code',
    content: 'Generate application code from your designs. Fill in design sections first for best results.',
    side: 'top',
  },
  terminalBtn: {
    id: 'hint-terminal-btn',
    content: 'Open the terminal to see AI build output and run commands.',
    side: 'bottom',
  },
};
