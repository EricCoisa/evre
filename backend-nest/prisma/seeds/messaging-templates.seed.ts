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
  // Variável custom: title (obrigatória).
  // Reservada: first_name — cai no fallback 'cliente' sem contato cadastrado.
  // Botão open: URL, sufixo = publicToken (credencial pública do link, não segredo interno).
  // Botão opt_out: QUICK_REPLY reservado.
  const frontendUrl = 'https://evre.com.br';
  const proposalSentVariables = [
    { name: 'title', type: 'STRING', required: true },
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
      body: 'Olá {{ first_name }}! A proposta *{{ title }}* está disponível para você.\n\nClique no link abaixo para visualizar todos os detalhes.',
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
}
