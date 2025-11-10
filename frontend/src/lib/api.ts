import type { Client, Deal, Document, Task } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

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
}
