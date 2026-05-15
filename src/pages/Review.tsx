import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react'
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
import { useAuth } from '@/hooks/use-auth'
import { getPedido, updatePedido, Pedido } from '@/services/pedidos'
import { useRealtime } from '@/hooks/use-realtime'
import { createCotacaoRound } from '@/services/cotacao_rounds'
import { createQuotation } from '@/services/quotations'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const quoteSchema = z
  .object({
    agent_name: z.string().min(1, 'Obrigatório'),
    modal: z.enum(['Aéreo', 'FCL', 'LCL']),
    cost: z.number({ invalid_type_error: 'Obrigatório' }).min(0.01, 'Inválido'),
    taxable_weight: z.number().nullable().optional(),
    free_time: z.number().nullable().optional(),
    transit_time: z.number().nullable().optional(),
    etd: z.string().nullable().optional(),
    round: z.enum(['cota1', 'cota2']),
  })
  .superRefine((data, ctx) => {
    if (data.modal === 'Aéreo' && (data.taxable_weight == null || data.taxable_weight <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Peso Taxável é obrigatório para Aéreo',
        path: ['taxable_weight'],
      })
    }
    if (data.modal === 'FCL' && (data.free_time == null || data.free_time < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Free Time é obrigatório para FCL',
        path: ['free_time'],
      })
    }
  })

const formSchema = z.object({ quotes: z.array(quoteSchema) })
type FormValues = z.infer<typeof formSchema>

