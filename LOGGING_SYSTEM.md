# Sistema de Logging Híbrido

Este sistema de logging foi implementado para funcionar tanto em **desenvolvimento** quanto em **produção**, capturando logs tanto do lado do **servidor** (Server Components) quanto do lado do **cliente** (Client Components).

## 🎯 Problema Resolvido

Em desenvolvimento, os logs aparecem no terminal do Next.js. Em produção:
- **Server Components**: Logs vão para stdout do servidor (logs da plataforma de hospedagem)
- **Client Components**: Logs aparecem apenas no DevTools do navegador do usuário

Este sistema garante que você tenha visibilidade dos logs em ambos os ambientes.

## 📦 Componentes

### 1. `lib/logger.ts`
Logger híbrido que:
- **Servidor**: Usa `console.log` normal (aparece nos logs do servidor)
- **Cliente em dev**: Usa `console.log` (aparece no terminal do Next.js)
- **Cliente em produção**: Usa `console.log` (aparece no DevTools) + envia para `/api/client-log`

### 2. `api/client-log/route.ts`
Endpoint de API que recebe logs do cliente e os registra no servidor em produção.

### 3. `components/ClientLogger.tsx`
Componente client-side que loga cada navegação de página.

## 🚀 Como Usar

### Server Components (Layouts, Pages, etc)

```tsx
import { logger } from '@/lib/logger';

export default async function MyServerComponent() {
  logger.info('my-component', 'Componente iniciado');
  logger.debug('my-component', 'Debug info', { some: 'data' });
  logger.warn('my-component', 'Aviso!');
  logger.error('my-component', 'Erro!', error);
  
  return <div>...</div>;
}
```

### Client Components

```tsx
'use client';
import { logger } from '@/lib/logger';

export function MyClientComponent() {
  useEffect(() => {
    logger.info('my-client-component', 'Montou no cliente');
  }, []);
  
  return <div>...</div>;
}
```

## 📊 Níveis de Log

- **`info`**: Informações gerais
- **`debug`**: Logs de debug (apenas em desenvolvimento)
- **`warn`**: Avisos
- **`error`**: Erros

## 🔍 Visualizando Logs em Produção

### Servidor (Server Components)
Acesse os logs da plataforma de hospedagem:
- **Vercel**: Dashboard → Projeto → Functions → Logs
- **Railway/Render/etc**: Visualizar logs do container/servidor
- **Docker**: `docker logs <container_id>`

### Cliente (Client Components)
1. Abra o DevTools do navegador (F12)
2. Vá para a aba Console
3. Logs do cliente aparecerão com prefixo `[CONTEXT]`

### Cliente → Servidor
Logs do cliente em produção são automaticamente enviados para o servidor e aparecem com o prefixo `[CLIENT LOG]`.

## 🛠️ Formato dos Logs

```
[CONTEXT] mensagem { data: 'opcional' }
```

Exemplos:
```
[ADMIN-LAYOUT] pathname: /project
[CLIENT-LAYOUT] Validando acesso... { userId: '123', hasAccess: true }
[REDIRECT-PAGE] Rota home encontrada { path: '/project' }
[CLIENT-NAVIGATION] Navegou para: /user
```

## 🔧 Configuração

O logger detecta automaticamente:
- Ambiente: `process.env.NODE_ENV`
- Contexto: `typeof window === 'undefined'` (servidor vs cliente)

Sem configuração adicional necessária!

## 📝 Notas Importantes

1. **Logs de debug** aparecem apenas em desenvolvimento
2. **Logs do cliente em produção** são enviados de forma assíncrona (não bloqueante)
3. **Falhas no envio de logs** são silenciosamente ignoradas (para não afetar a aplicação)
4. Use `keepalive: true` para garantir envio mesmo quando a página fecha

## 🎯 Uso nos Layouts

Os layouts já estão configurados com logging:
- `(admin)/layout.tsx`: Logs de validação de acesso admin
- `(client)/layout.tsx`: Logs de validação de acesso client
- `redirect/page.tsx`: Logs de redirecionamento

## 🚨 Troubleshooting

### Logs não aparecem no servidor em produção
- Verifique se a plataforma de hospedagem está capturando stdout
- Alguns provedores requerem configuração específica de logging

### Logs não aparecem no `/api/client-log`
- Verifique se o endpoint está acessível
- Verifique CORS se o front-end e back-end estão em domínios diferentes
- Verifique os logs do servidor para erros no endpoint

### Performance
- Logs do cliente são enviados com `keepalive` e de forma não-bloqueante
- Falhas de envio não afetam a experiência do usuário
- Em produção, considere limitar quantidade de logs do cliente se houver muito tráfego
