import { describe, it, expect } from 'vitest';
import { BLOCK_META } from './blocks.meta';
import {
  SPANS,
  SPAN_CLASS,
  parsePageLayout,
  resolvePageLayout,
} from './schema';

const validLayout = {
  v: 1,
  blocks: [
    {
      id: 'b1',
      type: 'stat.card',
      span: 2,
      props: { label: 'Total' },
      data: { source: 'users.list' },
    },
  ],
};

describe('parsePageLayout', () => {
  it('lê um layout válido do mapa de páginas', () => {
    const result = parsePageLayout({ '/dashboard': validLayout }, '/dashboard');

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.layout.blocks).toHaveLength(1);
  });

  it('aceita o mapa ainda serializado como string', () => {
    const result = parsePageLayout(
      JSON.stringify({ '/dashboard': validLayout }),
      '/dashboard',
    );

    expect(result.status).toBe('ok');
  });

  it('devolve none quando a página não foi customizada', () => {
    expect(parsePageLayout({ '/outra': validLayout }, '/dashboard').status).toBe('none');
    expect(parsePageLayout({}, '/dashboard').status).toBe('none');
    expect(parsePageLayout(null, '/dashboard').status).toBe('none');
  });

  it('devolve none em JSON corrompido em vez de lançar', () => {
    expect(parsePageLayout('{isto não é json', '/dashboard').status).toBe('none');
  });

  it('trata layout sem blocos como não customizado', () => {
    // É assim que o editor desfaz a customização: apagar tudo e salvar tem que devolver a
    // página em código, não uma tela em branco.
    expect(
      parsePageLayout({ '/dashboard': { v: 1, blocks: [] } }, '/dashboard').status,
    ).toBe('none');
  });

  it('devolve invalid quando o layout salvo não bate com o schema', () => {
    expect(parsePageLayout({ '/dashboard': { v: 1 } }, '/dashboard').status).toBe('invalid');
    expect(parsePageLayout({ '/dashboard': { v: 2, blocks: [] } }, '/dashboard').status).toBe('invalid');
    expect(
      parsePageLayout({ '/dashboard': { v: 1, blocks: [{ id: 'b1' }] } }, '/dashboard').status,
    ).toBe('invalid');
  });

  it('recusa span fora de 1–12', () => {
    const bad = { v: 1, blocks: [{ id: 'b1', type: 'stat.card', span: 13 }] };

    expect(parsePageLayout({ '/dashboard': bad }, '/dashboard').status).toBe('invalid');
  });

  it('aceita type desconhecido no parse — quem pula é o renderer', () => {
    const unknown = { v: 1, blocks: [{ id: 'b1', type: 'nao.existe' }] };

    expect(parsePageLayout({ '/dashboard': unknown }, '/dashboard').status).toBe('ok');
  });
});

describe('parsePageLayout — aninhamento', () => {
  const grouped = {
    v: 1,
    blocks: [
      {
        id: 'g1',
        type: 'group',
        span: 4,
        props: { title: 'Usuários' },
        children: [
          { id: 'c1', type: 'stat.card', span: 2, data: { source: 'users.list' } },
          { id: 'c2', type: 'table.basic', span: 2, data: { source: 'users.list' } },
        ],
      },
    ],
  };

  it('lê um container com filhos', () => {
    const result = parsePageLayout({ '/dashboard': grouped }, '/dashboard');

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.layout.blocks[0].children).toHaveLength(2);
  });

  // Aninhamento é de um nível só. O front DESCARTA o segundo nível em vez de invalidar a
  // página inteira — quem recusa na origem é set_page_layout, aqui a regra é não quebrar a
  // tela por causa de um layout que já está gravado.
  it('descarta o segundo nível de children em vez de invalidar a página', () => {
    const deep = {
      v: 1,
      blocks: [
        {
          id: 'g1',
          type: 'group',
          children: [{ id: 'c1', type: 'group', children: [{ id: 'c2', type: 'stat.card' }] }],
        },
      ],
    };

    const result = parsePageLayout({ '/dashboard': deep }, '/dashboard');

    expect(result.status).toBe('ok');
    expect(
      result.status === 'ok' &&
        (result.layout.blocks[0].children?.[0] as Record<string, unknown>).children,
    ).toBeUndefined();
  });
});

