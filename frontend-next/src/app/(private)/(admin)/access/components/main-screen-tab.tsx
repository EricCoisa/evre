'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfigList, ConfigRow } from '@/components/config-row';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRoleHomes, useSaveRoleHomes } from '@/lib/actions/access/route/queries';
import { useUserRole, useUserRoleAccess } from '@/lib/actions/access/roleRouteAccess/queries';
import type { RoleUser, RoleUserAccess } from '@/lib/actions/access/roleRouteAccess/types';
import type { TFunc } from '@/hooks/use-translation';

const NO_HOME = 'none';

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const page = data as { data?: T[] } | undefined;
  return page?.data ?? [];
}

/** Linha por role, listando as rotas que aquela role alcança. */
function RoleHomeRow({
  role,
  value,
  onPick,
  t,
}: {
  role: RoleUser;
  value: string;
  onPick: (roleName: string, routeId: string) => void;
  t: TFunc;
}) {
  const { data } = useUserRoleAccess(role.roleId, { pagination: false });
  const routes = useMemo(
    () => asList<RoleUserAccess>(data).filter((item) => item.hasAccess && item.isActive),
    [data],
  );

  const roleNameTranslated = t(role.roleName) !== role.roleName ? t(role.roleName) : role.roleName;

  return (
    <ConfigRow
      key={role.roleId}
      title={roleNameTranslated}
      description={t('mainTabDesc')}
    >
      <Select value={value} onValueChange={(next) => onPick(role.roleName, next)}>
        <SelectTrigger className="w-full max-w-full truncate" aria-label={role.roleName}>
          <SelectValue placeholder={t('mainNoHome')} className="truncate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_HOME}>{t('mainNoHome')}</SelectItem>
          {routes.map((item) => (
            <SelectItem key={item.routeId} value={item.routeId}>
              {t(item.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ConfigRow>
  );
}

/** Tela para definir a rota inicial de cada role, gravada em SystemConfiguration chaveada por nome. */
export function MainScreenTab({ t }: { t: TFunc }) {
  const { data: rolesData } = useUserRole({ pagination: false });
  const { data: homes } = useRoleHomes();
  const save = useSaveRoleHomes();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const roles = asList<RoleUser>(rolesData);
  const current = draft ?? homes ?? {};

  const pick = (roleName: string, value: string) =>
    setDraft((prev) => {
      const next = { ...(prev ?? homes ?? {}) };
      if (value === NO_HOME) delete next[roleName];
      else next[roleName] = value;
      return next;
    });

  const submit = async () => {
    const result = await save.mutateAsync(current);
    setDraft(null);
    // O backend recusa rota que a role não alcança; avisa quando descartou algo.
    if (Object.keys(result).length !== Object.keys(current).length) {
      toast.warning(t('mainDroppedMissing'));
    } else {
      toast.success(t('mainSaved'));
    }
  };

  const hasChanges = draft !== null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 sm:p-6 shadow-sm">
        <div className="pb-4 border-b mb-4">
          <h3 className="text-base font-semibold">{t('mainTab')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('mainTabDesc')}</p>
        </div>

        <ConfigList>
          {roles.map((role) => (
            <RoleHomeRow
              key={role.roleId}
              role={role}
              value={current[role.roleName] ?? NO_HOME}
              onPick={pick}
              t={t}
            />
          ))}
        </ConfigList>

        <div className="mt-6 pt-4 border-t flex justify-end">
          <Button
            type="button"
            disabled={!hasChanges || save.isPending}
            onClick={submit}
            className="min-w-28"
          >
            {save.isPending ? t('loading') : t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
