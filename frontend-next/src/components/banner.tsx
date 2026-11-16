"use client";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { BrandIconPlay, BrandIconSlash, BrandIconPlayInverse } from "@/components/brand-icons";

type BannerVariant = "login" | "signup" | "forgotPassword" | "resetPassword";

export function Banner({ variant = "login" }: { variant?: BannerVariant }) {
  const { t } = useTranslation("common");
  return (
    <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-between lg:px-12 lg:py-12 bg-primary text-primary-foreground overflow-hidden relative">
      {/* Decorative brand icons — bottom right */}
      
      <div className="absolute bottom-20 right-20 flex gap-3 opacity-60 translate-x-8 translate-y-8" aria-hidden="true">
        {[BrandIconPlay, BrandIconSlash, BrandIconPlayInverse].map((Icon, i) => (
          <div key={i} style={{ width: 'clamp(70px, 7vw, 110px)', height: 'clamp(70px, 7vw, 110px)' }}>
            <Icon />
          </div>
        ))}
      </div>

      {/* Logo */}
      <div className="relative h-8 w-28 slide-in-left">
        <Image src="/brand/evre/logo-white.svg" alt="EVRE" fill priority className="object-contain object-left" />
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-md slide-in-left relative z-10">
        <h2 className="text-4xl font-black tracking-tight leading-tight mb-4">
          {t(`banner.${variant}.title`)}
        </h2>
        <p className="text-lg text-primary-foreground/80 leading-relaxed">
          {t(`banner.${variant}.description`)}
        </p>
      </div>

      {/* Bottom spacer to balance logo */}
      <div className="h-8" />
    </div>
  );
}