describe('resolvePageLayout — precedência usuário → sistema → código', () => {
  const userLayout = { v: 1, blocks: [{ id: 'u1', type: 'stat.card' }] };
  const systemLayout = { v: 1, blocks: [{ id: 's1', type: 'stat.card' }] };

  it('prefere o layout do usuário quando ele existe', () => {
    const r = resolvePageLayout(
      { '/dashboard': userLayout },
      { '/dashboard': systemLayout },
      '/dashboard',
    );

    expect(r.status).toBe('ok');
    expect(r.origin).toBe('user');
    expect(r.status === 'ok' && r.layout.blocks[0].id).toBe('u1');
  });

  it('cai para o layout do sistema quando o usuário não tem o dele', () => {
    const r = resolvePageLayout({}, { '/dashboard': systemLayout }, '/dashboard');

    expect(r.status).toBe('ok');
    expect(r.origin).toBe('system');
    expect(r.status === 'ok' && r.layout.blocks[0].id).toBe('s1');
  });

  it('layout de usuário zerado conta como "não tenho o meu" e devolve o do sistema', () => {
    const r = resolvePageLayout(
      { '/dashboard': { v: 1, blocks: [] } },
      { '/dashboard': systemLayout },
      '/dashboard',
    );

    expect(r.origin).toBe('system');
  });

  it('sem usuário e sem sistema, é página em código', () => {
    const r = resolvePageLayout({}, {}, '/dashboard');

    expect(r.status).toBe('none');
    expect(r.origin).toBe('none');
  });

  it('layout inválido do usuário mostra o aviso em vez de mascarar com o do sistema', () => {
    // Quem tem um layout ilegível precisa ver o aviso para corrigir ou restaurar; cair para
    // o do sistema esconderia o problema e o botão de restaurar.
    const r = resolvePageLayout(
      { '/dashboard': { v: 1 } },
      { '/dashboard': systemLayout },
      '/dashboard',
    );

    expect(r.status).toBe('invalid');
    expect(r.origin).toBe('user');
  });

  it('layout inválido do SISTEMA não quebra a página de quem só está visitando', () => {
    const r = resolvePageLayout({}, { '/dashboard': { v: 9 } }, '/dashboard');

    expect(r.status).toBe('none');
    expect(r.origin).toBe('none');
  });

  it('aceita os dois lados ainda serializados como string', () => {
    const r = resolvePageLayout(
      '{}',
      JSON.stringify({ '/dashboard': systemLayout }),
      '/dashboard',
    );

    expect(r.origin).toBe('system');
  });

  it('resolve por página: customizada numa, padrão na outra', () => {
    const user = { '/dashboard': userLayout };
    const system = { '/dashboard': systemLayout, '/outra': systemLayout };

    expect(resolvePageLayout(user, system, '/dashboard').origin).toBe('user');
    expect(resolvePageLayout(user, system, '/outra').origin).toBe('system');
  });
});

describe('tokens de layout', () => {
  it('todo span válido tem uma classe literal correspondente', () => {
    for (const span of SPANS) {
      expect(SPAN_CLASS[span]).toMatch(/^lg:col-span-\d+$/);
    }
  });

  it('nenhum bloco declara prop de estilo livre', () => {
    const forbidden = ['className', 'class', 'style', 'color', 'css'];
    const offenders = Object.entries(BLOCK_META).flatMap(([type, meta]) =>
      meta.props.filter((p) => forbidden.includes(p.name)).map((p) => `${type}.${p.name}`),
    );

    expect(offenders).toEqual([]);
  });
});
