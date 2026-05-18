import { useNavigate } from 'react-router-dom'
import { UploadCloud, History as HistoryIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import logoUrl from '@/assets/logo-color-ad1d0.png'

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in space-y-8">
      <div className="text-center space-y-6 max-w-2xl mx-auto">
        <img src={logoUrl} alt="Brasporto" className="h-16 mx-auto object-contain mb-8" />

        <h1 className="text-3xl font-bold tracking-tight text-slate-800">
          Bem-vindo ao Brasporto Fretes
        </h1>
        <p className="text-lg text-slate-500">
          Inicie um novo processo de cotação de fretes de forma rápida e centralizada. Faça o upload
          dos documentos e nós cuidamos do resto.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mt-8">
        <Card
          className="p-8 border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer flex flex-col items-center text-center group"
          onClick={() => navigate('/upload')}
        >
          <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Nova Cotação</h3>
          <p className="text-sm text-slate-500 mb-6">
            Inicie um novo pedido de cotação fazendo o upload de seus documentos de embarque.
          </p>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Começar Agora</Button>
        </Card>

        <Card
          className="p-8 border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
          onClick={() => navigate('/history')}
        >
          <div className="h-16 w-16 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <HistoryIcon className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Histórico</h3>
          <p className="text-sm text-slate-500 mb-6">
            Consulte o arquivo de pedidos e cotações realizadas anteriormente no sistema.
          </p>
          <Button variant="outline" className="w-full">
            Acessar Histórico
          </Button>
        </Card>
      </div>
    </div>
  )
}
