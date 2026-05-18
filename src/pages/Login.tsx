import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import logoUrl from '@/assets/logo-color-ad1d0.png'
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
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('E-mail e senha são obrigatórios.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um e-mail válido.')
      return
    }

    setIsLoading(true)

    const result = await signIn(email, password)

    if (result.error) {
      setError('E-mail ou senha inválidos. Tente novamente.')
      setIsLoading(false)
    } else {
      setTimeout(() => {
        setIsLoading(false)
        navigate('/dashboard')
      }, 500)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-4">
      <div className="w-full max-w-md animate-slide-in-up">
        <div className="flex justify-center mb-8">
          <img src={logoUrl} alt="Brasporto Logo" className="h-16 object-contain" />
        </div>

        <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="h-2 w-full bg-primary" />
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
                  E-mail
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`h-12 text-base pr-12 transition-all ${error ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-accent'}`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm font-medium text-destructive mt-1 animate-fade-in">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-white transition-all shadow-md hover:shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Autenticando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Entrar
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
