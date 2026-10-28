'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'
import { Badge } from '@/components/ui/badge' // Shadcn UI
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StatusFieldProps {
  path: string
  label?: string
  required?: boolean
}

const statusConfig = {
  draft: {
    label: 'Draft',
    variant: 'secondary' as const,
  },
  published: {
    label: 'Published',
    variant: 'default' as const,
  },
  archived: {
    label: 'outline' as const,
    variant: 'outline' as const,
  },
}

export default function StatusField({ path, label, required }: StatusFieldProps) {
  const { value, setValue } = useField<string>({ path })

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label || 'Status'}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      <div className="flex items-center gap-4">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value && (
          <Badge variant={statusConfig[value as keyof typeof statusConfig]?.variant}>
            {statusConfig[value as keyof typeof statusConfig]?.label}
          </Badge>
        )}
      </div>
    </div>
  )
}
