import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MentionText } from '../MentionText';

describe('MentionText', () => {
  it('renders mentions as styled spans', () => {
    render(<MentionText text="hello @alice and @bob" />);
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('highlights self-mention differently', () => {
    render(<MentionText text="hey @alice" currentUsername="alice" />);
    const node = screen.getByText('@alice');
    expect(node.className).toMatch(/bg-primary\/20/);
  });

  it('treats @here as a group token', () => {
    render(<MentionText text="@here heads up" />);
    expect(screen.getByText('@here').className).toMatch(/bg-warning/);
  });

  it('does not match emails', () => {
    render(<MentionText text="ping alice@example.com" />);
    expect(screen.queryByText(/@example\.com/)).toBeNull();
  });
});
