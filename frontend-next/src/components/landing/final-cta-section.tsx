'use client';

import { useState } from 'react';
import { MessageCircle, Mail, Copy, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { defaulHometData } from '@/lib/actions/cms/home/type';

interface FinalCtaSectionProps {
  title?: string;
  description?: string;
  whatsappButtonText?: string;
  whatsappNumber?: string;
  contactEmail?: string;
}

export function FinalCtaSection({
  title = defaulHometData.ctaTitle!,
  description = defaulHometData.ctaDescription!,
  whatsappButtonText = defaulHometData.ctaWhatsappButtonText!,
  whatsappNumber = defaulHometData.heroWhatsappNumber!,
  contactEmail = defaulHometData.contactEmail!,
}: FinalCtaSectionProps) {
  const [copied, setCopied] = useState(false);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20um%20projeto%20com%20a%20EVRE.`;

  const copyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    toast.success('E-mail copiado para a área de transferência');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="contato" className="relative bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <div className="rounded-3xl border border-border bg-card/70 p-8 shadow-xl backdrop-blur-md sm:p-14 dark:border-white/10 dark:bg-[#0C0C10]">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {title}
          </h2>

          <p className="mx-auto mb-8 max-w-xl text-sm text-muted-foreground sm:text-base leading-relaxed">
            {description}
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:w-auto"
            >
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              <span>{whatsappButtonText}</span>
              <ArrowRight className="h-4 w-4 opacity-60" />
            </a>

            <button
              onClick={copyEmail}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-5 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-accent sm:w-auto"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>{contactEmail}</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{contactEmail}</span>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
