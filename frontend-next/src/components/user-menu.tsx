'use client';

import * as React from 'react';
import { Languages, LogOut, Settings } from 'lucide-react';
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
import { LanguageToggle } from './ui/languageToggle';
import { useMe } from '@/lib/actions/auth/queries';
import { logout } from '@/lib/actions/auth/auth-action';

export function UserMenu() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { data: user } = useMe();
  
  const handleLogout = async () => {
    try {
      logout()
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
          <Avatar className="size-8">
            <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? undefined} />
            <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col gap-1 p-2">
          <p className="text-sm font-medium">{user?.name || t('user')}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Languages className="mr-2 size-4" />
          <LanguageToggle />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleProfile}>
          <Settings className="mr-2 size-4" />
          {t('profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} variant="destructive">
          <LogOut className="mr-2 size-4" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
