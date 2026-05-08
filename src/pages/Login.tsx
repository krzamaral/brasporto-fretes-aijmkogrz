import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('O e-mail é obrigatório.')
      return
    }

    if (!email.endsWith('@brasporto.com')) {
      setError('Por favor, utilize um e-mail corporativo @brasporto.com')
      return
    }

    setIsLoading(true)

    const result = await signIn(email)

    if (result.error) {
      setError(result.error.message || 'Erro ao enviar link de acesso. Tente novamente.')
      setIsLoading(false)
    } else {
      setTimeout(() => {
        setIsLoading(false)
        navigate('/dashboard')
      }, 800)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-4">
      <div className="w-full max-w-md animate-slide-in-up">
        <div className="flex justify-center mb-8">
          <div className="bg-primary p-4 rounded-2xl shadow-lg flex items-center gap-3 text-primary-foreground">
            <Truck className="h-8 w-8" />
            <span className="text-2xl font-bold tracking-tight">Brasporto</span>
          </div>
        </div>

        <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="h-2 w-full bg-accent" />
          <CardHeader className="space-y-3 pb-6 text-center">
            <CardTitle className="text-2xl font-bold text-slate-800">Acesso à Plataforma</CardTitle>
            <CardDescription className="text-base text-slate-500">
              Plataforma de comparação e decisão de fretes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                  E-mail Corporativo
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu-email@brasporto.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`h-12 text-base transition-all ${error ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-accent'}`}
                  autoComplete="email"
                />
                {error && (
                  <p className="text-sm font-medium text-destructive mt-1 animate-fade-in">
                    {error}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-accent hover:bg-accent/90 text-white transition-all shadow-md hover:shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando Magic Link...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Receber Link de Acesso
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t bg-slate-50/50 py-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              <span>Acesso restrito a colaboradores</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
