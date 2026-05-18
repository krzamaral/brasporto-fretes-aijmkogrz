import pb from '@/lib/pocketbase/client'

export interface Pedido {
  id: string
  origem: string
  destino: string
  peso_bruto?: number | null
  volume?: number | null
  quantidade_containers?: number | null
  tipo_mercadoria?: string
  modal_desejado: 'Aéreo' | 'FCL' | 'LCL'
  prazo_desejado_dias?: number | null
  user_id: string
  status: 'aguardando_cotacao' | 'em_andamento' | 'concluido'
  created: string
  updated: string
  expand?: {
    user_id?: {
      name: string
      email: string
    }
  }
}

export const getPedidos = () =>
  pb.collection('pedidos').getFullList<Pedido>({ sort: '-created', expand: 'user_id' })
export const getPedido = (id: string) =>
  pb.collection('pedidos').getOne<Pedido>(id, { expand: 'user_id' })
export const createPedido = (data: Partial<Pedido>) => pb.collection('pedidos').create<Pedido>(data)
export const updatePedido = (id: string, data: Partial<Pedido>) =>
  pb.collection('pedidos').update<Pedido>(id, data)
export const deletePedido = (id: string) => pb.collection('pedidos').delete(id)
