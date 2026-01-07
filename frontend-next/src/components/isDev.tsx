import { useTranslation } from "@/hooks/use-translation";

export function IsDev() {
    const { t } = useTranslation();
    return (
        <span
            className="relative left-0 top-1/2 -translate-y-1/2 bg-warning border border-warning/20 text-warning-foreground text-xs px-2 py-1 rounded shadow z-20 select-none pointer-events-none"
            title="Dev mode"
        >
            {t('isDev') || 'DEV'}
        </span>
    );
}