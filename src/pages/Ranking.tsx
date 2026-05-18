import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FileDown, Bot, Loader2, ArrowLeft, Check, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getQuotationsByPedido, analisarCotacoesIA, updateQuotation } from '@/services/quotations'
import { getPedido, type Pedido } from '@/services/pedidos'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Stepper } from '@/components/Stepper'
import { cn } from '@/lib/utils'
import { useRealtime } from '@/hooks/use-realtime'
import {
  rankQuotations,
  type EnrichedQuotation,
  calculateChargeableWeight,
} from '@/lib/freight-calculator'

export default function Ranking() {
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [quotations, setQuotations] = useState<EnrichedQuotation[]>([])
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiComment, setAiComment] = useState<string>('')

  const loadData = async () => {
    const pedidoId = location.state?.pedidoId
    if (!pedidoId) {
      navigate('/dashboard')
      return
    }
    try {
      const [ped, quots] = await Promise.all([getPedido(pedidoId), getQuotationsByPedido(pedidoId)])
      setPedido(ped)

      const ranked = rankQuotations(quots, ped)
      setQuotations(ranked)

      if (ranked.length > 0 && !aiComment) {
        const topOption = ranked[0]
        const topAgentName = topOption.option_description
          ? `${topOption.agent_name} - ${topOption.option_description}`
          : topOption.agent_name

        setAiComment(
          `A opção ${topAgentName} é a recomendada por apresentar o melhor custo-benefício (US$ ${topOption.computedTotal.toFixed(2)}) e score operacional de ${topOption.calculatedScore.toFixed(2)}, garantindo atendimento ao destino de forma eficiente.`,
        )
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [location.state?.pedidoId, navigate])

  useRealtime('quotations', () => {
    loadData()
  })
  useRealtime('pedidos', () => {
    loadData()
  })

  const handleGenerateAiProposal = async () => {
    if (!pedido || quotations.length === 0) return
    setIsAiLoading(true)
    try {
      const payload = {
        pedido_id: pedido.id,
        cotacoes: quotations.map((q) => ({
          id: q.id,
          agent_name: q.option_description
            ? `${q.agent_name} - ${q.option_description}`
            : q.agent_name,
          modal: q.modal,
          cost: q.computedTotal,
          transit_time: q.transit_time,
          etd: q.etd || new Date().toISOString(),
          free_time: q.free_time || 0,
          taxable_weight: q.qTaxable,
        })),
        prazo_desejado_dias: pedido.prazo_desejado_dias || null,
        origem: pedido.origem,
        destino: pedido.destino,
        peso_bruto: pedido.peso_bruto,
        modal_desejado: pedido.modal_desejado,
      }
      const res = await analisarCotacoesIA(payload)
      if (res.data?.template?.justificativa) {
        setAiComment(res.data.template.justificativa)
        toast({
          title: 'IA Concluída',
          description: 'Análise e justificativa geradas com sucesso.',
        })
      } else {
        throw new Error('Formato de resposta inesperado da IA')
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao gerar proposta com IA',
        variant: 'destructive',
      })
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateQuotation(id, { status: status as any })
      toast({ title: 'Status atualizado com sucesso' })
    } catch (err) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
    }
  }

  if (!pedido) {
    return (
      <div className="p-8 flex justify-center min-h-screen items-center">
        <Loader2 className="animate-spin h-12 w-12 text-[#00749b]" />
      </div>
    )
  }

  const pesoBruto = pedido.peso_bruto || 0
  const chargeableWeight = calculateChargeableWeight(pedido)

  const top1 = quotations[0]
  const top2 = quotations[1]

  const diffAbs = top2 && top1 ? top2.computedTotal - top1.computedTotal : 0
  const diffPct = top2 && top1 && top1.computedTotal > 0 ? (diffAbs / top1.computedTotal) * 100 : 0

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-[#c6e5b1] text-green-900'
    if (score >= 0.6) return 'bg-[#fff2cc] text-yellow-900'
    if (score >= 0.4) return 'bg-[#f8cbad] text-orange-900'
    return 'bg-[#f4b084] text-red-900'
  }

  const Th = ({ children, className, colSpan, rowSpan }: any) => (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cn(
        'border border-slate-300 px-2 py-1.5 align-middle text-xs font-semibold text-slate-700 bg-slate-100',
        className,
      )}
    >
      {children}
    </th>
  )

  const Td = ({ children, className, title }: any) => (
    <td
      title={title}
      className={cn('border border-slate-300 px-2 py-1 text-xs text-slate-800 bg-white', className)}
    >
      {children}
    </td>
  )

  const LabelTd = ({ children }: any) => (
    <td className="border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 w-1/3">
      {children}
    </td>
  )

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-6 pb-24 print:bg-white print:p-0">
      <style>{`
        @media print { 
          @page { margin: 5mm; size: landscape; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; zoom: 0.85; }
          .print-hidden { display: none !important; }
          .print\\:block { display: block !important; }
          table { page-break-inside: auto; width: 100% !important; max-width: 100% !important; table-layout: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          td, th { page-break-inside: avoid; }
          * { overflow: visible !important; }
        }
      `}</style>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 print-hidden gap-4">
        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto shadow-sm">
          <Link to="/dashboard" className="flex items-center gap-2 text-slate-600">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerateAiProposal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm transition-all"
            disabled={isAiLoading || quotations.length === 0}
          >
            {isAiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            Gerar Justificativa IA
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="flex items-center gap-2 shadow-sm"
          >
            <FileDown className="h-4 w-4 text-slate-600" /> Baixar PDF
          </Button>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto bg-white border border-slate-200 shadow-sm print:border-none print:shadow-none p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-[#00749b] pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center bg-[#00749b] text-white p-3 rounded-sm">
              <RefreshCcw className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#00749b] tracking-tight">BRASPORTO</h1>
              <p className="text-[10px] tracking-[0.2em] text-slate-500 font-semibold uppercase">
                International Logistics
              </p>
            </div>
          </div>

          <div className="text-center flex-1">
            <h2 className="text-xl md:text-2xl font-bold text-[#00749b] mb-1">
              COMPARADOR DE COTAÇÕES DE FRETE
            </h2>
            <p className="text-sm font-semibold text-slate-600 tracking-wider">
              AIR / LCL / FCL – COM VALIDAÇÃO E SCORE OPERACIONAL
            </p>
          </div>

          <table className="border-collapse border border-slate-300 text-xs w-full md:w-64 bg-white">
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                  ID DA COTAÇÃO:
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right font-bold text-slate-800">
                  {pedido.id.slice(0, 6).toUpperCase()}/
                  {new Date(pedido.created).getFullYear().toString().slice(2)}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                  DATA:
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right font-medium text-slate-800">
                  {new Date().toLocaleDateString('pt-BR')}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                  RESPONSÁVEL:
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right font-medium truncate max-w-[120px] text-slate-800">
                  {user?.name || user?.email?.split('@')[0]}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="print-hidden">
          <Stepper currentStep={5} />
        </div>
        {/* 3 Columns Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 print:grid-cols-3 gap-4 items-stretch">
          {/* Column 1 */}
          <div className="flex flex-col">
            <div className="bg-[#00749b] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              RESUMO DA SOLICITAÇÃO
            </div>
            <table className="w-full border-collapse flex-1 bg-white">
              <tbody>
                <tr>
                  <LabelTd>Modal:</LabelTd>
                  <Td>{pedido.modal_desejado}</Td>
                </tr>
                <tr>
                  <LabelTd>Incoterm:</LabelTd>
                  <Td>{pedido.incoterm}</Td>
                </tr>
                <tr>
                  <LabelTd>Origem:</LabelTd>
                  <Td>{pedido.origem}</Td>
                </tr>
                <tr>
                  <LabelTd>Destino:</LabelTd>
                  <Td>{pedido.destino}</Td>
                </tr>
                <tr>
                  <LabelTd>ETA Máximo:</LabelTd>
                  <Td>{pedido.prazo_desejado_dias ? `${pedido.prazo_desejado_dias} dias` : '-'}</Td>
                </tr>
                <tr>
                  <LabelTd>Mercadoria:</LabelTd>
                  <Td>{pedido.tipo_mercadoria || '-'}</Td>
                </tr>
                <tr>
                  <LabelTd>Dimensões:</LabelTd>
                  <Td>
                    {pedido.comprimento && pedido.largura && pedido.altura
                      ? `${pedido.comprimento}x${pedido.largura}x${pedido.altura} cm`
                      : '-'}
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col">
            <div className="bg-[#00749b] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              VALIDAÇÃO LOGÍSTICA
            </div>
            <table className="w-full border-collapse flex-1 bg-white">
              <tbody>
                <tr>
                  <LabelTd>Referência:</LabelTd>
                  <Td>{pedido.id.slice(0, 6).toUpperCase()}</Td>
                </tr>
                <tr>
                  <LabelTd>Peso Bruto Total:</LabelTd>
                  <Td>{pesoBruto.toFixed(2)} kg</Td>
                </tr>
                <tr>
                  <LabelTd>Peso Taxável (Base):</LabelTd>
                  <Td className="font-bold text-slate-800">
                    {chargeableWeight.toFixed(2)}{' '}
                    {pedido.modal_desejado === 'Aéreo' ? 'kg' : 'ton/cbm'}
                  </Td>
                </tr>
                <tr>
                  <LabelTd>Quantidade Vol:</LabelTd>
                  <Td>{pedido.quantidade_containers || '-'}</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col">
            <div className="bg-[#009b7c] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              CONFORMIDADE
            </div>
            <table className="w-full border-collapse flex-1 bg-white">
              <tbody>
                {['Referência', 'Modal', 'Incoterm', 'Origem', 'Destino', 'Peso', 'ETA Máximo'].map(
                  (item) => (
                    <tr key={item}>
                      <td className="border border-slate-300 px-2 py-[7px] text-xs font-semibold text-slate-700 bg-slate-50">
                        {item}
                      </td>
                      <td className="border border-slate-300 px-2 text-center text-green-600 font-bold bg-green-50 w-16">
                        OK
                      </td>
                      <td className="border border-slate-300 px-2 text-center w-10 bg-green-50">
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      </td>
                    </tr>
                  ),
                )}
                <tr>
                  <td
                    colSpan={2}
                    className="border border-slate-300 px-2 py-[11px] text-xs font-bold text-right bg-slate-100 uppercase tracking-wide"
                  >
                    STATUS GLOBAL
                  </td>
                  <td
                    colSpan={2}
                    className="border border-slate-300 px-2 py-[11px] text-xs font-bold text-center bg-[#c6e5b1] text-green-900 uppercase tracking-wide"
                  >
                    CONFORME
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* Quotations Table */}
        <div className="overflow-x-auto overflow-y-hidden pb-2 print:overflow-visible">
          <div className="bg-[#00749b] text-white font-bold text-center py-1.5 text-[12px] uppercase tracking-wide rounded-t-sm min-w-[1000px] print:min-w-0">
            COTAÇÕES RECEBIDAS DOS AGENTES
          </div>
          <table className="w-full text-center border-collapse whitespace-nowrap min-w-[1000px] print:min-w-0 print:whitespace-normal bg-white">
            <thead>
              <tr>
                <Th rowSpan={2}>AGENTE / ROTA</Th>
                <Th rowSpan={2}>MODAL</Th>
                <Th colSpan={5}>MEMÓRIA DE CÁLCULO (USD)</Th>
                <Th colSpan={3}>OPERAÇÃO</Th>
                <Th colSpan={2}>VALIDAÇÃO</Th>
                <Th rowSpan={2}>
                  SCORE
                  <br />
                  (0 a 1)
                </Th>
                <Th rowSpan={2} className="print-hidden">
                  STATUS
                </Th>
              </tr>
              <tr>
                <Th>Peso Taxável</Th>
                <Th>Frete Unit.</Th>
                <Th>Frete Total</Th>
                <Th>EXW / Origem</Th>
                <Th className="bg-slate-200 text-slate-900">Total Global</Th>
                <Th>Transit Time</Th>
                <Th>Frequência</Th>
                <Th>Validade</Th>
                <Th>Prazo OK</Th>
                <Th>Destino OK</Th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => {
                const prazoOk =
                  pedido.prazo_desejado_dias && q.transit_time
                    ? q.transit_time <= pedido.prazo_desejado_dias
                    : true
                const agentDisplayName = q.option_description
                  ? `${q.agent_name} - ${q.option_description}`
                  : q.agent_name

                return (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <Td
                      className="font-bold text-left whitespace-normal max-w-[200px]"
                      title={agentDisplayName}
                    >
                      {agentDisplayName}
                    </Td>
                    <Td>{q.modal}</Td>
                    <Td className="font-semibold text-blue-700 bg-blue-50/30">
                      {q.qTaxable.toFixed(2)}
                    </Td>
                    <Td>
                      {(q.cost_breakdown?.frete_unitario || 0) > 0
                        ? (q.cost_breakdown?.frete_unitario || 0).toFixed(2)
                        : '-'}
                    </Td>
                    <Td>{q.freteTotal > 0 ? q.freteTotal.toFixed(2) : '-'}</Td>
                    <Td title={q.cost_breakdown?.formula_origem || 'Taxa Origem'}>
                      {q.appliedTaxasOrigem > 0 ? q.appliedTaxasOrigem.toFixed(2) : '-'}
                    </Td>
                    <Td className="font-bold bg-slate-50 text-slate-900">
                      {q.computedTotal.toFixed(2)}
                    </Td>
                    <Td>{q.transit_time ? `${q.transit_time} dias` : '-'}</Td>
                    <Td>Semanal</Td>
                    <Td>{q.etd ? new Date(q.etd).toLocaleDateString('pt-BR') : '-'}</Td>
                    <Td
                      className={cn(
                        'font-bold',
                        prazoOk ? 'text-green-600 bg-green-50/50' : 'text-red-600 bg-red-50/50',
                      )}
                    >
                      {prazoOk ? 'OK' : 'NÃO'}
                    </Td>
                    <Td className="text-green-600 font-bold bg-green-50/50">SIM</Td>
                    <Td
                      className={cn(
                        'font-bold text-[13px] border border-slate-300',
                        getScoreColor(q.calculatedScore / 100),
                      )}
                    >
                      {q.calculatedScore.toFixed(1)}%
                    </Td>{' '}
                    <Td className="print-hidden w-28 text-center p-1">
                      <select
                        className="w-full text-xs p-1 border rounded bg-white text-slate-800"
                        value={q.status || 'em_analise'}
                        onChange={(e) => handleStatusChange(q.id, e.target.value)}
                      >
                        <option value="em_analise">Em análise</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="rejeitado">Rejeitado</option>
                      </select>
                    </Td>
                  </tr>
                )
              })}
              {quotations.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
                    className="py-8 text-slate-500 border border-slate-300 bg-white text-sm"
                  >
                    Nenhuma cotação recebida para este pedido.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Memoria de Calculo Section */}
        {quotations.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold text-lg text-slate-800 mb-3 print:text-black">
              Detalhamento Financeiro / Memória de Cálculo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quotations.map((q) => (
                <div
                  key={q.id}
                  className="border border-slate-200 p-3 rounded bg-slate-50 print:bg-transparent print:border-slate-300"
                >
                  <h4 className="font-bold text-slate-800 print:text-black">
                    {q.agent_name} {q.option_description ? `- ${q.option_description}` : ''}
                  </h4>
                  <ul className="text-xs text-slate-600 print:text-black space-y-1.5 mt-3">
                    <li>
                      <strong>Frete Base:</strong> USD {q.freteTotal.toFixed(2)}
                    </li>
                    <li>
                      <strong>EXW/Origem:</strong> USD {q.appliedTaxasOrigem.toFixed(2)} <br />
                      <span className="text-[10px] text-slate-500">{q.exwLog}</span>
                    </li>
                    {q.pickupFee > 0 && (
                      <li>
                        <strong>Pickup Fee:</strong> USD {q.pickupFee.toFixed(2)}
                      </li>
                    )}
                    {q.addTaxesLog.map((log, i) => (
                      <li key={i}>
                        <strong>Adicional:</strong> {log}
                      </li>
                    ))}
                    {q.destinationTaxes > 0 && (
                      <li>
                        <strong>Destino:</strong> USD {q.destinationTaxes.toFixed(2)}
                      </li>
                    )}
                    <li className="pt-2 border-t border-slate-200 mt-2 font-black text-slate-800 text-sm">
                      TOTAL: USD {q.computedTotal.toFixed(2)}
                    </li>
                  </ul>

                  <div className="mt-4 pt-3 border-t border-slate-200 print:border-slate-300">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Justificativa de Ranking
                    </h5>
                    <div className="flex gap-2 text-[10px] text-slate-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                        Custo: {q.costScore.toFixed(1)}/50
                      </span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                        Transit: {q.transitScore.toFixed(1)}/30
                      </span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                        Compat: {(q.compatScore * 20).toFixed(1)}/20
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* AI Recommendation Box */}{' '}
        <div className="border border-slate-300 bg-slate-50 rounded-sm mt-6 print:break-inside-avoid">
          <div className="bg-[#00749b]/10 text-[#00749b] font-bold px-4 py-2 text-[11px] uppercase tracking-wide border-b border-slate-300 flex justify-between items-center">
            <span>Análise de Decisão</span>
            {isAiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00749b]" />}
          </div>
          <div className="p-4 text-sm text-slate-700 leading-relaxed font-medium min-h-[80px] whitespace-pre-wrap print-hidden">
            <textarea
              className="w-full min-h-[100px] bg-white border border-slate-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00749b] resize-y"
              value={aiComment}
              onChange={(e) => setAiComment(e.target.value)}
              placeholder="Gere uma análise com IA ou insira seu comentário para justificar a escolha."
            />
          </div>
          <div className="hidden print:block p-4 text-sm text-slate-700 leading-relaxed font-medium min-h-[80px] whitespace-pre-wrap">
            {aiComment || 'Nenhuma análise informada.'}
          </div>
        </div>
      </div>
    </div>
  )
}
