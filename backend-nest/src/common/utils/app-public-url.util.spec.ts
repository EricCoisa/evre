import type { Request } from 'express';

import {
  appPublicUrl,
  MCP_PUBLIC_ORIGIN_HEADER,
} from './app-public-url.util';

/** Request mínimo: a util só chama `req.get(header)`. */
const reqWith = (headers: Record<string, string>) =>
  ({ get: (name: string) => headers[name.toLowerCase()] }) as unknown as Request;

/** Testa a origem usada para o `issuer` e os endpoints que um servidor remoto precisa alcançar. */
describe('appPublicUrl', () => {
  const original = process.env.NEXTAUTH_URL;
  beforeEach(() => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = original;
  });

  it('usa a origem informada pelo proxy, não o NEXTAUTH_URL', () => {
    const url = appPublicUrl(
      reqWith({ [MCP_PUBLIC_ORIGIN_HEADER]: 'https://tunnel.example.com' }),
    );
    expect(url).toBe('https://tunnel.example.com');
  });

  it('preserva a porta — localhost:3000 sem porta apontaria para o lugar errado', () => {
    expect(
      appPublicUrl(reqWith({ [MCP_PUBLIC_ORIGIN_HEADER]: 'http://localhost:3000' })),
    ).toBe('http://localhost:3000');
  });

  it('descarta path, query e credenciais do header — só a origem entra nos metadados', () => {
    expect(
      appPublicUrl(
        reqWith({
          [MCP_PUBLIC_ORIGIN_HEADER]: 'https://app.example.com/algum/path?x=1',
        }),
      ),
    ).toBe('https://app.example.com');
    expect(
      appPublicUrl(
        reqWith({ [MCP_PUBLIC_ORIGIN_HEADER]: 'https://user:pw@app.example.com' }),
      ),
    ).toBe('https://app.example.com');
  });

  it('header torto ou com scheme não-http cai no fallback em vez de vazar cru', () => {
    for (const bad of [
      'não-uma-url',
      '/relativo',
      'javascript:alert(1)',
      'file:///etc/passwd',
      '',
    ]) {
      expect(appPublicUrl(reqWith({ [MCP_PUBLIC_ORIGIN_HEADER]: bad }))).toBe(
        'http://localhost:3000',
      );
    }
  });

  it('sem request (ou sem o header) usa NEXTAUTH_URL, sem barra final', () => {
    process.env.NEXTAUTH_URL = 'https://app.example.com/';
    expect(appPublicUrl()).toBe('https://app.example.com');
    expect(appPublicUrl(reqWith({}))).toBe('https://app.example.com');
  });

  it('sem NEXTAUTH_URL cai no localhost do dev', () => {
    delete process.env.NEXTAUTH_URL;
    expect(appPublicUrl()).toBe('http://localhost:3000');
  });
});
