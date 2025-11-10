import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Client, Deal, Note } from '../types'

type ClientsPageProps = {
  onDataChange?: () => void
}

const initialFormState = {
  name: '',
  type: 'company',
  status: 'lead',
  phone: '',
  email: '',
}

const dealStatusLabel = (status?: Deal['status']) => {
  switch (status) {
    case 'won':
      return 'Сделка выиграна'
    case 'lost':
      return 'Сделка закрыта'
    case 'on_hold':
      return 'На паузе'
    default:
      return 'В работе'
  }
}

export function ClientsPage({ onDataChange }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [clientData, dealData] = await Promise.all([api.listClients(), api.listDeals()])
        if (!ignore) {
          setClients(clientData)
          setDeals(dealData)
          setSelectedClientId((prev) => prev ?? clientData[0]?.id ?? null)
        }
      } catch (err) {
        console.error(err)
        if (!ignore) {
          setError('Не удалось загрузить клиентов')
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

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.trim().toLowerCase()
    return clients.filter((client) => {
      const phones = client.phones?.join(' ') ?? ''
      const emails = client.emails?.join(' ') ?? ''
      return [client.name, phones, emails].some((value) => value?.toLowerCase().includes(q))
    })
  }, [clients, search])

  useEffect(() => {
    if (!selectedClientId && filteredClients.length) {
      setSelectedClientId(filteredClients[0].id)
    }
  }, [filteredClients, selectedClientId])

  const selectedClient = filteredClients.find((c) => c.id === selectedClientId) ?? filteredClients[0]

  useEffect(() => {
    let ignore = false
    if (!selectedClient) {
      setNotes([])
      return
    }
    const loadNotes = async () => {
      setNotesLoading(true)
      try {
        const data = await api.listNotes({ client: selectedClient.id })
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
  }, [selectedClient])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) return

    setSaving(true)
    setError(null)
    try {
      const payload: Partial<Client> = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
      }
      if (form.phone.trim()) payload.phones = [form.phone.trim()]
      if (form.email.trim()) payload.emails = [form.email.trim()]
      const created = await api.createClient(payload)
      setClients((prev) => [created, ...prev])
      setForm(initialFormState)
      setSelectedClientId(created.id)
      onDataChange?.()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать клиента')
    } finally {
      setSaving(false)
    }
  }

  const relatedDeals = useMemo(() => {
    if (!selectedClient) return []
    return deals.filter((deal) => deal.client === selectedClient.id || deal.client_name === selectedClient.name)
  }, [deals, selectedClient])

  const handleNoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedClient || !noteText.trim()) return
    try {
      await api.createNote({ client: selectedClient.id, body: noteText.trim(), author_name: 'Manager' })
      setNoteText('')
      const data = await api.listNotes({ client: selectedClient.id })
      setNotes(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось сохранить заметку')
    }
  }

  return (
    <div className="clients-layout">
      <aside className="client-list">
        <h2>Клиенты</h2>
        <form className="form-inline" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Название"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <input
            type="text"
            placeholder="+7..."
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <input
            type="email"
            placeholder="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
          >
            <option value="company">Компания</option>
            <option value="person">Частное лицо</option>
          </select>
          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="lead">Лид</option>
            <option value="active">Активный</option>
            <option value="dormant">Спящий</option>
          </select>
          <button type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </form>

        <div className="client-search">
          <input
            type="search"
            placeholder="Поиск по имени, телефону, email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <ul>
          {loading && <li className="muted">Загрузка…</li>}
          {!loading && filteredClients.length === 0 && <li className="muted">Клиенты не найдены.</li>}
          {filteredClients.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                className={selectedClient?.id === client.id ? 'active' : ''}
                onClick={() => setSelectedClientId(client.id)}
              >
                <div>
                  <strong>{client.name}</strong>
                  <small>{client.type === 'person' ? 'Физ. лицо' : 'Компания'}</small>
                </div>
                <span className={`badge badge-${client.status}`}>{client.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="client-details">
        {error && <p className="error">{error}</p>}
        {!selectedClient && <p className="muted">Выберите клиента из списка.</p>}
        {selectedClient && (
          <>
            <header>
              <h2>{selectedClient.name}</h2>
              <span className={`badge badge-${selectedClient.status}`}>{selectedClient.status}</span>
            </header>
            <div className="client-summary">
              <div>
                <strong>{relatedDeals.length}</strong>
                <span>Сделок</span>
              </div>
              <div>
                <strong>{selectedClient.type === 'person' ? 'Физ. лицо' : 'Компания'}</strong>
                <span>Тип</span>
              </div>
              <div>
                <strong>{selectedClient.phones?.[0] || '—'}</strong>
                <span>Телефон</span>
              </div>
              <div>
                <strong>{selectedClient.emails?.[0] || '—'}</strong>
                <span>Email</span>
              </div>
            </div>

            <div className="client-actions">
              <a
                href={`tel:${selectedClient.phones?.[0] ?? ''}`}
                className={!selectedClient.phones?.length ? 'disabled' : ''}
              >
                Позвонить
              </a>
              <a
                href={`https://wa.me/${(selectedClient.phones?.[0] ?? '').replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className={!selectedClient.phones?.length ? 'disabled' : ''}
              >
                WhatsApp
              </a>
              <a
                href={`mailto:${selectedClient.emails?.[0] ?? ''}`}
                className={!selectedClient.emails?.length ? 'disabled' : ''}
              >
                Email
              </a>
            </div>

            <section className="client-section">
              <h3>Активные сделки</h3>
              {relatedDeals.length === 0 && <p className="muted">Пока нет сделок.</p>}
              <ul className="client-deals">
                {relatedDeals.map((deal) => (
                  <li key={deal.id}>
                    <div>
                      <strong>{deal.title}</strong>
                      <small>{dealStatusLabel(deal.status)}</small>
                      {deal.stage_name && <span className="muted">{deal.stage_name}</span>}
                    </div>
                    <span>{deal.amount ? `${deal.amount} ₽` : ''}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="client-section">
              <h3>Заметки</h3>
              <form className="deal-form" onSubmit={handleNoteSubmit}>
                <textarea
                  placeholder="Новая запись..."
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                />
                <button type="submit">Сохранить</button>
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
          </>
        )}
      </section>
    </div>
  )
}
