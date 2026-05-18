import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FileDown, Bot, Loader2, ArrowLeft, Check, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getQuotationsByPedido, analisarCotacoesIA, type Quotation } from '@/services/quotations'
import { getPedido, type Pedido } from '@/services/pedidos'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Stepper } from '@/components/Stepper'
import { cn } from '@/lib/utils'

export default function Ranking() {
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiComment, setAiComment] = useState<string>('')

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

        if (quots.length > 0) {
          const sorted = [...quots].sort((a, b) => getScore(b) - getScore(a))
          const topOption = sorted[0]
          const topAgentName = topOption.option_description
            ? `${topOption.agent_name} - ${topOption.option_description}`
            : topOption.agent_name
          setAiComment(
            `A opção ${topAgentName} é a recomendada por apresentar o melhor custo-benefício (US$ ${topOption.cost.toFixed(2)}) e score operacional de ${getScore(topOption).toFixed(2)}, garantindo atendimento ao destino de forma eficiente.`,
          )
        }
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
          agent_name: q.option_description
            ? `${q.agent_name} - ${q.option_description}`
            : q.agent_name,
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

  const getScore = (q: Quotation) => {
    let score = q.score || 0
    if (score > 1 && score <= 100) return score / 100
    if (score > 100) return 1
    return score
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-[#c6e5b1] text-green-900'
    if (score >= 0.6) return 'bg-[#fff2cc] text-yellow-900'
    if (score >= 0.4) return 'bg-[#f8cbad] text-orange-900'
    return 'bg-[#f4b084] text-red-900'
  }

  if (!pedido) {
    return (
      <div className="p-8 flex justify-center min-h-screen items-center">
        <Loader2 className="animate-spin h-12 w-12 text-[#00749b]" />
      </div>
    )
  }

  const volume = pedido.volume || 0
  const pesoBruto = pedido.peso_bruto || 0
  const chargeableWeight =
    pedido.modal_desejado === 'Aéreo'
      ? Math.max(pesoBruto, volume * 167)
      : Math.max(pesoBruto / 1000, volume)

  const sortedQuots = [...quotations].sort((a, b) => getScore(b) - getScore(a))
  const top1 = sortedQuots[0]
  const top2 = sortedQuots[1]
  const diffAbs = top2 && top1 ? top2.cost - top1.cost : 0
  const diffPct = top2 && top1 && top1.cost > 0 ? (diffAbs / top1.cost) * 100 : 0

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

  const Td = ({ children, className }: any) => (
    <td
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
          @page { margin: 10mm; size: landscape; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
          .print-hidden { display: none !important; }
          table { page-break-inside: auto; max-width: 100% !important; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          td, th { page-break-inside: avoid; }
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

        {/* Stepper */}
        <div className="print-hidden">
          <Stepper currentStep={5} />
        </div>

        {/* 3 Columns Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 print:grid-cols-3 gap-4 items-stretch">
          {/* Column 1: Client Request */}
          <div className="flex flex-col">
            <div className="bg-[#00749b] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              RESUMO DA SOLICITAÇÃO DO CLIENTE (E-MAIL)
            </div>
            <table className="w-full border-collapse flex-1 bg-white">
              <tbody>
                <tr>
                  <LabelTd>Cliente:</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>Referência Cliente:</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>Modal:</LabelTd>
                  <Td>{pedido.modal_desejado}</Td>
                </tr>
                <tr>
                  <LabelTd>Incoterm:</LabelTd>
                  <Td>{pedido.incoterm}</Td>
                </tr>
                <tr>
                  <LabelTd>Origem (Coleta):</LabelTd>
                  <Td>{pedido.origem}</Td>
                </tr>
                <tr>
                  <LabelTd>Destino (Entrega):</LabelTd>
                  <Td>{pedido.destino}</Td>
                </tr>
                <tr>
                  <LabelTd>Ready Date:</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>ETA Máximo / Prazo:</LabelTd>
                  <Td>{pedido.prazo_desejado_dias ? `${pedido.prazo_desejado_dias} dias` : '-'}</Td>
                </tr>
                <tr>
                  <LabelTd>Descrição da Carga:</LabelTd>
                  <Td>{pedido.tipo_mercadoria || '-'}</Td>
                </tr>
                <tr>
                  <LabelTd>NCM:</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>Valor Mercadoria:</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>Observações:</LabelTd>
                  <Td>-</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Column 2: Logistics Validation */}
          <div className="flex flex-col">
            <div className="bg-[#00749b] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              DADOS CONFIRMADOS NA VALIDAÇÃO LOGÍSTICA
            </div>
            <table className="w-full border-collapse flex-1 bg-white">
              <tbody>
                <tr>
                  <LabelTd>Referência / Processo:</LabelTd>
                  <Td>{pedido.id.slice(0, 6).toUpperCase()}</Td>
                </tr>
                <tr>
                  <LabelTd>Cliente:</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>Modal:</LabelTd>
                  <Td>{pedido.modal_desejado}</Td>
                </tr>
                <tr>
                  <LabelTd>Incoterm:</LabelTd>
                  <Td>{pedido.incoterm}</Td>
                </tr>
                <tr>
                  <LabelTd>Origem (Coleta):</LabelTd>
                  <Td>{pedido.origem}</Td>
                </tr>
                <tr>
                  <LabelTd>Destino (Entrega):</LabelTd>
                  <Td>{pedido.destino}</Td>
                </tr>
                <tr>
                  <LabelTd>Peso Bruto Total:</LabelTd>
                  <Td>{pesoBruto.toFixed(2)} kg</Td>
                </tr>
                <tr>
                  <LabelTd>Peso Cubado / Chargeable:</LabelTd>
                  <Td>
                    {chargeableWeight.toFixed(2)}{' '}
                    {pedido.modal_desejado === 'Aéreo' ? 'kg' : 'ton/cbm'}
                  </Td>
                </tr>
                <tr>
                  <LabelTd>Quantidade de Volumes:</LabelTd>
                  <Td>{pedido.quantidade_containers || '-'}</Td>
                </tr>
                <tr>
                  <LabelTd>Dimensões (cm):</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>Commodity / NCM:</LabelTd>
                  <Td>{pedido.tipo_mercadoria || '-'}</Td>
                </tr>
                <tr>
                  <LabelTd>Ready Date:</LabelTd>
                  <Td>-</Td>
                </tr>
                <tr>
                  <LabelTd>ETA Máximo / Prazo:</LabelTd>
                  <Td>{pedido.prazo_desejado_dias ? `${pedido.prazo_desejado_dias} dias` : '-'}</Td>
                </tr>
                <tr>
                  <LabelTd>Observações:</LabelTd>
                  <Td>-</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Column 3: Conformity Checklist */}
          <div className="flex flex-col">
            <div className="bg-[#009b7c] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              CONFORMIDADE CLIENTE x VALIDAÇÃO
            </div>
            <table className="w-full border-collapse flex-1 bg-white">
              <tbody>
                {[
                  'Cliente',
                  'Referência / Processo',
                  'Modal',
                  'Incoterm',
                  'Origem',
                  'Destino',
                  'Peso',
                  'Dimensões / Volumes',
                  'Ready Date',
                  'ETA Máximo',
                ].map((item) => (
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
                ))}
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
                <Th rowSpan={2} className="w-[12%]">
                  AGENTE /<br />
                  ROTA
                </Th>
                <Th rowSpan={2} className="w-[6%]">
                  MODAL
                </Th>
                <Th colSpan={4}>CUSTOS (USD)</Th>
                <Th colSpan={3}>OPERAÇÃO</Th>
                <Th colSpan={3}>VALIDAÇÃO (x LOGÍSTICA)</Th>
                <Th rowSpan={2} className="w-[8%]">
                  SCORE
                  <br />
                  OPERACIONAL
                  <br />
                  (0 a 1)
                </Th>
              </tr>
              <tr>
                <Th>
                  Frete
                  <br />
                  Unitário
                </Th>
                <Th>
                  Total Frete
                  <br />
                  Peso
                </Th>
                <Th>
                  Taxas de
                  <br />
                  Origem
                </Th>
                <Th className="bg-slate-200 text-slate-900">
                  Valor
                  <br />
                  Total
                </Th>
                <Th>
                  Transit Time
                  <br />
                  (dias)
                </Th>
                <Th>Frequência</Th>
                <Th>
                  Validade da
                  <br />
                  Cotação
                </Th>
                <Th>
                  Ready
                  <br />
                  Date OK
                </Th>
                <Th>
                  Prazo
                  <br />
                  Entrega OK
                </Th>
                <Th>
                  Destino
                  <br />
                  OK
                </Th>
              </tr>
            </thead>
            <tbody>
              {sortedQuots.map((q) => {
                const score = getScore(q)
                const scoreColor = getScoreColor(score)
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
                      className="font-bold text-left truncate max-w-[200px]"
                      title={agentDisplayName}
                    >
                      {agentDisplayName}
                    </Td>
                    <Td>{q.modal}</Td>
                    <Td>
                      {q.cost_breakdown?.frete_unitario
                        ? q.cost_breakdown.frete_unitario.toFixed(2)
                        : '-'}
                    </Td>
                    <Td>
                      {q.cost_breakdown?.frete_peso
                        ? q.cost_breakdown.frete_peso.toFixed(2)
                        : q.cost_breakdown?.freight
                          ? q.cost_breakdown.freight.toFixed(2)
                          : '-'}
                    </Td>
                    <Td>
                      {q.cost_breakdown?.taxas_origem
                        ? q.cost_breakdown.taxas_origem.toFixed(2)
                        : q.cost_breakdown?.origin_taxes
                          ? q.cost_breakdown.origin_taxes.toFixed(2)
                          : '-'}
                    </Td>
                    <Td className="font-bold bg-slate-50 text-slate-900">{q.cost.toFixed(2)}</Td>
                    <Td>{q.transit_time ? `${q.transit_time} a ${q.transit_time + 1}` : '-'}</Td>
                    <Td>Semanal</Td>
                    <Td>{q.etd ? new Date(q.etd).toLocaleDateString('pt-BR') : '-'}</Td>
                    <Td className="text-green-600 font-bold bg-green-50/50">OK</Td>
                    <Td
                      className={cn(
                        'font-bold',
                        prazoOk ? 'text-green-600 bg-green-50/50' : 'text-red-600 bg-red-50/50',
                      )}
                    >
                      {prazoOk ? 'OK' : 'NÃO'}
                    </Td>
                    <Td className="text-green-600 font-bold bg-green-50/50">SIM</Td>
                    <Td className={cn('font-bold text-[13px] border border-slate-300', scoreColor)}>
                      {score.toFixed(2)}
                    </Td>
                  </tr>
                )
              })}
              {quotations.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    className="py-8 text-slate-500 border border-slate-300 bg-white text-sm"
                  >
                    Nenhuma cotação recebida para este pedido.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
            Obs.: Valores de Free Time / Demurrage / Detention são aplicáveis apenas para
            modalidades marítimas (LCL / FCL).
          </p>
        </div>

        {/* Footer Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 print:grid-cols-12 gap-4 items-stretch">
          {/* Decision Summary (Col 1-7) */}
          <div className="lg:col-span-7 print:col-span-7 flex flex-col">
            <div className="bg-[#00749b] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              RESUMO DA DECISÃO
            </div>
            <div className="grid grid-cols-5 border border-slate-300 border-t-0 bg-white flex-1">
              {/* Option 1 */}
              <div className="col-span-2 border-r border-slate-300 flex flex-col">
                <div className="bg-slate-100 font-bold text-slate-800 text-center py-1.5 text-[10px] border-b border-slate-300 tracking-wide">
                  MELHOR OPÇÃO (Ranking 1)
                </div>
                <table className="w-full text-[11px] flex-1">
                  <tbody>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Agente:
                      </td>
                      <td
                        className="px-2 py-[5px] text-right font-bold text-slate-800 border-b border-slate-200 truncate max-w-[120px]"
                        title={
                          top1
                            ? `${top1.agent_name}${top1.option_description ? ` - ${top1.option_description}` : ''}`
                            : undefined
                        }
                      >
                        {top1
                          ? `${top1.agent_name}${top1.option_description ? ` - ${top1.option_description}` : ''}`
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Total Geral:
                      </td>
                      <td className="px-2 py-[5px] text-right font-bold text-green-700 border-b border-slate-200">
                        USD {top1?.cost?.toFixed(2) || '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Transit Time:
                      </td>
                      <td className="px-2 py-[5px] text-right font-medium text-slate-800 border-b border-slate-200">
                        {top1?.transit_time ? `${top1.transit_time} dias` : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Score Operacional:
                      </td>
                      <td
                        className={cn(
                          'px-2 py-[5px] text-right font-bold border-b border-slate-200',
                          top1 ? getScoreColor(getScore(top1)) : '',
                        )}
                      >
                        {top1 ? getScore(top1).toFixed(2) : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600">Elegível:</td>
                      <td className="px-2 py-[5px] text-right font-bold text-green-600">SIM</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Option 2 */}
              <div className="col-span-2 border-r border-slate-300 flex flex-col">
                <div className="bg-slate-100 font-bold text-slate-800 text-center py-1.5 text-[10px] border-b border-slate-300 tracking-wide">
                  SEGUNDO LUGAR (Ranking 2)
                </div>
                <table className="w-full text-[11px] flex-1">
                  <tbody>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Agente:
                      </td>
                      <td
                        className="px-2 py-[5px] text-right font-bold text-slate-800 border-b border-slate-200 truncate max-w-[120px]"
                        title={
                          top2
                            ? `${top2.agent_name}${top2.option_description ? ` - ${top2.option_description}` : ''}`
                            : undefined
                        }
                      >
                        {top2
                          ? `${top2.agent_name}${top2.option_description ? ` - ${top2.option_description}` : ''}`
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Total Geral:
                      </td>
                      <td className="px-2 py-[5px] text-right font-bold text-slate-800 border-b border-slate-200">
                        USD {top2?.cost?.toFixed(2) || '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Transit Time:
                      </td>
                      <td className="px-2 py-[5px] text-right font-medium text-slate-800 border-b border-slate-200">
                        {top2?.transit_time ? `${top2.transit_time} dias` : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600 border-b border-slate-200">
                        Score Operacional:
                      </td>
                      <td
                        className={cn(
                          'px-2 py-[5px] text-right font-bold border-b border-slate-200',
                          top2 ? getScoreColor(getScore(top2)) : '',
                        )}
                      >
                        {top2 ? getScore(top2).toFixed(2) : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-[5px] font-semibold text-slate-600">Elegível:</td>
                      <td className="px-2 py-[5px] text-right font-bold text-green-600">SIM</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Diff */}
              <div className="col-span-1 bg-slate-50 flex flex-col justify-center items-center p-2 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight mb-2 tracking-wide">
                  Comparativo
                  <br />
                  Financeiro
                </span>
                <div className="w-full h-[1px] bg-slate-200 mb-2"></div>
                <div className="text-[10px] font-semibold text-slate-600 mb-0.5 uppercase">
                  Diferença:
                </div>
                <div className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
                  USD {diffAbs.toFixed(2)}
                </div>
                <div className="text-[12px] font-black text-orange-600 mt-1.5 bg-orange-100 px-1.5 py-0.5 rounded-sm">
                  +{diffPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Ranking List (Col 8-12) */}
          <div className="lg:col-span-5 print:col-span-5 h-full flex flex-col">
            <div className="bg-[#00749b] text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-wide rounded-t-sm">
              RANKING FINAL (Elegíveis)
            </div>
            <div className="border border-t-0 border-slate-300 bg-white flex-1">
              <table className="w-full text-[11px] text-center h-full">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                    <th className="py-1.5 px-1 border-r border-slate-300 w-10 font-bold">RANK</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-left font-bold">
                      AGENTE
                    </th>
                    <th className="py-1.5 px-2 border-r border-slate-300 font-bold">TOTAL (USD)</th>
                    <th className="py-1.5 px-2 font-bold">SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedQuots.slice(0, 5).map((q, idx) => {
                    const agentDisplayName = q.option_description
                      ? `${q.agent_name} - ${q.option_description}`
                      : q.agent_name
                    return (
                      <tr key={q.id} className="border-b border-slate-200 last:border-0">
                        <td className="py-1.5 px-1 border-r border-slate-200 font-black text-slate-600 bg-slate-50">
                          {idx + 1}
                        </td>
                        <td
                          className="py-1.5 px-2 border-r border-slate-200 font-bold text-slate-800 text-left truncate max-w-[150px]"
                          title={agentDisplayName}
                        >
                          {agentDisplayName}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-medium text-slate-700">
                          {q.cost.toFixed(2)}
                        </td>
                        <td className={cn('py-1.5 px-2 font-bold', getScoreColor(getScore(q)))}>
                          {getScore(q).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                  {sortedQuots.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-slate-500">
                        Sem dados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Recommendation Box */}
        <div className="border border-slate-300 bg-slate-50 rounded-sm mt-6">
          <div className="bg-[#00749b]/10 text-[#00749b] font-bold px-4 py-2 text-[11px] uppercase tracking-wide border-b border-slate-300 flex justify-between items-center">
            <span>Comentário sobre a opção indicada</span>
            {isAiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00749b]" />}
          </div>
          <div className="p-4 text-sm text-slate-700 leading-relaxed font-medium min-h-[80px] whitespace-pre-wrap">
            {aiComment
              ? aiComment
              : 'Gere uma análise com IA ou insira seu comentário para justificar a escolha.'}
          </div>
        </div>
      </div>
    </div>
  )
}
