import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, History as HistoryIcon, Ship, Plane, Eye, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getPedidos, type Pedido } from '@/services/pedidos'
import { getHistoryQuotations, type Quotation } from '@/services/quotations'

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

    return (
      <div
        id="history-print-area"
        className="bg-white rounded-lg p-0 sm:p-6 pb-20 print:p-2 print:pb-0"
      >
        <div className="mb-8 border-b border-slate-200 pb-4 print:border-slate-800 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2 print:text-black">
              Relatório de Cotação de Frete (Memória de Cálculo)
            </h1>
            <div className="text-sm text-slate-500 print:text-black flex flex-wrap gap-4">
              <span>
                <strong>ID do Pedido:</strong> {pedido.id.toUpperCase()}
              </span>
              <span>
                <strong>Data da Solicitação:</strong>{' '}
                {new Date(pedido.created).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
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
                  {quotations.map((q, index) => {
                    let calcTaxable = q.taxable_weight || chargeableWeight

                    const freteUnitario = q.cost_breakdown?.frete_unitario || 0
                    const freteTotal =
                      q.cost_breakdown?.frete_peso || freteUnitario * calcTaxable || 0
                    const taxasOrigem =
                      q.cost_breakdown?.taxas_origem || q.cost_breakdown?.origin_taxes || 0

                    const isIncotermEXW = pedido.incoterm === 'EXW'
                    const showTaxasOrigem = isIncotermEXW ? taxasOrigem : taxasOrigem || 0

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
                          className="px-3 py-3 font-semibold text-slate-800 print:text-black max-w-[250px] truncate"
                          title={agentDisplayName}
                        >
                          {agentDisplayName}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 font-semibold print:text-black">
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
                          title={q.cost_breakdown?.formula_origem}
                        >
                          {showTaxasOrigem > 0 ? showTaxasOrigem.toFixed(2) : '-'}
                          {isIncotermEXW && showTaxasOrigem > 0 && (
                            <div className="text-[10px] text-blue-600 print:text-black leading-tight mt-0.5">
                              (EXW)
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-black text-blue-700 print:text-black text-sm">
                          {q.cost.toFixed(2)}
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
                        {winner ? winner.agent_name : '-'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 text-right">
                        {winner ? winner.cost.toFixed(2) : '-'}
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
