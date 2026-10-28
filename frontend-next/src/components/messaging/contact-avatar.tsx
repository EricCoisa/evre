'use client';

import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { contactInitials, contactPhotoSrc } from '@/lib/messaging/contact';

/** Mostra a foto do contato, com iniciais ou ícone quando não há foto ou ela não carrega. */
export function ContactAvatar({
  contactId,
  name,
  hasProfilePicture,
  className,
}: {
  /** Contato (id) cuja foto buscar; sem id só há iniciais. */
  contactId?: string;
  name?: string | null;
  hasProfilePicture?: boolean;
  className?: string;
}) {
  const initials = contactInitials(name);
  return (
    <Avatar className={cn('size-8', className)}>
      {hasProfilePicture && contactId && <AvatarImage src={contactPhotoSrc(contactId)} alt="" loading="lazy" />}
      <AvatarFallback className="text-xs font-medium">
        {initials ?? <User className="size-4 text-muted-foreground" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  );
}
