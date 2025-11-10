import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Client } from '../types'
import type { FormEvent } from 'react'

type ClientsPageProps = {
  onDataChange?: () => void
}

const initialFormState = {
  name: '',
  type: 'company',
  status: 'lead',
}

export function ClientsPage({ onDataChange }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(initialFormState)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.listClients()
        if (!ignore) {
          setClients(data)
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) return

    setSaving(true)
    setError(null)
    try {
      const created = await api.createClient({
        name: form.name.trim(),
        type: form.type,
        status: form.status,
      })
      setClients((prev) => [created, ...prev])
      setForm(initialFormState)
      onDataChange?.()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать клиента')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="table-wrapper">
      <div className="table-head">
        <h2>Клиенты</h2>
      </div>

      <form className="form-inline" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Название"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
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

      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Тип</th>
            <th>Статус</th>
            <th>Теги</th>
          </tr>
        </thead>
        <tbody>
          {!loading && clients.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Клиенты пока не добавлены.
              </td>
            </tr>
          )}
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.name}</td>
              <td>{client.type === 'person' ? 'Физ. лицо' : 'Компания'}</td>
              <td>
                <span className={`badge badge-${client.status}`}>{client.status}</span>
              </td>
              <td>{client.tags?.length ? client.tags.join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
