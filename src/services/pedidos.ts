import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export const getPedidos = (): Promise<RecordModel[]> => {
  return pb.collection('pedidos').getFullList({ sort: '-created' })
}

export const getPedido = (id: string): Promise<RecordModel> => {
  return pb.collection('pedidos').getOne(id)
}

export const createPedido = (data: any): Promise<RecordModel> => {
  return pb.collection('pedidos').create(data)
}

export const updatePedido = (id: string, data: any): Promise<RecordModel> => {
  return pb.collection('pedidos').update(id, data)
}
