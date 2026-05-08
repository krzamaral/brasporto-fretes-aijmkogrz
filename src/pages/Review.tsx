import { Link } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck, AlertCircle } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Review() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Conferência de Dados</h2>
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

        <div className="mt-16 mb-12 flex flex-col items-center justify-center text-center">
          <div className="h-24 w-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <ClipboardCheck className="h-12 w-12 text-accent" strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-semibold text-slate-800 mb-3">
            Em breve: Conferência de dados
          </h3>
          <p className="text-slate-500 max-w-lg mb-8 text-lg">
            Esta etapa permitirá revisar os dados extraídos das planilhas, corrigir possíveis
            inconsistências e validar rotas e valores.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3 text-left">
              <AlertCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">Módulo em desenvolvimento</p>
                <p className="text-sm text-slate-500 mt-1">
                  A visualização em tabela interativa para conferência de rotas estará disponível na
                  próxima atualização do sistema.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-4 mt-6">
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/ranking">Avançar para Ranking</Link>
        </Button>
      </div>
    </div>
  )
}
