import React from 'react'
import Image from 'next/image'
import { Logo } from '@/components/logo'
import { siteInitials } from '@/lib/site'

interface CustomLogoProps {
  className?: string
}

export default function CustomLogo({ className }: CustomLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <Logo priority className="h-10 w-32" />
      <span className="text-xs text-muted-foreground">
        Admin Panel
      </span>
    </div>
  )
}

export function CustomIcon({ className }: CustomLogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt={siteInitials()}
      width={32}
      height={32}
      className={`rounded-md ${className || ''}`}
      priority
    />
  )
}
