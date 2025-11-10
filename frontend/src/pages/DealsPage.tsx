const stages = [
  { stage: 'Новые', deals: ['CRM аудит', 'Полис TechInc'] },
  { stage: 'Работаем', deals: ['Продление Контакт+'] },
  { stage: 'Финал', deals: ['Сделка «Люкс»'] },
]

export function DealsPage() {
  return (
    <div className="kanban">
      {stages.map((column) => (
        <div key={column.stage} className="kanban-column">
          <header>
            <h3>{column.stage}</h3>
            <span>{column.deals.length}</span>
          </header>
          <ul>
            {column.deals.map((deal) => (
              <li key={deal}>{deal}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
