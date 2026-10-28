"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/cn"

export interface OnboardingStepContext {
  onNext: () => void
  onBack: () => void
  isFirst: boolean
  isLast: boolean
}

export interface OnboardingStep {
  id: string
  title: string
  description?: string
  /** Renders the step body. Call ctx.onNext() whenever this step's content decides it's done. */
  render: (ctx: OnboardingStepContext) => React.ReactNode
}

interface OnboardingProps {
  steps: OnboardingStep[]
  /** Called after the last step calls onNext() */
  onComplete?: () => void
  /** 'card' = bordered card chrome (standalone use); 'plain' = no wrapper (e.g. inside a Dialog) */
  chrome?: "card" | "plain"
  className?: string
}

export function Onboarding({ steps, onComplete, chrome = "card", className }: OnboardingProps) {
  const [stepIndex, setStepIndex] = React.useState(0)
  const step = steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  const onNext = () => {
    if (isLast) {
      onComplete?.()
    } else {
      setStepIndex((i) => i + 1)
    }
  }
  const onBack = () => setStepIndex((i) => Math.max(0, i - 1))

  const progress = steps.length > 1 && (
    <div className="mb-2 flex items-center gap-2">
      {steps.map((s, i) => (
        <div
          key={s.id}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= stepIndex ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  )

  if (chrome === "plain") {
    return (
      <div className={cn("w-full", className)}>
        {progress}
        <h3 className="font-semibold leading-none">{step.title}</h3>
        {step.description && (
          <p className="text-muted-foreground text-sm mt-1">{step.description}</p>
        )}
        <div className="mt-4">{step.render({ onNext, onBack, isFirst, isLast })}</div>
      </div>
    )
  }

  return (
    <Card className={cn("w-full max-w-lg", className)}>
      <CardHeader>
        {progress}
        <CardTitle>{step.title}</CardTitle>
        {step.description && <CardDescription>{step.description}</CardDescription>}
      </CardHeader>
      <CardContent>{step.render({ onNext, onBack, isFirst, isLast })}</CardContent>
    </Card>
  )
}
