import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Package,
  Clock,
  CheckCircle2,
  TrendingUp,
  Search,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import { format, startOfMonth, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { getPedidos } from '@/services/pedidos'
import { getQuotations } from '@/services/quotations'
import type { RecordModel } from 'pocketbase'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [pedidos, setPedidos] = useState<RecordModel[]>([])
  const [quotations, setQuotations] = useState<RecordModel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [modalFilter, setModalFilter] = useState('todos')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [pData, qData] = await Promise.all([getPedidos(), getQuotations()])
        setPedidos(pData)
        setQuotations(qData)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  const pedidoStatuses = useMemo(() => {
    const map = new Map<string, string>()
    pedidos.forEach((p) => {
      const pQuotes = quotations.filter((q) => q.pedido_id === p.id)
      const hasDecided = pQuotes.some((q) => q.status === 'aprovado' || q.status === 'rejeitado')
      map.set(p.id, hasDecided ? 'decidida' : 'em_andamento')
    })
    return map
  }, [pedidos, quotations])

  const metrics = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)

    let monthTotal = 0
    let monthAndamento = 0
    let monthDecididas = 0

    pedidos.forEach((p) => {
      if (!p.created) return
      const pDate = parseISO(p.created.replace(' ', 'T'))
      if (pDate >= monthStart) {
        monthTotal++
        const status = pedidoStatuses.get(p.id)
        if (status === 'decidida') monthDecididas++
        else monthAndamento++
      }
    })

    const rate = monthTotal > 0 ? Math.round((monthDecididas / monthTotal) * 100) : 0

    return { total: monthTotal, andamento: monthAndamento, decididas: monthDecididas, rate }
  }, [pedidos, pedidoStatuses])

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        p.id.toLowerCase().includes(searchLower) ||
        (p.origem && p.origem.toLowerCase().includes(searchLower)) ||
        (p.destino && p.destino.toLowerCase().includes(searchLower))
      if (!matchesSearch) return false

      const status = pedidoStatuses.get(p.id)
      if (statusFilter !== 'todos' && status !== statusFilter) return false

      if (modalFilter !== 'todos' && p.modal_desejado !== modalFilter) return false

      return true
    })
  }, [pedidos, search, statusFilter, modalFilter, pedidoStatuses])

  const displayPedidos = filteredPedidos.slice(0, 10)
  const hasMore = filteredPedidos.length > 10

  return (
    <div className="flex flex-col space-y-8 animate-fade-in pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {greeting}, {user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário'}
          </h1>
          <p className="text-slate-500 mt-1">
            Gerencie cotações de frete em um só lugar — Air, FCL e LCL.
          </p>
        </div>
        <Button
          onClick={() => navigate('/upload')}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-6 text-base font-semibold shadow-lg hover:shadow-xl ring-2 ring-blue-600/20 ring-offset-2 transition-all"
        >
          <Plus className="mr-2 h-5 w-5" />
          Nova Cotação
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Cotações no mês</CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '—' : metrics.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Em andamento</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '—' : metrics.andamento}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Decididas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '—' : metrics.decididas}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Taxa de conclusão</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '—' : `${metrics.rate}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <CardTitle className="text-lg font-semibold text-slate-800">
              Atividade Recente
            </CardTitle>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar origem, ref..."
                  className="pl-9 w-full sm:w-[200px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="decidida">Decididas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modalFilter} onValueChange={setModalFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Modal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos modais</SelectItem>
                  <SelectItem value="Aéreo">Aéreo</SelectItem>
                  <SelectItem value="FCL">FCL</SelectItem>
                  <SelectItem value="LCL">LCL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Carregando dados...</div>
          ) : displayPedidos.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum pedido encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-medium text-slate-600">Referência</TableHead>
                    <TableHead className="font-medium text-slate-600">Data</TableHead>
                    <TableHead className="font-medium text-slate-600">Modal</TableHead>
                    <TableHead className="font-medium text-slate-600">Rota</TableHead>
                    <TableHead className="font-medium text-slate-600">Status</TableHead>
                    <TableHead className="text-right font-medium text-slate-600">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayPedidos.map((p) => {
                    const status = pedidoStatuses.get(p.id)
                    const isDecided = status === 'decidida'
                    const pDate = p.created ? parseISO(p.created.replace(' ', 'T')) : new Date()

                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                        onClick={() => navigate(`/ranking?pedidoId=${p.id}`)}
                      >
                        <TableCell className="font-mono text-xs text-slate-500">
                          {p.id.substring(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {format(pDate, 'dd/MM/yy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium bg-white">
                            {p.modal_desejado?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          <span className="font-medium">{p.origem}</span>
                          <ArrowRight className="inline-block w-3 h-3 mx-1 text-slate-400" />
                          <span className="font-medium">{p.destino}</span>
                        </TableCell>
                        <TableCell>
                          {isDecided ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-medium">
                              Decidida
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-medium">
                              Em andamento
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            Ver ranking <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {hasMore && !isLoading && displayPedidos.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/history')}
                className="text-slate-600 hover:text-slate-900"
              >
                Ver histórico completo <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
