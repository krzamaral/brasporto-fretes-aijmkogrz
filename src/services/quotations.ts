import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export const getQuotations = (): Promise<RecordModel[]> => {
  return pb.collection('quotations').getFullList()
}

export const getQuotationsByPedido = (pedidoId: string): Promise<RecordModel[]> => {
  return pb.collection('quotations').getFullList({
    filter: `pedido_id = "${pedidoId}"`,
  })
}

export const createQuotation = (data: any): Promise<RecordModel> => {
  return pb.collection('quotations').create(data)
}

export const updateQuotation = (id: string, data: any): Promise<RecordModel> => {
  return pb.collection('quotations').update(id, data)
}

export const analisarCotacoesIA = async (data: any): Promise<any> => {
  const body = typeof data === 'string' ? { pedidoId: data } : data
  return pb.send('/backend/v1/analisar-cotacoes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
