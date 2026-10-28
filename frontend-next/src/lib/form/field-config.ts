import { z } from 'zod'

interface FieldConfigEntry {
  /** Display label for the field */
  label?: string
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'textarea' | 'select' | 'file' | 'image' | 'display' | 'custom'
  /** Placeholder text */
  placeholder?: string
  /** Help text shown below the field */
  description?: string
  /** Disable the field */
  disabled?: boolean
  /** Custom className for the field container */
  className?: string
  /** Options for select fields */
  options?: { value: string; label: string }[]
  /** Existing image/file URL for preview (image/file types) */
  preview?: string
  /** Accept attribute for file/image inputs */
  accept?: string
}

/** Configuração de campos type-safe para um schema Zod. */
export type FieldConfig<TSchema extends z.ZodType> = {
  [K in keyof z.infer<TSchema>]?: FieldConfigEntry
}

/** Converte um schema Zod + configuração de campos em um array de FormFields. */
export function buildFieldsFromConfig<TSchema extends z.ZodObject<z.ZodRawShape>>(
  schema: TSchema,
  config: FieldConfig<TSchema> = {}
): Array<{
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'textarea' | 'select'
  placeholder?: string
  description?: string
  disabled?: boolean
  className?: string
  options?: { value: string; label: string }[]
  preview?: string
  accept?: string
}> {
  const shape = schema.shape
  return Object.entries(shape).map(([name, zodType]) =>
    buildField(name, zodType as z.ZodTypeAny, config[name as keyof typeof config]),
  )
}

/** Monta um FormField a partir do tipo Zod da propriedade e da config opcional do campo. */
function buildField(name: string, zodType: z.ZodTypeAny, fieldConfig: FieldConfigEntry = {}) {
  const options = fieldConfig.options || extractOptionsFromEnum(zodType)
  return {
    name,
    label: fieldConfig.label || capitalize(name),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: (fieldConfig.type as any) || inferTypeFromZod(zodType),
    placeholder: fieldConfig.placeholder,
    description: fieldConfig.description,
    disabled: fieldConfig.disabled,
    className: fieldConfig.className,
    options,
    preview: fieldConfig.preview,
    accept: fieldConfig.accept,
  }
}

/** Remove optional/nullable/default até chegar no tipo Zod de base. */
function unwrapZodType(zodType: z.ZodTypeAny): z.ZodTypeAny {
  let type: z.ZodTypeAny = zodType
  while (
    type instanceof z.ZodOptional ||
    type instanceof z.ZodNullable ||
    type instanceof z.ZodDefault
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type = (type._def as any).innerType || (type._def as any).type
  }
  return type
}

/** Extracts options from a ZodEnum type. */
function extractOptionsFromEnum(zodType: z.ZodTypeAny): { value: string; label: string }[] | undefined {
  const type = unwrapZodType(zodType)

  // Extract enum values
  if (type instanceof z.ZodEnum) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = (type._def as any).values as string[] | undefined
    if (values && Array.isArray(values)) {
      return values.map((value) => ({
        value,
        label: capitalize(value),
      }))
    }
  }

  return undefined
}

/** ZodString vira 'email' quando tem validação `.email()`, senão 'text'. */
function inferStringType(type: z.ZodString): 'email' | 'text' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checks = (type._def as any).checks || []
  return checks.some((check: { kind: string }) => check.kind === 'email') ? 'email' : 'text'
}

/** Infers the input type from a Zod type. */
function inferTypeFromZod(zodType: z.ZodTypeAny): 'text' | 'email' | 'password' | 'number' | 'checkbox' | 'date' | 'textarea' | 'select' {
  const type = unwrapZodType(zodType)

  if (type instanceof z.ZodEnum) return 'select'
  if (type instanceof z.ZodString) return inferStringType(type)
  if (type instanceof z.ZodNumber) return 'number'
  if (type instanceof z.ZodBoolean) return 'checkbox'
  if (type instanceof z.ZodDate) return 'date'

  return 'text'
}

/** Capitalizes the first letter of a string. */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
