import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { api } from '../lib/api'
import type { Deal, DocumentRecognitionResult, Note } from '../types'

type DealsPageProps = {
  onAddDeal: () => void
}

export function DealsPage({ onAddDeal }: DealsPageProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [noteText, setNoteText] = useState('')
  const [notesLoading, setNotesLoading] = useState(false)
  const [recognitionResults, setRecognitionResults] = useState<DocumentRecognitionResult[]>([])
  const [recognitionLoading, setRecognitionLoading] = useState(false)
  const [fileList, setFileList] = useState<File[]>([])

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

  useEffect(() => {
    if (!selectedDeal) {
      setNotes([])
      return
    }
    let ignore = false
    const loadNotes = async () => {
      setNotesLoading(true)
      try {
        const data = await api.listNotes({ deal: selectedDeal.id })
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
  }, [selectedDeal])

  const columns = useMemo(() => {
    const grouped = new Map<string, Deal[]>()
    deals.forEach((deal) => {
      const stage = deal.stage_name || 'Без этапа'
      grouped.set(stage, [...(grouped.get(stage) ?? []), deal])
    })

    return Array.from(grouped.entries()).map(([stage, stageDeals]) => ({
      stage,
      deals: stageDeals,
    }))
  }, [deals])

  const handleSelectDeal = (deal: Deal) => {
    setSelectedDeal(deal)
    setRecognitionResults([])
    setFileList([])
  }

  const handleNoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDeal || !noteText.trim()) {
      return
    }
    try {
      await api.createNote({
        deal: selectedDeal.id,
        body: noteText.trim(),
        author_name: 'Менеджер',
      })
      setNoteText('')
      const data = await api.listNotes({ deal: selectedDeal.id })
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
    if (!selectedDeal || fileList.length === 0) return
    setRecognitionLoading(true)
    try {
      const response = await api.recognizeDocuments(selectedDeal.id, fileList)
      setRecognitionResults(response.results)
      setFileList([])
      const data = await api.listNotes({ deal: selectedDeal.id })
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
      <div>
        <div className="deals-toolbar">
          <h2>Сделки</h2>
          <button type="button" onClick={onAddDeal}>
            + Сделка
          </button>
        </div>
        {loading && <p className="muted">Загрузка…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && deals.length === 0 && <p className="muted">Сделок пока нет.</p>}

        <div className="kanban">
          {columns.map((column) => (
            <div key={column.stage} className="kanban-column">
              <header>
                <h3>{column.stage}</h3>
                <span>{column.deals.length}</span>
              </header>
              <ul>
                {column.deals.map((deal) => (
                  <li
                    key={deal.id}
                    className={selectedDeal?.id === deal.id ? 'selected' : ''}
                    onClick={() => handleSelectDeal(deal)}
                  >
                    <strong>{deal.title}</strong>
                    <div className="muted">{deal.client_name ?? deal.client ?? 'Без клиента'}</div>
                    <small className="muted">{deal.amount ? `${deal.amount} ₽` : ''}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {selectedDeal && (
        <aside className="deal-panel">
          <h3>{selectedDeal.title}</h3>
          <p className="muted">{selectedDeal.client_name ?? 'Без клиента'}</p>

          <section>
            <h4>Заметки</h4>
            <form className="deal-form" onSubmit={handleNoteSubmit}>
              <textarea
                placeholder="Новая запись..."
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
