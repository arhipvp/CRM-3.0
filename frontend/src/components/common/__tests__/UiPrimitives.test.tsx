import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppIcon } from '../AppIcon';
import { Button, IconButton } from '../Button';
import { PageHeader, Panel, SegmentedControl, StatusBadge, Toolbar } from '../layoutPrimitives';
import { Tabs } from '../Tabs';

describe('ui primitives', () => {
  it('renders buttons with icons and accessible labels', () => {
    const onClick = vi.fn();
    render(
      <div>
        <Button icon="plus" variant="primary" onClick={onClick}>
          Добавить
        </Button>
        <IconButton icon="close" label="Закрыть" />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
  });

  it('renders icon title when provided', () => {
    render(<AppIcon name="settings" title="Настройки" />);

    expect(screen.getByTitle('Настройки')).toBeInTheDocument();
  });

  it('exposes a busy state and prevents repeated button submission', () => {
    render(
      <Button isLoading loadingLabel="Сохраняем…">
        Сохранить
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Сохраняем…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('renders layout primitives and segmented changes', () => {
    const onChange = vi.fn();
    render(
      <Panel>
        <StatusBadge tone="success">Готово</StatusBadge>
        <SegmentedControl
          ariaLabel="Режим"
          value="first"
          onChange={onChange}
          options={[
            { value: 'first', label: 'Первый' },
            { value: 'second', label: 'Второй' },
          ]}
        />
      </Panel>,
    );

    expect(screen.getByText('Готово')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Второй' }));
    expect(onChange).toHaveBeenCalledWith('second');
  });

  it('renders the standard page hierarchy and keyboard-navigable tabs', () => {
    const onChange = vi.fn();
    render(
      <div>
        <PageHeader title="Сделки" description="Рабочая область" />
        <Toolbar leading="Фильтры" trailing="Действия" />
        <Tabs
          idPrefix="test-tab"
          ariaLabel="Разделы"
          value="first"
          onChange={onChange}
          options={[
            { value: 'first', label: 'Первый' },
            { value: 'second', label: 'Второй' },
          ]}
        />
      </div>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Сделки' })).toBeInTheDocument();
    expect(screen.getByText('Фильтры')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Первый' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('second');
  });
});
