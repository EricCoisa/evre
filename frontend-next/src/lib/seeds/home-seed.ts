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
      heroPrimaryButtonText: defaulHometData.heroPrimaryButtonText,
      heroSecondaryButtonText: defaulHometData.heroSecondaryButtonText,
      heroWhatsappNumber: defaulHometData.heroWhatsappNumber,
      servicesTitle: defaulHometData.servicesTitle,
      servicesDescription: defaulHometData.servicesDescription,
      services: defaulHometData.services,
      processTitle: defaulHometData.processTitle,
      processDescription: defaulHometData.processDescription,
      processSteps: defaulHometData.processSteps,
      ctaTitle: defaulHometData.ctaTitle,
      ctaDescription: defaulHometData.ctaDescription,
      ctaWhatsappButtonText: defaulHometData.ctaWhatsappButtonText,
      contactEmail: defaulHometData.contactEmail,
      footerText: defaulHometData.footerText,
      meta: defaulHometData.meta,
    };

    // Cria o documento inicial
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
