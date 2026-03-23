import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidedTour from '../components/GuidedTour';
import type { TourStep } from '../hooks/useGuidedTour';

const mockStep: TourStep = {
  id: 'test-step',
  targetSelector: '[data-tour="test-target"]',
  title: 'Test Step Title',
  body: 'This is a test step body.',
  placement: 'right',
};

const defaultProps = {
  active: true,
  step: mockStep,
  stepIndex: 0,
  totalSteps: 3,
  onNext: vi.fn(),
  onBack: vi.fn(),
  onSkip: vi.fn(),
};

describe('GuidedTour', () => {
  beforeEach(() => {
    // Create target element for spotlight
    const target = document.createElement('div');
    target.setAttribute('data-tour', 'test-target');
    target.style.position = 'fixed';
    target.style.top = '100px';
    target.style.left = '100px';
    target.style.width = '50px';
    target.style.height = '50px';
    document.body.appendChild(target);

    vi.clearAllMocks();
  });

  it('renders nothing when not active', () => {
    const { container } = render(<GuidedTour {...defaultProps} active={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when step is null', () => {
    const { container } = render(<GuidedTour {...defaultProps} step={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the step title and body', async () => {
    render(<GuidedTour {...defaultProps} />);
    // Wait for the measure timeout (80ms)
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Test Step Title')).toBeInTheDocument();
    expect(screen.getByText('This is a test step body.')).toBeInTheDocument();
  });

  it('shows step counter', async () => {
    render(<GuidedTour {...defaultProps} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('calls onNext when Next button is clicked', async () => {
    render(<GuidedTour {...defaultProps} />);
    await new Promise((r) => setTimeout(r, 100));
    fireEvent.click(screen.getByText('Next'));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when Skip tour is clicked', async () => {
    render(<GuidedTour {...defaultProps} />);
    await new Promise((r) => setTimeout(r, 100));
    fireEvent.click(screen.getByText('Skip tour'));
    expect(defaultProps.onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Back button is clicked on non-first step', async () => {
    render(<GuidedTour {...defaultProps} stepIndex={1} />);
    await new Promise((r) => setTimeout(r, 100));
    fireEvent.click(screen.getByText('Back'));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('does not show Back button on first step', async () => {
    render(<GuidedTour {...defaultProps} stepIndex={0} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('shows Done instead of Next on last step', async () => {
    render(<GuidedTour {...defaultProps} stepIndex={2} totalSteps={3} />);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('renders step dots matching totalSteps', async () => {
    const { container } = render(<GuidedTour {...defaultProps} totalSteps={5} />);
    await new Promise((r) => setTimeout(r, 100));
    // Each dot is a span with rounded-full class
    const dots = container.querySelectorAll('.rounded-full.h-1\\.5');
    expect(dots.length).toBe(5);
  });
});
