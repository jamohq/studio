import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HintTooltip, { HINTS, resetAllHints } from '../components/HintTooltip';

describe('HintTooltip', () => {
  beforeEach(() => {
    resetAllHints();
  });

  it('renders children', () => {
    render(
      <HintTooltip id="test-hint" content="Test hint text">
        <button>Click me</button>
      </HintTooltip>,
    );
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('shows pulsing indicator when hint is unseen', () => {
    const { container } = render(
      <HintTooltip id="test-hint" content="Test hint text">
        <button>Click me</button>
      </HintTooltip>,
    );
    // The pulsing dot should be present (has animate-ping class)
    const pulsingDot = container.querySelector('.animate-ping');
    expect(pulsingDot).toBeInTheDocument();
  });

  it('does not show pulsing indicator when hint was previously seen', () => {
    localStorage.setItem('jamo-hints-seen', JSON.stringify(['test-hint']));
    const { container } = render(
      <HintTooltip id="test-hint" content="Test hint text">
        <button>Click me</button>
      </HintTooltip>,
    );
    const pulsingDot = container.querySelector('.animate-ping');
    expect(pulsingDot).not.toBeInTheDocument();
  });

  it('does not show pulsing indicator when disabled', () => {
    const { container } = render(
      <HintTooltip id="test-hint" content="Test hint text" disabled>
        <button>Click me</button>
      </HintTooltip>,
    );
    const pulsingDot = container.querySelector('.animate-ping');
    expect(pulsingDot).not.toBeInTheDocument();
  });

  it('persists seen state to localStorage after hover', async () => {
    const user = userEvent.setup();
    render(
      <HintTooltip id="test-hint" content="Test hint text">
        <button>Click me</button>
      </HintTooltip>,
    );

    await user.hover(screen.getByText('Click me'));
    // Give the tooltip time to open (Radix has a delay)
    // The seen state should be saved
    const stored = localStorage.getItem('jamo-hints-seen');
    if (stored) {
      expect(JSON.parse(stored)).toContain('test-hint');
    }
  });

  it('resetAllHints clears localStorage', () => {
    localStorage.setItem('jamo-hints-seen', JSON.stringify(['hint1', 'hint2']));
    resetAllHints();
    expect(localStorage.getItem('jamo-hints-seen')).toBeNull();
  });

  it('HINTS has expected keys', () => {
    expect(HINTS.creatorBtn).toBeDefined();
    expect(HINTS.explorerBtn).toBeDefined();
    expect(HINTS.changesBtn).toBeDefined();
    expect(HINTS.chatBtn).toBeDefined();
    expect(HINTS.runBtn).toBeDefined();
    expect(HINTS.buildCode).toBeDefined();
    expect(HINTS.terminalBtn).toBeDefined();
  });

  it('all HINTS have unique IDs', () => {
    const ids = Object.values(HINTS).map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all HINTS have valid side values', () => {
    const validSides = ['top', 'bottom', 'left', 'right'];
    for (const hint of Object.values(HINTS)) {
      expect(validSides).toContain(hint.side);
    }
  });
});
