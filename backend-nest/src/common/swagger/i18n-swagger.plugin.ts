import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import { Request, Response } from 'express';

interface PathItemObject {
  [method: string]: OperationObject;
}

interface OperationObject {
  summary?: string;
  description?: string;
  [key: string]: unknown;
}

/** Traduz a documentação Swagger em runtime; o idioma vem de `?lang=`. */
export class I18nSwaggerPlugin {
  constructor(private readonly i18n: any) {}

  /** Traduz o documento Swagger para o idioma informado. */
  translateDocument(
    document: OpenAPIObject,
    lang: string = 'pt-BR',
  ): OpenAPIObject {
    const translatedDoc: OpenAPIObject = JSON.parse(
      JSON.stringify(document),
    ) as OpenAPIObject;

    // Traduz paths (endpoints)
    if (translatedDoc.paths) {
      Object.keys(translatedDoc.paths).forEach((path) => {
        const pathItem = translatedDoc.paths?.[path] as PathItemObject;
        if (!pathItem) return;

        Object.keys(pathItem).forEach((method) => {
          const operation = pathItem[method];
          if (!operation) return;

          // Traduz summary
          if (operation.summary && this.isTranslationKey(operation.summary)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            operation.summary = this.i18n.translate(operation.summary, {
              lang,
            }) as string;
          }

          // Traduz description
          if (
            operation.description &&
            this.isTranslationKey(operation.description)
          ) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            operation.description = this.i18n.translate(operation.description, {
              lang,
            }) as string;
          }
        });
      });
    }

    return translatedDoc;
  }

  /** Indica se a string tem formato de chave de tradução (`x.y.z`). */
  private isTranslationKey(str: string): boolean {
    return /^[a-z]+(\.[a-z_]+)+$/.test(str);
  }
}

/** Registra a rota que serve a documentação Swagger traduzida. */
export function setupI18nSwagger(
  app: INestApplication,
  path: string,
  document: OpenAPIObject,

  i18n: any,
): I18nSwaggerPlugin {
  const plugin = new I18nSwaggerPlugin(i18n);

  // Middleware customizado que intercepta requisições ao Swagger JSON
  // Detecta o idioma via query string (?lang=en) ou header (Accept-Language)
  app.use(`/${path}-json`, (req: Request, res: Response) => {
    // Tenta obter o idioma de várias fontes
    const queryLang = req.query.lang as string | undefined;
    const headerLang =
      (req.headers['x-language'] as string) ||
      (req.headers['accept-language']?.split(',')[0] as string);
    const lang = queryLang || headerLang || 'pt-BR';

    const translatedDoc = plugin.translateDocument(document, lang);
    res.json(translatedDoc);
  });

  return plugin;
}
