import { Link } from 'react-router-dom'
import { ArrowLeft, CloudUpload, FileType, Info } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Upload() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Upload de Cotações</h2>
          <p className="text-muted-foreground">
            Envie os arquivos das transportadoras para iniciar a análise.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="hidden sm:flex">
          <Link to="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm mb-6">
        <Stepper currentStep={1} />

        <div className="mt-12 max-w-3xl mx-auto">
          <div className="border-2 border-dashed border-slate-300 hover:border-accent hover:bg-slate-50 transition-colors rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer group">
            <div className="h-16 w-16 bg-slate-100 group-hover:bg-accent/10 text-slate-500 group-hover:text-accent rounded-full flex items-center justify-center mb-4 transition-colors">
              <CloudUpload className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Clique ou arraste seus arquivos aqui</h3>
            <p className="text-slate-500 mb-6 max-w-md">
              Faça o upload das tabelas de cotação recebidas. O sistema extrairá os dados
              automaticamente.
            </p>

            <div className="flex gap-4">
              <Button type="button" className="bg-accent hover:bg-accent/90 text-white shadow-sm">
                Selecionar Arquivos
              </Button>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-blue-800">
            <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-blue-900">Formatos aceitos e instruções:</p>
              <ul className="list-disc pl-4 space-y-1 text-blue-800/80">
                <li>Arquivos Excel (.xlsx, .xls) ou CSV (.csv)</li>
                <li>Tamanho máximo: 10MB por arquivo</li>
                <li>
                  Assegure-se de que as colunas de "Origem", "Destino", "Peso" e "Valor" estejam
                  presentes.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-4 mt-6">
        <Button asChild variant="outline">
          <Link to="/dashboard">Cancelar</Link>
        </Button>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/review">Avançar para Conferência</Link>
        </Button>
      </div>
    </div>
  )
}
