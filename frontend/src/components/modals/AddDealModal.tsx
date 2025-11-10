import { useState } from 'react'
import type { Client, Deal } from '../../types'
import { api } from '../../lib/api'
import { Modal } from './Modal'

type AddDealModalProps = {
  clients: Client[]
  onClose: () => void
  onCreated: (deal: Deal) => void
}

const statusOptions: Array<{ value: Deal['status']; label: string }> = [
  { value: 'open', label: 'В работе' },
  { value: 'on_hold', label: 'На паузе' },
  { value: 'won', label: 'Выиграна' },
  { value: 'lost', label: 'Проиграна' },
]

export const AddDealModal = ({ clients, onClose, onCreated }: AddDealModalProps) => {
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [status, setStatus] = useState<Deal['status']>('open')
  const [stageName, setStageName] = useState('')
  const [amount, setAmount] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !clientId) {
      setError('Заполните название и выберите клиента')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const deal = await api.createDeal({
        title: title.trim(),
        client: clientId,
        status,
        stage_name: stageName.trim(),
        amount: Number(amount),
      })
      onCreated(deal)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать сделку')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Новая сделка" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <label>
          Название
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Клиент
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Статус
          <select value={status} onChange={(event) => setStatus(event.target.value as Deal['status'])}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Этап/комментарий
          <input value={stageName} onChange={(event) => setStageName(event.target.value)} placeholder="Например, Подготовка КП" />
        </label>
        <label>
          Сумма
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving || !clients.length}>
          {saving ? 'Сохранение…' : 'Создать'}
        </button>
      </form>
    </Modal>
  )
}
