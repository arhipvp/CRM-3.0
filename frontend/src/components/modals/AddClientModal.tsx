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
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const payload: Partial<Client> = {
        name: name.trim(),
        type,
        status,
      }
      if (phone.trim()) {
        payload.phones = [phone.trim()]
      }
      if (email.trim()) {
        payload.emails = [email.trim()]
      }
      const client = await api.createClient(payload)
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
        <label>
          Телефон
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7..." />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Создать'}
        </button>
      </form>
    </Modal>
  )
}
