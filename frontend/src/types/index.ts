export type Client = {
  id: string
  name: string
  status: string
  owner?: string
  tags?: string[]
}

export type Deal = {
  id: string
  title: string
  stage: string
  amount: number
  clientName: string
}
