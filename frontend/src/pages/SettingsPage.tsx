const sections = [
  { title: 'Пользователи', description: 'Приглашение, роли, блокировки' },
  { title: 'Воронки', description: 'Пайплайны, этапы, вероятности' },
  { title: 'Источники', description: 'Каналы лидогенерации и цветовые теги' },
  { title: 'Шаблоны документов', description: 'DOCX/HTML с плейсхолдерами' },
]

export function SettingsPage() {
  return (
    <div className="settings">
      {sections.map((section) => (
        <article key={section.title}>
          <h3>{section.title}</h3>
          <p>{section.description}</p>
          <button type="button">Перейти</button>
        </article>
      ))}
    </div>
  )
}
