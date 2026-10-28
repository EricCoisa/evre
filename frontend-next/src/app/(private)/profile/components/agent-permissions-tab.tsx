'use client';

import { useMemo, useState, useEffect } from 'react';
import { Container } from "@/components/container";
import { useTranslation } from '@/hooks/use-translation';
import { ConfigRow, ConfigList } from '@/components/config-row';
import { SwitchField } from '@/components/switch-field';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useAiToolPermissions,
  useRevokeAiToolAccess,
  useAllowAiToolAccess,
} from '@/lib/actions/ai/queries';
import { HelpButton, useTour } from '@/components/tour';

interface ToolItem {
  name: string;
  group: string;
  description: string;
  descriptionKey: string;
  enabled: boolean;
}

export function AgentPermissionsTab() {
  const { t } = useTranslation('profile');
  const { registerTour } = useTour();
  const { data: tools } = useAiToolPermissions();

  const revoke = useRevokeAiToolAccess();
  const allow = useAllowAiToolAccess();
  const [activeGroup, setActiveGroup] = useState('');

  const groups = useMemo(() => {
    const byGroup = new Map<string, ToolItem[]>();
    for (const tool of (tools as ToolItem[] | undefined) ?? []) {
      const list = byGroup.get(tool.group) ?? [];
      list.push(tool);
      byGroup.set(tool.group, list);
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tools]);

  useEffect(() => {
    registerTour('profile-agent-permissions', [
      {
        content: t('tour_agent_permissions_intro'),
        selectorId: 'agent-permissions-header',
        position: 'bottom',
      },
      {
        content: t('tour_agent_permissions_group'),
        selectorId: 'agent-permissions-group-select',
        position: 'bottom',
      },
      {
        content: t('tour_agent_permissions_switch'),
        selectorId: 'agent-permissions-list',
        position: 'top',
      },
    ]);
  }, [registerTour, t]);

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      if (enabled) {
        await allow.mutateAsync(name);
      } else {
        await revoke.mutateAsync(name);
      }
    } catch {
      return;
    }
    toast.success(enabled ? t('toolAllowedSuccess') : t('toolRevokedSuccess'));
  };

  const describe = (tool: { descriptionKey: string; description: string }) => {
    const translated = t(tool.descriptionKey);
    return translated === tool.descriptionKey ? tool.description : translated;
  };

  if (groups.length === 0) {
    return <Container variant="form" padding>{t('noToolsAvailable')}</Container>;
  }

  const currentGroup = groups.some(([group]) => group === activeGroup)
    ? activeGroup
    : groups[0][0];

  const currentTools = groups.find(([group]) => group === currentGroup)?.[1] ?? [];
  const enabledCount = currentTools.filter((tool) => tool.enabled).length;

  return (
    <Container variant="form" padding>
      <div id="agent-permissions-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight">
              {t(`group_${currentGroup.replace(/-/g, '_')}`)}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('tools_summary', { enabled: enabledCount, total: currentTools.length })}
            </p>
          </div>
          <HelpButton tourId="profile-agent-permissions" startDirect />
        </div>
        <div id="agent-permissions-group-select" className="w-full sm:w-64 shrink-0">
          <Select value={currentGroup} onValueChange={setActiveGroup}>
            <SelectTrigger className="w-full h-9 bg-card">
              <SelectValue placeholder={t('select_tool_group')} />
            </SelectTrigger>
            <SelectContent>
              {groups.map(([group, groupTools]) => (
                <SelectItem key={group} value={group}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate">{t(`group_${group.replace(/-/g, '_')}`)}</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 shrink-0 ml-2">
                      {groupTools.length}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="agent-permissions-list">
        <ConfigList>
          {currentTools.map((tool) => (
            <ConfigRow key={tool.name} title={tool.name} description={describe(tool)}>
              <SwitchField
                inline
                className="sm:justify-end"
                id={tool.name}
                label={tool.enabled ? t('toolEnabled') : t('toolDisabled')}
                checked={tool.enabled}
                disabled={revoke.isPending || allow.isPending}
                onCheckedChange={(checked) => handleToggle(tool.name, checked)}
              />
            </ConfigRow>
          ))}
        </ConfigList>
      </div>
    </Container>
  );
}
