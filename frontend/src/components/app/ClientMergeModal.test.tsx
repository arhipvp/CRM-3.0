import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClientMergeModal } from './ClientMergeModal';

describe('ClientMergeModal document selection', () => {
  it('requires an explicit current passport choice and preserves other fields', () => {
    const onChange = vi.fn();
    render(
      <ClientMergeModal
        targetClient={{ id: 'target', name: 'Клиент', createdAt: '', updatedAt: '' }}
        mergeCandidates={[]}
        mergeSearch=""
        mergeSources={['source']}
        mergeStep="preview"
        mergePreview={{
          targetClientId: 'target',
          sourceClientIds: ['source'],
          includeDeleted: true,
          previewSnapshotId: 'preview',
          movedCounts: {},
          items: {},
          canonicalProfile: { name: 'Клиент', phone: '', notes: '' },
          drivePlan: [],
          warnings: [],
          documentConflicts: [
            {
              kind: 'passport',
              documents: [
                { id: 'doc1', client_id: 'target', label: 'Первый паспорт' },
                { id: 'doc2', client_id: 'source', label: 'Второй паспорт' },
              ],
            },
          ],
        }}
        mergeSession={null}
        mergeError={null}
        isMergingClients={false}
        isPreviewLoading={false}
        isPreviewConfirmed
        fieldOverrides={{ name: 'Клиент', phone: '', email: '', notes: '' }}
        onFieldOverridesChange={onChange}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onPreview={vi.fn()}
        onToggleSource={vi.fn()}
        onSearchChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText('Актуальный паспорт после объединения');
    expect(select).toBeRequired();
    expect(select).toHaveValue('');
    fireEvent.change(select, { target: { value: 'doc2' } });
    expect(onChange).toHaveBeenCalledWith({
      name: 'Клиент',
      phone: '',
      email: '',
      notes: '',
      current_passport_id: 'doc2',
    });
  });
});
