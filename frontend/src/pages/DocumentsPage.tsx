const documents = [
  { title: 'Договор_Люкс.pdf', type: 'Contract', deal: 'Люкс', updated: '10.11' },
  { title: 'Счет_Progress.pdf', type: 'Invoice', deal: 'Прогресс', updated: '09.11' },
]

export function DocumentsPage() {
  return (
    <div className="table-wrapper">
      <div className="table-head">
        <h2>Документы</h2>
        <button type="button">Загрузить</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Тип</th>
            <th>Сделка</th>
            <th>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.title}>
              <td>{doc.title}</td>
              <td>{doc.type}</td>
              <td>{doc.deal}</td>
              <td>{doc.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
