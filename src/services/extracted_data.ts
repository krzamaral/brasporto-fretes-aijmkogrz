import pb from '@/lib/pocketbase/client'

export interface ExtractedData {
  id: string
  quotation_id: string
  raw_data: Record<string, any>
  created: string
  updated: string
}

export const getLatestExtractedData = () =>
  pb.collection('extracted_data').getList<ExtractedData>(1, 1, { sort: '-created' })
