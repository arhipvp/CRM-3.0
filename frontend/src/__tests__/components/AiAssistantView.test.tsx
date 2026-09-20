import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAssistantView } from '../../components/views/AiAssistantView';

const api = vi.hoisted(() => ({
  updateAiConversationModel: vi.fn(),
}));

vi.mock('../../api/aiAssistant', () => ({
  aiDocumentPageFragment: vi.fn(() => ''),
  createAiConversation: vi.fn(),
  deleteAiDocument: vi.fn(),
  fetchAiCatalog: vi.fn(async () => ({
    total: 0,
    unclassified: 0,
    insurers: [],
    suggestions: { insurers: [], insurance_kinds: [], products: [] },
  })),
  fetchAiConversations: vi.fn(async () => [
    { id: 'chat-1', title: 'КАСКО', created_at: '2026-09-20', provider: null, model: null },
  ]),
  fetchAiDocumentContent: vi.fn(),
  fetchAiDocuments: vi.fn(async () => []),
  fetchAiMessages: vi.fn(async () => []),
  fetchAiProviders: vi.fn(async () => ({
    providers: [
      {
        id: 'polza',
        label: 'Polza',
        available: true,
        models: ['polza-default', 'polza-pro'],
        default_model: 'polza-default',
        billing: 'Тарифицируется',
      },
    ],
  })),
  formatAiCitationLocation: vi.fn(),
  streamAiAnswer: vi.fn(),
  updateAiDocumentClassification: vi.fn(),
  updateAiConversationModel: api.updateAiConversationModel,
  uploadAiDocuments: vi.fn(),
}));

describe('AiAssistantView', () => {
  beforeEach(() => {
    api.updateAiConversationModel.mockReset();
    api.updateAiConversationModel.mockResolvedValue({
      id: 'chat-1',
      title: 'КАСКО',
      created_at: '2026-09-20',
      provider: 'polza',
      model: 'polza-pro',
    });
  });

  it('uses the chat default and saves a newly selected model for that chat', async () => {
    render(<AiAssistantView currentUser={null} />);

    const select = await screen.findByLabelText('Модель Polza для этого чата');
    expect(select).toHaveValue('polza-default');

    fireEvent.change(select, { target: { value: 'polza-pro' } });

    await waitFor(() =>
      expect(api.updateAiConversationModel).toHaveBeenCalledWith('chat-1', 'polza', 'polza-pro'),
    );
    expect(select).toHaveValue('polza-pro');
  });
});
