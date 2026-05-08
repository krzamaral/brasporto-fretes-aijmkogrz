import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileDown, History as HistoryIcon, Ship, Plane } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRealtime } from '@/hooks/use-realtime'
import { getHistoryQuotations, type Quotation } from '@/services/quotations'

export default function History() {
  const [quotations, setQuotations] = useState<Quotation[]>([])

  const loadData = async () => {
    try {
      const data = await getHistoryQuotations()
      setQuotations(data)
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
    <div className="space-y-6 animate-fade-in print:m-0 print:space-y-4">
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { margin: 1cm; }
        }
      `}</style>

      {/* Print Header */}
      <div className="hidden print:flex items-center justify-between mb-8 border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            B
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Brasporto Fretes</h1>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold text-slate-700">Histórico de Cotações (30 dias)</h2>
          <p className="text-sm text-slate-500">Uso Interno</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 print:hidden gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-slate-800 flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-blue-600" />
            Histórico da Empresa
          </h2>
          <p className="text-muted-foreground">Cotações processadas nos últimos 30 dias.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Baixar PDF
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
        {quotations.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Nenhum histórico encontrado nos últimos 30 dias.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 print:bg-transparent print:border-b">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg print:rounded-none">Data</th>
                  <th className="px-4 py-3">Fornecedor</th>
                  <th className="px-4 py-3">Modal</th>
                  <th className="px-4 py-3 text-right">Custo (US$)</th>
                  <th className="px-4 py-3 text-center">Transit Time</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 rounded-tr-lg print:rounded-none">Usuário</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 print:hover:bg-transparent"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {new Date(q.created).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{q.agent_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        {q.modal === 'Aéreo' ? (
                          <Plane className="h-3.5 w-3.5" />
                        ) : (
                          <Ship className="h-3.5 w-3.5" />
                        )}
                        {q.modal}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 text-right">
                      {q.cost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-center">
                      {q.transit_time ? `${q.transit_time} dias` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-bold print:border print:border-slate-300">
                        {q.score || 0}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-slate-600 truncate max-w-[150px]"
                      title={q.expand?.user_id?.name || 'Sistema'}
                    >
                      {q.expand?.user_id?.name || 'Sistema'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Print Footer */}
      <div className="hidden print:block mt-12 pt-4 border-t text-center text-sm text-slate-500">
        Gerado em {new Date().toLocaleString('pt-BR')}
      </div>
    </div>
  )
}
