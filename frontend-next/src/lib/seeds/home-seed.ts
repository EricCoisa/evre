import { Payload } from 'payload';
import type { Home } from '../../../payload-types';
import { defaulHometData } from '../actions/cms/home/type';

/** Popula a coleção Home (singleton) do Payload CMS com o conteúdo oficial inicial caso o banco esteja vazio. */
export async function seedHomeData(payload: Payload) {
  try {
    const existingDocs = await payload.find({
      collection: 'home',
      limit: 1,
    });

    if (existingDocs.docs.length > 0) {
      console.log('✓ Coleção Home já inicializada no CMS');
      return;
    }

    const homePayloadData = {
      title: defaulHometData.title || 'Home',
      heroTitle: defaulHometData.heroTitle,
      heroDescription: defaulHometData.heroDescription,
      heroCta: defaulHometData.heroCta,
      heroWhatsappNumber: defaulHometData.heroWhatsappNumber,
      sitesLabel: defaulHometData.sitesLabel,
      sitesTitle: defaulHometData.sitesTitle,
      sitesDescription: defaulHometData.sitesDescription,
      siteDemos: defaulHometData.siteDemos,
      sistemasLabel: defaulHometData.sistemasLabel,
      sistemasTitle: defaulHometData.sistemasTitle,
      sistemasDescription: defaulHometData.sistemasDescription,
      sistemaDemos: defaulHometData.sistemaDemos,
      reforcosLabel: defaulHometData.reforcosLabel,
      reforcosTitle: defaulHometData.reforcosTitle,
      reforcosDescription: defaulHometData.reforcosDescription,
      equipesCards: defaulHometData.equipesCards,
      ctaTitle: defaulHometData.ctaTitle,
      ctaButtonText: defaulHometData.ctaButtonText,
      contactEmail: defaulHometData.contactEmail,
      footerText: defaulHometData.footerText,
      meta: defaulHometData.meta,
    };

    await payload.create({
      collection: 'home',
      draft: false,
      data: homePayloadData as unknown as Omit<Home, 'id' | 'createdAt' | 'updatedAt'>,
    });

    console.log('✓ Dados iniciais da Home criados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criar dados iniciais da Home:', error);
    throw error;
  }
}
