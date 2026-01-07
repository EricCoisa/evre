'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSetUserConfiguration, useUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import i18n from '../../../i18n';
import { setLang } from '@/lib/utils';

export function LanguageToggle() {
  const { data: languageConfig} = useUserConfiguration<string>('USERCONFIG_LANGUAGE');
  const updateUserConfig = useSetUserConfiguration();

  const onValueChange = async (value: string) => {
    if (!languageConfig?.id) return;

    // Atualiza no backend
    await updateUserConfig.mutateAsync({
      userConfiguration: {
        ...languageConfig,
        value: value
      }
    });
    setLang(value);
  }
  return (
    <Select value={i18n.language} onValueChange={onValueChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Idioma" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pt-BR">🇧🇷 Português</SelectItem>
        <SelectItem value="en">🇺🇸 English</SelectItem>
      </SelectContent>
    </Select>
  );
}
