import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  running?: boolean;
  onCancel?: () => void;
  openFile?: string | null;
}

export default function ChatInput({ onSend, disabled, running, onCancel, openFile }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && running && onCancel) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, running, onCancel]
  );

  return (
    <div className="border-t px-3 py-2">
      {openFile && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] text-foreground-dim">Context:</span>
          <span className="text-[10px] text-foreground-muted bg-background-deep px-1.5 py-0.5 rounded truncate max-w-[200px]">
            {openFile.split('/').pop()}
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={running ? 'Press Escape or click Stop to cancel...' : 'Ask about your code...'}
          disabled={disabled && !running}
          readOnly={running}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-background-deep border rounded-md px-3 py-2',
            'text-[13px] text-foreground placeholder:text-foreground-dim',
            'focus:outline-none focus:ring-1 focus:ring-accent/50',
            'min-h-[36px] max-h-[150px]',
            disabled && !running && 'opacity-50 cursor-not-allowed'
          )}
        />
        {running ? (
          <button
            onClick={onCancel}
            className={cn(
              'self-end px-3 py-2 rounded-md text-[12px] font-medium shrink-0',
              'bg-red-500/15 text-red-400 border border-red-500/25',
              'hover:bg-red-500/25 transition-colors'
            )}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={cn(
              'self-end px-3 py-2 rounded-md text-[12px] font-medium shrink-0',
              'bg-accent text-white',
              'hover:bg-accent/90 transition-colors',
              (disabled || !value.trim()) && 'opacity-50 cursor-not-allowed'
            )}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
