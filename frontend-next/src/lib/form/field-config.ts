import { z } from 'zod'

/**
 * Type-safe field configuration for a Zod schema
 * 
 * @example
 * const schema = z.object({
 *   email: z.string().email(),
 *   name: z.string(),
 * })
 * 
 * const config: FieldConfig<typeof schema> = {
 *   email: { label: 'Email', type: 'email' },
 *   name: { label: 'Full Name' },
 * }
 */
export type FieldConfig<TSchema extends z.ZodType> = {
  [K in keyof z.infer<TSchema>]?: {
    /** Display label for the field */
    label?: string
    /** Input type */
    type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'textarea' | 'select'
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
  }
}

/**
 * Converts a Zod schema + field config into an array of FormFields
 * 
 * @param schema - Zod schema object
 * @param config - Field configuration (labels, placeholders, etc)
 * @returns Array of FormField objects
 */
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
}> {
  const shape = schema.shape
  const fields: Array<{
    name: string
    label: string
    type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'textarea' | 'select'
    placeholder?: string
    description?: string
    disabled?: boolean
    className?: string
    options?: { value: string; label: string }[]
  }> = []

  for (const [name, zodType] of Object.entries(shape)) {
    const fieldConfig = config[name as keyof typeof config]
    const inferredType = inferTypeFromZod(zodType as z.ZodTypeAny)
    const options = fieldConfig?.options || extractOptionsFromEnum(zodType as z.ZodTypeAny)
    
    fields.push({
      name,
      label: fieldConfig?.label || capitalize(name),
      type: fieldConfig?.type || inferredType,
      placeholder: fieldConfig?.placeholder,
      description: fieldConfig?.description,
      disabled: fieldConfig?.disabled,
      className: fieldConfig?.className,
      options,
    })
  }

  return fields
}

/**
 * Extracts options from a ZodEnum type
 */
function extractOptionsFromEnum(zodType: z.ZodTypeAny): { value: string; label: string }[] | undefined {
  // Unwrap optional, nullable, default
  let type: z.ZodTypeAny = zodType
  while (
    type instanceof z.ZodOptional ||
    type instanceof z.ZodNullable ||
    type instanceof z.ZodDefault
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type = (type._def as any).innerType || (type._def as any).type
  }

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

/**
 * Infers the input type from a Zod type
 */
function inferTypeFromZod(zodType: z.ZodTypeAny): 'text' | 'email' | 'password' | 'number' | 'checkbox' | 'date' | 'textarea' | 'select' {
  // Unwrap optional, nullable, default
  let type: z.ZodTypeAny = zodType
  while (
    type instanceof z.ZodOptional ||
    type instanceof z.ZodNullable ||
    type instanceof z.ZodDefault
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type = (type._def as any).innerType || (type._def as any).type
  }

  // Check for enum first
  if (type instanceof z.ZodEnum) {
    return 'select'
  }

  // ZodString with special validations
  if (type instanceof z.ZodString) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checks = (type._def as any).checks || []
    for (const check of checks) {
      if (check.kind === 'email') return 'email'
    }
    return 'text'
  }

  // Other types
  if (type instanceof z.ZodNumber) return 'number'
  if (type instanceof z.ZodBoolean) return 'checkbox'
  if (type instanceof z.ZodDate) return 'date'

  return 'text'
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
