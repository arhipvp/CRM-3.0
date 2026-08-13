import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppIcon, type AppIconName } from '../AppIcon';
import { ActionLink, Button, DisclosureSummary, IconButton } from '../Button';
import { KpiCard } from '../KpiCard';
import { LoadingState, Spinner } from '../LoadingState';
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

  it('supports typed link variants and semantic tones', () => {
    render(
      <div>
        <Button variant="link">Открыть</Button>
        <Button variant="linkDanger">Удалить</Button>
        <ActionLink href="/example" variant="secondary" size="sm">
          Документ
        </ActionLink>
        <details>
          <DisclosureSummary>Дополнительно</DisclosureSummary>
        </details>
        <KpiCard label="Сальдо" value="12 000 ₽" tone="balance" />
        <StatusBadge tone="overdue">Просрочено</StatusBadge>
        <Spinner label="Обновление" />
        <LoadingState label="Получаем данные" />
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Открыть' })).toHaveClass('btn-link');
    expect(screen.getByRole('button', { name: 'Удалить' })).toHaveClass('btn-link-danger');
    expect(screen.getByRole('link', { name: 'Документ' })).toHaveClass('btn-secondary');
    expect(screen.getByText('Дополнительно')).toHaveClass('btn-secondary');
    expect(screen.getByLabelText('Сальдо')).toHaveClass('kpi-card-balance');
    expect(screen.getByText('Просрочено')).toBeInTheDocument();
    expect(screen.getByLabelText('Обновление')).toBeInTheDocument();
    expect(screen.getByText('Получаем данные')).toBeInTheDocument();
  });

  it('handles button interaction through user events', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Продолжить</Button>);

    await user.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders icon title when provided', () => {
    render(<AppIcon name="settings" title="Настройки" />);

    expect(screen.getByTitle('Настройки')).toBeInTheDocument();
  });

  it('renders the complete action icon set with accessible titles', () => {
    const actionIcons: AppIconName[] = [
      'pin',
      'pinOff',
      'folder',
      'duplicate',
      'normalize',
      'chevronLeft',
      'chevronRight',
      'arrowRight',
      'sortAsc',
      'sortDesc',
      'download',
      'copy',
    ];

    render(
      <div>
        {actionIcons.map((name) => (
          <AppIcon key={name} name={name} size={24} title={name} data-testid={`icon-${name}`} />
        ))}
      </div>,
    );

    for (const name of actionIcons) {
      const icon = screen.getByTestId(`icon-${name}`);
      expect(icon).toHaveAttribute('width', '24');
      expect(icon).toHaveAttribute('height', '24');
      expect(icon).toHaveAttribute('aria-labelledby', `${name}-icon-title`);
      expect(screen.getByTitle(name)).toBeInTheDocument();
    }
  });

  it('hides decorative icons and labels icon buttons', () => {
    render(
      <div>
        <AppIcon name="copy" data-testid="decorative-icon" />
        <IconButton icon="pin" label="Закрепить" size="sm" />
      </div>,
    );

    expect(screen.getByTestId('decorative-icon')).toHaveAttribute('aria-hidden', 'true');
    const button = screen.getByRole('button', { name: 'Закрепить' });
    expect(button).toHaveAttribute('title', 'Закрепить');
    expect(button).toHaveClass('h-7', 'w-7');
    expect(button.querySelector('svg')).toHaveAttribute('width', '14');
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
