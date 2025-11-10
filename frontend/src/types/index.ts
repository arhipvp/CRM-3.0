export type Client = {
  id: string
  name: string
  status: string
  type?: string
  owner?: number | null
  tags?: string[]
  created_at?: string
  phones?: string[]
  emails?: string[]
  messengers?: Record<string, string>
  notes?: string
}

export type Pipeline = {
  id: string
  name: string
  code?: string
}

export type DealStage = {
  id: string
  pipeline: string
  name: string
  order_index?: number
}

export type Deal = {
  id: string
  title: string
  stage: string
  stage_name?: string
  pipeline_name?: string
  pipeline?: string
  client?: string
  client_name?: string
  amount?: number
  status?: string
}

export type Task = {
  id: string
  title: string
  status: string
  due_at?: string | null
  assignee?: number | null
  client_name?: string | null
  deal_title?: string | null
}

export type Document = {
  id: string
  title: string
  doc_type?: string
  deal_title?: string | null
  client_name?: string | null
  updated_at?: string
}

export type Payment = {
  id: string
  deal: string
  deal_title?: string
  amount: number
  currency: string
  description?: string
  scheduled_date?: string | null
  actual_date?: string | null
  status: string
}

export type Income = {
  id: string
  payment: string
  payment_description?: string
  amount: number
  received_at?: string | null
  source?: string
  note?: string
}

export type Expense = {
  id: string
  payment: string
  payment_description?: string
  amount: number
  expense_type: string
  expense_date?: string | null
  note?: string
}

export type Note = {
  id: string
  deal?: string | null
  deal_title?: string | null
  client?: string | null
  client_name?: string | null
  body: string
  author_name?: string
  created_at: string
}

export type FinanceSummary = {
  incomes_total: number
  expenses_total: number
  net_total: number
  planned_payments: Payment[]
}

export type DocumentRecognitionResult = {
  filename: string
  summary: string
}
