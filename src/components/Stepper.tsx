import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepperProps {
  currentStep: number
}

const STEPS = ['Pedido', 'Cotação 1', 'Cotação 2', 'Revisão', 'Decisão']

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-border z-0" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-accent print:bg-slate-800 transition-all duration-500 ease-in-out z-0"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep

          return (
            <div key={step} className="relative z-10 flex flex-col items-center group">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 print:border print:border-slate-300',
                  isActive &&
                    'bg-accent text-accent-foreground ring-4 ring-accent/20 print:bg-slate-800 print:text-white',
                  isCompleted &&
                    'bg-primary text-primary-foreground print:bg-slate-800 print:text-white',
                  !isActive &&
                    !isCompleted &&
                    'bg-background border-2 border-muted-foreground/30 text-muted-foreground print:bg-white',
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : stepNumber}
              </div>
              <div className="absolute top-10 w-24 text-center">
                <span
                  className={cn(
                    'text-xs md:text-sm font-medium transition-colors hidden md:block',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
