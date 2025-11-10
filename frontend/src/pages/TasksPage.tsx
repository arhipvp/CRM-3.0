const tasks = [
  { title: 'Позвонить клиенту «Прогресс»', due: 'Сегодня 14:00', owner: 'Алина' },
  { title: 'Подготовить доп. соглашение', due: 'Сегодня 16:30', owner: 'Игорь' },
  { title: 'Проверить оплату по «Гарант»', due: 'Завтра 09:30', owner: 'Мария' },
]

export function TasksPage() {
  return (
    <div className="tasks">
      <div className="table-head">
        <h2>Задачи</h2>
        <button type="button">+ Задача</button>
      </div>
      <ul className="tasks-list">
        {tasks.map((task) => (
          <li key={task.title}>
            <div>
              <strong>{task.title}</strong>
              <small>{task.due}</small>
            </div>
            <span>{task.owner}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
