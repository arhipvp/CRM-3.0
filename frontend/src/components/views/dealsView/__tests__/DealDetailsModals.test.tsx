import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Deal, DealSimilarityCandidate, User } from '../../../../types';
import { DealMergeModal, DealSimilarModal } from '../DealDetailsModals';

const deal: Deal = {
  id: 'deal-1',
  title: 'Test Deal',
  clientId: 'client-1',
  clientName: 'Client A',
  status: 'open',
  createdAt: '2024-01-01T00:00:00Z',
  quotes: [],
  documents: [],
};

const users: User[] = [
  {
    id: 'user-1',
    username: 'seller',
    roles: ['Admin'],
  },
];

describe('DealDetailsModals', () => {
  it('renders merge modal and exposes handlers', () => {
    const onMergeSearchChange = vi.fn();
    const toggleMergeSource = vi.fn();
    const onSubmit = vi.fn();
    const onPreview = vi.fn();
    const onBackToSelection = vi.fn();

    const dealList: Deal[] = [
      {
        id: 'deal-1',
        title: 'Deal 1',
        clientId: 'client-1',
        clientName: 'Client A',
        status: 'open',
        createdAt: '2024-01-01T00:00:00Z',
        quotes: [],
        documents: [],
      },
      {
        id: 'deal-2',
        title: 'Deal 2',
        clientId: 'client-1',
        clientName: 'Client A',
        status: 'open',
        createdAt: '2024-01-01T00:00:00Z',
        quotes: [],
        documents: [],
      },
    ];

    render(
      <DealMergeModal
        targetDeal={deal}
        selectedClientName="Client A"
        clients={[
          {
            id: 'client-1',
            name: 'Client A',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ]}
        users={users}
        mergeSearch=""
        onMergeSearchChange={onMergeSearchChange}
        mergeList={dealList}
        mergeSources={['deal-1']}
        toggleMergeSource={toggleMergeSource}
        mergeError={null}
        mergePreviewWarnings={[]}
        mergeStep="select"
        onBackToSelection={onBackToSelection}
        mergeFinalDraft={null}
        onPreview={onPreview}
        isPreviewLoading={false}
        isPreviewConfirmed={false}
        isLoading={false}
        isActiveSearch={false}
        searchQuery=""
        isMerging={false}
        zIndex={70}
        onClose={() => undefined}
        onSubmit={onSubmit}
        onRequestAddClient={() => undefined}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } });
    expect(onMergeSearchChange).toHaveBeenCalledWith('test');

    fireEvent.click(screen.getByRole('checkbox', { name: /Deal 2/ }));
    expect(toggleMergeSource).toHaveBeenCalledWith('deal-2');

    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр' }));
    expect(onPreview).toHaveBeenCalled();

    const layout = screen.getByTestId('deal-merge-modal-layout');
    const scroll = screen.getByTestId('deal-merge-modal-scroll');
    const actions = screen.getByTestId('deal-merge-modal-actions');

    expect(layout.className).toContain('max-h-[85vh]');
    expect(screen.getByRole('dialog', { name: 'Объединить сделки' }).parentElement).toHaveStyle({
      zIndex: '70',
    });
    expect(scroll.className).toContain('overflow-y-auto');
    expect(actions.className).toContain('sticky');
  });

  it('renders similar modal and wires handlers', () => {
    const onToggleIncludeClosed = vi.fn();
    const onToggleCandidate = vi.fn();
    const onContinue = vi.fn();
    const onClose = vi.fn();
    const candidates: DealSimilarityCandidate[] = [
      {
        deal: {
          id: 'deal-2',
          title: 'Ипотека',
          clientId: 'client-1',
          clientName: 'Client A',
          status: 'open',
          createdAt: '2024-01-01T00:00:00Z',
          quotes: [],
          documents: [],
        },
        score: 87,
        confidence: 'high',
        reasons: ['same_norm_title', 'shared_policy_number'],
        matchedFields: { title_norm_exact: true },
        mergeBlockers: [],
      },
    ];

    const { rerender } = render(
      <DealSimilarModal
        targetDeal={deal}
        candidates={candidates}
        selectedIds={[]}
        includeClosed={false}
        isLoading={false}
        error={null}
        zIndex={70}
        onToggleIncludeClosed={onToggleIncludeClosed}
        onToggleCandidate={onToggleCandidate}
        onContinue={onContinue}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Похожие сделки')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Похожие сделки' }).parentElement).toHaveStyle({
      zIndex: '70',
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Показывать закрытые сделки/i }));
    expect(onToggleIncludeClosed).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('checkbox', { name: /Ипотека/ }));
    expect(onToggleCandidate).toHaveBeenCalledWith('deal-2');

    expect(screen.getByRole('button', { name: 'Перейти к объединению' })).toBeDisabled();

    rerender(
      <DealSimilarModal
        targetDeal={deal}
        candidates={candidates}
        selectedIds={['deal-2']}
        includeClosed={false}
        isLoading={false}
        error={null}
        zIndex={70}
        onToggleIncludeClosed={onToggleIncludeClosed}
        onToggleCandidate={onToggleCandidate}
        onContinue={onContinue}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Перейти к объединению' }));
    expect(onContinue).toHaveBeenCalled();
  });
});
