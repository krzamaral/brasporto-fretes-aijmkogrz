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
  CheckCircle2,
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
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createPedido, getPedido, updatePedido } from '@/services/pedidos'
import { createCotacaoRound } from '@/services/cotacao_rounds'
import { createQuotation } from '@/services/quotations'
import { useAuth } from '@/hooks/use-auth'
import * as pdfjsLib from 'pdfjs-dist'
import { rankQuotations } from '@/lib/freight-calculator'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`

const pedidoSchema = z
  .object({
    origem: z.string().min(1, 'Obrigatório'),
    destino: z.string().min(1, 'Obrigatório'),
    peso_bruto: z.number({ invalid_type_error: 'Deve ser um número' }).nullable().optional(),
    volume: z.number({ invalid_type_error: 'Deve ser um número' }).nullable().optional(),
    comprimento: z.number({ invalid_type_error: 'Deve ser um número' }).nullable().optional(),
    largura: z.number({ invalid_type_error: 'Deve ser um número' }).nullable().optional(),
    altura: z.number({ invalid_type_error: 'Deve ser um número' }).nullable().optional(),
    quantidade_containers: z
      .number({ invalid_type_error: 'Deve ser um número' })
      .nullable()
      .optional(),
    itens: z
      .array(
        z.object({
          comprimento: z.number({ invalid_type_error: 'Deve ser um número' }),
          largura: z.number({ invalid_type_error: 'Deve ser um número' }),
          altura: z.number({ invalid_type_error: 'Deve ser um número' }),
          quantidade: z.number({ invalid_type_error: 'Deve ser um número' }),
        }),
      )
      .optional(),
    tipo_mercadoria: z.string().optional(),
    modal_desejado: z.enum(['Aéreo', 'FCL', 'LCL']),
    incoterm: z.enum(['EXW', 'FCA', 'FAS', 'FOB'], {
      required_error: 'Obrigatório',
      invalid_type_error: 'Incoterm inválido',
    }),
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

type QuoteFile = {
  id: string
  name: string
  file: File
  status: 'pending' | 'loading' | 'success' | 'error'
  errorMessage?: string
  quotes?: any[]
}

const validateIncotermCoherence = (incoterm: string, quote: any) => {
  if (!incoterm || !quote) return null
  const warnings: string[] = []
  const rawStr = JSON.stringify(quote).toLowerCase()

  if (incoterm === 'EXW') {
    if (
      rawStr.includes('freight') ||
      rawStr.includes('frete internacional') ||
      rawStr.includes('frete aéreo') ||
      rawStr.includes('sea freight')
    ) {
      warnings.push(
        'Aviso de Coerência: O termo EXW indica que o comprador assume os custos desde a origem. No entanto, a cotação parece incluir frete internacional.',
      )
    }
  } else if (incoterm === 'FOB' || incoterm === 'FCA' || incoterm === 'FAS') {
    if (
      rawStr.includes('origin handling') ||
      rawStr.includes('origin cost') ||
      rawStr.includes('taxa de origem')
    ) {
      warnings.push(
        `Aviso de Coerência: Em ${incoterm}, os custos na origem geralmente são do vendedor. Verifique se o comprador está sendo cobrado indevidamente por despesas de origem.`,
      )
    }
  }

  return warnings.length > 0 ? warnings : null
}

export default function Upload() {
  const location = useLocation()
  const initialPedidoId = location.state?.pedidoId

  const [wizardStep, setWizardStep] = useState(initialPedidoId ? 2 : 1)
  const [pedidoId, setPedidoId] = useState<string | null>(initialPedidoId || null)

  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'form' | 'error' | 'review-quotes'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState<string>('')

  const [quoteFiles, setQuoteFiles] = useState<QuoteFile[]>([])

  const [autoDetectedIncoterm, setAutoDetectedIncoterm] = useState(false)
  const [autoDetectedOrigem, setAutoDetectedOrigem] = useState(false)
  const [autoDetectedDestino, setAutoDetectedDestino] = useState(false)
  const [reviewQuotes, setReviewQuotes] = useState<any[] | null>(null)
  const [reviewIncoterm, setReviewIncoterm] = useState<string>('')
  const [reviewIncotermDetected, setReviewIncotermDetected] = useState(false)
  const [pedidoIncoterm, setPedidoIncoterm] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const isProcessingQuotes =
    quoteFiles.length > 0 &&
    quoteFiles.some((f) => f.status === 'loading' || f.status === 'pending')
  const hasSuccessQuotes = quoteFiles.some(
    (f) => f.status === 'success' && f.quotes && f.quotes.length > 0,
  )

  useEffect(() => {
    if (initialPedidoId) {
      getPedido(initialPedidoId)
        .then((p) => {
          if (p?.incoterm) setPedidoIncoterm(p.incoterm)
        })
        .catch(console.error)
    }
  }, [initialPedidoId])

  const form = useForm<PedidoFormValues>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: {
      origem: '',
      destino: '',
      peso_bruto: null,
      volume: null,
      comprimento: null,
      largura: null,
      altura: null,
      quantidade_containers: null,
      itens: [],
      tipo_mercadoria: '',
      modal_desejado: 'Aéreo',
      incoterm: undefined,
      prazo_desejado_dias: null,
    },
  })

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

  const processPedidoFile = async (file: File) => {
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

    if (file.type !== 'application/pdf') {
      const msg = 'Selecione um arquivo PDF válido.'
      setErrorMessage(msg)
      setStatus('error')
      toast({ title: 'Formato inválido', description: msg, variant: 'destructive' })
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
        throw new Error(
          'Nenhum texto detectado no documento. Por favor, verifique se o PDF contém texto selecionável.',
        )
      }

      const payload: Record<string, any> = {
        text: extractedText,
        docType: 'pedido',
        userId: user.id,
        step: 1,
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

      const hasExtractedIncoterm = ['EXW', 'FCA', 'FAS', 'FOB'].includes(extracted?.incoterm)

      const hasExtractedOrigem = !!extracted?.origem
      const hasExtractedDestino = !!extracted?.destino

      form.reset({
        origem: extracted?.origem || '',
        destino: extracted?.destino || '',
        peso_bruto: extracted?.peso_bruto ? Number(extracted.peso_bruto) : null,
        volume: extracted?.volume ? Number(extracted.volume) : null,
        comprimento: extracted?.comprimento ? Number(extracted.comprimento) : null,
        largura: extracted?.largura ? Number(extracted.largura) : null,
        altura: extracted?.altura ? Number(extracted.altura) : null,
        quantidade_containers: extracted?.quantidade_containers
          ? Number(extracted.quantidade_containers)
          : null,
        itens: Array.isArray(extracted?.itens)
          ? extracted.itens.map((i: any) => ({
              comprimento: Number(i.comprimento) || 0,
              largura: Number(i.largura) || 0,
              altura: Number(i.altura) || 0,
              quantidade: Number(i.quantidade) || 1,
            }))
          : [],
        tipo_mercadoria: extracted?.tipo_mercadoria || '',
        modal_desejado: ['Aéreo', 'FCL', 'LCL'].includes(extracted?.modal_desejado)
          ? extracted.modal_desejado
          : 'Aéreo',
        incoterm: hasExtractedIncoterm ? extracted.incoterm : undefined,
        prazo_desejado_dias: extracted?.prazo_desejado_dias
          ? Number(extracted.prazo_desejado_dias)
          : null,
      })

      setAutoDetectedIncoterm(hasExtractedIncoterm)
      setAutoDetectedOrigem(hasExtractedOrigem)
      setAutoDetectedDestino(hasExtractedDestino)
      setStatus('form')
      toast({ title: 'Dados extraídos', description: 'Revise os dados do pedido abaixo.' })
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

      if (err instanceof Error) {
        errorMsg = err.message
      } else if (err?.status === 400) {
        const validationMsg = getErrorMessage(err)
        const isGeneric =
          validationMsg === 'An unexpected error occurred.' ||
          validationMsg === 'Something went wrong while processing your request.'
        errorMsg =
          !isGeneric && validationMsg
            ? validationMsg
            : 'Os dados extraídos estão inválidos ou incompletos.'
      } else if (err?.status === 413) {
        errorMsg = 'O arquivo é muito grande para ser processado.'
      } else if (err?.status >= 500) {
        errorMsg = 'Erro interno do servidor. Tente novamente mais tarde.'
      }

      setErrorMessage(errorMsg)
      toast({ title: 'Falha no Processamento', description: errorMsg, variant: 'destructive' })
    }
  }

  const processQuoteFiles = async (files: File[]) => {
    if (!user || !user.id || !pb.authStore.isValid) {
      toast({ title: 'Erro', description: 'Sessão expirada.', variant: 'destructive' })
      signOut()
      navigate('/login')
      return
    }

    if (!pedidoId) {
      toast({
        title: 'Erro',
        description: 'Pedido não encontrado. Volte à etapa 1.',
        variant: 'destructive',
      })
      return
    }

    const newFiles: QuoteFile[] = files.map((f) => ({
      id: Math.random().toString(),
      name: f.name,
      file: f,
      status: 'pending',
    }))

    setQuoteFiles((prev) => [...prev, ...newFiles])

    for (const uf of newFiles) {
      setQuoteFiles((prev) => prev.map((p) => (p.id === uf.id ? { ...p, status: 'loading' } : p)))
      try {
        if (uf.file.type !== 'application/pdf') throw new Error('Apenas PDF é suportado.')
        if (uf.file.size > 5 * 1024 * 1024) throw new Error('Tamanho máximo 5MB.')

        const text = await extractTextFromPdf(uf.file)
        if (!text || text.trim().length === 0)
          throw new Error('Nenhum texto detectado no documento.')

        const payload = { text, docType: 'cotacao', step: 2, userId: user.id, pedidoId }
        const res = await pb.send('/backend/v1/extract-pdf', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        })

        const extracted = res?.data?.data || res?.data || res
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

        if (!quotes || quotes.length === 0 || !quotes[0]) {
          throw new Error('Nenhuma cotação foi encontrada neste documento.')
        }

        let sharedFormulaOrigem: string | undefined = undefined
        let sharedPickupOptions: any[] | undefined = undefined

        for (const q of quotes) {
          if (q.formula_origem && !sharedFormulaOrigem) sharedFormulaOrigem = q.formula_origem
          if (
            q.pickup_options &&
            Array.isArray(q.pickup_options) &&
            q.pickup_options.length > 0 &&
            !sharedPickupOptions
          ) {
            sharedPickupOptions = q.pickup_options
          }
        }

        const isMultiQuote = quotes.length > 1
        const zeroOriginCount = quotes.filter(
          (q: any) =>
            q.taxas_origem === undefined || q.taxas_origem === null || Number(q.taxas_origem) === 0,
        ).length
        const originViaFormula = isMultiQuote && zeroOriginCount >= quotes.length / 2

        if (sharedFormulaOrigem || sharedPickupOptions || originViaFormula) {
          quotes = quotes.map((q: any) => {
            const updatedQ = { ...q }

            if (sharedFormulaOrigem && !updatedQ.formula_origem) {
              updatedQ.formula_origem = sharedFormulaOrigem
            }

            if (originViaFormula) {
              if (
                updatedQ.taxas_origem !== undefined &&
                updatedQ.taxas_origem !== null &&
                Number(updatedQ.taxas_origem) > 0
              ) {
                if (!Array.isArray(updatedQ.taxas_adicionais)) {
                  updatedQ.taxas_adicionais = []
                }
                updatedQ.taxas_adicionais.push({
                  tipo: 'por_embarque',
                  valor: Number(updatedQ.taxas_origem),
                  descricao: 'Taxa adicional da linha',
                })
                updatedQ.taxas_origem = 0
              }
            }

            if (
              sharedPickupOptions &&
              (!updatedQ.pickup_options || updatedQ.pickup_options.length === 0)
            ) {
              updatedQ.pickup_options = sharedPickupOptions
            }

            return updatedQ
          })
        }

        const iataToCity: Record<string, string> = {
          PEK: 'PEKING',
          PVG: 'SHANGHAI',
          SHA: 'SHANGHAI',
          CAN: 'GUANGZHOU',
          SZX: 'SHENZHEN',
          EHU: 'EZHOU',
          XMN: 'XIAMEN',
          CTU: 'CHENGDU',
          HGH: 'HANGZHOU',
          NKG: 'NANJING',
          TAO: 'QINGDAO',
          DLC: 'DALIAN',
        }

        quotes = quotes.map((q: any) => {
          const updatedQ = { ...q }

          if (
            (!updatedQ.pickup_fee || Number(updatedQ.pickup_fee) === 0) &&
            updatedQ.pol &&
            Array.isArray(updatedQ.pickup_options) &&
            updatedQ.pickup_options.length > 0
          ) {
            const polCode = updatedQ.pol.toUpperCase().trim()
            const cityName = iataToCity[polCode]

            if (cityName) {
              const matchedOption = updatedQ.pickup_options.find(
                (opt: any) => opt.local && opt.local.toUpperCase().trim() === cityName,
              )

              if (matchedOption && matchedOption.valor !== undefined) {
                updatedQ.pickup_fee = Number(matchedOption.valor)
              }
            }
          }

          return updatedQ
        })

        setQuoteFiles((prev) =>
          prev.map((p) => (p.id === uf.id ? { ...p, status: 'success', quotes } : p)),
        )
      } catch (err: any) {
        let errorMsg = 'Erro ao processar arquivo.'
        if (err instanceof Error) errorMsg = err.message
        else if (err?.status === 400) errorMsg = getErrorMessage(err) || errorMsg
        setQuoteFiles((prev) =>
          prev.map((p) => (p.id === uf.id ? { ...p, status: 'error', errorMessage: errorMsg } : p)),
        )
      }
    }
  }

  const handleProceedToReview = () => {
    const allQuotes = quoteFiles
      .filter((f) => f.status === 'success')
      .flatMap((f) => f.quotes || [])

    if (!pedidoId) {
      toast({ title: 'Erro', description: 'Referência do pedido perdida.', variant: 'destructive' })
      return
    }

    let extractedIncoterm = undefined
    const validIncoterms = ['EXW', 'FCA', 'FAS', 'FOB']
    for (const q of allQuotes) {
      if (validIncoterms.includes(q?.incoterm)) {
        extractedIncoterm = q.incoterm
        break
      }
    }

    setReviewQuotes(allQuotes)
    setReviewIncoterm(extractedIncoterm || pedidoIncoterm || 'FOB')
    setReviewIncotermDetected(!!extractedIncoterm)

    setStatus('review-quotes')
    setWizardStep(3)
  }

  const confirmReviewQuotes = async () => {
    try {
      setStatus('loading')

      if (!pedidoId) throw new Error('Pedido ID ausente.')

      if (reviewIncoterm !== pedidoIncoterm) {
        await updatePedido(pedidoId, { incoterm: reviewIncoterm })
        setPedidoIncoterm(reviewIncoterm)
      }

      const ped = await getPedido(pedidoId)
      if (!ped) throw new Error('Pedido não encontrado.')

      const pedVolume = ped.volume || 0
      const pedPeso = ped.peso_bruto || 0
      let calcVolumetricAir = pedVolume / 0.006
      if (ped.comprimento && ped.largura && ped.altura) {
        calcVolumetricAir =
          (ped.comprimento * ped.largura * ped.altura * (ped.quantidade_containers || 1)) / 6000
      }
      const calcVolumetricLCL = pedVolume * 1000
      const chargeableAir = Math.ceil(Math.max(pedPeso, calcVolumetricAir))

      const mappedQuotes: any[] = []

      for (const q of reviewQuotes || []) {
        const modal = ['Aéreo', 'FCL', 'LCL'].includes(q?.modal) ? q.modal : ped.modal_desejado

        let formattedAgentName = q?.agent_name || 'Desconhecido'
        if (q?.carrier || q?.pol) {
          const suffix = [q?.carrier, q?.pol].filter(Boolean).join(' ')
          if (suffix) {
            formattedAgentName = `${formattedAgentName} (${suffix})`
          }
        }

        let taxable = q?.taxable_weight ? Number(q.taxable_weight) : null
        if (modal === 'Aéreo') {
          taxable = Math.max(taxable || 0, chargeableAir)
        } else if (!taxable) {
          if (modal === 'LCL') {
            taxable = Number(Math.max(pedPeso, calcVolumetricLCL).toFixed(2))
          }
        }

        const breakdown = q || {}
        const unit_rate = Number(breakdown.frete_unitario ?? null)
        const taxas_origem = Number(breakdown.taxas_origem ?? breakdown.origin_taxes ?? null)
        let pickup_fee = Number(breakdown.pickup_fee ?? null)

        const pol = q?.pol || breakdown.pol
        if (
          !pickup_fee &&
          Array.isArray(breakdown.pickup_options) &&
          breakdown.pickup_options.length > 0 &&
          pol
        ) {
          const IATA_MAP: Record<string, string> = {
            PEK: 'PEKING',
            PVG: 'SHANGHAI',
            SHA: 'SHANGHAI',
            CAN: 'GUANGZHOU',
            SZX: 'SHENZHEN',
            EHU: 'EZHOU',
            XMN: 'XIAMEN',
            CTU: 'CHENGDU',
            HGH: 'HANGZHOU',
            NKG: 'NANJING',
            TAO: 'QINGDAO',
            DLC: 'DALIAN',
          }
          const polCity = IATA_MAP[pol.toUpperCase()] || ''
          if (polCity) {
            const match = breakdown.pickup_options.find(
              (p: any) => p.local && p.local.toUpperCase() === polCity,
            )
            if (match && match.valor) {
              pickup_fee = Number(match.valor)
            }
          }
        }

        const destination_taxes = Number(breakdown.destination_taxes ?? null)

        let additional_fees = Number(q.additional_fees ?? null) || 0
        if (
          !additional_fees &&
          breakdown.taxas_adicionais &&
          Array.isArray(breakdown.taxas_adicionais)
        ) {
          additional_fees = breakdown.taxas_adicionais.reduce((acc: number, t: any) => {
            if (t.condicional) return acc
            let val = t.valor || 0
            if (t.tipo === 'por_kg') {
              let calc = val * (taxable || 0)
              if (t.minimo && calc < t.minimo) {
                calc = t.minimo
              }
              return acc + calc
            }
            return acc + val
          }, 0)
        }

        let etd = q?.etd || undefined
        if (etd) {
          const d = new Date(etd)
          if (!isNaN(d.getTime())) {
            etd = d.toISOString().split('T')[0]
          } else {
            etd = undefined
          }
        }

        mappedQuotes.push({
          agent_name: formattedAgentName,
          modal,
          cost: 0,
          transit_time: q?.transit_time_max
            ? Number(q.transit_time_max)
            : q?.transit_time
              ? Number(q.transit_time)
              : undefined,
          free_time: q?.free_time ? Number(q.free_time) : undefined,
          taxable_weight: taxable,
          etd,
          unit_rate,
          taxas_origem,
          pickup_fee,
          destination_taxes,
          additional_fees,
          cost_breakdown: breakdown,
        })
      }

      const previewDataToRank = mappedQuotes.map((q, idx) => ({
        id: `preview-${idx}`,
        agent_name: q.agent_name || '',
        modal: q.modal || 'Aéreo',
        cost: q.cost || 0,
        taxable_weight: q.taxable_weight || 0,
        transit_time: q.transit_time || 0,
        cost_breakdown: {
          ...q.cost_breakdown,
          frete_unitario: q.unit_rate || 0,
          taxas_origem: q.taxas_origem || 0,
          pickup_fee: q.pickup_fee || 0,
          destination_taxes: q.destination_taxes || 0,
          taxas_adicionais: [
            { tipo: 'por_embarque', valor: q.additional_fees || 0, descricao: 'Outras Taxas' },
          ],
        },
      }))

      const ranked = rankQuotations(previewDataToRank as any, ped)

      const round1 = await createCotacaoRound({
        pedido_id: pedidoId,
        nome_round: 'cota1',
        user_id: user.id,
      })

      const promises = mappedQuotes.map(async (q, idx) => {
        const preview = ranked.find((p) => p.id === `preview-${idx}`)
        const finalScore = preview?.calculatedScore || 0
        const compat = (preview?.compatScore || 0) * 100

        const updatedBreakdown = {
          ...q.cost_breakdown,
          frete_unitario: q.unit_rate,
          taxas_origem: q.taxas_origem,
          pickup_fee: q.pickup_fee,
          destination_taxes: q.destination_taxes,
          taxas_adicionais: [
            {
              tipo: 'por_embarque',
              valor: q.additional_fees || 0,
              descricao: 'Outras Taxas (Manual)',
            },
          ],
        }

        const createdQ = await createQuotation({
          agent_name: q.agent_name,
          modal: q.modal as any,
          cost: preview?.computedTotal || 0,
          transit_time: q.transit_time ?? undefined,
          free_time: q.free_time ?? undefined,
          etd: q.etd ?? undefined,
          taxable_weight: q.taxable_weight ?? undefined,
          rate_unitario: q.unit_rate ?? undefined,
          score: finalScore,
          compatibilidade_score: Math.round(compat),
          pedido_id: pedidoId,
          cotacao_round_id: round1.id,
          user_id: user.id,
          cost_breakdown: updatedBreakdown,
        })

        try {
          await pb.collection('extracted_data').create({
            quotation_id: createdQ.id,
            raw_data: q.cost_breakdown || {},
          })
        } catch (err) {
          console.error('Failed to save extracted data:', err)
        }

        return createdQ
      })

      await Promise.all(promises)
      await updatePedido(pedidoId, { status: 'concluido' })

      toast({ title: 'Sucesso', description: 'Cotações salvas. Indo para o ranking...' })
      navigate('/ranking', { state: { pedidoId } })
    } catch (err: any) {
      console.error(err)
      setStatus('error')
      setErrorMessage('Falha ao processar e salvar as cotações.')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) {
      if (wizardStep === 1) processPedidoFile(files[0])
      else if (wizardStep === 2) processQuoteFiles(files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      if (wizardStep === 1) processPedidoFile(files[0])
      else if (wizardStep === 2) processQuoteFiles(files)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
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
        comprimento: data.comprimento ? Number(data.comprimento) : undefined,
        largura: data.largura ? Number(data.largura) : undefined,
        altura: data.altura ? Number(data.altura) : undefined,
        quantidade_containers: data.quantidade_containers
          ? Number(data.quantidade_containers)
          : null,
        itens: data.itens,
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
      setPedidoIncoterm(data.incoterm)
      setWizardStep(2)
      setStatus('idle')
      setQuoteFiles([])
      toast({
        title: 'Pedido criado',
        description: 'Agora envie as cotações concorrentes.',
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

  const watchedModal = form.watch('modal_desejado')
  const watchedVolume = form.watch('volume')
  const watchedPeso = form.watch('peso_bruto')
  const watchedOrigem = form.watch('origem')
  const watchedDestino = form.watch('destino')
  const watchedIncoterm = form.watch('incoterm')

  useEffect(() => {
    if (watchedModal === 'FCL') {
      const currentQtd = form.getValues('quantidade_containers')
      if (currentQtd === null || currentQtd === undefined || currentQtd <= 0) {
        form.setValue('quantidade_containers', 1, { shouldValidate: true })
      }
    }
  }, [watchedModal, form])

  const {
    fields: itensFields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({
    control: form.control,
    name: 'itens',
  })

  const watchedComp = form.watch('comprimento')
  const watchedLarg = form.watch('largura')
  const watchedAlt = form.watch('altura')
  const watchedItens = form.watch('itens') || []

  let totalVolumeM3 = 0
  if (watchedItens.length > 0) {
    totalVolumeM3 = watchedItens.reduce((acc, item) => {
      const c = item.comprimento || 0
      const l = item.largura || 0
      const a = item.altura || 0
      const q = item.quantidade || 1
      return acc + (c * l * a * q) / 1000000
    }, 0)
  } else if (watchedComp && watchedLarg && watchedAlt) {
    totalVolumeM3 =
      (watchedComp * watchedLarg * watchedAlt * (form.watch('quantidade_containers') || 1)) /
      1000000
  }

  const pesoCubadoByDim = totalVolumeM3 > 0 ? totalVolumeM3 * 166.666666667 : 0

  const pesoCubado = pesoCubadoByDim > 0 ? pesoCubadoByDim : (watchedVolume || 0) * 166.667
  const pesoTaxado = Math.max(watchedPeso || 0, pesoCubado)

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="mt-12 max-w-3xl mx-auto space-y-8 animate-fade-in-up">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-slate-800">Processando...</h3>
            <p className="text-slate-500">Aguarde enquanto os dados são salvos.</p>
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

    if (wizardStep === 3 || status === 'review-quotes') {
      return (
        <div className="mt-12 max-w-3xl mx-auto animate-fade-in-up space-y-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-800">Revisar Cotações e Coerência</h3>
            <p className="text-slate-500 text-sm">
              Verifique as cotações extraídas e a coerência com o Incoterm selecionado antes de
              salvar. {reviewQuotes?.length || 0} cotação(ões) extraída(s) deste lote.
            </p>
          </div>

          <Card className="p-5 border-slate-200 bg-slate-50 space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                Incoterm do Pedido
                {reviewIncotermDetected && (
                  <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center border border-green-200">
                    Detectado na Cotação
                  </span>
                )}
              </label>
              <Select
                value={reviewIncoterm}
                onValueChange={(val) => {
                  setReviewIncoterm(val)
                  setReviewIncotermDetected(false)
                }}
              >
                <SelectTrigger
                  className={`bg-white ${reviewIncotermDetected ? 'border-green-400 ring-1 ring-green-200' : ''}`}
                >
                  <SelectValue placeholder="Selecione o Incoterm" />
                </SelectTrigger>
                <SelectContent>
                  {['EXW', 'FCA', 'FAS', 'FOB'].map((inc) => (
                    <SelectItem key={inc} value={inc}>
                      {inc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                A alteração do Incoterm recalculará os avisos de coerência abaixo e atualizará o
                pedido.
              </p>
            </div>
          </Card>

          <div className="space-y-4">
            {reviewQuotes?.map((q, idx) => {
              const warnings = validateIncotermCoherence(reviewIncoterm, q)
              const currency = q.currency || 'USD'
              const freteUnitario = Number(q.frete_unitario) || 0
              const ttMin = q.transit_time_min
              const ttMax = q.transit_time_max
              let ttDisplay =
                ttMin && ttMax
                  ? `${ttMin}-${ttMax} dias`
                  : (ttMin || ttMax || q.transit_time || 'N/A') +
                    (ttMin || ttMax || q.transit_time ? ' dias' : '')

              const pickupCount = Array.isArray(q.pickup_options) ? q.pickup_options.length : 0
              const adicCount = Array.isArray(q.taxas_adicionais) ? q.taxas_adicionais.length : 0

              const origemDisplay =
                q.formula_origem || (q.taxas_origem ? `${currency} ${q.taxas_origem}` : 'N/A')

              return (
                <Card
                  key={idx}
                  className="p-5 border-slate-200 bg-white shadow-sm flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <h4 className="font-semibold text-slate-800 text-lg leading-tight">
                        {q.carrier || q.agent_name || 'Agente Desconhecido'}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <span>
                          {q.pol || 'Origem'} &rarr; {q.pod || 'Destino'}
                        </span>
                        {q.weight_break && (
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                            {q.weight_break}
                          </span>
                        )}
                        {q.modal && (
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                            {q.modal}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-500 mb-0.5">Rate</div>
                      <span className="text-xl font-bold text-slate-800">
                        {currency} {freteUnitario.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Transit Time</span>
                      <span className="text-sm font-medium text-slate-700">{ttDisplay}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Origem / EXW</span>
                      <span
                        className="text-sm font-medium text-slate-700 truncate"
                        title={origemDisplay}
                      >
                        {origemDisplay}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Opções Pickup</span>
                      <span className="text-sm font-medium text-slate-700">
                        {pickupCount} encontrada(s)
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Taxas Adicionais</span>
                      <span className="text-sm font-medium text-slate-700">
                        {adicCount} extraída(s)
                      </span>
                    </div>
                  </div>

                  {warnings && warnings.length > 0 && (
                    <div className="space-y-2">
                      {warnings.map((w, wIdx) => (
                        <div
                          key={wIdx}
                          className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2.5 text-amber-800 text-sm"
                        >
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                          <p className="leading-snug">{w}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStatus('idle')
                setWizardStep(2)
              }}
              className="text-slate-600"
            >
              Voltar
            </Button>
            <Button onClick={confirmReviewQuotes} className="bg-primary hover:bg-primary/90">
              Confirmar e Salvar <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )
    }

    if (status === 'form' && wizardStep === 1) {
      return (
        <div className="mt-12 max-w-3xl mx-auto animate-fade-in-up">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-800">Revise os dados do Pedido</h3>
            <p className="text-slate-500 text-sm mb-4">
              Confirme ou altere os dados extraídos antes de prosseguir.
            </p>
            {(!watchedOrigem ||
              !watchedDestino ||
              !watchedIncoterm ||
              (watchedModal === 'Aéreo' && !watchedPeso) ||
              (watchedModal === 'LCL' && !watchedVolume)) && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex gap-2.5 text-amber-800 text-sm items-start">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Alguns campos obrigatórios não foram identificados automaticamente no documento.
                  Por favor, preencha os campos em destaque para prosseguir.
                </p>
              </div>
            )}
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onPedidoSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="origem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Origem
                        {autoDetectedOrigem && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border border-blue-200">
                            Formatado IA
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            setAutoDetectedOrigem(false)
                          }}
                          className={
                            autoDetectedOrigem
                              ? 'border-blue-400 ring-1 ring-blue-200'
                              : !field.value
                                ? 'border-amber-400 ring-1 ring-amber-200 bg-amber-50/30'
                                : ''
                          }
                        />
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
                      <FormLabel className="flex items-center gap-2">
                        Destino
                        {autoDetectedDestino && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border border-blue-200">
                            Formatado IA
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            setAutoDetectedDestino(false)
                          }}
                          className={
                            autoDetectedDestino
                              ? 'border-blue-400 ring-1 ring-blue-200'
                              : !field.value
                                ? 'border-amber-400 ring-1 ring-amber-200 bg-amber-50/30'
                                : ''
                          }
                        />
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
                          className={
                            watchedModal === 'Aéreo' && (field.value == null || field.value <= 0)
                              ? 'border-amber-400 ring-1 ring-amber-200 bg-amber-50/30'
                              : ''
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
                          className={
                            watchedModal === 'LCL' && (field.value == null || field.value <= 0)
                              ? 'border-amber-400 ring-1 ring-amber-200 bg-amber-50/30'
                              : ''
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base">Dimensões / Caixas</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendItem({ comprimento: 0, largura: 0, altura: 0, quantidade: 1 })
                      }
                      className="text-xs h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Volume
                    </Button>
                  </div>

                  {itensFields.length > 0 ? (
                    <div className="space-y-3">
                      {itensFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-100"
                        >
                          <FormField
                            control={form.control}
                            name={`itens.${index}.quantidade`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs">Qtd</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`itens.${index}.comprimento`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs">Comp (cm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`itens.${index}.largura`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs">Larg (cm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`itens.${index}.altura`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs">Alt (cm)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name="comprimento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comp (cm)</FormLabel>
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
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="largura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Larg (cm)</FormLabel>
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
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="altura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alt (cm)</FormLabel>
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
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
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
                      <FormLabel className="flex items-center gap-2">
                        INCOTERM <span className="text-red-500">*</span>
                        {autoDetectedIncoterm && (
                          <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border border-green-200">
                            Detectado por IA
                          </span>
                        )}
                      </FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val)
                          setAutoDetectedIncoterm(false)
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={
                              autoDetectedIncoterm
                                ? 'border-green-400 ring-1 ring-green-200'
                                : !field.value
                                  ? 'border-amber-400 ring-1 ring-amber-200 bg-amber-50/30'
                                  : ''
                            }
                          >
                            <SelectValue placeholder="Selecione o Incoterm" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['EXW', 'FCA', 'FAS', 'FOB'].map((inc) => (
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
                        {totalVolumeM3 > 0
                          ? 'Peso Cubado (Volume m³ × 166.667)'
                          : 'Peso Cubado (Volume m³ × 166.667)'}
                      </span>
                      <span className="font-medium">
                        {totalVolumeM3 > 0
                          ? `${totalVolumeM3.toFixed(3)} m³ × 166.667 = ${pesoCubado.toFixed(2)} kg`
                          : `${watchedVolume || 0} × 166.667 = ${pesoCubado.toFixed(2)} kg`}
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

    if (status === 'error' && wizardStep === 1) {
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
      <div className="mt-12 max-w-3xl mx-auto animate-fade-in-up flex flex-col items-center">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed w-full max-w-xl transition-all duration-200 ease-in-out rounded-xl p-16 flex flex-col items-center justify-center text-center cursor-pointer group ${
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
            multiple={wizardStep === 2}
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
            {wizardStep === 1 ? 'Upload do Pedido (Load Request)' : 'Upload de Cotações'}
          </h3>
          <p className="text-slate-500 mb-8 max-w-md">
            {wizardStep === 1
              ? 'Arraste um PDF ou clique para buscar em seu computador.'
              : 'Arraste os PDFs das cotações concorrentes ou clique para selecioná-los.'}
          </p>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-white shadow-sm pointer-events-none px-6"
          >
            {wizardStep === 1 ? 'Selecionar Arquivo PDF' : 'Selecionar Arquivos (PDF)'}
          </Button>
        </div>

        {wizardStep === 2 && quoteFiles.length > 0 && (
          <div className="mt-8 space-y-4 animate-fade-in w-full max-w-xl mx-auto">
            <h4 className="font-semibold text-slate-800 border-b pb-2">
              Arquivos em Processamento
            </h4>
            <div className="space-y-3">
              {quoteFiles.map((qf) => (
                <div
                  key={qf.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="h-6 w-6 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate" title={qf.name}>
                      {qf.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {qf.status === 'pending' && (
                      <span className="text-xs text-slate-400">Aguardando...</span>
                    )}
                    {qf.status === 'loading' && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-medium">Extraindo...</span>
                      </div>
                    )}
                    {qf.status === 'success' && (
                      <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          {qf.quotes?.length} cotação(ões)
                        </span>
                      </div>
                    )}
                    {qf.status === 'error' && (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">Erro</span>
                        </div>
                        <span
                          className="text-[10px] text-red-500 max-w-[150px] truncate"
                          title={qf.errorMessage}
                        >
                          {qf.errorMessage}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isProcessingQuotes && hasSuccessQuotes && (
              <div className="pt-4 flex justify-end">
                <Button
                  onClick={handleProceedToReview}
                  className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                >
                  Revisar Cotações Extraídas <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-lg p-5 flex gap-4 text-slate-700 w-full max-w-xl mx-auto">
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
                  Envie um ou mais PDFs de cotação. A IA processará cada arquivo individualmente e
                  extrairá as propostas.
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
