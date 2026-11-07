'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  name,
  email,
  imageUrl,
  className = 'h-6 w-6',
  fallbackClassName = 'text-[10px]',
}: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {imageUrl && <AvatarImage src={imageUrl} alt={name || email || 'Avatar'} />}
      <AvatarFallback className={`bg-primary/10 text-primary font-semibold ${fallbackClassName}`}>
        {getInitials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
