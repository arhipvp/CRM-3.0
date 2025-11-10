import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { StatCard } from '../components/StatCard'
import { api } from '../lib/api'
import type {
  Deal,
  Expense,
  FinanceSummary,
  Income,
  Payment,
} from '../types'

const emptySummary: FinanceSummary = {
  incomes_total: 0,
  expenses_total: 0,
  net_total: 0,
  planned_payments: [],
}

export function FinancesPage() {
  const [summary, setSummary] = useState<FinanceSummary>(emptySummary)
  const [payments, setPayments] = useState<Payment[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [paymentForm, setPaymentForm] = useState({
    deal: '',
    amount: '',
    scheduled_date: '',
    description: '',
  })

  const [incomeForm, setIncomeForm] = useState({
    payment: '',
    amount: '',
    received_at: '',
    source: '',
  })

  const [expenseForm, setExpenseForm] = useState({
    payment: '',
    amount: '',
    expense_type: '',
    expense_date: '',
  })

  useEffect(() => {
    refreshData()
  }, [])

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [paymentsData, incomesData, expensesData, summaryData, dealsData] = await Promise.all([
        api.listPayments(),
        api.listIncomes(),
        api.listExpenses(),
        api.getFinanceSummary(),
        api.listDeals(),
      ])
      setPayments(paymentsData)
      setIncomes(incomesData)
      setExpenses(expensesData)
      setSummary(summaryData)
      setDeals(dealsData)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить финансовые данные')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!paymentForm.deal) return
    try {
      await api.createPayment({
        deal: paymentForm.deal,
        amount: Number(paymentForm.amount),
        scheduled_date: paymentForm.scheduled_date || null,
        description: paymentForm.description,
        status: 'planned',
      })
      setPaymentForm({ deal: '', amount: '', scheduled_date: '', description: '' })
      refreshData()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать платёж')
    }
  }

  const handleIncomeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!incomeForm.payment) return
    try {
      await api.createIncome({
        payment: incomeForm.payment,
        amount: Number(incomeForm.amount),
        received_at: incomeForm.received_at || null,
        source: incomeForm.source,
      })
      setIncomeForm({ payment: '', amount: '', received_at: '', source: '' })
      refreshData()
    } catch (err) {
      console.error(err)
      setError('Не удалось добавить доход')
    }
  }

  const handleExpenseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!expenseForm.payment || !expenseForm.expense_type) return
    try {
      await api.createExpense({
        payment: expenseForm.payment,
        amount: Number(expenseForm.amount),
        expense_type: expenseForm.expense_type,
        expense_date: expenseForm.expense_date || null,
      })
      setExpenseForm({ payment: '', amount: '', expense_type: '', expense_date: '' })
      refreshData()
    } catch (err) {
      console.error(err)
      setError('Не удалось добавить расход')
    }
  }

  return (
    <div className="finances">
      <div className="grid">
        <StatCard label="Доходы" value={`${summary.incomes_total.toFixed(2)} ₽`} />
        <StatCard label="Расходы" value={`${summary.expenses_total.toFixed(2)} ₽`} />
        <StatCard label="Чистая прибыль" value={`${summary.net_total.toFixed(2)} ₽`} />
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Загрузка...</p>}

      <section className="finance-grid">
        <div className="finance-card">
          <h3>Новый платёж</h3>
          <form className="finance-form" onSubmit={handlePaymentSubmit}>
            <select
              value={paymentForm.deal}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, deal: event.target.value }))}
            >
              <option value="">Выберите сделку</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Сумма"
              value={paymentForm.amount}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
              required
            />
            <input
              type="date"
              value={paymentForm.scheduled_date}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, scheduled_date: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Описание"
              value={paymentForm.description}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, description: event.target.value }))}
            />
            <button type="submit">Сохранить</button>
          </form>
        </div>

        <div className="finance-card">
          <h3>Доход</h3>
          <form className="finance-form" onSubmit={handleIncomeSubmit}>
            <select
              value={incomeForm.payment}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, payment: event.target.value }))}
            >
              <option value="">Платёж</option>
              {payments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {payment.deal_title || payment.description || payment.id}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Сумма"
              value={incomeForm.amount}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, amount: event.target.value }))}
              required
            />
            <input
              type="date"
              value={incomeForm.received_at}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, received_at: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Источник"
              value={incomeForm.source}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, source: event.target.value }))}
            />
            <button type="submit">Добавить</button>
          </form>
        </div>

        <div className="finance-card">
          <h3>Расход</h3>
          <form className="finance-form" onSubmit={handleExpenseSubmit}>
            <select
              value={expenseForm.payment}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, payment: event.target.value }))}
            >
              <option value="">Платёж</option>
              {payments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {payment.deal_title || payment.description || payment.id}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Сумма"
              value={expenseForm.amount}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
              required
            />
            <input
              type="text"
              placeholder="Категория"
              value={expenseForm.expense_type}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, expense_type: event.target.value }))}
              required
            />
            <input
              type="date"
              value={expenseForm.expense_date}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, expense_date: event.target.value }))}
            />
            <button type="submit">Добавить</button>
          </form>
        </div>
      </section>

      <div className="finance-columns">
        <div className="table-wrapper">
          <h3>Запланированные платежи</h3>
          <table>
            <thead>
              <tr>
                <th>Сделка</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {summary.planned_payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.deal_title || payment.description}</td>
                  <td>{payment.amount}</td>
                  <td>{payment.status}</td>
                  <td>{payment.scheduled_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-wrapper">
          <h3>Доходы</h3>
          <table>
            <thead>
              <tr>
                <th>Платёж</th>
                <th>Сумма</th>
                <th>Дата</th>
                <th>Источник</th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((income) => (
                <tr key={income.id}>
                  <td>{income.payment_description || income.payment}</td>
                  <td>{income.amount}</td>
                  <td>{income.received_at ?? '—'}</td>
                  <td>{income.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-wrapper">
          <h3>Расходы</h3>
          <table>
            <thead>
              <tr>
                <th>Платёж</th>
                <th>Сумма</th>
                <th>Тип</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.payment_description || expense.payment}</td>
                  <td>{expense.amount}</td>
                  <td>{expense.expense_type}</td>
                  <td>{expense.expense_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
