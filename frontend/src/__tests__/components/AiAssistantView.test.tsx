import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAssistantView } from '../../components/views/AiAssistantView';

const api = vi.hoisted(() => ({
  fetchAiCatalog: vi.fn(),
  fetchAiDocuments: vi.fn(),
  fetchAiMessages: vi.fn(),
  updateAiConversationModel: vi.fn(),
  updateAiConversationScope: vi.fn(),
}));

vi.mock('../../api/aiAssistant', () => ({
  aiDocumentPageFragment: vi.fn(() => ''),
  createAiConversation: vi.fn(),
  deleteAiDocument: vi.fn(),
  fetchAiCatalog: api.fetchAiCatalog,
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
  fetchAiDocuments: api.fetchAiDocuments,
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
    api.fetchAiCatalog.mockReset();
    api.fetchAiDocuments.mockReset();
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
    api.fetchAiCatalog.mockResolvedValue({
      total: 1,
      unclassified: 0,
      insurers: [{ name: 'РЕСО', count: 1, kinds: [] }],
      suggestions: { insurers: ['РЕСО'], insurance_kinds: [], products: [] },
    });
    api.fetchAiDocuments.mockResolvedValue([]);
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

  it('keeps scope in the selected chat and persists changes from its settings menu', async () => {
    render(<AiAssistantView currentUser={null} />);

    expect(await screen.findByText('Поиск: 1 ветки')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ОСАГО' }));
    expect(await screen.findByText('Поиск: вся библиотека')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Настроить область поиска этого чата' }));
    fireEvent.click(await screen.findByLabelText('РЕСО (1)'));

    await waitFor(() =>
      expect(api.updateAiConversationScope).toHaveBeenCalledWith('chat-2', [{ insurer: 'РЕСО' }]),
    );
  });

  it('keeps the library focused on shared documents, not chat scope settings', async () => {
    render(<AiAssistantView currentUser={null} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Библиотека · 1' }));

    expect(screen.getByRole('heading', { name: 'Источники' })).toBeInTheDocument();
    expect(
      screen.queryByText('Настройка применяется только к этому чату.'),
    ).not.toBeInTheDocument();
  });

  it('uses the library tree to filter shared documents without changing chat scope', async () => {
    api.fetchAiCatalog.mockResolvedValue({
      total: 2,
      unclassified: 0,
      insurers: [
        {
          name: 'РЕСО',
          count: 1,
          kinds: [{ name: 'КАСКО', count: 1, products: [{ name: 'РЕСОавто', count: 1 }] }],
        },
        {
          name: 'Ингосстрах',
          count: 1,
          kinds: [{ name: 'КАСКО', count: 1, products: [{ name: 'КАСКО Премиум', count: 1 }] }],
        },
      ],
      suggestions: { insurers: ['РЕСО', 'Ингосстрах'], insurance_kinds: ['КАСКО'], products: [] },
    });
    api.fetchAiDocuments.mockResolvedValue([
      {
        id: 'reso-rule',
        filename: 'reso-kasko.pdf',
        status: 'ready',
        chunks: 3,
        classification: { insurer: 'РЕСО', insurance_kind: 'КАСКО', product: 'РЕСОавто' },
      },
      {
        id: 'ingo-rule',
        filename: 'ingo-kasko.pdf',
        status: 'ready',
        chunks: 3,
        classification: {
          insurer: 'Ингосстрах',
          insurance_kind: 'КАСКО',
          product: 'КАСКО Премиум',
        },
      },
    ]);
    render(<AiAssistantView currentUser={null} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Библиотека · 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть РЕСО (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть КАСКО (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'РЕСОавто (1)' }));

    expect(await screen.findByText('reso-kasko.pdf')).toBeInTheDocument();
    expect(screen.queryByText('ingo-kasko.pdf')).not.toBeInTheDocument();
    expect(
      screen.getByText(/РЕСО → КАСКО → РЕСОавто · показано 1 из 2 документов/),
    ).toBeInTheDocument();
    expect(api.updateAiConversationScope).not.toHaveBeenCalled();
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
