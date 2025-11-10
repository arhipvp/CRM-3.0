import { useState } from 'react'
import type { Client } from '../../types'
import { api } from '../../lib/api'
import { Modal } from './Modal'

type AddClientModalProps = {
  onClose: () => void
  onCreated: (client: Client) => void
}

export const AddClientModal = ({ onClose, onCreated }: AddClientModalProps) => {
  const [name, setName] = useState('')
  const [type, setType] = useState<'company' | 'person'>('company')
  const [status, setStatus] = useState('lead')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const client = await api.createClient({ name: name.trim(), type, status })
      onCreated(client)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать клиента')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Новый клиент" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <label>
          Название
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Тип
          <select value={type} onChange={(event) => setType(event.target.value as 'company' | 'person')}>
            <option value="company">Компания</option>
            <option value="person">Частное лицо</option>
          </select>
        </label>
        <label>
          Статус
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="lead">Лид</option>
            <option value="active">Активный</option>
            <option value="dormant">Спящий</option>
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Создать'}
        </button>
      </form>
    </Modal>
  )
}
