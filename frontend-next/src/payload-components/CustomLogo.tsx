import React from 'react'
import Image from 'next/image'
import { SITE_NAME, siteInitials } from '@/lib/site'

interface CustomLogoProps {
  className?: string
}

export default function CustomLogo({ className }: CustomLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <Image
        src="/logo.svg"
        alt={SITE_NAME}
        width={40}
        height={40}
        className="rounded-lg"
        priority
      />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">
          Admin Panel
        </span>
      </div>
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
