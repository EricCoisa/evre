'use client';

import * as React from 'react';
import { Languages, LogOut, Settings, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LanguageToggle } from './ui/languageToggle';
import { useMe } from '@/lib/actions/auth/queries';
import { usePresignedUrl } from '@/lib/actions/storage/queries';
import { logout } from '@/lib/actions/auth/auth-action';
import { useApp } from '@/contexts/appProvider';
import { isDevelopment } from '@/lib/utils';

function UserAvatar({ src, name }: { src?: string; name?: string }) {
  const fallback = name ? name.charAt(0) : 'U';
  return (
    <Avatar className="size-8">
      <AvatarImage src={src} alt={name} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

function UserInfo({ name, email, fallbackName }: { name?: string; email?: string; fallbackName: string }) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="text-sm font-medium">{name || fallbackName}</p>
      {email && <p className="text-xs text-muted-foreground">{email}</p>}
    </div>
  );
}

export function UserMenu() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { data: user } = useMe();
  const { data: imageUrl } = usePresignedUrl(user?.image);
  const { devTools, setDevTools } = useApp();

  const handleLogout = async () => {
    try {
      logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleProfile = () => {
    router.push('/profile');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative size-8 rounded-full p-0">
          <UserAvatar src={imageUrl?.url ?? undefined} name={user?.name ?? undefined} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <UserInfo name={user?.name ?? undefined} email={user?.email} fallbackName={t('user')} />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Languages className="mr-2 size-4" />
          <LanguageToggle />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleProfile}>
          <Settings className="mr-2 size-4" />
          {t('profile')}
        </DropdownMenuItem>
        {isDevelopment() && (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex justify-between items-center sm:hidden">
            <span className="flex items-center text-xs font-medium">
              <Wrench className="mr-2 size-4 text-warning" />
              DevTools
            </span>
            <Switch aria-label="DevTools" checked={devTools} onCheckedChange={() => setDevTools(!devTools)} />
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} variant="destructive">
          <LogOut className="mr-2 size-4" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
