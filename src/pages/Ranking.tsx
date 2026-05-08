import { Link } from 'react-router-dom'
import { ArrowLeft, Trophy, BarChart3 } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Ranking() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Ranking de Fornecedores</h2>
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

        <div className="mt-16 mb-12 flex flex-col items-center justify-center text-center">
          <div className="relative">
            <div className="h-24 w-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 z-10 relative border-4 border-white shadow-sm">
              <Trophy className="h-12 w-12 text-amber-500" strokeWidth={1.5} />
            </div>
            <div className="absolute -right-4 -bottom-2 h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center z-20 border-4 border-white shadow-sm">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
          </div>

          <h3 className="text-2xl font-semibold text-slate-800 mb-3 mt-4">
            Em breve: Ranking e Cotações
          </h3>
          <p className="text-slate-500 max-w-lg mb-8 text-lg">
            Aqui você visualizará o ranking inteligente das transportadoras, comparando custo, prazo
            de entrega e SLA com gráficos interativos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full text-left">
            <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
              <h4 className="font-semibold text-slate-800 mb-2">Simulação de Cenários</h4>
              <p className="text-sm text-slate-500">
                Compare fornecedores alternando pesos entre Custo vs. Prazo de Entrega.
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
              <h4 className="font-semibold text-slate-800 mb-2">Decisão e Validação</h4>
              <p className="text-sm text-slate-500">
                Exporte relatórios justificativos para aprovação final da diretoria.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-between mt-6">
        <Button asChild variant="ghost">
          <Link to="/dashboard">Voltar ao Início</Link>
        </Button>
        <Button disabled className="bg-primary opacity-50 cursor-not-allowed">
          Finalizar Decisão
        </Button>
      </div>
    </div>
  )
}
