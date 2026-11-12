import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { LayoutProfileName } from './dto/page-layout.dto';

export interface PageBlockDescription {
  type: string;
  description: string;
  /** `kind`s de fonte que este bloco consegue renderizar; vazio = bloco sem dado. */
  accepts: string[];
  /** Recebe `children` em vez de dado (ex.: `group`). */
  container: boolean;
  /** Micro-elemento sem grade pesada (ex.: `text.rich`, `button.action`). */
  inline?: boolean;
  /** Quando `true`, a fonte de dados (`data.source`) é opcional. */
  optionalSource?: boolean;
  props: Array<{ name: string; type: string; required: boolean }>;
}
export interface PageBuilderSchemaResponse {
  /** Já filtrados pelo profile pedido; sem profile, o catálogo inteiro. */
  blocks: PageBlockDescription[];
  /** Páginas que renderizam <PageRenderer> — escrever em qualquer outra não tem efeito. */
  pages: Array<{ pageKey: string; description: string }>;
  spans: number[];
  /** Classes Tailwind aceitas em `className` — o CSS só existe para estas. */
  classNames: string[];
}

/** Bridge para `/api/agent/page-builder/schema` no frontend, autenticada por `AGENT_CMS_SECRET`. */
@Injectable()
export class PageBuilderBridgeService {
  constructor(private readonly configService: ConfigService) {}

  private baseUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_INTERNAL_URL') ||
      this.configService.get<string>('NEXTAUTH_URL') ||
      'http://localhost:3000'
    );
  }

  async describeSchema(
    profile?: LayoutProfileName,
  ): Promise<PageBuilderSchemaResponse> {
    const secret = this.configService.get<string>('AGENT_CMS_SECRET');
    if (!secret) {
      throw new Error(
        'AGENT_CMS_SECRET not configured in environment variables',
      );
    }
    const query = profile ? `?profile=${profile}` : '';
    try {
      const { data } = await axios.get<PageBuilderSchemaResponse>(
        `${this.baseUrl()}/api/agent/page-builder/schema${query}`,
        { headers: { 'x-agent-secret': secret } },
      );
      return data;
    } catch (err) {
      throw new Error(extractBridgeErrorMessage(err, this.baseUrl()));
    }
  }
}

function extractBridgeErrorMessage(err: unknown, baseUrl: string): string {
  if (typeof err === 'object' && err !== null) {
    const maybeAxios = err as {
      response?: { data?: { error?: string; message?: string } };
      code?: string;
      message?: string;
    };
    if (typeof maybeAxios.response?.data?.message === 'string') {
      return maybeAxios.response.data.message;
    }
    if (typeof maybeAxios.response?.data?.error === 'string') {
      return maybeAxios.response.data.error;
    }
    if (maybeAxios.code) {
      return `Falha ao conectar no frontend (${maybeAxios.code} em ${baseUrl})`;
    }
    if (maybeAxios.message && maybeAxios.message.trim() !== '') {
      return maybeAxios.message;
    }
  }
  return err instanceof Error && err.message.trim() !== ''
    ? err.message
    : `Falha ao consultar o catálogo de blocos do PageBuilder em ${baseUrl}`;
}
