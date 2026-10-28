import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScrollableTabsList } from './scrollable-tabslist';

function setScrollMetrics(
  el: HTMLElement,
  { scrollLeft = 0, scrollWidth = 0, clientWidth = 0 }: { scrollLeft?: number; scrollWidth?: number; clientWidth?: number },
) {
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, configurable: true });
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
}

describe('ScrollableTabsList', () => {
  it('renders the children', () => {
    render(<ScrollableTabsList><span>tab</span></ScrollableTabsList>);
    expect(screen.getByText('tab')).toBeInTheDocument();
  });

  it('hides both arrows when the content fits without overflow', () => {
    render(<ScrollableTabsList><span>tab</span></ScrollableTabsList>);
    expect(screen.getByLabelText('Scroll left')).toHaveClass('invisible');
    expect(screen.getByLabelText('Scroll right')).toHaveClass('invisible');
  });

  it('shows the right arrow when the content overflows, and scrolls right on click', async () => {
    const user = userEvent.setup();
    render(<ScrollableTabsList><span>tab</span></ScrollableTabsList>);
    const track = screen.getByText('tab').parentElement as HTMLElement;
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;
    setScrollMetrics(track, { scrollLeft: 0, scrollWidth: 500, clientWidth: 200 });
    fireEvent.scroll(track);

    expect(screen.getByLabelText('Scroll right')).not.toHaveClass('invisible');
    expect(screen.getByLabelText('Scroll left')).toHaveClass('invisible');

    await user.click(screen.getByLabelText('Scroll right'));
    expect(scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
  });

  it('shows the left arrow once scrolled away from the start, and scrolls left on click', async () => {
    const user = userEvent.setup();
    render(<ScrollableTabsList><span>tab</span></ScrollableTabsList>);
    const track = screen.getByText('tab').parentElement as HTMLElement;
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;
    setScrollMetrics(track, { scrollLeft: 300, scrollWidth: 500, clientWidth: 200 });
    fireEvent.scroll(track);

    expect(screen.getByLabelText('Scroll left')).not.toHaveClass('invisible');

    await user.click(screen.getByLabelText('Scroll left'));
    expect(scrollBy).toHaveBeenCalledWith({ left: -200, behavior: 'smooth' });
  });

  it('recalculates the arrows on window resize', () => {
    render(<ScrollableTabsList><span>tab</span></ScrollableTabsList>);
    const track = screen.getByText('tab').parentElement as HTMLElement;
    setScrollMetrics(track, { scrollLeft: 0, scrollWidth: 500, clientWidth: 200 });
    fireEvent(window, new Event('resize'));
    expect(screen.getByLabelText('Scroll right')).not.toHaveClass('invisible');
  });
});
