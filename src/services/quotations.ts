import pb from '@/lib/pocketbase/client'

export interface Quotation {
  id: string
  agent_name: string
  modal: 'Aéreo' | 'FCL' | 'LCL'
  cost: number
  transit_time?: number
  etd?: string
  free_time?: number
  taxable_weight?: number
  score: number
  user_id: string
  created: string
  updated: string
  expand?: {
    user_id?: {
      name: string
      email: string
    }
  }
}

export const getQuotations = () =>
  pb.collection('quotations').getFullList<Quotation>({ sort: '-created', expand: 'user_id' })

export const getHistoryQuotations = () => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().replace('T', ' ').substring(0, 19)
  return pb.collection('quotations').getFullList<Quotation>({
    filter: `updated >= '${dateStr}'`,
    sort: '-updated',
    expand: 'user_id',
  })
}
export const getQuotation = (id: string) => pb.collection('quotations').getOne<Quotation>(id)
export const createQuotation = (data: Partial<Quotation>) =>
  pb.collection('quotations').create<Quotation>(data)
export const updateQuotation = (id: string, data: Partial<Quotation>) =>
  pb.collection('quotations').update<Quotation>(id, data)
export const deleteQuotation = (id: string) => pb.collection('quotations').delete(id)