export default function Review() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pedido, setPedido] = useState<Pedido | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { quotes: [] },
    mode: 'onChange',
  })

  const { fields } = useFieldArray({ control: form.control, name: 'quotes' })

  useRealtime('extracted_data', (e) => {
    if (e.action === 'create' || e.action === 'update') {
      toast({
        title: 'Nova extração sincronizada',
        description: 'Dados foram extraídos de novos documentos em background.',
      })
    }
  })

  useRealtime(
    'quotations',
    (e) => {
      if (e.action === 'create' && e.record.pedido_id === pedido?.id) {
        toast({
          title: 'Nova cotação adicionada',
          description: 'Uma cotação foi registrada recentemente neste pedido.',
        })
      }
    },
    !!pedido?.id,
  )

  useEffect(() => {
    async function loadData() {
      const state = location.state as { pedidoId: string; cota1Quotes: any[]; cota2Quote: any }
      if (!state || !state.pedidoId) {
        toast({
          title: 'Sessão expirada',
          description: 'Por favor, inicie o processo novamente.',
          variant: 'destructive',
        })
        navigate('/upload')
        return
      }

      try {
        const ped = await getPedido(state.pedidoId)
        setPedido(ped)

        const combined = []
        if (state.cota1Quotes) {
          state.cota1Quotes.forEach((q) => combined.push({ ...q, round: 'cota1' }))
        }
        if (state.cota2Quote) {
          combined.push({ ...state.cota2Quote, round: 'cota2' })
        }

        const pedVolume = ped.volume || 0
        const pedPeso = ped.peso_bruto || 0
        const calcVolumetric = pedVolume * 166.667

        form.reset({
          quotes: combined.map((q) => {
            const modal = ['Aéreo', 'FCL', 'LCL'].includes(q.modal) ? q.modal : ped.modal_desejado
            let taxable = q.taxable_weight ? Number(q.taxable_weight) : null

            if (modal === 'Aéreo') {
              taxable = Number(Math.max(pedPeso, calcVolumetric).toFixed(2))
            }

            return {
              agent_name: q.agent_name || '',
              modal: modal as 'Aéreo' | 'FCL' | 'LCL',
              cost: Number(q.cost) || (null as any),
              taxable_weight: taxable,
              free_time: q.free_time ? Number(q.free_time) : null,
              transit_time: q.transit_time ? Number(q.transit_time) : null,
              etd: q.etd ? String(q.etd).split('T')[0] : '',
              round: q.round as 'cota1' | 'cota2',
            }
          }),
        })
      } catch (error) {
        toast({ title: 'Erro', description: 'Falha ao carregar dados.', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [form, location, navigate, toast])

  const onSubmit = async (data: FormValues) => {
    if (!user || !pedido) return
    setIsSubmitting(true)
    try {
      const getEtdDays = (etd?: string | null) =>
        etd ? Math.max(0, (new Date(etd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

      const costs = data.quotes.map((q) => q.cost)
      const maxC = Math.max(...costs)
      const minC = Math.min(...costs)

      const tts = data.quotes.map((q) => q.transit_time).filter((v): v is number => v != null)
      const maxTT = tts.length > 0 ? Math.max(...tts) : 0
      const minTT = tts.length > 0 ? Math.min(...tts) : 0

      const etds = data.quotes.map((q) => getEtdDays(q.etd)).filter((v): v is number => v != null)
      const maxETD = etds.length > 0 ? Math.max(...etds) : 0
      const minETD = etds.length > 0 ? Math.min(...etds) : 0

      const fts = data.quotes.map((q) => q.free_time).filter((v): v is number => v != null)
      const maxFT = fts.length > 0 ? Math.max(...fts) : 0
      const minFT = fts.length > 0 ? Math.min(...fts) : 0

      const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 1

      const hasCota1 = data.quotes.some((q) => q.round === 'cota1')
      const hasCota2 = data.quotes.some((q) => q.round === 'cota2')

      let round1Id, round2Id
      if (hasCota1)
        round1Id = (
          await createCotacaoRound({ pedido_id: pedido.id, nome_round: 'cota1', user_id: user.id })
        ).id
      if (hasCota2)
        round2Id = (
          await createCotacaoRound({ pedido_id: pedido.id, nome_round: 'cota2', user_id: user.id })
        ).id

      const promises = data.quotes.map((q) => {
        // N = (C * 0.40) + (TT * 0.30) + (ETD * 0.20) + (FT * 0.10)
        const normC = maxC === minC ? 100 : ((maxC - q.cost) / (maxC - minC)) * 100

        const normTT =
          q.transit_time != null
            ? maxTT === minTT
              ? 100
              : ((maxTT - q.transit_time) / (maxTT - minTT)) * 100
            : 0

        const qEtdDays = getEtdDays(q.etd)
        const normETD =
          qEtdDays != null
            ? maxETD === minETD
              ? 100
              : ((maxETD - qEtdDays) / (maxETD - minETD)) * 100
            : 0

        const normFT =
          q.free_time != null
            ? maxFT === minFT
              ? 100
              : ((q.free_time - minFT) / (maxFT - minFT)) * 100
            : 0

        const finalScore = Math.round(normC * 0.4 + normTT * 0.3 + normETD * 0.2 + normFT * 0.1)

        let compat = 100
        const prazoDesejado = pedido.prazo_desejado_dias
        if (prazoDesejado != null && q.transit_time != null) {
          const ttDiff = q.transit_time - prazoDesejado
          if (ttDiff > 0) compat -= Math.min(100, ttDiff * 5)
        }
        if (q.modal !== pedido.modal_desejado) compat -= 20

        return createQuotation({
          agent_name: q.agent_name,
          modal: q.modal,
          cost: q.cost,
          transit_time: q.transit_time ?? undefined,
          free_time: q.free_time ?? undefined,
          etd: q.etd ?? undefined,
          taxable_weight: q.taxable_weight ?? undefined,
          score: finalScore,
          compatibilidade_score: Math.round(compat),
          pedido_id: pedido.id,
          cotacao_round_id: q.round === 'cota1' ? round1Id : round2Id,
          user_id: user.id,
        })
      })

      await Promise.all(promises)
      await updatePedido(pedido.id, { status: 'concluido' })
      toast({ title: 'Sucesso', description: 'Cotações salvas e rankeadas!' })
      navigate('/ranking', { state: { pedidoId: pedido.id } })
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
      </div>
    )

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            Conferência de Cotações
          </h2>
          <p className="text-muted-foreground">
            Revise todas as opções extraídas antes de gerar o ranking.
          </p>
        </div>
      </div>

      <Card className="p-6 md:p-8 bg-white border-slate-200 shadow-sm">
        <Stepper currentStep={4} />

        {pedido && (
          <div className="mt-8 mb-6 p-4 bg-slate-50 border rounded-lg flex items-start gap-4">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-slate-800">Referência do Pedido</h4>
              <p className="text-sm text-slate-600 mb-1">
                {pedido.origem} → {pedido.destino} | {pedido.modal_desejado} | Prazo alvo:{' '}
                {pedido.prazo_desejado_dias ? `${pedido.prazo_desejado_dias} dias` : 'Não definido'}{' '}
                | Peso: {pedido.peso_bruto}kg
              </p>
              <p className="text-sm text-slate-500">
                Mercadoria: {pedido.tipo_mercadoria || 'Não especificada no documento'}
              </p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {fields.map((field, index) => {
              const roundLabel =
                form.watch(`quotes.${index}.round`) === 'cota1'
                  ? 'Cotação 1 (Múltiplas)'
                  : 'Cotação 2'
              const modalValue = form.watch(`quotes.${index}.modal`)
              return (
                <Card
                  key={field.id}
                  className="p-5 border-slate-200 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <div className="flex flex-col gap-2 mb-4 ml-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">
                        Opção {index + 1}{' '}
                        <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">
                          {roundLabel}
                        </span>
                      </h3>
                      {Object.keys(form.formState.errors?.quotes?.[index] || {}).length > 0 && (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center">
                          <Info className="w-3 h-3 mr-1" />
                          Incompleta / Crítica
                        </span>
                      )}
                    </div>
                    {modalValue === 'FCL' && form.watch(`quotes.${index}.free_time`) == null && (
                      <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Aviso: Free Time é obrigatório para modal FCL e não foi localizado.
                      </div>
                    )}
                    {modalValue === 'Aéreo' &&
                      (form.watch(`quotes.${index}.taxable_weight`) == null ||
                        form.watch(`quotes.${index}.taxable_weight`)! <= 0) && (
                        <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          Aviso: Peso Taxável é obrigatório para modal Aéreo.
                        </div>
                      )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 ml-2">
                    <FormField
                      control={form.control}
                      name={`quotes.${index}.agent_name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agente</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`quotes.${index}.modal`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modal</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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
                      name={`quotes.${index}.cost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {modalValue === 'Aéreo'
                              ? 'Custo Total da Remessa (US$)'
                              : 'Custo Total (US$)'}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`quotes.${index}.transit_time`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transit Time (dias)</FormLabel>
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
                    {modalValue === 'Aéreo' && (
                      <FormField
                        control={form.control}
                        name={`quotes.${index}.taxable_weight`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso Taxável (kg)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                                }
                              />{' '}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {modalValue === 'FCL' && (
                      <FormField
                        control={form.control}
                        name={`quotes.${index}.free_time`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Free Time (dias)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value ? parseInt(e.target.value, 10) : null,
                                  )
                                }
                              />{' '}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name={`quotes.${index}.etd`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ETD</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Card>
              )
            })}

            {fields.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Nenhuma cotação extraída. Retorne e faça o upload novamente.
              </div>
            )}

            <div className="flex justify-end pt-6 border-t mt-8">
              <Button
                type="submit"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
                disabled={isSubmitting || fields.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Finalizar e Rankear
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  )
}
