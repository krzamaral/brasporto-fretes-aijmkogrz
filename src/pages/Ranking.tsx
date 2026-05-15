import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Trophy,
  Medal,
  Award,
  Sparkles,
  FileDown,
  CheckCircle2,
  XCircle,
  Bot,
  Loader2,
} from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getQuotationsByPedido, analisarCotacoesIA, type Quotation } from '@/services/quotations'
import { getPedido, type Pedido } from '@/services/pedidos'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function Ranking() {
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiProposal, setAiProposal] = useState<any>(null)
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
      const pedidoId = location.state?.pedidoId
      if (!pedidoId) {
        navigate('/dashboard')
        return
      }
      try {
        const [ped, quots] = await Promise.all([
          getPedido(pedidoId),
          getQuotationsByPedido(pedidoId),
        ])
        setPedido(ped)
        setQuotations(quots)
      } catch (e) {
        console.error(e)
      }
    }
    loadData()
  }, [location, navigate])

  const handleGenerateAiProposal = async () => {
    if (!pedido || quotations.length === 0) return
    setIsAiLoading(true)
    try {
      const payload = {
        pedido_id: pedido.id,
        cotacoes: quotations.map((q) => ({
          id: q.id,
          agent_name: q.agent_name,
          modal: q.modal,
          cost: q.cost,
          transit_time: q.transit_time,
          etd: q.etd || new Date().toISOString(),
          free_time: q.free_time || 0,
          taxable_weight: q.taxable_weight || 0,
        })),
        prazo_desejado_dias: pedido.prazo_desejado_dias || null,
        origem: pedido.origem,
        destino: pedido.destino,
        peso_bruto: pedido.peso_bruto,
        modal_desejado: pedido.modal_desejado,
      }
      const res = await analisarCotacoesIA(payload)
      setAiProposal(res.data)
      setIsAiDialogOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao gerar proposta',
        variant: 'destructive',
      })
    } finally {
      setIsAiLoading(false)
    }
  }

  const generateJustification = (q: Quotation, ped: Pedido) => {
    let text = `Melhor opção para o pedido ${ped.origem} - ${ped.destino}. `
    if (
      ped.prazo_desejado_dias &&
      q.transit_time != null &&
      q.transit_time <= ped.prazo_desejado_dias
    ) {
      text += `Atende o prazo alvo com transit time de ${q.transit_time} dias e `
    } else {
      text += `Apresenta transit time de ${q.transit_time != null ? q.transit_time : '-'} dias e `
    }
    text += `custo total de US$ ${q.cost.toFixed(2)}.`
    return text
  }

  const cota1List = quotations.filter((q) => q.expand?.cotacao_round_id?.nome_round === 'cota1')
  const cota2List = quotations.filter((q) => q.expand?.cotacao_round_id?.nome_round === 'cota2')

  const renderList = (list: Quotation[], title: string) => {
    if (list.length === 0) return null
    return (
      <div className="mb-10 last:mb-0">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">
          {title}
        </h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((q) => {
            const isWinner = quotations.length > 0 && q.id === quotations[0].id
            const meetsDeadline =
              pedido?.prazo_desejado_dias && q.transit_time != null
                ? q.transit_time <= pedido.prazo_desejado_dias
                : false

            return (
              <Card
                key={q.id}
                className={cn(
                  'p-6 relative overflow-hidden transition-all',
                  isWinner
                    ? 'border-amber-300 shadow-amber-100/50 shadow-lg scale-[1.02] z-10'
                    : 'border-slate-200',
                )}
              >
                {isWinner && <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-400" />}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 pr-2">
                    {isWinner ? (
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Trophy className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <Medal className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h4
                        className="font-bold text-slate-800 truncate max-w-[140px]"
                        title={q.agent_name}
                      >
                        {q.agent_name}
                      </h4>
                      <p className="text-xs text-slate-500">{q.modal}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-800">{q.score}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Score Global</div>
                  </div>
                </div>

                {isWinner && pedido && (
                  <div className="mb-4 bg-amber-50/50 rounded-lg p-3 border border-amber-100 flex gap-2 items-start">
                    <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-900 leading-tight">
                      {generateJustification(q, pedido)}
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">
                      {q.modal === 'Aéreo' ? 'Frete Total' : 'Custo Total'}
                    </span>
                    <span className="font-semibold text-slate-800">US$ {q.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Transit Time</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1">
                      {q.transit_time != null ? `${q.transit_time} dias` : '-'}
                      {pedido?.prazo_desejado_dias &&
                        q.transit_time != null &&
                        (meetsDeadline ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Free Time</span>
                    <span className="font-medium text-slate-800">
                      {q.free_time != null ? `${q.free_time} dias` : '-'}
                    </span>
                  </div>
                  {q.modal === 'Aéreo' && (
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                      <span className="text-slate-500">Peso Taxável</span>
                      <div className="text-right">
                        <div className="font-medium text-slate-800">
                          {q.taxable_weight ? `${q.taxable_weight.toFixed(2)} kg` : '-'}
                        </div>
                        {q.taxable_weight && pedido && (
                          <div className="text-[10px] text-slate-400">
                            (Baseado em{' '}
                            {q.taxable_weight > (pedido.peso_bruto || 0)
                              ? 'Peso Cubado'
                              : 'Peso Real'}
                            )
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Score Compatibilidade</span>
                    <span className="font-semibold text-blue-600">
                      {q.compatibilidade_score || 0} pts
                    </span>
                  </div>
                </div>

                <div className="mt-5 print:hidden">
                  <Button
                    className={cn(
                      'w-full',
                      isWinner
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800',
                    )}
                  >
                    Aprovar Fornecedor
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in print:m-0 print:space-y-4">
      <style>{`@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @page { margin: 1cm; } }`}</style>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 print:hidden gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            Ranking de Fornecedores
          </h2>
          <p className="text-muted-foreground">Decisão Estratégica de Frete</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleGenerateAiProposal}
            variant="default"
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
            disabled={isAiLoading || quotations.length === 0}
          >
            {isAiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            Gerar Proposta IA
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
        <Stepper currentStep={5} />

        {pedido && (
          <div className="mt-8 mb-8 text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              {pedido.origem}{' '}
              <ArrowLeft className="inline h-4 w-4 rotate-180 text-slate-400 mx-1" />{' '}
              {pedido.destino}
            </h2>
            <p className="text-slate-500">
              Modal: {pedido.modal_desejado} | Prazo Alvo:{' '}
              {pedido.prazo_desejado_dias ? `${pedido.prazo_desejado_dias} dias` : 'Não definido'}
            </p>
          </div>
        )}

        {renderList(cota1List, 'Opções - Cotação 1')}
        {renderList(cota2List, 'Opções - Cotação 2')}

        {quotations.length === 0 && (
          <div className="text-center py-12 text-slate-500">Nenhuma cotação disponível.</div>
        )}
      </Card>

      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Bot className="h-5 w-5" /> Proposta Gerada por IA
            </DialogTitle>
            <DialogDescription>
              A IA analisou as cotações, filtrou as que excedem 20% do prazo e selecionou a mais
              econômica.
            </DialogDescription>
          </DialogHeader>

          {aiProposal?.template && !aiProposal.template.error ? (
            <div className="mt-4 space-y-4 text-slate-800 text-sm">
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                <h3 className="font-bold text-lg mb-4 text-center border-b pb-2">
                  {aiProposal.template.titulo}
                </h3>

                <div className="mb-4">
                  <h4 className="font-semibold text-slate-700 mb-1">Dados do Pedido</h4>
                  <p className="whitespace-pre-wrap">{aiProposal.template.dados_pedido}</p>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold text-slate-700 mb-1">Cotação Selecionada</h4>
                  <p className="whitespace-pre-wrap">{aiProposal.template.cotacao_selecionada}</p>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold text-slate-700 mb-1">Justificativa</h4>
                  <p className="whitespace-pre-wrap">{aiProposal.template.justificativa}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">Próximos Passos</h4>
                  <p className="whitespace-pre-wrap">{aiProposal.template.proximos_passos}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-red-500 text-center">
              Não foi possível gerar a proposta corretamente. Verifique os logs.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
