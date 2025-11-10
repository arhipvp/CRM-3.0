import { useEffect, useMemo, useState } from 'react'
import type { Client, Deal, DealStage, Pipeline } from '../../types'
import { api } from '../../lib/api'
import { Modal } from './Modal'

type AddDealModalProps = {
  clients: Client[]
  pipelines: Pipeline[]
  stages: DealStage[]
  onClose: () => void
  onCreated: (deal: Deal) => void
}

export const AddDealModal = ({ clients, pipelines, stages, onClose, onCreated }: AddDealModalProps) => {
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id || '')
  const [stageId, setStageId] = useState('')
  const [amount, setAmount] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredStages = useMemo(
    () => stages.filter((stage) => stage.pipeline === pipelineId),
    [stages, pipelineId],
  )

  useEffect(() => {
    if (!stageId && filteredStages.length) {
      setStageId(filteredStages[0].id)
    }
  }, [filteredStages, stageId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !clientId || !pipelineId || !stageId) {
      setError('Заполните все поля')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const deal = await api.createDeal({
        title: title.trim(),
        client: clientId,
        pipeline: pipelineId,
        stage: stageId,
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
          Воронка
          <select
            value={pipelineId}
            onChange={(event) => {
              setPipelineId(event.target.value)
              setStageId('')
            }}
          >
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Этап
          <select value={stageId} onChange={(event) => setStageId(event.target.value)}>
            {filteredStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
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
        <button type="submit" disabled={saving || !clients.length || !pipelines.length}>
          {saving ? 'Сохранение…' : 'Создать'}
        </button>
      </form>
    </Modal>
  )
}
