import { Link } from 'react-router-dom'
import { FolderOpen, FileUp, PlusCircle } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Dashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="mb-12">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Resumo da Solicitação</h2>
        <p className="text-muted-foreground">
          Acompanhe o progresso das suas cotações de frete ativas.
        </p>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm">
        <Stepper currentStep={1} />

        <div className="mt-16 mb-8 flex flex-col items-center justify-center text-center px-4">
          <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
            <FolderOpen className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            Nenhuma solicitação ativa no momento
          </h3>
          <p className="text-slate-500 max-w-md mb-8">
            Para iniciar o processo de comparação de fretes, faça o upload das cotações recebidas
            dos fornecedores.
          </p>

          <Button
            asChild
            size="lg"
            className="bg-accent hover:bg-accent/90 text-white font-medium shadow-sm h-12 px-8 rounded-full"
          >
            <Link to="/upload" className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Fazer Upload de Cotações
            </Link>
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Placeholder cards for future dashboard widgets */}
        <Card className="p-6 border border-dashed bg-transparent shadow-none flex flex-col items-center justify-center text-slate-400 h-40">
          <PlusCircle className="h-8 w-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">Widget de Economia</span>
        </Card>
        <Card className="p-6 border border-dashed bg-transparent shadow-none flex flex-col items-center justify-center text-slate-400 h-40">
          <PlusCircle className="h-8 w-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">Fornecedores Top 3</span>
        </Card>
        <Card className="p-6 border border-dashed bg-transparent shadow-none flex flex-col items-center justify-center text-slate-400 h-40">
          <PlusCircle className="h-8 w-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">Histórico Recente</span>
        </Card>
      </div>
    </div>
  )
}
