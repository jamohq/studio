import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastVariant = 'default' | 'success' | 'error';

interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

// ---------------------------------------------------------------------------
// gRPC / common error mapping
// ---------------------------------------------------------------------------

const ERROR_PATTERNS: [RegExp, string][] = [
  [/UNAVAILABLE/i, 'The engine is not reachable. Is it running?'],
  [/DEADLINE_EXCEEDED/i, 'The request timed out. Please try again.'],
  [/UNAUTHENTICATED/i, 'Authentication failed. Please restart the app.'],
  [/PERMISSION_DENIED/i, 'You do not have permission to perform this action.'],
  [/NOT_FOUND/i, 'The requested resource was not found.'],
  [/ALREADY_EXISTS/i, 'This resource already exists.'],
  [/RESOURCE_EXHAUSTED/i, 'Too many requests. Please wait a moment.'],
  [/INTERNAL/i, 'An internal error occurred. Please try again.'],
  [/ECONNREFUSED/i, 'Could not connect to the engine.'],
  [/ETIMEDOUT/i, 'Connection timed out.'],
  [/fetch failed/i, 'Network request failed. Check your connection.'],
];

function mapErrorMessage(message: string): string {
  for (const [pattern, friendly] of ERROR_PATTERNS) {
    if (pattern.test(message)) return friendly;
  }
  return message;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Individual Toast
// ---------------------------------------------------------------------------

const AUTO_DISMISS_MS = 5000;

const variantStyles: Record<ToastVariant, string> = {
  default: 'border-border bg-background-surface text-foreground',
  success: 'border-success/30 bg-background-surface text-foreground',
  error: 'border-destructive/30 bg-background-surface text-foreground',
};

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  default: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-accent">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  ),
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-success">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8.5L7 10.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-destructive">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6L10 10M10 6L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-3 shadow-lg transition-all duration-200',
        variantStyles[toast.variant],
        exiting ? 'translate-x-2 opacity-0' : 'translate-x-0 opacity-100',
      )}
      role="alert"
    >
      <div className="mt-0.5">{variantIcon[toast.variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-xs leading-snug text-foreground-muted">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 text-foreground-dim hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((input: ToastInput) => {
    const variant = input.variant ?? 'default';
    const title = variant === 'error' ? mapErrorMessage(input.title) : input.title;
    const description =
      variant === 'error' && input.description ? mapErrorMessage(input.description) : input.description;

    const id = `toast-${++idCounter}`;
    setToasts((prev) => [...prev, { id, title, description, variant }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
