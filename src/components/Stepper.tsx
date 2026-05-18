import { cn } from '@/lib/utils'
import { Inbox, FileSearch, FileText, CheckSquare, Trophy } from 'lucide-react'

interface StepperProps {
  currentStep: number
}

const STEPS = [
  { label: '1. SOLICITAÇÃO\nDO CLIENTE', icon: Inbox },
  { label: '2. CONFERÊNCIA\nLOGÍSTICA', icon: FileSearch },
  { label: '3. COTAÇÕES\nDOS AGENTES', icon: FileText },
  { label: '4. VALIDAÇÃO E\nCOMPARAÇÃO', icon: CheckSquare },
  { label: '5. DECISÃO', icon: Trophy },
]

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="w-full py-4 print:py-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-[5%] top-1/2 -translate-y-1/2 w-[90%] h-[2px] bg-slate-200 z-0" />

        {STEPS.map((step, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep
          const Icon = step.icon

          return (
            <div key={step.label} className="relative z-10 flex flex-col items-center group w-1/5">
              <div className="flex items-center gap-2 lg:gap-3 bg-white print:bg-white px-2">
                <div
                  className={cn(
                    'w-8 h-8 lg:w-10 lg:h-10 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 border-2 bg-white',
                    isActive || isCompleted
                      ? 'border-[#00749b] text-[#00749b]'
                      : 'border-slate-300 text-slate-400',
                  )}
                >
                  <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div className="text-left hidden md:block">
                  <span
                    className={cn(
                      'text-[10px] lg:text-[11px] font-bold uppercase whitespace-pre-line leading-tight',
                      isActive || isCompleted ? 'text-slate-800' : 'text-slate-400',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
