'use client';

import { useTranslation } from '@/hooks/use-translation';
import { ButtonKindIcon } from './template-buttons-editor';
import type { MessagingTemplateCatalogItem, TemplateButton } from '@/lib/actions/messaging/types';

export function WhatsappSimulator({
  headerText,
  body,
  footer,
  buttons = [],
}: {
  headerText?: string;
  body: string;
  footer?: string;
  buttons?: { kind: TemplateButton['kind']; label: string }[];
}) {
  const { t } = useTranslation('messaging');
  return (
    <div className="flex flex-col p-6 bg-[#efeae2] rounded-lg border border-border/50 min-h-[400px] items-center justify-center">
      <div className="w-full max-w-xs bg-white rounded-xl rounded-tl-none shadow-sm p-2 relative flex flex-col gap-1">
        {headerText && <div className="font-bold text-gray-900 px-1 pt-1 break-words">{headerText}</div>}
        
        {body ? (
          <div className="text-gray-800 whitespace-pre-wrap px-1 text-[15px] break-words">{body}</div>
        ) : (
          <div className="text-gray-400 italic px-1 text-[15px]">{t('templateBody')}</div>
        )}
        
        {footer && <div className="text-[13px] text-gray-500 px-1 pb-1 break-words">{footer}</div>}
        
        {buttons.filter((b) => b.label).length > 0 && (
          <div className="border-t border-gray-100 mt-1 flex flex-col divide-y divide-gray-100">
            {buttons
              .filter((b) => b.label)
              .map((button, index) => (
                <div
                  key={index}
                  className="py-2.5 text-center text-[#00a884] flex items-center justify-center gap-2 text-[15px] font-medium break-words"
                >
                  <ButtonKindIcon kind={button.kind} className="w-4 h-4 opacity-80 shrink-0" />
                  <span>{button.label}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Os dois renderings: o que escrevemos, e o que a Meta de fato manda (corpo fixo em AUTHENTICATION). */
export function TemplatePreview({ template }: { template: MessagingTemplateCatalogItem }) {
  const isAuth = template.category === 'AUTHENTICATION';

  const headerText = template.header?.kind === 'TEXT' ? template.header.text : undefined;

  return (
    <div className="flex justify-center">
      <WhatsappSimulator 
        headerText={headerText}
        body={isAuth ? '123456 is your verification code.' : template.body}
        footer={template.footer || undefined}
        buttons={isAuth ? [{ kind: 'COPY_CODE', label: 'Copy code' }] : (template.buttons ?? [])}
      />
    </div>
  );
}
