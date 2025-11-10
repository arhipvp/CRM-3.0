import { StatCard } from '../components/StatCard'

const activities = [
  { time: '09:20', text: 'Связались с ООО «Прогресс» по продлению полиса' },
  { time: '10:05', text: 'Согласовали КП для ИП Сидорова' },
  { time: '11:40', text: 'Загружен договор по сделке «Норвуд»' },
]

export function DashboardPage() {
  return (
    <div className="dashboard">
      <div className="grid">
        <StatCard label="Выручка (месяц)" value="4.2 млн ₽" hint="+12% к прошлому" />
        <StatCard label="Новых лидов" value="18" hint="7 из Telegram" />
        <StatCard label="Документов" value="42" hint="за последние 7 дней" />
      </div>

      <section>
        <h2>Сегодня</h2>
        <ul className="timeline">
          {activities.map((activity) => (
            <li key={activity.time}>
              <span>{activity.time}</span>
              <p>{activity.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
