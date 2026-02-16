import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LinkifiedText, splitTextToLinks } from '../LinkifiedText';

describe('splitTextToLinks', () => {
  it('parses links with and without protocol', () => {
    const parts = splitTextToLinks('Текст bampadu.ru/form и https://example.com/path');

    expect(parts).toEqual([
      { type: 'text', value: 'Текст ' },
      { type: 'link', value: 'bampadu.ru/form', href: 'https://bampadu.ru/form' },
      { type: 'text', value: ' и ' },
      { type: 'link', value: 'https://example.com/path', href: 'https://example.com/path' },
    ]);
  });

  it('does not convert email to link', () => {
    const parts = splitTextToLinks('Почта user@example.com');

    expect(parts).toEqual([{ type: 'text', value: 'Почта user@example.com' }]);
  });
});

describe('LinkifiedText', () => {
  it('renders links that open in new tab', () => {
    render(<LinkifiedText text="Открой bampadu.ru/form" />);

    const link = screen.getByRole('link', { name: 'bampadu.ru/form' });
    expect(link).toHaveAttribute('href', 'https://bampadu.ru/form');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders fallback for empty text', () => {
    render(<LinkifiedText text="" fallback="Нет текста" />);

    expect(screen.getByText('Нет текста')).toBeInTheDocument();
  });
});
