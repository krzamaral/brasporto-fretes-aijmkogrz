import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Info, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage, extractFieldErrors } from '@/lib/pocketbase/errors'

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const processFile = async (file: File) => {
    setErrorMessage('')

    if (file.type !== 'application/pdf') {
      const msg = 'Por favor, selecione um arquivo PDF válido.'
      setErrorMessage(msg)
      setStatus('error')
      toast({
        title: 'Formato inválido',
        description: msg,
        variant: 'destructive',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      const msg = 'O arquivo é muito grande. O tamanho máximo permitido é 5MB.'
      setErrorMessage(msg)
      setStatus('error')
      toast({
        title: 'Arquivo muito grande',
        description: msg,
        variant: 'destructive',
      })
      return
    }

    setStatus('loading')

    try {
      const base64Data = await toBase64(file)

      const res = await pb.send('/backend/v1/extract-pdf', {
        method: 'POST',
        body: JSON.stringify({ pdfBase64: base64Data }),
        headers: { 'Content-Type': 'application/json' },
      })

      let extracted = res.data || res
      if (typeof extracted === 'string') {
        try {
          extracted = JSON.parse(extracted)
        } catch {
          /* intentionally ignored */
        }
      }

      const userId = pb.authStore.record?.id
      if (!userId) {
        throw new Error('Usuário não autenticado. Por favor, faça login novamente.')
      }

      const parseNumber = (val: any): number | null => {
        if (val === undefined || val === null || val === '') return null
        const num = Number(val)
        return isNaN(num) ? null : num
      }

      let etd = null
      if (extracted.etd) {
        const parsedDate = new Date(extracted.etd)
        if (!isNaN(parsedDate.getTime())) {
          etd = parsedDate.toISOString()
        }
      }

      const cost = parseNumber(extracted.cost)

      const payload: Record<string, any> = {
        agent_name: extracted.agent_name
          ? String(extracted.agent_name).trim()
          : 'Agente Desconhecido',
        modal: ['Aéreo', 'FCL', 'LCL'].includes(extracted.modal) ? extracted.modal : 'Aéreo',
        cost: cost !== null ? cost : 0,
        user_id: userId,
      }

      const transitTime = parseNumber(extracted.transit_time)
      if (transitTime !== null) payload.transit_time = transitTime

      if (etd) payload.etd = etd

      const freeTime = parseNumber(extracted.free_time)
      if (freeTime !== null) payload.free_time = freeTime

      const taxableWeight = parseNumber(extracted.taxable_weight)
      if (taxableWeight !== null) payload.taxable_weight = taxableWeight

      const score = parseNumber(extracted.score)
      if (score !== null) payload.score = score

      const quotation = await pb.collection('quotations').create(payload)

      await pb.collection('extracted_data').create({
        quotation_id: quotation.id,
        raw_data: extracted,
      })

      setStatus('success')
      toast({
        title: 'Sucesso',
        description: 'Dados extraídos com sucesso!',
      })

      setTimeout(() => {
        navigate('/review')
      }, 2000)
    } catch (err: any) {
      console.error(err)
      setStatus('error')

      const fieldErrors = extractFieldErrors(err)
      const hasFieldErrors = Object.keys(fieldErrors).length > 0

      let msg = getErrorMessage(err)

      if (hasFieldErrors) {
        const errors = Object.entries(fieldErrors)
          .map(([field, detail]) => `${field}: ${detail}`)
          .join(', ')
        msg = `Campos obrigatórios ausentes ou inválidos: ${errors}`
      } else if (err.status === 413) {
        msg = 'O arquivo excede o limite de tamanho suportado.'
      } else if (err.status === 400 && err.message) {
        msg = err.message
      }

      setErrorMessage(msg)

      toast({
        title: 'Erro na extração',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        let encoded = reader.result as string
        encoded = encoded.replace(/^data:.*?;base64,/, '')
        resolve(encoded)
      }
      reader.onerror = (error) => reject(error)
    })

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="mt-12 max-w-3xl mx-auto space-y-8 animate-fade-in-up">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-slate-800">Analisando documento...</h3>
            <p className="text-slate-500">
              A inteligência artificial está extraindo os dados da cotação.
            </p>
          </div>
          <Card className="p-8 space-y-8 border-slate-200">
            <div className="space-y-3">
              <Skeleton className="h-4 w-[180px] bg-slate-200" />
              <Skeleton className="h-12 w-full bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-[120px] bg-slate-200" />
                <Skeleton className="h-12 w-full bg-slate-100" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-[120px] bg-slate-200" />
                <Skeleton className="h-12 w-full bg-slate-100" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-[140px] bg-slate-200" />
              <Skeleton className="h-12 w-full bg-slate-100" />
            </div>
          </Card>
        </div>
      )
    }

    if (status === 'success') {
      return (
        <div className="mt-12 max-w-3xl mx-auto flex flex-col items-center justify-center py-16 animate-fade-in-up">
          <div className="h-24 w-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-slate-800">Processamento Concluído</h3>
          <p className="text-slate-500 mb-8 text-center max-w-md">
            Os dados foram extraídos com sucesso. Você será redirecionado para a conferência em
            instantes.
          </p>
          <Button onClick={() => navigate('/review')} className="bg-primary hover:bg-primary/90">
            Ir para Conferência Agora
          </Button>
        </div>
      )
    }

    if (status === 'error') {
      return (
        <div className="mt-12 max-w-3xl mx-auto flex flex-col items-center justify-center py-16 animate-fade-in-up">
          <div className="h-24 w-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <AlertCircle className="h-12 w-12" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-slate-800">Falha na Extração</h3>
          <p className="text-slate-500 mb-8 text-center max-w-md">
            {errorMessage || 'Ocorreu um erro ao processar o arquivo. Por favor, tente novamente.'}
          </p>
          <Button
            onClick={() => setStatus('idle')}
            variant="outline"
            className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      )
    }

    return (
      <div className="mt-12 max-w-3xl mx-auto animate-fade-in-up">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed transition-all duration-200 ease-in-out rounded-xl p-16 flex flex-col items-center justify-center text-center cursor-pointer group ${
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-slate-300 hover:border-primary hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="application/pdf"
            className="hidden"
          />
          <div
            className={`h-20 w-20 rounded-full flex items-center justify-center mb-6 transition-colors ${
              isDragging
                ? 'bg-primary/20 text-primary'
                : 'bg-slate-100 group-hover:bg-primary/10 text-slate-500 group-hover:text-primary'
            }`}
          >
            <FileText className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-semibold mb-3 text-slate-800">
            Nenhum arquivo selecionado. Arraste um PDF ou clique para buscar.
          </h3>
          <p className="text-slate-500 mb-8 max-w-md">
            Faça o upload do documento de cotação recebido. O sistema extrairá os dados
            automaticamente usando Inteligência Artificial.
          </p>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-white shadow-sm pointer-events-none px-6"
          >
            Selecionar Arquivo PDF
          </Button>
        </div>

        <div className="mt-8 bg-blue-50/80 border border-blue-100 rounded-lg p-5 flex gap-4 text-blue-800">
          <Info className="h-6 w-6 shrink-0 mt-0.5 text-blue-600" />
          <div className="text-sm space-y-2">
            <p className="font-semibold text-blue-900 text-base">Instruções para Upload:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-blue-800/80">
              <li>Apenas arquivos PDF são aceitos no momento (máximo 5MB).</li>
              <li>
                A Inteligência Artificial extrairá automaticamente: Nome do Agente, Modalidade
                (Aéreo/FCL/LCL), Frete Base, Transit Time e ETD.
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-slate-900">
            Upload de Cotações
          </h2>
          <p className="text-slate-500">
            Envie os arquivos das transportadoras em PDF para iniciar a análise inteligente.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden sm:flex border-slate-300 text-slate-700"
        >
          <Link to="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm mb-6">
        <Stepper currentStep={1} />
        {renderContent()}
      </Card>
    </div>
  )
}
