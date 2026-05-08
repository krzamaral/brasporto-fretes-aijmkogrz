import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Ship, Plane } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRealtime } from '@/hooks/use-realtime'
import { getQuotations, type Quotation } from '@/services/quotations'

export default function Review() {
  const [quotations, setQuotations] = useState<Quotation[]>([])

  const loadData = async () => {
    try {
      const data = await getQuotations()
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-slate-800">
            Conferência de Dados
          </h2>
          <p className="text-muted-foreground">
            Revise as informações extraídas antes de prosseguir.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/upload" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm">
        <Stepper currentStep={2} />

        <div className="mt-12">
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Modal</TableHead>
                  <TableHead>Custo (US$)</TableHead>
                  <TableHead>Transit Time</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead>Free Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium text-slate-800">{q.agent_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {q.modal === 'Aéreo' ? (
                          <Plane className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Ship className="h-4 w-4 text-blue-500" />
                        )}
                        {q.modal}
                      </div>
                    </TableCell>
                    <TableCell>${q.cost.toFixed(2)}</TableCell>
                    <TableCell>{q.transit_time} dias</TableCell>
                    <TableCell>{new Date(q.etd).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{q.free_time} dias</TableCell>
                  </TableRow>
                ))}
                {quotations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Nenhuma cotação encontrada. Faça o upload primeiro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-4 mt-6">
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
          <Link to="/ranking">
            Avançar para Ranking
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
