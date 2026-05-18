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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getPedidos, type Pedido } from '@/services/pedidos'
import { getHistoryQuotations, type Quotation } from '@/services/quotations'
import { calculateExw } from '@/lib/utils'

type HistoryRow = {
  pedido: Pedido
  winner: Quotation | null
  quotations: Quotation[]
}

export default function History() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const ped = await getPedidos()
        const concluded = ped.filter((p) => p.status === 'concluido')
        const quotes = await getHistoryQuotations()

        const combined = concluded.map((p) => {
          const pQuotes = quotes.filter((q) => q.pedido_id === p.id)
          const winner = pQuotes.length > 0 ? pQuotes[0] : null // already sorted by score desc
          return { pedido: p, winner, quotations: pQuotes }
        })
        setRows(combined)
      } catch (e) {
        console.error(e)
      }
    }
    loadData()
  }, [])

  const handlePrintModal = () => {
    window.print()
  }

  const renderModalContent = (row: HistoryRow) => {
    const { pedido, quotations } = row
    const pesoBruto = pedido.peso_bruto || 0
    const volume = pedido.volume || 0
    const volumetricWeightAir = (volume * 1000000) / 6000
    const isAereo = pedido.modal_desejado === 'Aéreo'

    const chargeableWeight = isAereo
      ? Math.ceil(Math.max(pesoBruto, volumetricWeightAir))
      : Math.max(pesoBruto / 1000, volume)

    const sortedQuotations = [...quotations].sort((a, b) => {
      const aTaxable = isAereo
        ? Math.ceil(a.taxable_weight || chargeableWeight)
        : a.taxable_weight || chargeableWeight
      const bTaxable = isAereo
        ? Math.ceil(b.taxable_weight || chargeableWeight)
        : b.taxable_weight || chargeableWeight

      const getTot = (q: Quotation, taxW: number) => {
        const fUnit = q.cost_breakdown?.frete_unitario || 0
        const fTot = q.cost_breakdown?.frete_peso || (fUnit > 0 ? fUnit * taxW : 0)
        let tOrig = q.cost_breakdown?.taxas_origem || q.cost_breakdown?.origin_taxes || 0
        if (q.cost_breakdown?.formula_origem) {
          tOrig = calculateExw(q.cost_breakdown.formula_origem, taxW, tOrig)
        }
        const isEXW = pedido.incoterm === 'EXW'
        const apOrig = isEXW ? tOrig : tOrig || 0
        const computed = fTot + apOrig + (q.cost_breakdown?.destination_taxes || 0)
        return computed > 0 ? computed : q.cost
      }
      return getTot(a, aTaxable) - getTot(b, bTaxable)
    })

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
            2. Ranking de Cotações & Memória de Cálculo
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
                      Peso Taxável (kg/cbm)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Frete Unit. (US$)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Frete Total (US$)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Taxas Origem/EXW (US$)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-right">
                      Custo Total (US$)
                    </th>
                    <th className="px-3 py-3 border-b print:border-slate-800 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                  {sortedQuotations.map((q, index) => {
                    const baseTaxable = q.taxable_weight ? q.taxable_weight : chargeableWeight
                    const calcTaxable = isAereo ? Math.ceil(baseTaxable) : baseTaxable

                    const freteUnitario = q.cost_breakdown?.frete_unitario || 0
                    const freteTotal =
                      q.cost_breakdown?.frete_peso ||
                      (freteUnitario > 0 ? freteUnitario * calcTaxable : 0)
                    let taxasOrigem =
                      q.cost_breakdown?.taxas_origem || q.cost_breakdown?.origin_taxes || 0

                    if (q.cost_breakdown?.formula_origem) {
                      taxasOrigem = calculateExw(
                        q.cost_breakdown.formula_origem,
                        calcTaxable,
                        taxasOrigem,
                      )
                    }

                    const isIncotermEXW = pedido.incoterm === 'EXW'
                    const showTaxasOrigem = isIncotermEXW ? taxasOrigem : taxasOrigem || 0

                    const computedTotal =
                      freteTotal + showTaxasOrigem + (q.cost_breakdown?.destination_taxes || 0)
                    const displayTotal = computedTotal > 0 ? computedTotal : q.cost

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
                        <td
                          className="px-3 py-3 font-semibold text-slate-800 print:text-black whitespace-normal max-w-[250px]"
                          title={agentDisplayName}
                        >
                          {agentDisplayName}
                        </td>
                        <td className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50/30 print:text-black print:bg-transparent">
                          {calcTaxable > 0 ? calcTaxable.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 print:text-black">
                          {freteUnitario > 0 ? freteUnitario.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 print:text-black">
                          {freteTotal > 0 ? freteTotal.toFixed(2) : '-'}
                        </td>
                        <td
                          className="px-3 py-3 text-right text-slate-600 print:text-black"
                          title={q.cost_breakdown?.formula_origem || 'Taxas de Origem'}
                        >
                          {showTaxasOrigem > 0 ? showTaxasOrigem.toFixed(2) : '-'}
                          {q.cost_breakdown?.formula_origem && (
                            <div className="text-[9px] text-slate-400 print:text-slate-600 leading-tight mt-0.5 truncate max-w-[120px] ml-auto">
                              ({q.cost_breakdown.formula_origem})
                            </div>
                          )}
                          {isIncotermEXW &&
                            showTaxasOrigem > 0 &&
                            !q.cost_breakdown?.formula_origem && (
                              <div className="text-[10px] text-blue-600 print:text-black leading-tight mt-0.5">
                                (EXW)
                              </div>
                            )}
                        </td>
                        <td className="px-3 py-3 text-right font-black text-slate-900 print:text-black text-sm">
                          {displayTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 print:bg-transparent print:border print:border-black rounded-full font-bold text-slate-700 print:text-black">
                            {q.score}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
          #history-print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            margin: 0;
            padding: 0;
          }
          @page { size: landscape; margin: 5mm; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 print:hidden gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-blue-600" /> Histórico da Empresa
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
                  <th className="px-4 py-3">Fornecedor Vencedor</th>
                  <th className="px-4 py-3 text-right">Custo Vencedor (US$)</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { pedido, winner } = row

                  let displayCost = winner?.cost || 0
                  if (winner) {
                    const isAereo = pedido.modal_desejado === 'Aéreo'
                    const pVol = ((pedido.volume || 0) * 1000000) / 6000
                    const pPeso = pedido.peso_bruto || 0
                    const chargeableWeight = isAereo
                      ? Math.ceil(Math.max(pPeso, pVol))
                      : Math.max(pPeso / 1000, pedido.volume || 0)
                    const qTaxable = isAereo
                      ? Math.ceil(winner.taxable_weight || chargeableWeight)
                      : winner.taxable_weight || chargeableWeight

                    const fUnit = winner.cost_breakdown?.frete_unitario || 0
                    const fTot =
                      winner.cost_breakdown?.frete_peso || (fUnit > 0 ? fUnit * qTaxable : 0)
                    let tOrig =
                      winner.cost_breakdown?.taxas_origem ||
                      winner.cost_breakdown?.origin_taxes ||
                      0
                    if (winner.cost_breakdown?.formula_origem) {
                      tOrig = calculateExw(winner.cost_breakdown.formula_origem, qTaxable, tOrig)
                    }
                    const isEXW = pedido.incoterm === 'EXW'
                    const apOrig = isEXW ? tOrig : tOrig || 0
                    const computed = fTot + apOrig + (winner.cost_breakdown?.destination_taxes || 0)
                    displayCost = computed > 0 ? computed : winner.cost
                  }

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
                        {winner
                          ? `${winner.agent_name}${winner.option_description ? ' - ' + winner.option_description : ''}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 text-right">
                        {winner ? displayCost.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {winner ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                            {winner.score}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">
                        {pedido.expand?.user_id?.name || 'Sistema'}
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
            <DialogTitle>Detalhes da Cotação</DialogTitle>
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
