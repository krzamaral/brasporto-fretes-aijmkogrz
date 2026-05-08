import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useRealtime } from '@/hooks/use-realtime'
import { getQuotations, type Quotation } from '@/services/quotations'
import { cn } from '@/lib/utils'

export default function Ranking() {
  const [quotations, setQuotations] = useState<Quotation[]>([])

  const loadData = async () => {
    try {
      const data = await getQuotations()
      const sorted = [...data].sort((a, b) => b.score - a.score || a.cost - b.cost)
      setQuotations(sorted)
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
            Ranking de Fornecedores
          </h2>
          <p className="text-muted-foreground">
            Análise comparativa para decisão estratégica de frete.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/review" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm">
        <Stepper currentStep={3} />

        <div className="mt-12">
          <div className="grid gap-6 md:grid-cols-3">
            {quotations.map((q, index) => {
              const isTop = index === 0
              const isSecond = index === 1
              const isThird = index === 2

              return (
                <Card
                  key={q.id}
                  className={cn(
                    'p-6 relative overflow-hidden transition-all',
                    isTop
                      ? 'border-amber-300 shadow-amber-100/50 shadow-lg scale-105 z-10'
                      : 'border-slate-200',
                  )}
                >
                  {isTop && <div className="absolute top-0 left-0 w-full h-1 bg-amber-400" />}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex items-center justify-center w-10 h-10 rounded-full',
                          isTop
                            ? 'bg-amber-100 text-amber-600'
                            : isSecond
                              ? 'bg-slate-100 text-slate-600'
                              : isThird
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-slate-50 text-slate-400',
                        )}
                      >
                        {isTop ? (
                          <Trophy className="h-5 w-5" />
                        ) : isSecond ? (
                          <Medal className="h-5 w-5" />
                        ) : isThird ? (
                          <Award className="h-5 w-5" />
                        ) : (
                          <span className="font-bold">{index + 1}º</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{q.agent_name}</h4>
                        <p className="text-xs text-slate-500 font-medium">{q.modal}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-800">{q.score}</div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Score</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-500">Custo Total</span>
                      <span className="font-semibold text-slate-800">US$ {q.cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-500">Transit Time</span>
                      <span className="font-semibold text-slate-800">{q.transit_time} dias</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-slate-500">Free Time</span>
                      <span className="font-semibold text-slate-800">{q.free_time} dias</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button
                      className={cn(
                        'w-full',
                        isTop
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800',
                      )}
                    >
                      Selecionar
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
          {quotations.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              Nenhuma cotação disponível para ranking.
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between mt-6">
        <Button asChild variant="ghost">
          <Link to="/dashboard">Voltar ao Início</Link>
        </Button>
      </div>
    </div>
  )
}
