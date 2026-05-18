import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  History as HistoryIcon,
  Ship,
  Plane,
  Eye,
  Printer,
  RefreshCcw,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getPedidos, type Pedido } from '@/services/pedidos'
import { getHistoryQuotations, updateQuotation } from '@/services/quotations'
import {
  rankQuotations,
  type EnrichedQuotation,
  calculateChargeableWeight,
} from '@/lib/freight-calculator'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

type HistoryRow = {
  pedido: Pedido
  winner: EnrichedQuotation | null
  quotations: EnrichedQuotation[]
}

export default function History() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const ped = await getPedidos()
      const concluded = ped.filter((p) => p.status === 'concluido')
      const quotes = await getHistoryQuotations()

      const combined = concluded.map((p) => {
        const pQuotes = quotes.filter((q) => q.pedido_id === p.id)
        const ranked = rankQuotations(pQuotes, p)
        const winner = ranked.length > 0 ? ranked[0] : null
        return { pedido: p, winner, quotations: ranked }
      })
      setRows(combined)
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

  const handlePrintModal = () => window.print()

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateQuotation(id, { status: status as any })
      toast({ title: 'Status atualizado com sucesso' })
      if (selectedRow) {
        const updated = selectedRow.quotations.map((q) =>
          q.id === id ? { ...q, status: status as any } : q,
        )
        setSelectedRow({ ...selectedRow, quotations: updated })
      }
    } catch (err) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
    }
  }

  const renderModalContent = (row: HistoryRow) => {
    const { pedido, quotations } = row
    const pesoBruto = pedido.peso_bruto || 0
    const volume = pedido.volume || 0
    const chargeableWeight = calculateChargeableWeight(pedido)
    const isAereo = pedido.modal_desejado === 'Aéreo'

    return (
      <div
        id="history-print-area"
        className="bg-white rounded-lg p-0 sm:p-6 pb-20 print:p-2 print:pb-0"
      >
        <div className="mb-6 border-b-2 border-[#00749b] pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center bg-[#00749b] text-white p-3 rounded-sm print:bg-[#00749b] print:text-white"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              <RefreshCcw className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#00749b] tracking-tight print:text-[#00749b]">
                BRASPORTO
              </h1>
              <p className="text-[10px] tracking-[0.2em] text-slate-500 font-semibold uppercase print:text-slate-600">
                International Logistics
              </p>
            </div>
          </div>
          <div className="text-center flex-1">
            <h2 className="text-xl md:text-2xl font-bold text-[#00749b] mb-1 print:text-[#00749b]">
              RELATÓRIO DE COTAÇÃO DE FRETE
            </h2>
            <p className="text-sm font-semibold text-slate-600 tracking-wider">
              MEMÓRIA DE CÁLCULO DETALHADA
            </p>
          </div>
          <table className="border-collapse border border-slate-300 text-xs w-full md:w-64 bg-white print:border-slate-400">
            <tbody>
              <tr>
                <td
                  className="border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-700 print:border-slate-400 print:bg-slate-100"
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                  ID DO PEDIDO:
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right font-bold text-slate-800 print:border-slate-400">
                  {pedido.id.toUpperCase()}
                </td>
              </tr>
              <tr>
                <td
                  className="border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-700 print:border-slate-400 print:bg-slate-100"
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                  DATA:
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right font-medium text-slate-800 print:border-slate-400">
                  {new Date(pedido.created).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 print:text-black">
            1. Dados da Solicitação (Pedido)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
            <div className="bg-slate-50 print:bg-transparent p-3 rounded border border-slate-100 print:border-slate-300">
              <div className="text-slate-500 text-xs mb-1">Origem / Destino</div>
              <div className="font-bold text-slate-800 print:text-black">
                {pedido.origem} → {pedido.destino}
              </div>
            </div>
            <div className="bg-slate-50 print:bg-transparent p-3 rounded border border-slate-100 print:border-slate-300">
              <div className="text-slate-500 text-xs mb-1">Modal / Incoterm</div>
              <div className="font-bold text-slate-800 print:text-black">
                {pedido.modal_desejado} | {pedido.incoterm}
              </div>
            </div>
            <div className="bg-slate-50 print:bg-transparent p-3 rounded border border-slate-100 print:border-slate-300">
              <div className="text-slate-500 text-xs mb-1">Peso Bruto / Volume</div>
              <div className="font-bold text-slate-800 print:text-black">
                {pesoBruto} kg | {volume} CBM
              </div>
            </div>
            <div className="bg-slate-50 print:bg-transparent p-3 rounded border border-slate-100 print:border-slate-300">
              <div className="text-slate-500 text-xs mb-1">Peso Taxável (Base)</div>
              <div className="font-bold text-blue-700 print:text-black">
                {chargeableWeight.toFixed(2)} {isAereo ? 'kg' : 'ton/cbm'}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 print:text-black">
            2. Ranking de Cotações & Comparativo
          </h2>
          {quotations.length === 0 ? (
            <div className="p-4 bg-slate-50 text-slate-500 text-center rounded border border-slate-200">
              Nenhuma cotação registrada para este pedido.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 print:border-slate-800 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 print:bg-slate-200 text-slate-700 uppercase text-[11px] font-semibold">
                  <tr>
                    <th className="px-3 py-3 border-b print:border-slate-800">Rank</th>
                    <th className="px-3 py-3 border-b print:border-slate-800">
                      Agente / Rota / Carrier
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Peso Taxável
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Frete Unit. (US$)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Frete Total (US$)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Taxas Origem/EXW
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Custo Total (US$)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-center">Score</th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-center print-hidden">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                  {quotations.map((q, index) => {
                    const agentDisplayName = q.option_description
                      ? `${q.agent_name} - ${q.option_description}`
                      : q.agent_name
                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-slate-50/50 print:hover:bg-transparent bg-white print:bg-white text-[12px]"
                      >
                        <td className="px-3 py-3 font-bold text-slate-500 print:text-black">
                          #{index + 1}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800 print:text-black whitespace-normal max-w-[200px]">
                          {agentDisplayName}
                        </td>
                        <td className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50/30 print:text-black print:bg-transparent">
                          {q.qTaxable.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 print:text-black">
                          {(q.cost_breakdown?.frete_unitario || 0) > 0
                            ? (q.cost_breakdown?.frete_unitario || 0).toFixed(2)
                            : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 print:text-black">
                          {q.freteTotal > 0 ? q.freteTotal.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 print:text-black">
                          {q.appliedTaxasOrigem > 0 ? q.appliedTaxasOrigem.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-black text-slate-900 print:text-black text-sm">
                          {q.computedTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 print:bg-transparent print:border print:border-black rounded-full font-bold text-slate-700 print:text-black">
                            {q.calculatedScore.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center print-hidden">
                          <select
                            className="w-full text-xs p-1 border rounded bg-white text-slate-800"
                            value={q.status || 'em_analise'}
                            onChange={(e) => handleStatusChange(q.id, e.target.value)}
                          >
                            <option value="em_analise">Em análise</option>
                            <option value="aprovado">Aprovado</option>
                            <option value="rejeitado">Rejeitado</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {quotations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-800 mb-4 print:text-black">
              3. Memória de Cálculo Detalhada
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quotations.map((q) => (
                <div
                  key={q.id}
                  className="border border-slate-200 p-3 rounded bg-slate-50 print:bg-transparent print:border-slate-300"
                >
                  <h4 className="font-bold text-slate-800 print:text-black">{q.agent_name}</h4>
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
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-1 print:text-black">
                      Justificativa de Ranking
                    </h5>
                    <div className="flex gap-2 text-[10px] text-slate-600 print:text-black">
                      <span className="bg-slate-100 print:bg-transparent px-1.5 py-0.5 rounded print:border print:border-black">
                        Custo: {q.costScore.toFixed(1)}/50
                      </span>
                      <span className="bg-slate-100 print:bg-transparent px-1.5 py-0.5 rounded print:border print:border-black">
                        Transit: {q.transitScore.toFixed(1)}/30
                      </span>
                      <span className="bg-slate-100 print:bg-transparent px-1.5 py-0.5 rounded print:border print:border-black">
                        Compat: {(q.compatScore * 20).toFixed(1)}/20
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-200 print:border-slate-800 text-xs text-slate-400 print:text-black text-center print:block hidden">
          Documento gerado pelo sistema Brasporto Fretes em {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in print:m-0 print:space-y-4">
      <style>{`
        @media print { 
          body * { visibility: hidden; }
          #history-print-area, #history-print-area * { visibility: visible; }
          #history-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          @page { size: landscape; margin: 5mm; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 print:hidden gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-blue-600" /> Histórico de Processos
          </h2>
          <p className="text-muted-foreground">
            Decisões finais de frete processadas recentemente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm print:hidden">
        <div className="mb-6 flex justify-end">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              className="text-sm border-slate-300 rounded-md bg-white text-slate-700 py-1.5 px-3 border shadow-sm outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              <option value="em_analise">Em Análise</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Nenhum histórico encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Data</th>
                  <th className="px-4 py-3">Pedido (Origem → Destino)</th>
                  <th className="px-4 py-3">Modal</th>
                  <th className="px-4 py-3">Melhor Opção (Rank 1)</th>
                  <th className="px-4 py-3 text-right">Custo Rank 1 (US$)</th>
                  <th className="px-4 py-3 text-center">Score Rank 1</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((row) => {
                    if (statusFilter === 'todos') return true
                    if (row.winner) {
                      return (row.winner.status || 'em_analise') === statusFilter
                    }
                    return statusFilter === 'em_analise'
                  })
                  .map((row) => {
                    const { pedido, winner } = row
                    return (
                      <tr
                        key={pedido.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {new Date(pedido.created).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {pedido.origem}{' '}
                          <ArrowLeft className="inline h-3 w-3 rotate-180 text-slate-400" />{' '}
                          {pedido.destino}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            {pedido.modal_desejado === 'Aéreo' ? (
                              <Plane className="h-3.5 w-3.5" />
                            ) : (
                              <Ship className="h-3.5 w-3.5" />
                            )}
                            {pedido.modal_desejado}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-700">
                          {winner ? `${winner.agent_name}` : '-'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 text-right">
                          {winner ? winner.computedTotal.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {winner ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                              {winner.calculatedScore.toFixed(1)}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="secondary" size="sm" onClick={() => setSelectedRow(row)}>
                            <Eye className="h-4 w-4 mr-1.5" /> Visualizar
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:border-none print:shadow-none p-0">
          <DialogHeader className="p-6 pb-0 print:hidden">
            <DialogTitle>Detalhes do Histórico</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2 print:p-0">{selectedRow && renderModalContent(selectedRow)}</div>
          <div className="absolute top-4 right-4 print:hidden flex gap-2">
            <Button
              onClick={handlePrintModal}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Printer className="w-4 h-4 mr-2" /> Baixar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
