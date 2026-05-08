import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Save, Loader2 } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { getLatestExtractedData } from '@/services/extracted_data'
import { createQuotation } from '@/services/quotations'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const emptyToNull = (val: any) => {
  if (val === '' || val === undefined || val === null) return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

const formSchema = z
  .object({
    agent_name: z.string().min(1, 'Campo obrigatório não preenchido: Nome do Agente'),
    modal: z.enum(['Aéreo', 'FCL', 'LCL'], {
      required_error: 'Campo obrigatório não preenchido: Modal',
    }),
    cost: z.preprocess(
      emptyToNull,
      z
        .number({ invalid_type_error: 'Campo obrigatório não preenchido: Frete Base' })
        .min(0.01, 'Campo obrigatório não preenchido: Frete Base'),
    ),
    taxable_weight: z.preprocess(emptyToNull, z.number().nullable().optional()),
    free_time: z.preprocess(emptyToNull, z.number().nullable().optional()),
    transit_time: z.preprocess(emptyToNull, z.number().nullable().optional()),
    etd: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.modal === 'Aéreo' && (!data.taxable_weight || data.taxable_weight <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Campo obrigatório não preenchido: Peso Taxável',
        path: ['taxable_weight'],
      })
    }
    if (data.modal === 'FCL' && (data.free_time === null || data.free_time === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Campo obrigatório não preenchido: Free Time',
        path: ['free_time'],
      })
    }
  })

type FormValues = z.infer<typeof formSchema>

export default function Review() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rawData, setRawData] = useState<Record<string, any> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      agent_name: '',
      modal: undefined,
      cost: null as any,
      taxable_weight: null,
      free_time: null,
      transit_time: null,
      etd: '',
    },
  })

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getLatestExtractedData()
        if (res.items.length > 0) {
          const extracted = res.items[0]
          const data = extracted.raw_data || {}
          setRawData(data)

          let etdVal = ''
          if (data.etd) {
            etdVal = String(data.etd).split('T')[0]
          }

          form.reset({
            agent_name: data.agent_name || '',
            modal: ['Aéreo', 'FCL', 'LCL'].includes(data.modal) ? data.modal : undefined,
            cost: data.cost ? Number(data.cost) : (null as any),
            taxable_weight: data.taxable_weight ? Number(data.taxable_weight) : null,
            free_time: data.free_time ? Number(data.free_time) : null,
            transit_time: data.transit_time ? Number(data.transit_time) : null,
            etd: etdVal,
          })

          setTimeout(() => form.trigger(), 50)
        }
      } catch (error) {
        console.error(error)
        toast({
          title: 'Erro',
          description: 'Falha ao carregar dados extraídos.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [form, toast])

  const modalValue = form.watch('modal')

  const isMissing = (field: string) => {
    if (!rawData) return false
    return (
      rawData[field] === null ||
      rawData[field] === undefined ||
      String(rawData[field]).trim() === ''
    )
  }

  const onSubmit = async (data: FormValues) => {
    if (!user) return
    setIsSubmitting(true)
    try {
      await createQuotation({
        user_id: user.id,
        agent_name: data.agent_name,
        modal: data.modal,
        cost: data.cost as number,
        taxable_weight:
          data.modal === 'Aéreo' && data.taxable_weight !== null ? data.taxable_weight : undefined,
        free_time: data.modal === 'FCL' && data.free_time !== null ? data.free_time : undefined,
        transit_time: data.transit_time !== null ? data.transit_time : undefined,
        etd: data.etd || undefined,
      })
      toast({ title: 'Sucesso', description: 'Cotação validada e salva com sucesso!' })
      navigate('/ranking')
    } catch (error) {
      console.error(error)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a cotação.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const MissingAlert = ({ field }: { field: string }) => {
    if (!isMissing(field)) return null
    return (
      <Tooltip>
        <TooltipTrigger type="button" className="cursor-help ml-2 inline-flex items-center">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Dado não encontrado no PDF. Preenchimento manual necessário.</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-slate-800">
            Conferência de Dados
          </h2>
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

        <div className="mt-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-slate-500">Carregando dados extraídos...</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="agent_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Nome do Agente <MissingAlert field="agent_name" />
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Agente Logístico S/A"
                            {...field}
                            className={
                              form.formState.errors.agent_name
                                ? 'border-red-500 focus-visible:ring-red-500'
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
                    name="modal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Modal <MissingAlert field="modal" />
                        </FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val)
                            form.trigger()
                          }}
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger
                              className={
                                form.formState.errors.modal
                                  ? 'border-red-500 focus:ring-red-500'
                                  : ''
                              }
                            >
                              <SelectValue placeholder="Selecione o modal" />
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
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Frete Base / Cost (US$) <MissingAlert field="cost" />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 1500.00"
                            {...field}
                            value={field.value ?? ''}
                            className={
                              form.formState.errors.cost
                                ? 'border-red-500 focus-visible:ring-red-500'
                                : ''
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
                      name="taxable_weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            Peso Taxável (kg) <MissingAlert field="taxable_weight" />
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Ex: 500"
                              {...field}
                              value={field.value ?? ''}
                              className={
                                form.formState.errors.taxable_weight
                                  ? 'border-red-500 focus-visible:ring-red-500'
                                  : ''
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {modalValue === 'FCL' && (
                    <FormField
                      control={form.control}
                      name="free_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            Free Time (dias) <MissingAlert field="free_time" />
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Ex: 7"
                              {...field}
                              value={field.value ?? ''}
                              className={
                                form.formState.errors.free_time
                                  ? 'border-red-500 focus-visible:ring-red-500'
                                  : ''
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
                    name="transit_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          Transit Time (dias) <MissingAlert field="transit_time" />
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ex: 30"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="etd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          ETD (Data de Saída) <MissingAlert field="etd" />
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-6 border-t mt-8">
                  <Button
                    type="submit"
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
                    disabled={!form.formState.isValid || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Confirmar Extração
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </Card>
    </div>
  )
}
