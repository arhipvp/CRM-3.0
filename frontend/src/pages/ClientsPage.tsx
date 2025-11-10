import type { Client } from '../types'

const mockClients: Client[] = [
  {
    id: '1',
    name: 'ООО «Вектор»',
    status: 'active',
    owner: 'Алина',
    tags: ['key'],
  },
  {
    id: '2',
    name: 'ИП Петров',
    status: 'lead',
    owner: 'Игорь',
    tags: ['telegram'],
  },
]

export function ClientsPage() {
  return (
    <div className="table-wrapper">
      <div className="table-head">
        <h2>Список клиентов</h2>
        <button type="button">+ Новый клиент</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Статус</th>
            <th>Ответственный</th>
            <th>Теги</th>
          </tr>
        </thead>
        <tbody>
          {mockClients.map((client) => (
            <tr key={client.id}>
              <td>{client.name}</td>
              <td>
                <span className={`badge badge-${client.status}`}>{client.status}</span>
              </td>
              <td>{client.owner}</td>
              <td>{client.tags?.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
