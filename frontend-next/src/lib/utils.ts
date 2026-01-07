"use client"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { QUERY_CONFIG } from './config/performance.config'
import { LucideIcon } from "lucide-react"
import * as LucideIcons from 'lucide-react';
import i18n from '../../i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Configurações padrão para React Query com base no tipo de cache
 * @param cacheType - Tipo de cache definido em QUERY_CONFIG.CACHE_TIMES
 * @param gcType - Tipo de garbage collection (opcional, usa DEFAULT se não especificado)
 */
export function getQueryConfig<T extends keyof typeof QUERY_CONFIG.CACHE_TIMES>(
  cacheType: T,
  gcType?: keyof typeof QUERY_CONFIG.GC_TIMES
) {
  return {
    staleTime: QUERY_CONFIG.CACHE_TIMES[cacheType],
    gcTime: QUERY_CONFIG.GC_TIMES[gcType || 'DEFAULT'],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: QUERY_CONFIG.RETRY.DEFAULT_COUNT,
    retryDelay: QUERY_CONFIG.RETRY.RETRY_DELAY,
  }
}


// Função para obter ícone dinamicamente
export const getIcon = (iconName?: string | null): LucideIcon => {
  if (!iconName) return LucideIcons.LayoutDashboard;
  
  // Remove hífens e converte para PascalCase
  const pascalCase = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  
  // Busca o ícone no objeto de ícones do lucide
  const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>;
  return iconsMap[pascalCase] || LucideIcons.LayoutDashboard;
};

export function formatDate(date: string): string {
 try {
          return new Date(String(date)).toLocaleString('pt-BR');
        } catch {
          return String(date);
        }
}

export function isUUID(text: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(text);
}

export function isDevelopment(): boolean {
  return process.env.NEXT_PUBLIC_ENV === 'development';
}

export function setLang(value: string): void {
    localStorage.setItem('i18nextLng', value);
    document.cookie = `i18nextLng=${value}; path=/; max-age=31536000; SameSite=Lax`;
    i18n.changeLanguage(value);
}

export type Only<T, U> = {
  [P in keyof T]: T[P];
} & {
   
  [P in keyof U]?: never;
};

export type Either<A, B> = (A & Partial<B>) | (B & Partial<A>);


export type NestedKeys<T> = {
  [K in keyof T]: T[K] extends object
    ? `${string & K}.${NestedKeys<T[K]>}` | `${string & K}`
    : `${string & K}`;
}[keyof T];


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function GetNestedValueArray (path: string[], obj: any): any{
  let result = "";
  path.forEach(p => {
    result += ` ${GetNestedValue(p, obj)}`
  });
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function GetNestedValue (path: string, obj: any): any{
    const r = path.split('.').reduce((acc, key) => acc?.[key], obj)
  
  return r;
}