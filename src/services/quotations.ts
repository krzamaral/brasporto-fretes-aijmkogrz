import pb from '@/lib/pocketbase/client'

export interface Quotation {
  id: string
  agent_name: string
  modal: 'Aéreo' | 'FCL' | 'LCL'
  cost: number
  cost_breakdown?: {
    freight?: number
    origin_taxes?: number
    destination_taxes?: number
    frete_unitario?: number
    frete_peso?: number
    taxas_origem?: number
    formula_origem?: string
  }
  option_description?: string
  transit_time?: number
  etd?: string
  free_time?: number
  taxable_weight?: number
  score: number
  compatibilidade_score?: number
  cotacao_round_id?: string
  pedido_id?: string
  user_id: string
  created: string
  updated: string
  expand?: {
    user_id?: {
      name: string
      email: string
    }
    cotacao_round_id?: {
      id: string
      nome_round: string
    }
  }
}

export const getQuotations = () =>
  pb
    .collection('quotations')
    .getFullList<Quotation>({ sort: '-created', expand: 'user_id,cotacao_round_id' })

export const getQuotationsByPedido = (pedidoId: string) =>
  pb.collection('quotations').getFullList<Quotation>({
    filter: `pedido_id='${pedidoId}'`,
    sort: '-score',
    expand: 'user_id,cotacao_round_id',
  })

export const getHistoryQuotations = () => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().replace('T', ' ').substring(0, 19)
  return pb.collection('quotations').getFullList<Quotation>({
    filter: `updated >= '${dateStr}' && pedido_id != ''`,
    sort: '-score',
    expand: 'user_id',
  })
}
export const getQuotation = (id: string) => pb.collection('quotations').getOne<Quotation>(id)
export const createQuotation = (data: Partial<Quotation>) =>
  pb.collection('quotations').create<Quotation>(data)
export const updateQuotation = (id: string, data: Partial<Quotation>) =>
  pb.collection('quotations').update<Quotation>(id, data)
export const deleteQuotation = (id: string) => pb.collection('quotations').delete(id)

export const analisarCotacoesIA = (data: {
  pedido_id: string
  cotacoes: any[]
  prazo_desejado_dias: number
  origem: string
  destino: string
  peso_bruto: number
  modal_desejado: string
}) =>
  pb.send('/backend/v1/analisar-cotacoes-ia', {
    method: 'POST',
    body: JSON.stringify(data),
  })
