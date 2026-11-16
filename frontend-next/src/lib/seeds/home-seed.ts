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

    // Carrega todo o conteúdo padrão de forma agnóstica a partir de defaulHometData
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...seedContent } = defaulHometData;

    await payload.create({
      collection: 'home',
      draft: false,
      data: {
        title: 'Home',
        ...seedContent,
      } as unknown as Omit<Home, 'id' | 'createdAt' | 'updatedAt'>,
    });

    console.log('✓ Dados iniciais da Home criados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criar dados iniciais da Home:', error);
    throw error;
  }
}
