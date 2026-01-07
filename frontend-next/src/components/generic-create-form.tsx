"use client"

import * as React from "react"
import { useForm, type FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslation } from "@/hooks/use-translation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { buildFieldsFromConfig, type FieldConfig } from "@/lib/form/field-config"

export interface FormField {
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'textarea' | 'select'
  placeholder?: string
  disabled?: boolean
  className?: string
  description?: string
  options?: { value: string; label: string }[]
}

interface GenericCreateFormProps<TSchema extends z.ZodType<FieldValues>> {
  /** Zod schema for form validation */
  schema: TSchema
  /** API action to call on form submit */
  onSubmit: (data: z.infer<TSchema>) => Promise<unknown>
  /** Form fields configuration (manual) */
  fields?: FormField[]
  /** Field configuration (auto-generated from schema) - alternative to fields */
  fieldConfig?: FieldConfig<TSchema>
  /** Callback when submission succeeds */
  onSuccess?: (data: unknown) => void
  /** Callback when submission fails */
  onError?: (error: Error) => void
  /** Label for submit button */
  submitLabel?: string
  /** Label for cancel button */
  cancelLabel?: string
  /** Callback for cancel action */
  onCancel?: () => void
  /** Class name for form container */
  className?: string
  /** Default values for form */
  defaultValues?: Partial<z.infer<TSchema>>
  // Somente props do formulário
}

export function GenericCreateForm<TSchema extends z.ZodType<FieldValues>>({
  schema,
  onSubmit,
  fields,
  fieldConfig,
  onSuccess,
  onError,
  submitLabel,
  cancelLabel,
  onCancel,
  className,
  defaultValues,
  // removidos: trigger, modal, title, description, open, onOpenChange
}: GenericCreateFormProps<TSchema>) {
  const { t } = useTranslation('common')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // Resolve fields: use manual fields, or build from fieldConfig, or empty
  const resolvedFields = React.useMemo(() => {
    if (fields) return fields
    if (fieldConfig && schema instanceof z.ZodObject) {
      return buildFieldsFromConfig(schema, fieldConfig)
    }
    return []
  }, [fields, fieldConfig, schema])

  // Garante que todos os campos tenham valores iniciais para evitar inputs não-controlados
  const initialValues = React.useMemo(() => {
    const defaults: Record<string, unknown> = {}
    
    resolvedFields.forEach(field => {
      if (defaultValues && field.name in defaultValues) {
        defaults[field.name] = defaultValues[field.name as keyof typeof defaultValues]
      } else {
        // Define valores iniciais padrão baseado no tipo do campo
        if (field.type === 'checkbox') {
          defaults[field.name] = false
        } else if (field.type === 'number') {
          defaults[field.name] = ''
        } else {
          defaults[field.name] = ''
        }
      }
    })
    
    return defaults
  }, [resolvedFields, defaultValues])

  const form = useForm<z.infer<TSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: initialValues as any,
  })

  const handleFormSubmit = async (data: z.infer<TSchema>) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await onSubmit(data)
      setSuccess(t('successMessage'))
      form.reset()
      onSuccess?.(result)
      // Limpa mensagem de sucesso após 1s
      setTimeout(() => {
        setSuccess(null)
      }, 1000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errorMessage')
      setError(errorMessage)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    setError(null)
    setSuccess(null)
    onCancel?.()
  }

  const renderField = (field: FormField) => {
    if (field.type === 'select') {
      return (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name as never}
          render={({ field: formField }) => (
            <FormItem className={field.className}>
              <FormLabel>
                {field.label}
                {field.description && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({field.description})
                  </span>
                )}
              </FormLabel>
              <Select
                onValueChange={formField.onChange}
                value={formField.value || ''}
                disabled={field.disabled || isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder || t('selectPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )
    }

    if (field.type === 'textarea') {
      return (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name as never}
          render={({ field: formField }) => (
            <FormItem className={field.className}>
              <FormLabel>
                {field.label}
                {field.description && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({field.description})
                  </span>
                )}
              </FormLabel>
              <FormControl>
                <textarea
                  {...formField}
                  placeholder={field.placeholder}
                  disabled={field.disabled || isSubmitting}
                  className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )
    }

    if (field.type === 'checkbox') {
      return (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name as never}
          render={({ field: formField }) => (
            <FormItem className={`flex items-center space-x-2 space-y-0 ${field.className || ''}`}>
              <FormControl>
                <input
                  type="checkbox"
                  checked={formField.value}
                  onBlur={formField.onBlur}
                  onChange={formField.onChange}
                  disabled={field.disabled || isSubmitting}
                  className="size-4 rounded border-input text-primary focus:ring-ring"
                />
              </FormControl>
              <FormLabel className="font-normal cursor-pointer">
                {field.label}
                {field.description && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({field.description})
                  </span>
                )}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      )
    }

    return (
      <FormField
        key={field.name}
        control={form.control}
        name={field.name as never}
        render={({ field: formField }) => (
          <FormItem className={field.className}>
            <FormLabel>
              {field.label}
              {field.description && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({field.description})
                </span>
              )}
            </FormLabel>
            <FormControl>
              <Input
                {...formField}
                type={field.type || 'text'}
                placeholder={field.placeholder}
                disabled={field.disabled || isSubmitting}
                onChange={(e) => {
                  const value = field.type === 'number'
                    ? e.target.valueAsNumber
                    : e.target.value
                  formField.onChange(value)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border rounded-lg p-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className={`space-y-6 ${className || ''}`}
        >
          <div className="grid gap-6">
            {resolvedFields.map(renderField)}
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-destructive text-sm">⚠</span>
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 text-sm">✓</span>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{success}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border/50">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="animate-spin mr-2" />}
              {submitLabel || t('submit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {cancelLabel || t('cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}


export interface GenericCreateFormModalProps<TSchema extends z.ZodType<FieldValues>> extends GenericCreateFormProps<TSchema> {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: string
  description?: string
  closeOnsuccess?: boolean
}


export function GenericCreateFormModal<TSchema extends z.ZodType<FieldValues>>(props: GenericCreateFormModalProps<TSchema>) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = props.open !== undefined ? props.open : internalOpen
  const setOpen = props.onOpenChange || setInternalOpen

  // Função para garantir que o modal feche ao cancelar
  const handleCancel = () => {
    setOpen(false)
    props.onCancel?.()
  }

  // Função para fechar o modal após sucesso e chamar o onSuccess original
  const handleSuccess = (data: unknown) => {
    if (props.closeOnsuccess) {
      setOpen(false)
    }
    props.onSuccess?.(data)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.trigger}
      </DialogTrigger>
      <DialogContent>
        {(props.title || props.description) && (
          <DialogHeader>
            {props.title && <DialogTitle>{props.title}</DialogTitle>}
            {props.description && <DialogDescription>{props.description}</DialogDescription>}
          </DialogHeader>
        )}
        <GenericCreateForm {...props} onCancel={handleCancel} onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}
