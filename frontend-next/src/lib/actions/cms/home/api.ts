"use server";
import { getPayload } from 'payload';
import config from '@payload-config';
import { HomeData, HomeResponse } from "./type";

/** Busca os dados da página Home do Payload CMS via API local. */
export async function getHomeData(): Promise<HomeData | null> {
  try {
    const payload = await getPayload({ config });
    
    const result = await payload.find({
      collection: 'home',
      limit: 1,
    });
    
    if (result.docs && result.docs.length > 0) {
      return result.docs[0] as unknown as HomeData;
    }
    return null;
  } catch {

    return null;
  }
}

/** Busca os dados da Home do Payload CMS a partir de um Client Component. */
export async function getHomeDataClient(): Promise<HomeData | null> {
  try {
    const response = await fetch('/api/home', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Erro ao buscar dados do Home:', response.statusText);
      return null;
    }

    const data: HomeResponse = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      return data.docs[0];
    }

    return null;
  } catch (error) {
    console.error('Erro ao conectar com Payload CMS:', error);
    return null;
  }
}
