'use client';

import type { ReactNode } from 'react';
import { Check, Settings, Power } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/use-translation';

export interface ProviderCardItem {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  isActive: boolean;
  isConfigured?: boolean;
  canActivate?: boolean;
  badge?: string;
  disabled?: boolean;
  rightSlot?: ReactNode;
  actionsSlot?: ReactNode;
}

export interface ProviderCardGridProps {
  providers: ProviderCardItem[];
  /** Acionado para abrir o modal de configuração de credenciais/stepper */
  onConfigure?: (id: string) => void;
  /** Acionado para ativar o provedor diretamente */
  onActivate?: (id: string) => void;
  configureLabel?: string;
  activeLabel?: string;
  activateLabel?: string;
  configuredLabel?: string;
  notConfiguredLabel?: string;
  disabled?: boolean;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

interface ProviderCardBadgesProps {
  provider: ProviderCardItem;
  activeLabel: string;
  configuredLabel: string;
  notConfiguredLabel: string;
}

function ProviderCardBadges({
  provider,
  activeLabel,
  configuredLabel,
  notConfiguredLabel,
}: ProviderCardBadgesProps) {
  if (provider.isActive) {
    return (
      <Badge
        variant="default"
        className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-xs font-medium"
      >
        <Check className="size-3" />
        {activeLabel}
      </Badge>
    );
  }

  if (provider.isConfigured === false) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-xs">
        {notConfiguredLabel}
      </Badge>
    );
  }


  return null;
}

interface ProviderCardActionsProps {
  provider: ProviderCardItem;
  isInteractive: boolean;
  onActivate?: (id: string) => void;
  onConfigure?: (id: string) => void;
  activateLabel: string;
  configureLabel: string;
}

function ActivateButton({
  providerId,
  isInteractive,
  onActivate,
  activateLabel,
  disabled,
}: {
  providerId: string;
  isInteractive: boolean;
  onActivate: (id: string) => void;
  activateLabel: string;
  disabled?: boolean;
}) {
  const isDisabled = !isInteractive || Boolean(disabled);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onActivate(providerId);
      }}
      className={cn(
        "h-8 text-xs gap-1.5 flex-1",
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none border-muted-foreground/30 text-muted-foreground hover:bg-transparent shadow-none"
      )}
    >
      <Power className="size-3.5" />
      {activateLabel}
    </Button>
  );
}

function ConfigureButton({
  providerId,
  isActive,
  isInteractive,
  onConfigure,
  configureLabel,
  isFullWidth,
}: {
  providerId: string;
  isActive: boolean;
  isInteractive: boolean;
  onConfigure: (id: string) => void;
  configureLabel: string;
  isFullWidth: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={isActive ? 'default' : 'secondary'}
      disabled={!isInteractive}
      onClick={() => onConfigure(providerId)}
      className={cn('h-8 text-xs gap-1.5', isFullWidth ? 'w-full' : 'flex-1')}
    >
      <Settings className="size-3.5" />
      {configureLabel}
    </Button>
  );
}

function ProviderCardActions({
  provider,
  isInteractive,
  onActivate,
  onConfigure,
  activateLabel,
  configureLabel,
}: ProviderCardActionsProps) {
  if (provider.actionsSlot) {
    return (
      <div className="flex items-center gap-2 pt-3 border-t border-border/40 mt-auto">
        {provider.actionsSlot}
      </div>
    );
  }

  const showActivate = Boolean(onActivate && !provider.isActive);
  const showConfigure = Boolean(onConfigure);

  if (!showActivate && !showConfigure) return null;

  // Ativar só é possível se o provedor estiver configurado e validado
  const canActivate = Boolean(provider.isConfigured && (provider.canActivate ?? true));

  return (
    <div className="flex items-center gap-2 pt-3 border-t border-border/40 mt-auto">
      {showActivate && onActivate && (
        <ActivateButton
          providerId={provider.id}
          isInteractive={isInteractive}
          disabled={!canActivate}
          onActivate={onActivate}
          activateLabel={activateLabel}
        />
      )}

      {showConfigure && onConfigure && (
        <ConfigureButton
          providerId={provider.id}
          isActive={provider.isActive}
          isInteractive={isInteractive}
          onConfigure={onConfigure}
          configureLabel={configureLabel}
          isFullWidth={!showActivate}
        />
      )}
    </div>
  );
}

interface ProviderCardSingleProps {
  provider: ProviderCardItem;
  disabled: boolean;
  onActivate?: (id: string) => void;
  onConfigure?: (id: string) => void;
  activeLabel: string;
  configuredLabel: string;
  notConfiguredLabel: string;
  activateLabel: string;
  configureLabel: string;
}

function ProviderCardSingle({
  provider,
  disabled,
  onActivate,
  onConfigure,
  activeLabel,
  configuredLabel,
  notConfiguredLabel,
  activateLabel,
  configureLabel,
}: ProviderCardSingleProps) {
  const isInteractive = !disabled && !provider.disabled;

  return (
    <Card
      className={cn(
        'relative flex flex-col justify-between transition-all duration-200 rounded-xl p-4 sm:p-5 border-2',
        provider.isActive
          ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary/20'
          : 'border-border/60 hover:border-border hover:shadow-xs bg-card',
        !isInteractive && 'opacity-60 pointer-events-none'
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {provider.icon && (
              <div
                className={cn(
                  'size-10 rounded-lg border flex items-center justify-center shrink-0 text-foreground transition-colors',
                  provider.isActive
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border/60 bg-muted/50'
                )}
              >
                {provider.icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm sm:text-base leading-snug text-foreground tracking-tight truncate">
                {provider.name}
              </h4>
              {provider.badge && (
                <span className="inline-block text-[11px] font-medium text-muted-foreground mt-0.5">
                  {provider.badge}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <ProviderCardBadges
              provider={provider}
              activeLabel={activeLabel}
              configuredLabel={configuredLabel}
              notConfiguredLabel={notConfiguredLabel}
            />
            {provider.rightSlot}
          </div>
        </div>

        {provider.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
            {provider.description}
          </p>
        )}
      </div>

      <ProviderCardActions
        provider={provider}
        isInteractive={isInteractive}
        onActivate={onActivate}
        onConfigure={onConfigure}
        activateLabel={activateLabel}
        configureLabel={configureLabel}
      />
    </Card>
  );
}

const columnStyles: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function ProviderCardGrid({
  providers,
  onConfigure,
  onActivate,
  configureLabel,
  activeLabel,
  activateLabel,
  configuredLabel,
  notConfiguredLabel,
  disabled = false,
  className,
  columns = 3,
}: ProviderCardGridProps) {
  const { t } = useTranslation('common');

  const resolvedConfigureLabel = configureLabel ?? t('configure');
  const resolvedActiveLabel = activeLabel ?? t('active');
  const resolvedActivateLabel = activateLabel ?? t('activate');
  const resolvedConfiguredLabel = configuredLabel ?? t('configured');
  const resolvedNotConfiguredLabel = notConfiguredLabel ?? t('not_configured');

  return (
    <div className={cn('grid gap-4', columnStyles[columns] ?? columnStyles[3], className)}>
      {providers.map((provider) => (
        <ProviderCardSingle
          key={provider.id}
          provider={provider}
          disabled={disabled}
          onActivate={onActivate}
          onConfigure={onConfigure}
          activeLabel={resolvedActiveLabel}
          configuredLabel={resolvedConfiguredLabel}
          notConfiguredLabel={resolvedNotConfiguredLabel}
          activateLabel={resolvedActivateLabel}
          configureLabel={resolvedConfigureLabel}
        />
      ))}
    </div>
  );
}
