"use client";
import { useTranslation } from "react-i18next";

export function Banner() {
    const { t } = useTranslation("common");
    return (
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 bg-primary">
            <div className="mx-auto w-full max-w-md slide-in-left">
                <h2 className="text-3xl font-bold text-primary-foreground mb-4">
                    {t("welcomeBack")}
                </h2>
                <p className="text-lg text-primary-foreground/90 leading-relaxed">
                    {t("accessDashboard")}
                </p>
            </div>
        </div>)
}