import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Info,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  ChevronRight,
} from 'lucide-react'
import { Stepper } from '@/components/Stepper'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createPedido } from '@/services/pedidos'
import { createCotacaoRound } from '@/services/cotacao_rounds'
import { createQuotation } from '@/services/quotations'
import { useAuth } from '@/hooks/use-auth'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`

const pedidoSchema = z
  .object({
    origem: z.string().min(1, 'Obrigatório'),
    destino: z.string().min(1, 'Obrigatório'),
    peso_bruto: z.number({ invalid_type_error: 'Deve ser um número' }).nullable().optional(),
    volume: z.number({ invalid_type_error: 'Deve ser um número' }).nullable().optional(),
    quantidade_containers: z
      .number({ invalid_type_error: 'Deve ser um número' })
      .nullable()
      .optional(),
    tipo_mercadoria: z.string().optional(),
    modal_desejado: z.enum(['Aéreo', 'FCL', 'LCL']),
    incoterm: z.enum(
      ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'],
      {
        required_error: 'Obrigatório',
        invalid_type_error: 'Incoterm inválido',
      },
    ),
    prazo_desejado_dias: z
      .number({ invalid_type_error: 'Deve ser um número' })
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.modal_desejado === 'Aéreo' && (data.peso_bruto == null || data.peso_bruto <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Obrigatório para Aéreo',
        path: ['peso_bruto'],
      })
    }
    if (data.modal_desejado === 'LCL' && (data.volume == null || data.volume <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Obrigatório para LCL',
        path: ['volume'],
      })
    }
    if (
      data.modal_desejado === 'FCL' &&
      (data.quantidade_containers == null || data.quantidade_containers <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Obrigatório para FCL',
        path: ['quantidade_containers'],
      })
    }
  })

type PedidoFormValues = z.infer<typeof pedidoSchema>

export default function Upload() {
  const location = useLocation()
  const initialPedidoId = location.state?.pedidoId

  const [wizardStep, setWizardStep] = useState(initialPedidoId ? 2 : 1)
  const [pedidoId, setPedidoId] = useState<string | null>(initialPedidoId || null)

  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'form' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const [cota1Quotes, setCota1Quotes] = useState<any[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const form = useForm<PedidoFormValues>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: {
      origem: '',
      destino: '',
      peso_bruto: null,
      volume: null,
      quantidade_containers: null,
      tipo_mercadoria: '',
      modal_desejado: 'Aéreo',
      incoterm: undefined,
      prazo_desejado_dias: null,
    },
  })

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n'
      }
      return fullText
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      return ''
    }
  }

  const processFile = async (file: File) => {
    setErrorMessage('')

    if (!user || !user.id || !pb.authStore.isValid) {
      const msg = 'Sessão expirada. Por favor, faça login novamente.'
      setErrorMessage(msg)
      setStatus('error')
      toast({ title: 'Erro de Autenticação', description: msg, variant: 'destructive' })
      signOut()
      navigate('/login')
      return
    }

    if (wizardStep > 1 && !pedidoId) {
      const msg = 'Referência do pedido não encontrada. Volte à etapa 1.'
      setErrorMessage(msg)
      setStatus('error')
      toast({ title: 'Erro de Fluxo', description: msg, variant: 'destructive' })
      return
    }

    if (file.type !== 'application/pdf') {
      const msg = 'Selecione um arquivo PDF válido.'
      setErrorMessage(msg)
      setStatus('error')
      toast({ title: 'Formato inválido', description: msg, variant: 'destructive' })
      return
    }

    if (file.size === 0) {
      const msg = 'O arquivo selecionado está vazio.'
      setErrorMessage(msg)
      setStatus('error')
      toast({ title: 'Arquivo inválido', description: msg, variant: 'destructive' })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      const msg = 'Tamanho máximo permitido é 5MB.'
      setErrorMessage(msg)
      setStatus('error')
      toast({ title: 'Arquivo muito grande', description: msg, variant: 'destructive' })
      return
    }

    setStatus('loading')

    try {
      const extractedText = await extractTextFromPdf(file)

      if (!extractedText || extractedText.trim().length === 0) {
        const msg =
          'Nenhum texto detectado no documento. Por favor, verifique se o PDF contém texto selecionável ou tente outro arquivo.'
        setErrorMessage(msg)
        setStatus('error')
        toast({ title: 'Arquivo inválido', description: msg, variant: 'destructive' })
        return
      }

      const docType = wizardStep === 1 ? 'pedido' : wizardStep === 2 ? 'cota1' : 'cota2'

      const payload: Record<string, any> = {
        text: extractedText,
        docType,
        userId: user.id,
        step: wizardStep,
      }

      if (pedidoId) {
        payload.pedidoId = pedidoId
      }

      const res = await pb.send('/backend/v1/extract-pdf', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })

      const extracted = res?.data?.data || res?.data || res

      if (!extracted || typeof extracted !== 'object') {
        throw new Error(
          'Não foi possível extrair os dados do documento. O formato retornado é inválido.',
        )
      }

      if (wizardStep === 1) {
        form.reset({
          origem: extracted?.origem || '',
          destino: extracted?.destino || '',
          peso_bruto: extracted?.peso_bruto ? Number(extracted.peso_bruto) : null,
          volume: extracted?.volume ? Number(extracted.volume) : null,
          quantidade_containers: extracted?.quantidade_containers
            ? Number(extracted.quantidade_containers)
            : null,
          tipo_mercadoria: extracted?.tipo_mercadoria || '',
          modal_desejado: ['Aéreo', 'FCL', 'LCL'].includes(extracted?.modal_desejado)
            ? extracted.modal_desejado
            : 'Aéreo',
          incoterm: [
            'EXW',
            'FCA',
            'CPT',
            'CIP',
            'DAP',
            'DPU',
            'DDP',
            'FAS',
            'FOB',
            'CFR',
            'CIF',
          ].includes(extracted?.incoterm)
            ? extracted.incoterm
            : undefined,
          prazo_desejado_dias: extracted?.prazo_desejado_dias
            ? Number(extracted.prazo_desejado_dias)
            : null,
        })
        setStatus('form')
        toast({ title: 'Dados extraídos', description: 'Revise os dados do pedido abaixo.' })
      } else if (wizardStep === 2) {
        let quotes = []
        if (extracted?.type === 'multiple' && Array.isArray(extracted?.quotations)) {
          quotes = extracted.quotations
        } else if (extracted?.type === 'single' && extracted?.data) {
          quotes = [extracted.data]
        } else if (Array.isArray(extracted?.quotations)) {
          quotes = extracted.quotations
        } else if (Array.isArray(extracted?.quotes)) {
          quotes = extracted.quotes
        } else {
          quotes = Array.isArray(extracted) ? extracted : [extracted]
        }

        if (!pedidoId) throw new Error('Pedido ID ausente. Volte à etapa 1.')

        if (quotes.length === 0) {
          throw new Error('Nenhuma cotação foi encontrada no documento.')
        }

        const round = await createCotacaoRound({
          pedido_id: pedidoId,
          nome_round: 'cota1',
          user_id: user.id,
        })

        const createdQuotes = []
        for (const q of quotes) {
          const modal = ['Aéreo', 'FCL', 'LCL'].includes(q?.modal)
            ? (q.modal as 'Aéreo' | 'FCL' | 'LCL')
            : 'Aéreo'
          const mappedQ = {
            agent_name: q?.agent_name || 'Desconhecido',
            modal,
            cost: Number(q?.cost) || 0,
            transit_time: q?.transit_time ? Number(q.transit_time) : undefined,
            free_time: q?.free_time ? Number(q.free_time) : undefined,
            taxable_weight: q?.taxable_weight ? Number(q.taxable_weight) : undefined,
            etd: q?.etd || undefined,
            cotacao_round_id: round.id,
            pedido_id: pedidoId,
            user_id: user.id,
          }

          if (mappedQ.etd) {
            const d = new Date(mappedQ.etd)
            if (!isNaN(d.getTime())) {
              mappedQ.etd = d.toISOString()
            } else {
              mappedQ.etd = undefined
            }
          }

          const createdQ = await createQuotation(mappedQ)
          createdQuotes.push(createdQ)

          try {
            await pb.collection('extracted_data').create({
              quotation_id: createdQ.id,
              raw_data: q || {},
            })
          } catch (err: any) {
            console.error('Failed to save extracted data:', err)
            if (err?.status === 401) throw err
          }
        }

        setCota1Quotes(createdQuotes)
        setStatus('idle')
        setWizardStep(3)
        toast({ title: 'Cotações Extraídas', description: 'Rodada 1 concluída. Envie a Rodada 2.' })
      } else if (wizardStep === 3) {
        let q =
          extracted?.type === 'single' && extracted?.data
            ? extracted.data
            : Array.isArray(extracted?.quotations) && extracted.quotations.length > 0
              ? extracted.quotations[0]
              : Array.isArray(extracted?.quotes) && extracted.quotes.length > 0
                ? extracted.quotes[0]
                : extracted

        if (!pedidoId) throw new Error('Pedido ID ausente. Volte à etapa 1.')

        if (!q || Array.isArray(q)) {
          q = Array.isArray(q) && q.length > 0 ? q[0] : null
        }

        if (!q) {
          throw new Error('Nenhuma cotação foi encontrada no documento.')
        }

        const round = await createCotacaoRound({
          pedido_id: pedidoId,
          nome_round: 'cota2',
          user_id: user.id,
        })

        const modal = ['Aéreo', 'FCL', 'LCL'].includes(q?.modal)
          ? (q.modal as 'Aéreo' | 'FCL' | 'LCL')
          : 'Aéreo'
        const mappedQ = {
          agent_name: q?.agent_name || 'Desconhecido',
          modal,
          cost: Number(q?.cost) || 0,
          transit_time: q?.transit_time ? Number(q.transit_time) : undefined,
          free_time: q?.free_time ? Number(q.free_time) : undefined,
          taxable_weight: q?.taxable_weight ? Number(q.taxable_weight) : undefined,
          etd: q?.etd || undefined,
          cotacao_round_id: round.id,
          pedido_id: pedidoId,
          user_id: user.id,
        }

        if (mappedQ.etd) {
          const d = new Date(mappedQ.etd)
          if (!isNaN(d.getTime())) {
            mappedQ.etd = d.toISOString()
          } else {
            mappedQ.etd = undefined
          }
        }

        const cota2Quote = await createQuotation(mappedQ)

        try {
          await pb.collection('extracted_data').create({
            quotation_id: cota2Quote.id,
            raw_data: q || {},
          })
        } catch (err: any) {
          console.error('Failed to save extracted data:', err)
          if (err?.status === 401) throw err
        }

        toast({ title: 'Sucesso', description: 'Análise concluída. Indo para revisão...' })
        navigate('/review', { state: { pedidoId, cota1Quotes, cota2Quote } })
      }
    } catch (err: any) {
      console.error('Extraction error:', err)
      setStatus('error')

      if (err?.status === 401 || !pb.authStore.isValid) {
        toast({
          title: 'Sessão Expirada',
          description: 'Sua sessão expirou. Faça login novamente.',
          variant: 'destructive',
        })
        signOut()
        navigate('/login')
        return
      }

      let errorMsg =
        'Não foi possível processar o arquivo. Verifique sua conexão e tente novamente.'

      if (err?.status === 400) {
        const validationMsg = getErrorMessage(err)
        const isGeneric =
          validationMsg === 'An unexpected error occurred.' ||
          validationMsg === 'Something went wrong while processing your request.'
        errorMsg =
          !isGeneric && validationMsg
            ? validationMsg
            : 'Os dados extraídos estão inválidos ou incompletos. Verifique o documento e tente novamente.'
      } else if (err?.status === 413) {
        errorMsg = 'O arquivo é muito grande para ser processado.'
      } else if (err?.status >= 500) {
        errorMsg = 'Erro interno do servidor. Tente novamente mais tarde.'
      } else if (err?.isAbort) {
        errorMsg = 'A requisição foi cancelada (tempo limite). Verifique sua conexão.'
      } else {
        const apiMsg = getErrorMessage(err)
        const isGeneric =
          apiMsg === 'An unexpected error occurred.' ||
          apiMsg === 'Something went wrong while processing your request.'
        if (!isGeneric && apiMsg) {
          errorMsg = apiMsg
        }
      }

      setErrorMessage(errorMsg)
      toast({
        title: 'Falha no Processamento',
        description: errorMsg,
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

  const onPedidoSubmit = async (data: PedidoFormValues) => {
    if (!user || !pb.authStore.isValid) {
      toast({
        title: 'Sessão Expirada',
        description: 'Por favor, faça login novamente.',
        variant: 'destructive',
      })
      signOut()
      navigate('/login')
      return
    }
    try {
      const pedidoPayload = {
        origem: data.origem,
        destino: data.destino,
        peso_bruto: data.peso_bruto ? Number(data.peso_bruto) : null,
        volume: data.volume ? Number(data.volume) : undefined,
        quantidade_containers: data.quantidade_containers
          ? Number(data.quantidade_containers)
          : null,
        tipo_mercadoria: data.tipo_mercadoria || '',
        modal_desejado: ['Aéreo', 'FCL', 'LCL'].includes(data.modal_desejado)
          ? (data.modal_desejado as 'Aéreo' | 'FCL' | 'LCL')
          : 'Aéreo',
        incoterm: data.incoterm,
        prazo_desejado_dias:
          data.prazo_desejado_dias !== null && data.prazo_desejado_dias !== undefined
            ? Number(data.prazo_desejado_dias)
            : (null as any),
        user_id: user.id,
        status: 'aguardando_cotacao' as const,
      }
      const pedido = await createPedido(pedidoPayload)
      setPedidoId(pedido.id)
      setWizardStep(2)
      setStatus('idle')
      toast({
        title: 'Pedido criado',
        description: 'Agora envie o documento da primeira rodada de cotação.',
      })
    } catch (e: any) {
      if (e?.status === 401 || !pb.authStore.isValid) {
        toast({
          title: 'Sessão Expirada',
          description: 'Por favor, faça login novamente.',
          variant: 'destructive',
        })
        signOut()
        navigate('/login')
        return
      }
      let errorMsg = 'Não foi possível salvar o pedido.'
      if (e?.status === 400) {
        const validationMsg = getErrorMessage(e)
        if (validationMsg && validationMsg !== 'An unexpected error occurred.') {
          errorMsg = validationMsg
        }
      }
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      })
    }
  }

  const handleSkipCota2 = () => {
    navigate('/review', { state: { pedidoId, cota1Quotes, cota2Quote: null } })
  }

  const watchedModal = form.watch('modal_desejado')
  const watchedVolume = form.watch('volume')
  const watchedPeso = form.watch('peso_bruto')

  useEffect(() => {
    if (watchedModal === 'FCL') {
      const currentQtd = form.getValues('quantidade_containers')
      if (currentQtd === null || currentQtd === undefined || currentQtd <= 0) {
        form.setValue('quantidade_containers', 1, { shouldValidate: true })
      }
    }
  }, [watchedModal, form])

  const pesoCubado = (watchedVolume || 0) * 166.667
  const pesoTaxado = Math.max(watchedPeso || 0, pesoCubado)

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="mt-12 max-w-3xl mx-auto space-y-8 animate-fade-in-up">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-slate-800">Analisando documento...</h3>
            <p className="text-slate-500">A IA está extraindo os dados relevantes.</p>
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
          </Card>
        </div>
      )
    }

    if (status === 'form' && wizardStep === 1) {
      return (
        <div className="mt-12 max-w-3xl mx-auto animate-fade-in-up">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-800">Revise os dados do Pedido</h3>
            <p className="text-slate-500 text-sm">
              Confirme ou altere os dados extraídos antes de prosseguir.
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onPedidoSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="origem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="destino"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destino</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="peso_bruto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Peso Bruto (kg){' '}
                        {watchedModal === 'Aéreo' && <span className="text-red-500">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="volume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Volume (m³){' '}
                        {watchedModal === 'LCL' && <span className="text-red-500">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipo_mercadoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Mercadoria</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="modal_desejado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modal Desejado</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Aéreo">Aéreo</SelectItem>
                          <SelectItem value="FCL">FCL</SelectItem>
                          <SelectItem value="LCL">LCL</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="incoterm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        INCOTERM <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o Incoterm" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[
                            'EXW',
                            'FCA',
                            'CPT',
                            'CIP',
                            'DAP',
                            'DPU',
                            'DDP',
                            'FAS',
                            'FOB',
                            'CFR',
                            'CIF',
                          ].map((inc) => (
                            <SelectItem key={inc} value={inc}>
                              {inc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedModal === 'FCL' && (
                  <FormField
                    control={form.control}
                    name="quantidade_containers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Qtd de Containers <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="prazo_desejado_dias"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Prazo Desejado (dias){' '}
                        <span className="text-xs text-slate-400 font-normal">(Opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {watchedModal === 'Aéreo' && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-sm text-slate-700 animate-fade-in">
                  <h4 className="font-semibold text-primary mb-2">
                    Cálculo de Peso Taxado (Aéreo)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-slate-500 text-xs">Peso Bruto</span>
                      <span className="font-medium">{watchedPeso || 0} kg</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs">
                        Peso Cubado (Volume m³ × 166.667)
                      </span>
                      <span className="font-medium">
                        {watchedVolume || 0} × 166.667 = {pesoCubado.toFixed(2)} kg
                      </span>
                    </div>
                    <div className="bg-primary/10 px-3 py-1.5 rounded-md">
                      <span className="block text-primary text-xs font-semibold">
                        Peso Taxado a considerar
                      </span>
                      <span className="font-bold text-primary">{pesoTaxado.toFixed(2)} kg</span>
                    </div>
                  </div>
                  <p className="text-xs text-primary/80 mt-2">
                    * O Peso Taxado é o maior valor entre o Peso Bruto e o Peso Cubado.
                  </p>
                </div>
              )}

              {watchedModal === 'LCL' && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-slate-700 animate-fade-in">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    Cálculo de Peso Taxado (Marítimo LCL)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-slate-500 text-xs">Peso Bruto</span>
                      <span className="font-medium">{watchedPeso || 0} kg</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs">
                        Peso Cubado (Volume m³ × 1.000)
                      </span>
                      <span className="font-medium">
                        {watchedVolume || 0} × 1.000 = {((watchedVolume || 0) * 1000).toFixed(2)} kg
                      </span>
                    </div>
                    <div className="bg-blue-100 px-3 py-1.5 rounded-md">
                      <span className="block text-blue-800 text-xs font-semibold">
                        Peso Taxado (W/M) a considerar
                      </span>
                      <span className="font-bold text-blue-800">
                        {Math.max(watchedPeso || 0, (watchedVolume || 0) * 1000).toFixed(2)} kg
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    * Fator Marítimo: 1 m³ = 1.000 kg. O valor taxado é a maior proporção (W/M).
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-primary hover:bg-primary/90">
                  Salvar Pedido e Avançar <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
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
            {errorMessage || 'Ocorreu um erro ao processar o arquivo.'}
          </p>
          <Button
            onClick={() => setStatus('idle')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Tentar Novamente
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
            {wizardStep === 1 ? (
              <FileText className="h-10 w-10" />
            ) : (
              <UploadCloud className="h-10 w-10" />
            )}
          </div>
          <h3 className="text-xl font-semibold mb-3 text-slate-800">
            {wizardStep === 1
              ? 'Upload do Pedido (Load Request)'
              : wizardStep === 2
                ? 'Upload da Cotação 1 (Várias opções)'
                : 'Upload da Cotação 2 (Opção única)'}
          </h3>
          <p className="text-slate-500 mb-8 max-w-md">
            Arraste um PDF ou clique para buscar em seu computador.
          </p>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-white shadow-sm pointer-events-none px-6"
          >
            Selecionar Arquivo PDF
          </Button>
        </div>

        {wizardStep === 3 && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="ghost"
              onClick={handleSkipCota2}
              className="text-slate-500 hover:text-slate-800"
            >
              Pular esta etapa (Não tenho segunda cotação) <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-lg p-5 flex gap-4 text-slate-700">
          <Info className="h-6 w-6 shrink-0 mt-0.5 text-primary" />
          <div className="text-sm space-y-2">
            <p className="font-semibold text-primary text-base">Instruções:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              {wizardStep === 1 && (
                <li>
                  Envie o documento de solicitação de carga para estabelecer os critérios da
                  cotação.
                </li>
              )}
              {wizardStep === 2 && (
                <li>
                  A IA irá ler o documento e extrair todas as cotações listadas nele
                  automaticamente.
                </li>
              )}
              {wizardStep === 3 && (
                <li>
                  Envie a oferta concorrente ou pule esta etapa para prosseguir para a revisão.
                </li>
              )}
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
            Upload de Documentos
          </h2>
          <p className="text-slate-500">
            Siga as etapas para registrar o pedido e as cotações concorrentes.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden sm:flex border-slate-300 text-slate-700"
        >
          <Link to="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm mb-6">
        <Stepper currentStep={wizardStep} />
        {renderContent()}
      </Card>
    </div>
  )
}
