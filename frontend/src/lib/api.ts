import type {
  Client,
  Deal,
  Document,
  DocumentRecognitionResult,
  Expense,
  FinanceSummary,
  Income,
  Note,
  Payment,
  Task,
} from '../types'

const fallbackApiUrl = (() => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8000/api/v1`
  }
  return 'http://localhost:8000/api/v1'
})()

function resolveApiUrl() {
  let url = import.meta.env.VITE_API_URL || fallbackApiUrl

  try {
    const parsed = new URL(url)
    const browserHost =
      typeof window !== 'undefined' ? window.location.hostname : 'localhost'

    if (parsed.hostname === 'backend') {
      parsed.hostname = browserHost
      url = parsed.toString()
    }
  } catch {
    url = fallbackApiUrl
  }

  return url.replace(/\/$/, '')
}

const API_URL = resolveApiUrl()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const options: RequestInit = { ...init }
  const isFormData = options.body instanceof FormData
  const defaultHeaders: HeadersInit = isFormData ? {} : { 'Content-Type': 'application/json' }
  options.headers = {
    ...defaultHeaders,
    ...(options.headers || {}),
  }

  const response = await fetch(`${API_URL}${path}`, options)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `API error: ${response.status}`)
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

export const api = {
  listClients() {
    return request<Client[]>('/clients/')
  },
  createClient(payload: Partial<Client>) {
    return request<Client>('/clients/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  listDeals() {
    return request<Deal[]>('/deals/')
  },
  listTasks() {
    return request<Task[]>('/tasks/')
  },
  listDocuments() {
    return request<Document[]>('/documents/')
  },
  listPayments() {
    return request<Payment[]>('/payments/')
  },
  createPayment(payload: Partial<Payment>) {
    return request<Payment>('/payments/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  listIncomes() {
    return request<Income[]>('/incomes/')
  },
  createIncome(payload: Partial<Income>) {
    return request<Income>('/incomes/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  listExpenses() {
    return request<Expense[]>('/expenses/')
  },
  createExpense(payload: Partial<Expense>) {
    return request<Expense>('/expenses/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getFinanceSummary() {
    return request<FinanceSummary>('/finances/summary/')
  },
  listNotes(params?: { deal?: string; client?: string }) {
    const query = new URLSearchParams()
    if (params?.deal) {
      query.append('deal', params.deal)
    }
    if (params?.client) {
      query.append('client', params.client)
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<Note[]>(`/notes/${suffix}`)
  },
  createNote(payload: Partial<Note>) {
    return request<Note>('/notes/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  recognizeDocuments(dealId: string, files: File[]) {
    const formData = new FormData()
    formData.append('deal_id', dealId)
    files.forEach((file) => formData.append('files', file))
    return request<{ results: DocumentRecognitionResult[] }>('/documents/recognize/', {
      method: 'POST',
      body: formData,
    })
  },
}
