import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAssistantView } from '../../components/views/AiAssistantView';

const api = vi.hoisted(() => ({
  fetchAiMessages: vi.fn(),
  updateAiConversationModel: vi.fn(),
  updateAiConversationScope: vi.fn(),
}));

vi.mock('../../api/aiAssistant', () => ({
  aiDocumentPageFragment: vi.fn(() => ''),
  createAiConversation: vi.fn(),
  deleteAiDocument: vi.fn(),
  fetchAiCatalog: vi.fn(async () => ({
    total: 1,
    unclassified: 0,
    insurers: [{ name: 'РЕСО', count: 1, kinds: [] }],
    suggestions: { insurers: ['РЕСО'], insurance_kinds: [], products: [] },
  })),
  fetchAiConversations: vi.fn(async () => [
    {
      id: 'chat-1',
      title: 'КАСКО',
      created_at: '2026-09-20',
      provider: null,
      model: null,
      scope: [{ insurer: 'РЕСО' }],
    },
    {
      id: 'chat-2',
      title: 'ОСАГО',
      created_at: '2026-09-20',
      provider: null,
      model: null,
      scope: [],
    },
  ]),
  fetchAiDocumentContent: vi.fn(),
  fetchAiDocuments: vi.fn(async () => []),
  fetchAiMessages: api.fetchAiMessages,
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
  updateAiConversationScope: api.updateAiConversationScope,
  uploadAiDocuments: vi.fn(),
}));

describe('AiAssistantView', () => {
  beforeEach(() => {
    api.fetchAiMessages.mockReset();
    api.updateAiConversationModel.mockReset();
    api.updateAiConversationScope.mockReset();
    api.updateAiConversationModel.mockResolvedValue({
      id: 'chat-1',
      title: 'КАСКО',
      created_at: '2026-09-20',
      provider: 'polza',
      model: 'polza-pro',
      scope: [{ insurer: 'РЕСО' }],
    });
    api.updateAiConversationScope.mockResolvedValue({
      id: 'chat-2',
      title: 'ОСАГО',
      created_at: '2026-09-20',
      provider: null,
      model: null,
      scope: [{ insurer: 'РЕСО' }],
    });
    api.fetchAiMessages.mockResolvedValue([]);
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

  it('switches the saved scope with the selected chat and persists branch changes', async () => {
    render(<AiAssistantView currentUser={null} />);

    expect(await screen.findByText('РЕСО')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ОСАГО' }));
    expect(await screen.findByText('Вся библиотека')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Библиотека · 1' }));
    fireEvent.click(await screen.findByLabelText('РЕСО (1)'));

    await waitFor(() =>
      expect(api.updateAiConversationScope).toHaveBeenCalledWith('chat-2', [{ insurer: 'РЕСО' }]),
    );
  });

  it('renders user questions on the right and assistant answers with a source section', async () => {
    api.fetchAiMessages.mockResolvedValue([
      { id: 'question', role: 'user', content: 'Когда нужен осмотр?', citations: [] },
      {
        id: 'answer',
        role: 'assistant',
        content: 'Осмотр нужен до оформления полиса.',
        citations: [
          {
            document_id: 'document-1',
            filename: 'rules.pdf',
            location: { page: 2 },
          },
        ],
      },
    ]);
    render(<AiAssistantView currentUser={null} />);

    const question = await screen.findByText('Когда нужен осмотр?');
    expect(question.closest('article')).toHaveClass('bg-[var(--app-brand-600)]');
    expect(screen.getByText('Страховой помощник')).toBeInTheDocument();
    expect(screen.getByText('Источники')).toBeInTheDocument();
    expect(screen.getByTitle('Открыть источник')).toHaveClass('cursor-pointer');
  });
});
