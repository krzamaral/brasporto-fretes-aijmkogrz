import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import logoUrl from '@/assets/logo-color-ad1d0.png'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-slate-50">
      {/* Left Panel (Hero) */}
      <div
        className="relative hidden md:flex md:w-[55%] flex-col justify-end bg-cover bg-center p-12 lg:p-16"
        style={{
          backgroundImage:
            'url("https://img.usecurling.com/p/1200/1600?q=logistics%20cargo%20ship")',
        }}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom right, rgba(27, 58, 107, 0.9), rgba(27, 58, 107, 0.25))',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-2xl text-white animate-slide-in-up">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight">BRASPORTO</h2>
            <p className="text-sm font-medium uppercase tracking-widest text-white/80">
              International Logistics
            </p>
          </div>

          {/* Decorative Bar */}
          <div className="mb-6 h-1 w-16" style={{ backgroundColor: '#D4A574' }} />

          <h1 className="mb-4 text-4xl font-bold leading-tight lg:text-5xl">
            Comparador inteligente de fretes
          </h1>
          <p className="text-lg text-white/90 lg:text-xl">
            Air, FCL e LCL — validação operacional, ranking automático, decisão em segundos.
          </p>
        </div>
      </div>

      {/* Right Panel (Form) */}
      <div className="flex w-full md:w-[45%] flex-col items-center justify-center bg-white p-6 sm:p-12 shadow-2xl z-10">
        <div className="w-full max-w-md animate-slide-in-up">
          {/* Mobile Logo */}
          <div className="mb-8 flex justify-center md:hidden">
            <img src={logoUrl} alt="Brasporto Logo" className="h-16 object-contain" />
          </div>

          <div className="mb-10 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-800">Acesso à Plataforma</h2>
            <p className="mt-2 text-base text-slate-500">
              Entre com suas credenciais pra continuar
            </p>
          </div>

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
                className={`h-12 text-base transition-all ${
                  error
                    ? 'border-destructive focus-visible:ring-destructive'
                    : 'focus-visible:ring-accent'
                }`}
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
                  className={`h-12 pr-12 text-base transition-all ${
                    error
                      ? 'border-destructive focus-visible:ring-destructive'
                      : 'focus-visible:ring-accent'
                  }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="animate-fade-in text-sm font-medium text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="h-12 w-full bg-primary text-base font-semibold text-white shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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

          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500 md:justify-start">
            <ShieldCheck className="h-4 w-4" />
            <span>Acesso restrito a colaboradores</span>
          </div>
        </div>
      </div>
    </div>
  )
}
