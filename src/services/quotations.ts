import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export const getQuotations = (): Promise<RecordModel[]> => {
  return pb.collection('quotations').getFullList()
}
