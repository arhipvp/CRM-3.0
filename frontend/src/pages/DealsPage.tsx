import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { api } from '../lib/api'
import type { Deal, DocumentRecognitionResult, Note } from '../types'

type DealsPageProps = {
  onAddDeal: () => void
}

type DealStatusFilter = 'all' | 'open' | 'on_hold' | 'won' | 'lost'

const statusFilters: Array<{ value: DealStatusFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'В работе' },
  { value: 'on_hold', label: 'На паузе' },
  { value: 'won', label: 'Выиграны' },
  { value: 'lost', label: 'Закрыты' },
]

const statusLabel = (status?: Deal['status']) => {
  switch (status) {
    case 'won':
      return 'Выиграна'
    case 'lost':
      return 'Проиграна'
    case 'on_hold':
      return 'На паузе'
    default:
      return 'В работе'
  }
}

const formatCurrency = (value?: number) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
    : '—'

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : '—'

export function DealsPage({ onAddDeal }: DealsPageProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [noteText, setNoteText] = useState('')
  const [notesLoading, setNotesLoading] = useState(false)
  const [recognitionResults, setRecognitionResults] = useState<DocumentRecognitionResult[]>([])
  const [recognitionLoading, setRecognitionLoading] = useState(false)
  const [fileList, setFileList] = useState<File[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<DealStatusFilter>('all')

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.listDeals()
        if (!ignore) {
          setDeals(data)
        }
      } catch (err) {
        console.error(err)
        if (!ignore) {
          setError('Не удалось загрузить сделки')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [])

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deals.filter((deal) => {
      const matchesQuery =
        !q ||
        [deal.title, deal.client_name, deal.stage_name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q))
      const matchesStatus = statusFilter === 'all' || deal.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [deals, query, statusFilter])

  useEffect(() => {
    if (filteredDeals.length === 0) {
      if (selectedDealId !== null) {
        setSelectedDealId(null)
      }
      return
    }
    if (!selectedDealId || !filteredDeals.some((deal) => deal.id === selectedDealId)) {
      setSelectedDealId(filteredDeals[0].id)
    }
  }, [filteredDeals, selectedDealId])

  const selectedDeal = useMemo(
    () => filteredDeals.find((deal) => deal.id === selectedDealId) ?? null,
    [filteredDeals, selectedDealId],
  )

  useEffect(() => {
    if (!selectedDealId) {
      setNotes([])
      return
    }
    let ignore = false
    const loadNotes = async () => {
      setNotesLoading(true)
      try {
        const data = await api.listNotes({ deal: selectedDealId })
        if (!ignore) {
          setNotes(data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!ignore) {
          setNotesLoading(false)
        }
      }
    }
    loadNotes()
    return () => {
      ignore = true
    }
  }, [selectedDealId])

  const handleSelectDeal = (dealId: string) => {
    setSelectedDealId(dealId)
    setRecognitionResults([])
    setFileList([])
  }

  const handleNoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDealId || !noteText.trim()) {
      return
    }
    try {
      await api.createNote({
        deal: selectedDealId,
        body: noteText.trim(),
        author_name: 'Менеджер',
      })
      setNoteText('')
      const data = await api.listNotes({ deal: selectedDealId })
      setNotes(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось добавить заметку')
    }
  }

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    setFileList(Array.from(event.target.files))
  }

  const handleRecognize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDealId || fileList.length === 0) return
    setRecognitionLoading(true)
    try {
      const response = await api.recognizeDocuments(selectedDealId, fileList)
      setRecognitionResults(response.results)
      setFileList([])
      const data = await api.listNotes({ deal: selectedDealId })
      setNotes(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось распознать документы')
    } finally {
      setRecognitionLoading(false)
    }
  }

  return (
    <div className="deals-layout">
      <section className="deals-board">
        <div className="deals-toolbar">
          <div>
            <h2>Сделки</h2>
            <p className="muted">Все активные и завершённые сделки</p>
          </div>
          <div className="deals-toolbar__actions">
            <input
              type="search"
              placeholder="Поиск по названию или клиенту"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="button" onClick={onAddDeal}>
              + Сделка
            </button>
          </div>
        </div>

        <div className="deals-filters">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={statusFilter === filter.value ? 'active' : ''}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading && <p className="muted">Загрузка…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && filteredDeals.length === 0 && <p className="muted">Сделок по фильтру нет.</p>}

        <ul className="deals-list">
          {filteredDeals.map((deal) => (
            <li key={deal.id}>
              <button
                type="button"
                className={`deal-card ${selectedDealId === deal.id ? 'active' : ''}`}
                onClick={() => handleSelectDeal(deal.id)}
              >
                <div className="deal-card__header">
                  <div>
                    <strong>{deal.title}</strong>
                    <p className="muted">{deal.client_name ?? 'Без клиента'}</p>
                  </div>
                  <span className={`status-pill ${deal.status ?? 'open'}`}>{statusLabel(deal.status)}</span>
                </div>
                <div className="deal-card__meta">
                  <span>{formatCurrency(deal.amount)}</span>
                  {deal.stage_name && <small className="muted">Комментарий: {deal.stage_name}</small>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedDeal && (
        <aside className="deal-panel">
          <header className="deal-panel__header">
            <div>
              <h3>{selectedDeal.title}</h3>
              <p className="muted">{selectedDeal.client_name ?? 'Без клиента'}</p>
            </div>
            <span className={`status-pill ${selectedDeal.status ?? 'open'}`}>{statusLabel(selectedDeal.status)}</span>
          </header>

          <div className="deal-summary">
            <div>
              <span className="muted">Сумма</span>
              <strong>{formatCurrency(selectedDeal.amount)}</strong>
            </div>
            <div>
              <span className="muted">Закрытие</span>
              <strong>{formatDate(selectedDeal.expected_close)}</strong>
            </div>
            <div>
              <span className="muted">Комментарий</span>
              <strong>{selectedDeal.stage_name || '—'}</strong>
            </div>
          </div>

          <section>
            <h4>Заметки</h4>
            <form className="deal-form" onSubmit={handleNoteSubmit}>
              <textarea
                placeholder="Новая запись…"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
              />
              <button type="submit">Добавить заметку</button>
            </form>
            {notesLoading ? (
              <p className="muted">Загрузка заметок…</p>
            ) : (
              <ul className="notes-list">
                {notes.map((note) => (
                  <li key={note.id}>
                    <strong>{note.author_name || 'Система'}</strong>
                    <span>{new Date(note.created_at).toLocaleString()}</span>
                    <p>{note.body}</p>
                  </li>
                ))}
                {notes.length === 0 && <li className="muted">Заметок пока нет.</li>}
              </ul>
            )}
          </section>

          <section>
            <h4>Распознать документы</h4>
            <form className="deal-form" onSubmit={handleRecognize}>
              <input type="file" multiple onChange={handleFilesChange} />
              <button type="submit" disabled={recognitionLoading}>
                {recognitionLoading ? 'Анализ…' : 'Распознать'}
              </button>
            </form>
            {recognitionResults.length > 0 && (
              <ul className="notes-list">
                {recognitionResults.map((item) => (
                  <li key={item.filename}>
                    <strong>{item.filename}</strong>
                    <p>{item.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      )}
    </div>
  )
}
