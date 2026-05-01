import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const TestButton = () => {
  return <button type="button">Open assistant</button>;
};

describe('react testing setup', () => {
  it('renders a React component', () => {
    render(<TestButton />);

    expect(
      screen.getByRole('button', { name: /open assistant/i }),
    ).toBeInTheDocument();
  });
});
