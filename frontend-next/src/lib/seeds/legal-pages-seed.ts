import { Payload } from 'payload'

type TextNode = {
  type: 'text'
  text: string
  detail: 0
  format: 0
  mode: 'normal'
  style: ''
  version: 1
}

function text(value: string): TextNode {
  return { type: 'text', text: value, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }
}

function heading(value: string) {
  return {
    type: 'heading',
    tag: 'h2',
    children: [text(value)],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  }
}

function paragraph(value: string) {
  return {
    type: 'paragraph',
    children: [text(value)],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  }
}

/** Monta um documento Lexical a partir de blocos alternando heading + paragraph. */
function richText(sections: Array<{ heading: string; body: string }>) {
  return {
    root: {
      type: 'root',
      children: sections.flatMap((s) => [heading(s.heading), paragraph(s.body)]),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

async function seedLegalPage(
  payload: Payload,
  slug: string,
  title: string,
  sections: Array<{ heading: string; body: string }>,
) {
  const existing = await payload.find({
    collection: 'legal-pages',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log(`✓ Página legal "${slug}" já existe no CMS`)
    return
  }

  await payload.create({
    collection: 'legal-pages',
    data: { title, slug, content: richText(sections), published: true },
  })

  console.log(`✓ Página legal "${slug}" criada com sucesso!`)
}

/**
 * Popula termo-uso, privacy-policy e politica-cookies com conteúdo oficial da EVRE.
 * O texto é um ponto de partida alinhado à LGPD — revise com jurídico antes de produção.
 */
export async function seedLegalPages(payload: Payload) {
  try {
    await seedLegalPage(payload, 'termo-uso', 'Termo de Uso', [
      {
        heading: '1. Aceitação dos Termos',
        body:
          'Ao acessar e utilizar os serviços e plataformas da EVRE Software House, você concorda com estes Termos de Uso. Caso não concorde, não utilize o serviço.',
      },
      {
        heading: '2. Cadastro e Conta do Usuário',
        body:
          'O usuário é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta no portal do cliente.',
      },
      {
        heading: '3. Uso Permitido',
        body:
          'É proibido utilizar a plataforma para fins ilícitos, violar direitos de terceiros ou tentar comprometer a segurança, disponibilidade e estabilidade do serviço.',
      },
      {
        heading: '4. Propriedade Intelectual',
        body:
          'Todo o conteúdo, marca EVRE e interfaces institucionais pertencem à EVRE Software House. Os códigos-fonte de projetos desenvolvidos sob encomenda são regidos pelos respectivos contratos individuais de prestação de serviços.',
      },
      {
        heading: '5. Limitação de Responsabilidade',
        body:
          'A EVRE Software House atua sob os mais altos padrões de segurança e engenharia, aplicando boas práticas de observabilidade e proteção de dados.',
      },
      {
        heading: '6. Alterações destes Termos',
        body:
          'Estes Termos podem ser atualizados periodicamente. O uso continuado da plataforma após alterações implica aceitação dos novos termos.',
      },
      {
        heading: '7. Contato',
        body: 'Dúvidas sobre estes Termos podem ser enviadas para contato@evre.com.br.',
      },
    ])

    await seedLegalPage(payload, 'privacy-policy', 'Política de Privacidade', [
      {
        heading: '1. Controlador dos Dados',
        body:
          'EVRE Software House é a controladora dos dados pessoais tratados nesta plataforma, nos termos da Lei nº 13.709/2018 (LGPD).',
      },
      {
        heading: '2. Quais Dados Coletamos',
        body:
          'Coletamos dados de contato comercial (nome, e-mail, telefone corporativo) e dados técnicos estritamente necessários ao funcionamento e segurança do serviço.',
      },
      {
        heading: '3. Finalidade e Base Legal',
        body:
          'Os dados são tratados para viabilizar o atendimento comercial, elaboração de propostas, execução de contrato de desenvolvimento e segurança da informação (art. 7º da LGPD).',
      },
      {
        heading: '4. Compartilhamento com Terceiros',
        body:
          'Não compartilhamos dados pessoais com terceiros para fins comerciais. Dados podem ser hospedados em provedores de nuvem de padrão internacional com criptografia.',
      },
      {
        heading: '5. Retenção e Exclusão',
        body:
          'Os dados são mantidos enquanto a relação comercial estiver ativa ou conforme exigido por obrigação legal, podendo ser excluídos a pedido do titular.',
      },
      {
        heading: '6. Direitos do Titular',
        body:
          'Você pode solicitar acesso, correção, exclusão, portabilidade ou revogar o consentimento sobre seus dados pessoais, conforme o art. 18 da LGPD.',
      },
      {
        heading: '7. Como Exercer seus Direitos',
        body: 'Solicitações podem ser enviadas para contato@evre.com.br.',
      },
      {
        heading: '8. Alterações nesta Política',
        body: 'Esta Política pode ser atualizada periodicamente; a data da última revisão constará nesta página.',
      },
    ])

    await seedLegalPage(payload, 'politica-cookies', 'Política de Cookies', [
      {
        heading: '1. O que são Cookies',
        body:
          'Cookies são pequenos arquivos armazenados no seu navegador que permitem que um site reconheça seu dispositivo entre visitas.',
      },
      {
        heading: '2. Cookies que Utilizamos',
        body:
          'Atualmente utilizamos apenas cookies estritamente necessários, de sessão de autenticação (HttpOnly), indispensáveis para o funcionamento do portal. Não utilizamos cookies de rastreamento intrusivo.',
      },
      {
        heading: '3. Como Gerenciar suas Preferências',
        body:
          'Você pode gerenciar cookies diretamente nas configurações do seu navegador.',
      },
      {
        heading: '4. Atualizações desta Política',
        body:
          'Caso novos cookies analíticos ou de preferências sejam adotados no futuro, esta página e as opções de consentimento serão atualizadas previamente.',
      },
    ])
  } catch (error) {
    console.error('❌ Erro ao criar páginas legais padrão:', error)
    throw error
  }
}
