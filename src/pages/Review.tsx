import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Info, Calculator } from 'lucide-react'
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
import { createQuotation, Quotation } from '@/services/quotations'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { rankQuotations } from '@/lib/freight-calculator'

const quoteSchema = z.object({
  agent_name: z.string().min(1, 'Obrigatório'),
  modal: z.enum(['Aéreo', 'FCL', 'LCL']),
  cost: z.number().min(0, 'Inválido'), // can be 0 if incomplete
  unit_rate: z.number().nullable().optional(),
  taxas_origem: z.number().nullable().optional(),
  pickup_fee: z.number().nullable().optional(),
  destination_taxes: z.number().nullable().optional(),
  additional_fees: z.number().nullable().optional(),
  taxable_weight: z.number().nullable().optional(),
  free_time: z.number().nullable().optional(),
  transit_time: z.number().nullable().optional(),
  etd: z.string().nullable().optional(),
  round: z.enum(['cota1', 'cota2']),
  cost_breakdown: z.any().optional(),
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
  const watchedQuotes = useWatch({ control: form.control, name: 'quotes' })

  const previewData = useMemo(() => {
    if (!pedido || !watchedQuotes) return []

    const mapped = watchedQuotes.map((q, idx) => {
      const breakdown = q.cost_breakdown || {}
      return {
        id: `preview-${idx}`,
        agent_name: q.agent_name || '',
        modal: q.modal || 'Aéreo',
        cost: q.cost || 0,
        taxable_weight: q.taxable_weight || 0,
        transit_time: q.transit_time || 0,
        cost_breakdown: {
          ...breakdown,
          frete_unitario: q.unit_rate || 0,
          taxas_origem: q.taxas_origem || 0,
          pickup_fee: q.pickup_fee || 0,
          destination_taxes: q.destination_taxes || 0,
          taxas_adicionais: [
            { tipo: 'por_embarque', valor: q.additional_fees || 0, descricao: 'Outras Taxas' },
          ],
        },
      } as Quotation
    })

    return rankQuotations(mapped, pedido)
  }, [watchedQuotes, pedido])

  useRealtime('extracted_data', (e) => {
    if (e.action === 'create' || e.action === 'update') {
      toast({
        title: 'Nova extração sincronizada',
        description: 'Dados foram extraídos de novos documentos em background.',
      })
    }
  })

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
        const calcVolumetricAir = pedVolume * 166.67
        const calcVolumetricLCL = pedVolume * 1000

        form.reset({
          quotes: combined.map((q) => {
            const modal = ['Aéreo', 'FCL', 'LCL'].includes(q.modal) ? q.modal : ped.modal_desejado
            let taxable = q.taxable_weight ? Number(q.taxable_weight) : null

            if (!taxable) {
              if (modal === 'Aéreo') {
                taxable = Number(Math.max(pedPeso, calcVolumetricAir).toFixed(2))
              } else if (modal === 'LCL') {
                taxable = Number(Math.max(pedPeso, calcVolumetricLCL).toFixed(2))
              }
            }

            const breakdown = q.cost_breakdown || {}
            const unit_rate = Number(breakdown.frete_unitario ?? q.unit_rate ?? null)
            const taxas_origem = Number(breakdown.taxas_origem ?? breakdown.origin_taxes ?? null)
            const pickup_fee = Number(breakdown.pickup_fee ?? null)
            const destination_taxes = Number(breakdown.destination_taxes ?? null)

            let additional_fees = Number(q.additional_fees ?? null)
            if (breakdown.taxas_adicionais && Array.isArray(breakdown.taxas_adicionais)) {
              additional_fees = breakdown.taxas_adicionais.reduce(
                (acc: number, t: any) => acc + (t.valor || 0),
                0,
              )
            }

            return {
              agent_name: q.agent_name || '',
              modal: modal as 'Aéreo' | 'FCL' | 'LCL',
              unit_rate,
              taxas_origem,
              pickup_fee,
              destination_taxes,
              additional_fees,
              cost: Number(q.cost) || 0,
              taxable_weight: taxable,
              free_time: q.free_time ? Number(q.free_time) : null,
              transit_time: q.transit_time ? Number(q.transit_time) : null,
              etd: q.etd ? String(q.etd).split('T')[0] : '',
              round: q.round as 'cota1' | 'cota2',
              cost_breakdown: breakdown,
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

      const promises = data.quotes.map((q, idx) => {
        const preview = previewData[idx]
        const finalScore = preview.calculatedScore
        const compat = preview.compatScore * 100

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

        return createQuotation({
          agent_name: q.agent_name,
          modal: q.modal,
          cost: preview.computedTotal,
          transit_time: q.transit_time ?? undefined,
          free_time: q.free_time ?? undefined,
          etd: q.etd ?? undefined,
          taxable_weight: q.taxable_weight ?? undefined,
          rate_unitario: q.unit_rate ?? undefined,
          score: finalScore,
          compatibilidade_score: Math.round(compat),
          pedido_id: pedido.id,
          cotacao_round_id: q.round === 'cota1' ? round1Id : round2Id,
          user_id: user.id,
          cost_breakdown: updatedBreakdown,
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
            Revise todas as opções e os custos detalhados antes de gerar o ranking.
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
                {pedido.prazo_desejado_dias ? `${pedido.prazo_desejado_dias} dias` : 'Não definido'}
                {pedido.peso_bruto ? ` | Peso: ${pedido.peso_bruto}kg` : ''}
                {pedido.volume ? ` | Volume: ${pedido.volume}m³` : ''}
                {pedido.quantidade_containers
                  ? ` | Containers: ${pedido.quantidade_containers}`
                  : ''}
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
              const preview = previewData[index]

              return (
                <Card
                  key={field.id}
                  className={cn(
                    'p-5 border-slate-200 shadow-sm relative overflow-hidden',
                    preview?.isIncompleteData && 'border-red-300',
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0 left-0 w-1 h-full',
                      preview?.isIncompleteData ? 'bg-red-500' : 'bg-blue-500',
                    )}
                  ></div>

                  <div className="flex flex-col gap-2 mb-4 ml-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">
                        Opção {index + 1}{' '}
                        <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">
                          {roundLabel}
                        </span>
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 ml-2">
                    <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
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
                                  field.onChange(
                                    e.target.value ? parseInt(e.target.value, 10) : null,
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {(modalValue === 'Aéreo' || modalValue === 'LCL') && (
                        <FormField
                          control={form.control}
                          name={`quotes.${index}.taxable_weight`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Peso Taxável</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.1"
                                  {...field}
                                  value={field.value ?? ''}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value ? parseFloat(e.target.value) : null,
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="col-span-full mt-4 pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <Calculator className="w-4 h-4" /> Detalhamento de Custos (USD)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <FormField
                            control={form.control}
                            name={`quotes.${index}.unit_rate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Taxa Base (un)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value ? parseFloat(e.target.value) : null,
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`quotes.${index}.taxas_origem`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">EXW / Origem</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value ? parseFloat(e.target.value) : null,
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`quotes.${index}.pickup_fee`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Pickup Fee</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value ? parseFloat(e.target.value) : null,
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`quotes.${index}.additional_fees`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Tx Adicionais (Total)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value ? parseFloat(e.target.value) : null,
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-4 flex flex-col justify-center">
                      {preview ? (
                        <div
                          className={cn(
                            'p-4 border rounded-md shadow-sm h-full flex flex-col justify-center',
                            preview.isIncompleteData
                              ? 'bg-red-50 border-red-200'
                              : 'bg-blue-50/50 border-blue-100',
                          )}
                        >
                          <h4 className="font-bold text-slate-800 mb-3 text-sm">
                            Resumo da Formação de Preço
                          </h4>
                          <div className="space-y-2 text-sm text-slate-700">
                            <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                              <span className="text-xs">
                                Base ({preview.qTaxable.toFixed(2)} ×{' '}
                                {preview.freteUnitario.toFixed(2)})
                              </span>
                              <span className="font-medium">${preview.freteTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                              <span className="text-xs" title={preview.exwLog || 'Taxa de Origem'}>
                                EXW / Origem
                              </span>
                              <span className="font-medium">
                                ${preview.appliedTaxasOrigem.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                              <span className="text-xs">Pickup Fee</span>
                              <span className="font-medium">${preview.pickupFee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                              <span className="text-xs">Adicionais</span>
                              <span className="font-medium">
                                ${preview.additionalTaxes.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                              <span className="font-bold text-slate-900">Total Calculado</span>
                              <span className="font-black text-lg text-blue-700">
                                ${preview.computedTotal.toFixed(2)}
                              </span>
                            </div>

                            {preview.isIncompleteData && (
                              <div className="mt-3 text-xs font-semibold text-red-600 bg-red-100 p-2 rounded">
                                Dados Incompletos: Faltam dimensões/peso para calcular o Custo
                                Total.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full bg-slate-50 border rounded-md flex items-center justify-center text-slate-400 text-sm">
                          Calculando...
                        </div>
                      )}
                    </div>
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
                disabled={
                  isSubmitting || fields.length === 0 || previewData.some((p) => p.isIncompleteData)
                }
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
            {previewData.some((p) => p.isIncompleteData) && (
              <p className="text-red-500 text-sm text-right mt-2 font-medium">
                Corrija os dados incompletos para continuar.
              </p>
            )}
          </form>
        </Form>
      </Card>
    </div>
  )
}
