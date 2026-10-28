import type {
  TemplateButton,
  TemplateHeader,
} from 'src/domain/interface/messaging-provider.interface';

export interface ParsedMetaComponents {
  header?: TemplateHeader;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
}

/** Converte componentes da Graph API da Meta para os campos nativos do nosso banco de dados. */
export function parseMetaComponents(
  components: unknown[] = [],
): ParsedMetaComponents {
  let header: TemplateHeader | undefined;
  let body = '';
  let footer: string | undefined;
  let buttons: TemplateButton[] | undefined;

  for (const comp of components) {
    if (!comp || typeof comp !== 'object') continue;
    const c = comp as Record<string, unknown>;
    const type = typeof c.type === 'string' ? c.type.toUpperCase() : '';

    switch (type) {
      case 'HEADER': {
        const format =
          typeof c.format === 'string' ? c.format.toUpperCase() : 'TEXT';
        if (format === 'TEXT' && typeof c.text === 'string') {
          header = { kind: 'TEXT', text: c.text };
        }
        break;
      }
      case 'BODY': {
        if (typeof c.text === 'string') {
          body = c.text;
        }
        break;
      }
      case 'FOOTER': {
        if (typeof c.text === 'string') {
          footer = c.text;
        }
        break;
      }
      case 'BUTTONS': {
        if (Array.isArray(c.buttons)) {
          const list: TemplateButton[] = [];
          for (const btn of c.buttons) {
            if (!btn || typeof btn !== 'object') continue;
            const b = btn as Record<string, unknown>;
            const bType =
              typeof b.type === 'string' ? b.type.toUpperCase() : '';
            const label = typeof b.text === 'string' ? b.text.trim() : '';

            if (bType === 'URL') {
              list.push({
                kind: 'URL',
                label: label || 'Link',
                url: typeof b.url === 'string' ? b.url : '',
              });
            } else if (bType === 'PHONE_NUMBER') {
              list.push({
                kind: 'PHONE_NUMBER',
                label: label || 'Ligar',
                phoneNumber:
                  typeof b.phone_number === 'string' ? b.phone_number : '',
              });
            } else if (bType === 'QUICK_REPLY') {
              list.push({
                kind: 'QUICK_REPLY',
                label: label || 'Resposta',
                payload: typeof b.payload === 'string' ? b.payload : undefined,
              });
            } else if (bType === 'COPY_CODE' || bType === 'OTP') {
              list.push({
                kind: 'COPY_CODE',
                label: label || 'Copiar código',
                payload: typeof b.example === 'string' ? b.example : undefined,
              });
            }
          }
          if (list.length > 0) buttons = list;
        }
        break;
      }
    }
  }

  return {
    header,
    body,
    footer,
    buttons,
  };
}
