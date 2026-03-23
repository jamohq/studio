import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGuidedTour, TOUR_STEPS } from '../hooks/useGuidedTour';

const mockSetActivePanel = vi.fn();

function renderTourHook() {
  return renderHook(() => useGuidedTour({ setActivePanel: mockSetActivePanel }));
}

describe('useGuidedTour', () => {
  beforeEach(() => {
    mockSetActivePanel.mockClear();
  });

  it('auto-starts the tour on first visit', () => {
    const { result } = renderTourHook();
    expect(result.current.active).toBe(true);
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.currentStep).toEqual(TOUR_STEPS[0]);
    expect(result.current.totalSteps).toBe(TOUR_STEPS.length);
  });

  it('advances to the next step on next()', () => {
    const { result } = renderTourHook();
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.currentStep).toEqual(TOUR_STEPS[1]);
  });

  it('goes back on back()', () => {
    const { result } = renderTourHook();
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(2);
    act(() => result.current.back());
    expect(result.current.stepIndex).toBe(1);
  });

  it('does not go below step 0', () => {
    const { result } = renderTourHook();
    act(() => result.current.back());
    expect(result.current.stepIndex).toBe(0);
  });

  it('completes the tour when next() is called on the last step', () => {
    const { result } = renderTourHook();
    // Advance to the last step
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      act(() => result.current.next());
    }
    expect(result.current.stepIndex).toBe(TOUR_STEPS.length - 1);
    // Complete
    act(() => result.current.next());
    expect(result.current.active).toBe(false);
    expect(result.current.hasSeenTour).toBe(true);
  });

  it('persists completion to localStorage', () => {
    const { result } = renderTourHook();
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      act(() => result.current.next());
    }
    expect(localStorage.getItem('jamo-guided-tour')).toBeTruthy();
    const state = JSON.parse(localStorage.getItem('jamo-guided-tour')!);
    expect(state.completed).toBe(true);
  });

  it('does not auto-start when tour was previously completed', () => {
    localStorage.setItem('jamo-guided-tour', JSON.stringify({ completed: true, dismissed: false }));
    const { result } = renderTourHook();
    expect(result.current.active).toBe(false);
    expect(result.current.hasSeenTour).toBe(true);
  });

  it('skip() dismisses the tour and persists', () => {
    const { result } = renderTourHook();
    act(() => result.current.skip());
    expect(result.current.active).toBe(false);
    expect(result.current.hasSeenTour).toBe(true);
    const state = JSON.parse(localStorage.getItem('jamo-guided-tour')!);
    expect(state.dismissed).toBe(true);
  });

  it('does not auto-start when tour was previously dismissed', () => {
    localStorage.setItem('jamo-guided-tour', JSON.stringify({ completed: false, dismissed: true }));
    const { result } = renderTourHook();
    expect(result.current.active).toBe(false);
  });

  it('start() re-activates the tour after completion', () => {
    localStorage.setItem('jamo-guided-tour', JSON.stringify({ completed: true, dismissed: false }));
    const { result } = renderTourHook();
    expect(result.current.active).toBe(false);
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.stepIndex).toBe(0);
  });

  it('migrates from legacy onboarding key', () => {
    localStorage.setItem('jamo-has-seen-onboarding', '1');
    const { result } = renderTourHook();
    expect(result.current.active).toBe(false);
    expect(result.current.hasSeenTour).toBe(true);
    // Should have migrated to new storage
    const state = JSON.parse(localStorage.getItem('jamo-guided-tour')!);
    expect(state.completed).toBe(true);
  });

  it('sets legacy key on completion for backward compatibility', () => {
    const { result } = renderTourHook();
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      act(() => result.current.next());
    }
    expect(localStorage.getItem('jamo-has-seen-onboarding')).toBe('1');
  });

  it('calls setActivePanel when step requires a panel', () => {
    const { result } = renderTourHook();
    // Step 0 has no requiresPanel
    expect(mockSetActivePanel).not.toHaveBeenCalled();
    // Step 1 (sections) requires 'creator' panel
    act(() => result.current.next());
    expect(mockSetActivePanel).toHaveBeenCalledWith('creator');
  });

  it('currentStep is null when tour is not active', () => {
    localStorage.setItem('jamo-guided-tour', JSON.stringify({ completed: true, dismissed: false }));
    const { result } = renderTourHook();
    expect(result.current.currentStep).toBeNull();
  });

  it('TOUR_STEPS all have unique IDs', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('TOUR_STEPS all have valid selectors', () => {
    for (const step of TOUR_STEPS) {
      expect(step.targetSelector).toMatch(/^\[data-tour="[^"]+"\]$/);
    }
  });
});
