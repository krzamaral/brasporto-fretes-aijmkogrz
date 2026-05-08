import pb from '@/lib/pocketbase/client'

export interface Quotation {
  id: string
  agent_name: string
  modal: 'Aéreo' | 'FCL' | 'LCL'
  cost: number
  transit_time: number
  etd: string
  free_time: number
  score: number
  user_id: string
  created: string
  updated: string
}

export const getQuotations = () =>
  pb.collection('quotations').getFullList<Quotation>({ sort: '-created' })
export const getQuotation = (id: string) => pb.collection('quotations').getOne<Quotation>(id)
export const createQuotation = (data: Partial<Quotation>) =>
  pb.collection('quotations').create<Quotation>(data)
export const updateQuotation = (id: string, data: Partial<Quotation>) =>
  pb.collection('quotations').update<Quotation>(id, data)
export const deleteQuotation = (id: string) => pb.collection('quotations').delete(id)
