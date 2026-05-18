import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileDown, History as HistoryIcon, Ship, Plane, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getPedidos, type Pedido } from '@/services/pedidos'
import { getHistoryQuotations, type Quotation } from '@/services/quotations'

type HistoryRow = {
  pedido: Pedido
  winner: Quotation | null
}

export default function History() {
  const [rows, setRows] = useState<HistoryRow[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const ped = await getPedidos()
        const concluded = ped.filter((p) => p.status === 'concluido')
        const quotes = await getHistoryQuotations()

        const combined = concluded.map((p) => {
          const pQuotes = quotes.filter((q) => q.pedido_id === p.id)
          const winner = pQuotes.length > 0 ? pQuotes[0] : null // already sorted by score desc
          return { pedido: p, winner }
        })
        setRows(combined)
      } catch (e) {
        console.error(e)
      }
    }
    loadData()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in print:m-0 print:space-y-4">
      <style>{`@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @page { margin: 1cm; } }`}</style>

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
        {rows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Nenhum histórico encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 print:bg-transparent print:border-b">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Data</th>
                  <th className="px-4 py-3">Pedido (Origem → Destino)</th>
                  <th className="px-4 py-3">Modal</th>
                  <th className="px-4 py-3">Fornecedor Vencedor</th>
                  <th className="px-4 py-3 text-right">Custo Vencedor (US$)</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ pedido, winner }) => (
                  <tr
                    key={pedido.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 print:hover:bg-transparent"
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
                    <td className="px-4 py-3 text-right print:hidden">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/history/${pedido.id}`}>Consultar</Link>
                        </Button>
                        <Button asChild variant="secondary" size="sm">
                          <Link to={`/history/${pedido.id}?print=true`}>Imprimir/PDF</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
