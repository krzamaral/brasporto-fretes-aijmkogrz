import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  PlusCircle,
  ArrowRight,
  Ship,
  Plane,
  History as HistoryIcon,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getPedidos, type Pedido } from '@/services/pedidos'
import { useRealtime } from '@/hooks/use-realtime'

export default function Dashboard() {
  const [activePedidos, setActivePedidos] = useState<Pedido[]>([])
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      const data = await getPedidos()
      setActivePedidos(data.filter((p) => p.status !== 'concluido'))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('pedidos', () => {
    loadData()
  })

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Painel de Cotações</h2>
          <p className="text-muted-foreground">Gerencie seus pedidos de frete ativos.</p>
        </div>
        <Button
          onClick={() => navigate('/upload')}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm">
        {activePedidos.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <FolderOpen className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Nenhum pedido em andamento
            </h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              Inicie um novo fluxo de cotação fazendo o upload da solicitação de carga.
            </p>
            <Button onClick={() => navigate('/upload')} variant="outline">
              Iniciar Cotação
            </Button>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-6">
              Pedidos Aguardando Cotação ({activePedidos.length})
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activePedidos.map((p) => (
                <Card
                  key={p.id}
                  className="p-5 border-slate-200 shadow-sm hover:shadow-md transition-shadow relative"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-semibold text-slate-800 text-sm">
                      {p.origem} <ArrowRight className="inline h-3 w-3 text-slate-400" />{' '}
                      {p.destino}
                    </span>
                    {p.modal_desejado === 'Aéreo' ? (
                      <Plane className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Ship className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm text-slate-600 mb-5">
                    <p className="flex justify-between">
                      <span className="text-slate-500">Peso:</span>{' '}
                      <span className="font-medium">{p.peso_bruto} kg</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500">Prazo Alvo:</span>{' '}
                      <span className="font-medium">{p.prazo_desejado_dias} dias</span>
                    </p>
                    <p className="flex justify-between items-center">
                      <span className="text-slate-500">Status:</span>{' '}
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate('/upload', { state: { pedidoId: p.id } })}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800"
                    size="sm"
                  >
                    Adicionar Cotações
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card
          className="p-6 border border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
          onClick={() => navigate('/history')}
        >
          <div>
            <h3 className="font-semibold text-slate-800">Histórico de Decisões</h3>
            <p className="text-sm text-slate-500">Consulte o arquivo de cotações concluídas.</p>
          </div>
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <HistoryIcon className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-6 border border-slate-200 shadow-sm flex items-center justify-between opacity-60 cursor-not-allowed">
          <div>
            <h3 className="font-semibold text-slate-800">Relatórios de Economia</h3>
            <p className="text-sm text-slate-500">Em breve: Analytics e Saving.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
