import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export const getPedidos = (): Promise<RecordModel[]> => {
  return pb.collection('pedidos').getFullList({ sort: '-created' })
}
