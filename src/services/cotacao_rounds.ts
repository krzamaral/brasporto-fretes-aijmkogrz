import pb from '@/lib/pocketbase/client'

export interface CotacaoRound {
  id: string
  pedido_id: string
  nome_round: 'cota1' | 'cota2'
  user_id: string
  created: string
  updated: string
}

export const createCotacaoRound = (data: Partial<CotacaoRound>) =>
  pb.collection('cotacao_rounds').create<CotacaoRound>(data)
