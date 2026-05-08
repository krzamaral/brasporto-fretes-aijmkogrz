import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, FileUp, PlusCircle, ArrowRight, Ship, Plane } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRealtime } from '@/hooks/use-realtime'
import { getQuotations, type Quotation } from '@/services/quotations'

export default function Dashboard() {
  const [quotations, setQuotations] = useState<Quotation[]>([])

  const loadData = async () => {
    try {
      const data = await getQuotations()
      const sorted = [...data].sort((a, b) => (b.score || 0) - (a.score || 0))
      setQuotations(sorted)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('quotations', () => {
    loadData()
  })

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="mb-12">
        <h2 className="text-2xl font-bold tracking-tight mb-2 text-slate-800">
          Resumo da Solicitação
        </h2>
        <p className="text-muted-foreground">
          Acompanhe o progresso das suas cotações de frete ativas.
        </p>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm">
        <Stepper currentStep={1} />

        {quotations.length === 0 ? (
          <div className="mt-16 mb-8 flex flex-col items-center justify-center text-center px-4">
            <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
              <FolderOpen className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Nenhuma solicitação ativa no momento
            </h3>
            <p className="text-slate-500 max-w-md mb-8">
              Para iniciar o processo de comparação de fretes, faça o upload das cotações recebidas
              dos fornecedores.
            </p>

            <Button
              asChild
              size="lg"
              className="bg-accent hover:bg-accent/90 text-white font-medium shadow-sm h-12 px-8 rounded-full"
            >
              <Link to="/upload" className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                Fazer Upload de Cotações
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-12">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800">
                Cotações Recentes ({quotations.length})
              </h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/review">
                  Ver Todas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quotations.slice(0, 3).map((q) => (
                <Card
                  key={q.id}
                  className="p-4 border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3 overflow-hidden">
                    <span
                      className="font-semibold text-slate-800 truncate mr-2"
                      title={q.agent_name}
                    >
                      {q.agent_name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {(q.score || 0) > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                          {q.score} pts
                        </span>
                      )}
                      {q.modal === 'Aéreo' ? (
                        <Plane className="h-5 w-5 text-blue-500" />
                      ) : (
                        <Ship className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>
                      Modal: <span className="font-medium text-slate-800">{q.modal}</span>
                    </p>
                    <p>
                      Custo:{' '}
                      <span className="font-medium text-slate-800">US$ {q.cost.toFixed(2)}</span>
                    </p>
                    <p>
                      Transit Time:{' '}
                      <span className="font-medium text-slate-800">{q.transit_time} dias</span>
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card className="p-6 border border-dashed bg-transparent shadow-none flex flex-col items-center justify-center text-slate-400 h-40">
          <PlusCircle className="h-8 w-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">Widget de Economia</span>
        </Card>
        <Card className="p-6 border border-dashed bg-transparent shadow-none flex flex-col items-center justify-center text-slate-400 h-40">
          <PlusCircle className="h-8 w-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">Fornecedores Top 3</span>
        </Card>
        <Card className="p-6 border border-dashed bg-transparent shadow-none flex flex-col items-center justify-center text-slate-400 h-40">
          <PlusCircle className="h-8 w-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">Histórico Recente</span>
        </Card>
      </div>
    </div>
  )
}
