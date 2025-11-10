export type Client = {
  id: string
  name: string
  status: string
  type?: string
  owner?: number | null
  tags?: string[]
  created_at?: string
}

export type Deal = {
  id: string
  title: string
  stage: string
  stage_name?: string
  pipeline_name?: string
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
