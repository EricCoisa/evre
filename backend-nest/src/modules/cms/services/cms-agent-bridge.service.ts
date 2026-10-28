import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface CmsSchemaField {
  name: string;
  type: string;
  required: boolean;
}
export interface CmsSchemaCollection {
  slug: string;
  fields: CmsSchemaField[];
}
export interface CmsSchemaResponse {
  collections: CmsSchemaCollection[];
}

/** Bridge para as rotas `/api/agent/cms/*` do frontend, autenticada por `AGENT_CMS_SECRET`. */
@Injectable()
export class CmsAgentBridgeService {
  constructor(private readonly configService: ConfigService) {}

  // reusa NEXTAUTH_URL; rodar o backend em container exige o hostname do serviço aqui.
  private baseUrl(): string {
    return (
      this.configService.get<string>('NEXTAUTH_URL') || 'http://localhost:3000'
    );
  }

  private headers(): Record<string, string> {
    const secret = this.configService.get<string>('AGENT_CMS_SECRET');
    if (!secret) {
      throw new Error(
        'AGENT_CMS_SECRET not configured in environment variables',
      );
    }
    return { 'x-agent-secret': secret, 'Content-Type': 'application/json' };
  }

  async describeSchema(): Promise<CmsSchemaResponse> {
    try {
      const { data } = await axios.get<CmsSchemaResponse>(
        `${this.baseUrl()}/api/agent/cms/schema`,
        { headers: this.headers() },
      );
      return data;
    } catch (err) {
      throw new Error(
        extractErrorMessage(err, 'Falha ao consultar schema do CMS'),
      );
    }
  }

  async getDocument(collection: string, id?: string): Promise<unknown> {
    const url = id
      ? `${this.baseUrl()}/api/agent/cms/${collection}/${id}`
      : `${this.baseUrl()}/api/agent/cms/${collection}`;
    try {
      const { data } = await axios.get<unknown>(url, {
        headers: this.headers(),
      });
      return data;
    } catch (err) {
      throw new Error(
        extractErrorMessage(err, 'Falha ao consultar documento do CMS'),
      );
    }
  }

  async updateDocument(
    collection: string,
    id: string,
    docData: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const { data } = await axios.patch<unknown>(
        `${this.baseUrl()}/api/agent/cms/${collection}/${id}`,
        docData,
        { headers: this.headers() },
      );
      return data;
    } catch (err) {
      throw new Error(
        extractErrorMessage(err, 'Falha ao atualizar documento do CMS'),
      );
    }
  }
}

// Propaga a mensagem de erro real do Payload ao tool_result, para o modelo se autocorrigir.
function extractErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data
      ?.error === 'string'
  ) {
    return (err as { response: { data: { error: string } } }).response.data
      .error;
  }
  return err instanceof Error ? err.message : fallback;
}
