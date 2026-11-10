# PDF — Geração Server-Side via Gotenberg

Geração de PDF feita **100% no backend** usando o container [Gotenberg](https://gotenberg.dev/). O `PdfService` converte HTML em PDF via uma chamada `POST` multipart ao Gotenberg e devolve um `Buffer`. Não há Puppeteer, jsPDF nem biblioteca de PDF na aplicação.

## Infraestrutura

| Ambiente | Gotenberg |
|---|---|
| Local (Docker Compose) | `http://gotenberg:3000` — sidecar em `docker-compose.yml` |
| Produção (Coolify) | hostname interno no projeto "Template Infra" da rede `coolify` |

A variável `PDF_SERVICE_URL` aponta o backend para o Gotenberg (default: `http://gotenberg:3000`).

## PdfModule

Localização: `backend-nest/src/modules/pdf/`.

| Arquivo | Responsabilidade |
|---|---|
| `pdf.service.ts` | `generate(html, options?)` → `Buffer`; `checkHealth()` com cache Redis (TTL 300s) |
| `pdf.controller.ts` | `GET /pdf/health` (ADMIN) |
| `pdf.capabilities.ts` | Registra `PDF_CAPABILITY` no `CapabilityRegistry` via `OnModuleInit` |
| `use-cases/check-health.use-case.ts` | Delega a `PdfService.checkHealth()` |

O módulo exporta `PdfService` para outros módulos importarem.

## Como usar em outro módulo

1. Importe `PdfModule` nos `imports` do seu módulo.
2. Injete `PdfService` no seu use-case ou service.
3. Crie um subdiretório `pdf/` dentro do seu módulo com:
   - Um template HTML (`*.template.html`) com variáveis `{{ varName }}`
   - Uma factory function `buildXxxHtml(data): Promise<string>` que usa `renderTemplateFromFile`
4. No use-case, chame `pdfService.generate(html, { orientation: 'landscape' })`.

### Exemplo mínimo

```ts
// meu-modulo/pdf/meu-relatorio-pdf.factory.ts
import * as path from 'path';
import { renderTemplateFromFile } from 'src/common/utils/email.util';

export async function buildMeuRelatorioHtml(data: MeusDados): Promise<string> {
  return renderTemplateFromFile(
    path.join(__dirname, 'meu-relatorio.template.html'),
    { titulo: data.titulo, tableRows: buildRows(data.itens) },
  );
}
```

```ts
// meu-modulo/use-cases/export-pdf.use-case.ts
@Injectable()
export class ExportMeuRelatorioPdfUseCase {
  constructor(private readonly pdf: PdfService) {}

  async execute(data: MeusDados): Promise<Buffer> {
    const html = await buildMeuRelatorioHtml(data);
    return this.pdf.generate(html, { orientation: 'portrait' });
  }
}
```

## Template HTML

- CSS **inline** no `<style>` do `<head>` — Gotenberg não carrega folhas externas por padrão.
- Use `{{ varName }}` para interpolação e `{{#if varName}}...{{/if}}` para condicionais.
- Gotenberg aceita parâmetros de formatação via campos do multipart: `landscape`, `paperWidth`, `paperHeight`, `marginTop`, etc.

## Referência de módulo existente

O módulo `time-tracking` tem um exemplo completo em `backend-nest/src/modules/time-tracking/pdf/`:
- `time-entries.template.html` — template do relatório de lançamentos
- `time-entries-pdf.factory.ts` — factory que transforma o resultado de `ExportTimeEntriesUseCase` em HTML
