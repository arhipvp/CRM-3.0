import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAssistantView } from '../../components/views/AiAssistantView';

const api = vi.hoisted(() => ({
  fetchAiCatalog: vi.fn(),
  fetchAiDocuments: vi.fn(),
  fetchAiMessages: vi.fn(),
  deleteAiDocument: vi.fn(),
  updateAiDocumentClassification: vi.fn(),
  uploadAiDocuments: vi.fn(),
  updateAiConversationModel: vi.fn(),
  updateAiConversationScope: vi.fn(),
  submitAiQuestion: vi.fn(),
  stopAiAnswer: vi.fn(),
}));

vi.mock('../../api/aiAssistant', () => ({
  aiDocumentPageFragment: vi.fn(() => ''),
  createAiConversation: vi.fn(),
  deleteAiDocument: api.deleteAiDocument,
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
  submitAiQuestion: api.submitAiQuestion,
  stopAiAnswer: api.stopAiAnswer,
  updateAiDocumentClassification: api.updateAiDocumentClassification,
  updateAiConversationModel: api.updateAiConversationModel,
  updateAiConversationScope: api.updateAiConversationScope,
  uploadAiDocuments: api.uploadAiDocuments,
}));

describe('AiAssistantView', () => {
  beforeEach(() => {
    api.fetchAiCatalog.mockReset();
    api.fetchAiDocuments.mockReset();
    api.fetchAiMessages.mockReset();
    api.deleteAiDocument.mockReset();
    api.updateAiDocumentClassification.mockReset();
    api.uploadAiDocuments.mockReset();
    api.updateAiConversationModel.mockReset();
    api.updateAiConversationScope.mockReset();
    api.submitAiQuestion.mockReset();
    api.stopAiAnswer.mockReset();
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
    api.deleteAiDocument.mockResolvedValue(undefined);
    api.updateAiDocumentClassification.mockResolvedValue([]);
    api.uploadAiDocuments.mockResolvedValue([]);
    api.submitAiQuestion.mockResolvedValue({ run_id: 'run-1' });
    api.stopAiAnswer.mockResolvedValue({});
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

  it('uploads new documents without classification and switches to unclassified sources', async () => {
    api.fetchAiCatalog.mockResolvedValue({
      total: 1,
      unclassified: 1,
      insurers: [],
      suggestions: { insurers: [], insurance_kinds: [], products: [] },
    });
    render(<AiAssistantView currentUser={{ username: 'Vova', isStaff: false } as never} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Библиотека · 1' }));
    const file = new File(['rules'], 'rules.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Загрузить документы'), { target: { files: [file] } });

    await waitFor(() => expect(api.uploadAiDocuments).toHaveBeenCalledWith([file]));
    expect(await screen.findByText(/Нераспределено\s+· показано/)).toBeInTheDocument();
  });

  it('validates an incomplete target branch and reports successful distribution', async () => {
    api.fetchAiCatalog.mockResolvedValue({
      total: 1,
      unclassified: 1,
      insurers: [],
      suggestions: { insurers: ['РЕСО'], insurance_kinds: ['КАСКО'], products: ['РЕСОавто'] },
    });
    api.fetchAiDocuments.mockResolvedValue([
      {
        id: 'draft',
        filename: 'draft.pdf',
        status: 'ready',
        chunks: 1,
        classification: {},
      },
    ]);
    api.updateAiDocumentClassification.mockResolvedValue([]);
    render(<AiAssistantView currentUser={{ username: 'Vova', isStaff: false } as never} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Библиотека · 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Нераспределено (1)' }));
    fireEvent.click(screen.getByLabelText('Выбрать draft.pdf'));
    fireEvent.click(screen.getByRole('button', { name: 'Распределить (1)' }));
    expect(
      await screen.findByText('Заполните страховщика, вид страхования и продукт.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Страховщик/), { target: { value: 'РЕСО' } });
    fireEvent.change(screen.getByLabelText(/Вид страхования/), { target: { value: 'КАСКО' } });
    fireEvent.change(screen.getByLabelText(/Продукт/), { target: { value: 'РЕСОавто' } });
    fireEvent.click(screen.getByRole('button', { name: 'Распределить (1)' }));

    await waitFor(() =>
      expect(api.updateAiDocumentClassification).toHaveBeenCalledWith(
        ['draft'],
        expect.objectContaining({ insurer: 'РЕСО', insurance_kind: 'КАСКО', product: 'РЕСОавто' }),
      ),
    );
    expect(await screen.findByText('Распределено: 1 документ.')).toBeInTheDocument();
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

  it('restores a running answer and blocks another question and settings changes', async () => {
    api.fetchAiMessages.mockResolvedValue([
      { id: 'question', role: 'user', content: 'Условия КАСКО?', citations: [] },
      {
        id: 'answer',
        role: 'assistant',
        content: 'Частичный ответ',
        citations: [],
        run: {
          id: 'run-1',
          status: 'generating',
          found_chunks: 8,
          created_at: new Date(Date.now() - 35_000).toISOString(),
        },
      },
    ]);
    render(<AiAssistantView currentUser={null} />);

    expect(await screen.findByText('Частичный ответ')).toBeInTheDocument();
    expect(screen.getByText('Модель продолжает формировать ответ')).toBeInTheDocument();
    expect(screen.getByText(/найдено фрагментов: 8/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    expect(screen.getByLabelText('Модель Polza для этого чата')).toBeDisabled();
    expect(screen.getByLabelText('Настроить область поиска этого чата')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Остановить' }));
    await waitFor(() => expect(api.stopAiAnswer).toHaveBeenCalledWith('chat-1', 'run-1'));
  });

  it('submits one durable request and replaces optimistic messages with server history', async () => {
    api.fetchAiMessages.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'question-1', role: 'user', content: 'Какой риск?', citations: [] },
      {
        id: 'answer-1',
        role: 'assistant',
        content: '',
        citations: [],
        run: {
          id: 'run-1',
          status: 'queued',
          found_chunks: 0,
          created_at: new Date().toISOString(),
        },
      },
    ]);
    render(<AiAssistantView currentUser={null} />);
    await screen.findByLabelText('Модель Polza для этого чата');
    fireEvent.change(screen.getByPlaceholderText('Спросите по страховым документам…'), {
      target: { value: 'Какой риск?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await waitFor(() => expect(api.submitAiQuestion).toHaveBeenCalledOnce());
    expect(api.submitAiQuestion).toHaveBeenCalledWith('chat-1', 'Какой риск?', expect.any(String));
    expect(await screen.findByText('В очереди')).toBeInTheDocument();
    expect(screen.getAllByText('Какой риск?')).toHaveLength(1);
  });

  it('restores the selected chat and explicitly repeats a failed answer with a new request id', async () => {
    api.fetchAiMessages.mockImplementation(async (id: string) =>
      id === 'chat-2'
        ? [
            { id: 'question-2', role: 'user', content: 'Вопрос ОСАГО', citations: [] },
            {
              id: 'answer-2',
              role: 'assistant',
              content: 'Сохранённый частичный ответ',
              citations: [],
              run: {
                id: 'run-2',
                status: 'failed',
                found_chunks: 3,
                created_at: new Date().toISOString(),
              },
            },
          ]
        : [],
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AiAssistantView currentUser={null} />);
    fireEvent.click(await screen.findByRole('button', { name: 'ОСАГО' }));
    expect(await screen.findByText('Сохранённый частичный ответ')).toBeInTheDocument();
    expect(screen.getByText('Ошибка ответа')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(api.submitAiQuestion).toHaveBeenCalledOnce());
    expect(api.submitAiQuestion).toHaveBeenCalledWith('chat-2', 'Вопрос ОСАГО', expect.any(String));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('оплату ещё раз'));
    confirm.mockRestore();
  });
});
