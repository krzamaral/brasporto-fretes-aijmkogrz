import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPedido, type Pedido } from '@/services/pedidos'
import { getQuotationsByPedido, type Quotation } from '@/services/quotations'

export default function HistoryDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isPrint = searchParams.get('print') === 'true'

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      Promise.all([getPedido(id), getQuotationsByPedido(id)])
        .then(([p, qs]) => {
          setPedido(p)
          setQuotations(qs)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [id])

  useEffect(() => {
    if (isPrint && !loading && pedido) {
      const timer = setTimeout(() => window.print(), 800)
      return () => clearTimeout(timer)
    }
  }, [isPrint, loading, pedido])

  if (loading) {
    return (
      <div className="p-8 flex justify-center text-slate-500 animate-pulse">
        Carregando detalhes...
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="p-8 text-center text-slate-500 flex flex-col items-center">
        <AlertCircle className="h-10 w-10 text-red-400 mb-4" />
        <p>Pedido não encontrado.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/history">Voltar ao Histórico</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in print:m-0 print:p-0">
      <style>{`
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background: white !important; 
          }
          body * {
            visibility: hidden;
          }
          #history-print-area, #history-print-area * {
            visibility: visible;
          }
          #history-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <Button variant="ghost" asChild className="text-slate-600">
          <Link to="/history">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      <div
        id="history-print-area"
        className="bg-white print:bg-transparent rounded-lg p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none"
      >
        <div className="mb-8 border-b border-slate-200 pb-4 print:border-slate-800">
          <h1 className="text-2xl font-bold text-slate-800 mb-2 print:text-black">
            Relatório de Cotação de Frete
          </h1>
          <div className="text-sm text-slate-500 print:text-black flex gap-4">
            <span>
              <strong>ID do Pedido:</strong> {pedido.id}
            </span>
            <span>
              <strong>Data da Solicitação:</strong>{' '}
              {new Date(pedido.created).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 print:text-black">
            1. Dados da Solicitação (Pedido)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
            <div className="bg-slate-50 print:bg-transparent p-3 rounded border border-slate-100 print:border-slate-300">
              <div className="text-slate-500 text-xs mb-1">Origem / Destino</div>
              <div className="font-medium text-slate-800 print:text-black">
                {pedido.origem} → {pedido.destino}
              </div>
            </div>
            <div className="bg-slate-50 print:bg-transparent p-3 rounded border border-slate-100 print:border-slate-300">
              <div className="text-slate-500 text-xs mb-1">Modal / Incoterm</div>
              <div className="font-medium text-slate-800 print:text-black">
                {pedido.modal_desejado} | {pedido.incoterm}
              </div>
            </div>
            <div className="bg-slate-50 print:bg-transparent p-3 rounded border border-slate-100 print:border-slate-300">
              <div className="text-slate-500 text-xs mb-1">Peso Bruto / Volume</div>
              <div className="font-medium text-slate-800 print:text-black">
                {pedido.peso_bruto || 0} kg | {pedido.volume || 0} CBM
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
                <thead className="bg-slate-100 print:bg-slate-200 text-slate-700 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-4 py-3 border-b print:border-slate-800">Rank</th>
                    <th className="px-4 py-3 border-b print:border-slate-800">Agente / Rota</th>
                    <th className="px-4 py-3 border-b print:border-slate-800 text-right">
                      Peso Tributável (kg)
                    </th>
                    <th className="px-4 py-3 border-b print:border-slate-800 text-right">
                      Frete Unit. (US$)
                    </th>
                    <th className="px-4 py-3 border-b print:border-slate-800 text-right">
                      Frete Total (US$)
                    </th>
                    <th className="px-4 py-3 border-b print:border-slate-800 text-right">
                      Taxas Origem/EXW (US$)
                    </th>
                    <th className="px-4 py-3 border-b print:border-slate-800 text-right">
                      Custo Total (US$)
                    </th>
                    <th className="px-4 py-3 border-b print:border-slate-800 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                  {quotations.map((q, index) => {
                    const pesoBruto = pedido.peso_bruto || 0
                    const volume = pedido.volume || 0
                    const pesoCubado = volume * 167
                    const isAereo = pedido.modal_desejado === 'Aéreo'

                    let calcTaxable = q.taxable_weight || 0
                    if (!q.taxable_weight) {
                      calcTaxable = isAereo ? Math.max(pesoBruto, pesoCubado) : pesoBruto
                    }

                    const freteUnitario = q.cost_breakdown?.frete_unitario || 0
                    const freteTotal =
                      q.cost_breakdown?.frete_peso || freteUnitario * calcTaxable || 0
                    const taxasOrigem =
                      q.cost_breakdown?.taxas_origem || q.cost_breakdown?.origin_taxes || 0

                    const isIncotermEXW = pedido.incoterm === 'EXW'
                    const showTaxasOrigem = isIncotermEXW ? taxasOrigem : taxasOrigem || 0

                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-slate-50/50 print:hover:bg-transparent bg-white print:bg-white"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-500 print:text-black">
                          #{index + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 print:text-black">
                          {q.agent_name}
                          {q.option_description && (
                            <div className="text-xs text-slate-500 font-normal mt-0.5">
                              {q.option_description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 print:text-black">
                          {calcTaxable > 0 ? calcTaxable.toFixed(2) : '-'}
                          {isAereo && calcTaxable === pesoCubado && calcTaxable > pesoBruto && (
                            <div className="text-[10px] text-amber-600 print:text-black leading-tight mt-0.5">
                              (Cubado)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 print:text-black">
                          {freteUnitario > 0 ? freteUnitario.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 print:text-black">
                          {freteTotal > 0 ? freteTotal.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 print:text-black">
                          {showTaxasOrigem > 0 ? showTaxasOrigem.toFixed(2) : '-'}
                          {isIncotermEXW && showTaxasOrigem > 0 && (
                            <div className="text-[10px] text-blue-600 print:text-black leading-tight mt-0.5">
                              (EXW)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-700 print:text-black">
                          {q.cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 print:bg-transparent print:border print:border-black rounded-full font-semibold text-slate-700 print:text-black">
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
    </div>
  )
}
