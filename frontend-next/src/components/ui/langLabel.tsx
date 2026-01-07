'use client';

import { useTranslation } from '@/hooks/use-translation';

type LangLabelProps = {
    text: string;
    langJson?: string;
};

export default function LangLabel({ text, langJson }: LangLabelProps) {
    const { t } = useTranslation(langJson);

    return (
        <>{t(text)}</>
    );
}