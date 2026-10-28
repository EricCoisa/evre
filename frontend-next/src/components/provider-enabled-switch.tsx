'use client';

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { useConfiguration, useUpdateConfiguration } from "@/lib/actions/systemConfiguration/queries";
import { cn } from "@/lib/cn";

/** Switch de liga/desliga embutido no card de um provider, nas telas de configuração. */
export function ProviderEnabledSwitch({
  labelKey,
  label,
  invalidateKeys,
  className,
}: {
  labelKey: string;
  label: string;
  /** Caches além do próprio `['system-configuration', labelKey]`, que o hook já derruba. */
  invalidateKeys?: QueryKey[];
  className?: string;
}) {
  const { data } = useConfiguration<boolean>(labelKey);
  // A leitura (GET) converte BOOLEAN pro tipo real, mas a gravação (PUT) sempre espera
  // `value` como string — mesma regra que o BaseConfiguration segue (`String(checked)`).
  const updateValue = useUpdateConfiguration<string>();
  const queryClient = useQueryClient();

  if (!data) return null;

  const checked = data.value === true || String(data.value) === 'true';

  return (
    <Switch
      aria-label={label}
      title={label}
      checked={checked}
      disabled={updateValue.isPending || data.blocked}
      // Previne que acionar o switch dispare cliques no container pai
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onCheckedChange={async (value) => {
        await updateValue.mutateAsync({
          systemConfiguration: { ...data, value: String(value) },
        });
        for (const key of invalidateKeys ?? []) {
          await queryClient.invalidateQueries({ queryKey: key });
        }
      }}
      className={cn('ml-1.5', className)}
    />
  );
}
