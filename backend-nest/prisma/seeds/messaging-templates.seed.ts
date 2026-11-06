import { PrismaClient } from '@prisma/client';

export async function seedMessagingTemplates(prisma: PrismaClient) {
  // Catálogo de templates: só PASSWORD_CHANGED nasce com o template (texto de autoria nossa,
  // sem submissão à Meta). `isSystem` é só marcador do seed — sem guard de delete.
  // `first_name` é reservada do sistema (messaging-variables.const.ts): o tipo a libera com
  // `reserved: true` — sem a marcação o corpo do template é recusado. Re-sincroniza no update.
  const passwordChangedVariables = [
    { name: 'first_name', type: 'STRING', required: false, reserved: true },
  ];
  const passwordChangedType = await prisma.messagingTemplateType.upsert({
    where: { key: 'PASSWORD_CHANGED' },
    update: { variables: passwordChangedVariables, isSystem: true },
    create: {
      key: 'PASSWORD_CHANGED',
      name: 'Senha alterada',
      variables: passwordChangedVariables,
      isSystem: true,
    },
  });
  await prisma.messagingTemplate.upsert({
    where: { key_language: { key: 'PASSWORD_CHANGED', language: 'pt-BR' } },
    update: { isSystem: true },
    create: {
      key: 'PASSWORD_CHANGED',
      language: 'pt-BR',
      category: 'UTILITY',
      typeId: passwordChangedType.id,
      body: 'Olá {{ first_name }}, sua senha foi alterada. Se não foi você, contate o suporte imediatamente.',
      isSystem: true,
    },
  });
  console.log('✅ Messaging template PASSWORD_CHANGED created');

  // Notificação genérica (NotificationModule → relay WhatsApp): um template cobre qualquer
  // notify() com channels.whatsapp, igual ao EmailTemplateType.NOTIFICATION único do email.
  // title/message são variáveis custom (não reservadas) — notify() sempre fornece as duas, então
  // não dependem de contato cadastrado. first_name é reservada do sistema (mesma liberação de
  // PASSWORD_CHANGED) — sem contato cadastrado, cai no fallback 'cliente' (messaging-variables.const.ts).
  const notificationTemplateVariables = [
    { name: 'title', type: 'STRING', required: true },
    { name: 'message', type: 'STRING', required: true },
    { name: 'first_name', type: 'STRING', required: false, reserved: true },
  ];
  const notificationTemplateType = await prisma.messagingTemplateType.upsert({
    where: { key: 'NOTIFICATION' },
    update: { variables: notificationTemplateVariables, isSystem: true },
    create: {
      key: 'NOTIFICATION',
      name: 'Notificação',
      variables: notificationTemplateVariables,
      isSystem: true,
    },
  });
  await prisma.messagingTemplate.upsert({
    where: { key_language: { key: 'NOTIFICATION', language: 'pt-BR' } },
    update: { isSystem: true },
    create: {
      key: 'NOTIFICATION',
      language: 'pt-BR',
      category: 'UTILITY',
      typeId: notificationTemplateType.id,
      // Header deixa claro que é um aviso automático; o corpo abre com saudação pessoal antes
      // do título/mensagem, pra não ler como robô cru. Texto fixo generoso ao redor das 3
      // variáveis e nunca termina em variável — a Meta recusa corpo dominado por variável ou
      // que termine nela (sem como garantir pontuação final, ela não aceita revisar).
      header: { kind: 'TEXT', text: 'Notificação' },
      body: 'Olá {{ first_name }}! Nova notificação do sistema.\n\n{{ title }}\n{{ message }}\n\nAcesse o sistema para mais informações.',
      isSystem: true,
    },
  });
  console.log('✅ Messaging template NOTIFICATION created');

  // VerificationModule (request-verification.use-case → canal WHATSAPP): um template cobre
  // qualquer propósito de verificação. `code` é custom (o chamador sempre fornece) e `sensitive`
  // — primeiro consumidor real desse flag (ver messaging-variables.const.ts). Categoria
  // AUTHENTICATION: na Meta, nosso body é ignorado em favor do texto nativo + botão "copiar
  // código" (providerOwnedBody); nos providers Evolution, enviado literalmente. Sem header —
  // AUTHENTICATION não aceita.
  const verificationCodeTemplateVariables = [
    { name: 'code', type: 'STRING', required: true, sensitive: true },
  ];
  const verificationCodeTemplateType = await prisma.messagingTemplateType.upsert({
    where: { key: 'VERIFICATION_CODE' },
    update: { variables: verificationCodeTemplateVariables, isSystem: true },
    create: {
      key: 'VERIFICATION_CODE',
      name: 'Código de verificação',
      variables: verificationCodeTemplateVariables,
      isSystem: true,
    },
  });
  await prisma.messagingTemplate.upsert({
    where: { key_language: { key: 'VERIFICATION_CODE', language: 'pt-BR' } },
    update: { isSystem: true },
    create: {
      key: 'VERIFICATION_CODE',
      language: 'pt-BR',
      category: 'AUTHENTICATION',
      typeId: verificationCodeTemplateType.id,
      body: 'Seu código de verificação é {{ code }}. Não compartilhe com ninguém.',
      isSystem: true,
    },
  });
  console.log('✅ Messaging template VERIFICATION_CODE created');

  // PROPOSAL_SENT: enviado por SendProposalUseCase (módulo proposal).
  // Variáveis custom: title (obrigatória), link (obrigatória, URL encurtada no body).
  // Reservada: first_name — cai no fallback 'cliente' sem contato cadastrado.
  // Botão open: URL do sistema com sufixo dinâmico (publicToken); opt_out: QUICK_REPLY reservado.
  const frontendUrl = 'https://evre.com.br';
  const proposalSentVariables = [
    { name: 'title', type: 'STRING', required: true },
    { name: 'link', type: 'STRING', required: true },
    { name: 'first_name', type: 'STRING', required: false, reserved: true },
  ];
  const proposalSentTypeButtons = [
    { key: 'open', kind: 'URL', urlBase: `${frontendUrl}/p/`, required: true },
    { key: 'opt_out', kind: 'QUICK_REPLY', reserved: true },
  ];
  const proposalSentType = await prisma.messagingTemplateType.upsert({
    where: { key: 'PROPOSAL_SENT' },
    update: {
      variables: proposalSentVariables,
      buttons: proposalSentTypeButtons,
      isSystem: true,
    },
    create: {
      key: 'PROPOSAL_SENT',
      name: 'Proposta enviada',
      variables: proposalSentVariables,
      buttons: proposalSentTypeButtons,
      isSystem: true,
    },
  });
  await prisma.messagingTemplate.upsert({
    where: { key_language: { key: 'PROPOSAL_SENT', language: 'pt-BR' } },
    update: { isSystem: true },
    create: {
      key: 'PROPOSAL_SENT',
      language: 'pt-BR',
      category: 'MARKETING',
      typeId: proposalSentType.id,
      body: 'Olá {{ first_name }}! A proposta *{{ title }}* está disponível para você.\n\nAcesse os detalhes pelo link: {{ link }}\n\nEstamos à disposição para qualquer dúvida.',
      buttons: [
        {
          kind: 'URL',
          label: 'Ver proposta',
          url: `${frontendUrl}/p/{{ open }}`,
          slot: 'open',
        },
        { kind: 'QUICK_REPLY', label: 'Parar de receber', slot: 'opt_out' },
      ],
      isSystem: true,
    },
  });
  console.log('✅ Messaging template PROPOSAL_SENT created');

  // PROPOSAL_FIRST_CONTACT: primeiro contato com pequenas empresas sem site/landing page.
  // Header IMAGE: prévia do site demonstrativo (URL fornecida por headerImageUrl no envio).
  // company_name: nome da empresa prospectada. first_name: contato (reservada, fallback 'cliente').
  // Botão open: mesma base do PROPOSAL_SENT — aponta para a proposta/demo publicada.
  const firstContactVariables = [
    { name: 'company_name', type: 'STRING', required: true },
    { name: 'first_name', type: 'STRING', required: false, reserved: true },
  ];
  const firstContactTypeButtons = [
    { key: 'open', kind: 'URL', urlBase: `${frontendUrl}/p/`, required: true },
    { key: 'opt_out', kind: 'QUICK_REPLY', reserved: true },
  ];
  const firstContactType = await prisma.messagingTemplateType.upsert({
    where: { key: 'PROPOSAL_FIRST_CONTACT' },
    update: {
      variables: firstContactVariables,
      buttons: firstContactTypeButtons,
      isSystem: true,
    },
    create: {
      key: 'PROPOSAL_FIRST_CONTACT',
      name: 'Primeiro contato — prévia de site',
      variables: firstContactVariables,
      buttons: firstContactTypeButtons,
      isSystem: true,
    },
  });
  await prisma.messagingTemplate.upsert({
    where: { key_language: { key: 'PROPOSAL_FIRST_CONTACT', language: 'pt-BR' } },
    update: { isSystem: true },
    create: {
      key: 'PROPOSAL_FIRST_CONTACT',
      language: 'pt-BR',
      category: 'MARKETING',
      typeId: firstContactType.id,
      // Header IMAGE: URL de exemplo usada na submissão à Meta para aprovação.
      // No envio, a URL real é passada via headerImageUrl (screenshot do site demo gerado para a empresa).
      header: { kind: 'IMAGE', url: `${frontendUrl}/assets/proposal-preview.jpg` },
      body: 'Olá {{ first_name }}! Somos da EVRE, especializados em desenvolvimento de sites e sistemas.\n\nConhecemos um pouco do trabalho da *{{ company_name }}* e preparamos uma prévia demonstrativa de como seu negócio poderia se apresentar na internet, valorizando seus serviços e facilitando o contato com novos clientes.\n\nAcesse o link para ver a demonstração, sem compromisso!',
      buttons: [
        {
          kind: 'URL',
          label: 'Ver demonstração',
          url: `${frontendUrl}/p/{{ open }}`,
          slot: 'open',
        },
        { kind: 'QUICK_REPLY', label: 'Parar de receber', slot: 'opt_out' },
      ],
      isSystem: true,
    },
  });
  console.log('✅ Messaging template PROPOSAL_FIRST_CONTACT created');
}
