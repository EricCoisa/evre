export const AiProviderConst = {
  ANTHROPIC: 'ANTHROPIC',
  OPENAI: 'OPENAI',
  OPENAI_COMPATIBLE: 'OPENAI_COMPATIBLE',
} as const;
export type AiProvider = (typeof AiProviderConst)[keyof typeof AiProviderConst];

/** Chaves SystemConfiguration por provider — mesma tabela que `resolveSystemConfig` lê. */
export const AI_CONFIG_KEYS: Record<
  AiProvider,
  { apiKey: string; model: string; baseUrl?: string }
> = {
  [AiProviderConst.ANTHROPIC]: {
    apiKey: 'SYSTEM_AI_ANTHROPIC_API_KEY',
    model: 'SYSTEM_AI_ANTHROPIC_MODEL',
  },
  [AiProviderConst.OPENAI]: {
    apiKey: 'SYSTEM_AI_OPENAI_API_KEY',
    model: 'SYSTEM_AI_OPENAI_MODEL',
  },
  [AiProviderConst.OPENAI_COMPATIBLE]: {
    apiKey: 'SYSTEM_AI_OPENAI_COMPATIBLE_API_KEY',
    model: 'SYSTEM_AI_OPENAI_COMPATIBLE_MODEL',
    baseUrl: 'SYSTEM_AI_OPENAI_COMPATIBLE_BASE_URL',
  },
};

/** Chaves UserConfiguration por provider, para credenciais BYOK do usuário. */
export const USER_AI_CONFIG_KEYS: Record<
  AiProvider,
  { apiKey: string; model: string; baseUrl?: string }
> = {
  [AiProviderConst.ANTHROPIC]: {
    apiKey: 'USERCONFIG_AGENT_ANTHROPIC_API_KEY',
    model: 'USERCONFIG_AGENT_ANTHROPIC_MODEL',
  },
  [AiProviderConst.OPENAI]: {
    apiKey: 'USERCONFIG_AGENT_OPENAI_API_KEY',
    model: 'USERCONFIG_AGENT_OPENAI_MODEL',
  },
  [AiProviderConst.OPENAI_COMPATIBLE]: {
    apiKey: 'USERCONFIG_AGENT_OPENAI_COMPATIBLE_API_KEY',
    model: 'USERCONFIG_AGENT_OPENAI_COMPATIBLE_MODEL',
    baseUrl: 'USERCONFIG_AGENT_OPENAI_COMPATIBLE_BASE_URL',
  },
};

export const AI_HEALTH_KEY = 'ai:health';

// System prompt base, sempre incluído, com regras de recusa e desambiguação de ações sem tool correspondente.
export const BASE_AGENT_SYSTEM_PROMPT =
  'Antes de recusar qualquer pedido, percorra a lista de ferramentas disponíveis e avalie ' +
  'cada uma pelo EFEITO que ela produz, não pelo nome dela nem pelas palavras exatas que o ' +
  'usuário usou — o usuário descreve o resultado que quer, não o nome técnico de nenhuma ' +
  'ferramenta. Recuse apenas depois de checar todas as ferramentas disponíveis por esse ' +
  'critério e nenhuma cobrir o pedido.\n\n' +
  'Se o usuário pedir uma AÇÃO para a qual não existe uma tool correspondente na lista ' +
  'disponível para ele, isso normalmente significa que ele não tem permissão para essa ' +
  'ação. Não tente alcançar o mesmo resultado usando outra ferramenta, outro caminho de ' +
  'dados ou qualquer mecanismo alternativo disponível para você. Apenas informe, em uma ' +
  'frase curta, que você não pode realizar essa ação e sugira falar com um administrador ' +
  'se for o caso. Não explique por que (não cite tools, scopes, permissões específicas ou ' +
  'o fato de ter cogitado outros caminhos) — isso é decisão interna, não faz parte da ' +
  'resposta.\n\n' +
  'Quando decidir usar uma ferramenta, chame a ferramenta na MESMA resposta. Nunca ' +
  'anuncie no futuro o que pretende fazer e encerre a resposta sem ter chamado a ' +
  'ferramenta correspondente: quem lê não tem como pedir a continuação, e a ação ' +
  'simplesmente não acontece. Se falta um dado para chamar a ferramenta, pergunte ' +
  'objetivamente o que falta em vez de anunciar a ação.\n\n' +
  'Se o pedido puder ser atendido por mais de uma ferramenta ou registro com efeitos ' +
  'diferentes entre si — por exemplo, uma opção que afeta só o usuário atual e outra que ' +
  'afeta todos os usuários da plataforma, uma mudança reversível e outra que não é, ou ' +
  'vários registros existentes que atendem à mesma descrição — não escolha sozinho qual ' +
  'usar. Pergunte objetivamente qual delas o usuário quer, sem chamar nenhuma ferramenta ' +
  'ainda, e só prossiga depois que a resposta desambiguar. Isso vale mesmo que uma das ' +
  'opções pareça a mais óbvia ou a mais provável: o que importa é a diferença de efeito ' +
  'entre as opções, não a probabilidade de ser essa a intenção.\n\n' +
  'Perguntar o que você sabe fazer NÃO é um pedido de ação: quando perguntarem o que ' +
  'você pode fazer, quais são suas ferramentas ou como você ajuda, responda normalmente ' +
  'descrevendo em linguagem natural as áreas que você cobre, a partir das tools que você ' +
  'tem disponíveis. Nunca recuse esse tipo de pergunta e nunca liste nomes internos de ' +
  'tools, parâmetros ou scopes — descreva o que dá pra fazer, não como se chama por dentro.';
