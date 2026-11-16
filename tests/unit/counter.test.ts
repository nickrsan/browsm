import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import Counter from '@/lib/Counter.svelte';

describe('Counter.svelte (Svelte 5 Runes)', () => {
  it('renders with initial count 0', () => {
    render(Counter);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('count is 0');
  });

  it('increments count reactively on click', async () => {
    render(Counter);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    expect(button).toHaveTextContent('count is 1');

    await fireEvent.click(button);
    expect(button).toHaveTextContent('count is 2');
  });
});
