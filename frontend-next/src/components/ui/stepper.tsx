"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/cn"

export interface StepDefinition {
  id: string
  title?: string
  description?: string
}

export interface UseStepperOptions {
  initialStep?: number
}

export interface UseStepperReturn<T extends StepDefinition> {
  steps: T[]
  index: number
  count: number
  current: T
  isFirst: boolean
  isLast: boolean
  canNext: boolean
  canPrev: boolean
  next: () => void
  prev: () => void
  goTo: (idOrIndex: string | number) => void
  reset: () => void
}

export function useStepper<T extends StepDefinition>(
  steps: T[],
  { initialStep = 0 }: UseStepperOptions = {},
): UseStepperReturn<T> {
  const [index, setIndex] = React.useState(initialStep)
  const clamp = (i: number) => Math.min(Math.max(i, 0), steps.length - 1)

  return {
    steps,
    index,
    count: steps.length,
    current: steps[index],
    isFirst: index === 0,
    isLast: index === steps.length - 1,
    canNext: index < steps.length - 1,
    canPrev: index > 0,
    next: () => setIndex((i) => clamp(i + 1)),
    prev: () => setIndex((i) => clamp(i - 1)),
    goTo: (idOrIndex) => {
      const target =
        typeof idOrIndex === "number" ? idOrIndex : steps.findIndex((s) => s.id === idOrIndex)
      if (target >= 0) setIndex(clamp(target))
    },
    reset: () => setIndex(clamp(initialStep)),
  }
}

type StepState = "completed" | "active" | "pending"

const StepperContext = React.createContext<{ index: number } | null>(null)

function useStepState(step: number): StepState {
  const ctx = React.useContext(StepperContext)
  if (!ctx) throw new Error("Stepper.* precisa estar dentro de <Stepper>")
  return step < ctx.index ? "completed" : step === ctx.index ? "active" : "pending"
}

export interface StepperProps extends React.ComponentProps<"div"> {
  /** Índice do passo ativo — normalmente `stepper.index` de `useStepper`. */
  index: number
}

function Stepper({ index, className, ...props }: StepperProps) {
  return (
    <StepperContext.Provider value={{ index }}>
      <div data-slot="stepper" className={cn("flex flex-col gap-6", className)} {...props} />
    </StepperContext.Provider>
  )
}

function StepperList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stepper-list"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

export interface StepperItemProps extends React.ComponentProps<"div"> {
  step: number
}

function StepperItem({ step, className, ...props }: StepperItemProps) {
  const state = useStepState(step)
  return (
    <div
      data-slot="stepper-item"
      data-state={state}
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

export interface StepperTriggerProps extends React.ComponentProps<"button"> {
  step: number
}

/** Clicável (navega pro passo) quando `onClick` é passado; senão só exibe. */
function StepperTrigger({ step, className, onClick, type = "button", ...props }: StepperTriggerProps) {
  const state = useStepState(step)
  return (
    <button
      data-slot="stepper-trigger"
      data-state={state}
      type={type}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-2 text-left disabled:cursor-default",
        className,
      )}
      {...props}
    />
  )
}

export interface StepperIndicatorProps extends Omit<React.ComponentProps<"span">, "children"> {
  step: number
  /** O que mostrar quando o passo ainda não foi completado (padrão: `step + 1`). */
  children?: React.ReactNode
}

function StepperIndicator({ step, className, children, ...props }: StepperIndicatorProps) {
  const state = useStepState(step)
  return (
    <span
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
        state === "pending" && "border-border bg-background text-muted-foreground",
        state === "active" && "border-primary bg-primary text-primary-foreground",
        state === "completed" && "border-success bg-success text-success-foreground",
        className,
      )}
      {...props}
    >
      {state === "completed" ? <Check className="size-4" /> : (children ?? step + 1)}
    </span>
  )
}

function StepperTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="stepper-title" className={cn("text-sm font-medium", className)} {...props} />
}

function StepperDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="stepper-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
}

export interface StepperSeparatorProps extends React.ComponentProps<"div"> {
  /** Passo ANTERIOR ao traço — o traço fica preenchido quando esse passo já foi completado. */
  step: number
}

function StepperSeparator({ step, className, ...props }: StepperSeparatorProps) {
  const state = useStepState(step)
  return (
    <div
      data-slot="stepper-separator"
      data-state={state}
      className={cn(
        "mx-2 h-0.5 flex-1 rounded-full transition-colors",
        state === "completed" ? "bg-success" : "bg-border",
        className,
      )}
      {...props}
    />
  )
}

export interface StepperContentProps extends React.ComponentProps<"div"> {
  step: number
}

/** Agnóstico ao conteúdo: renderiza `children` (form, texto, o que for) só quando ativo. */
function StepperContent({ step, className, ...props }: StepperContentProps) {
  const ctx = React.useContext(StepperContext)
  if (!ctx) throw new Error("StepperContent precisa estar dentro de <Stepper>")
  if (ctx.index !== step) return null
  return <div data-slot="stepper-content" className={cn("w-full", className)} {...props} />
}

export {
  Stepper,
  StepperList,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
  StepperContent,
}
