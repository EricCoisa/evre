import { SEOMetadata } from "../types";

export interface HomeData {
  id: string;
  title: string;

  // Hero
  heroTitle: string;
  heroDescription: string;
  heroCta: string;
  heroWhatsappNumber: string;

  // Sites section
  sitesLabel: string;
  sitesTitle: string;
  sitesDescription: string;
  siteDemos: Array<{ url: string; label: string }>;

  // Sistemas section
  sistemasLabel: string;
  sistemasTitle: string;
  sistemasDescription: string;
  sistemaDemos: Array<{ url: string; label: string }>;

  // Reforço de equipes section
  reforcosLabel: string;
  reforcosTitle: string;
  reforcosDescription: string;
  equipesCellOneTitle: string;
  equipesCellOneDescription: string;
  equipesCellTwoTitle: string;
  equipesCellTwoDescription: string;
  equipesCellThreeTitle: string;
  equipesCellThreeDescription: string;

  // CTA section
  ctaTitle: string;
  ctaButtonText: string;
  contactEmail: string;

  // Footer
  footerText: string;

  meta?: SEOMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface HomeResponse {
  docs: HomeData[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export const defaulHometData: Partial<HomeData> = {
  title: 'Home',
  heroTitle: 'Desenvolvimento\nde software\nsob medida.',
  heroDescription: 'Sistemas, plataformas e sites desenvolvidos para o seu modelo de negócio, do planejamento ao suporte.',
  heroCta: 'Falar no WhatsApp',
  heroWhatsappNumber: '5534953301409',

  sitesLabel: 'Sites & Landing Pages',
  sitesTitle: 'Para quem quer vender\ne aparecer online.',
  sitesDescription: 'Sites institucionais, lojas e portais digitais com design sob medida, integrados ao seu processo de vendas.',
  siteDemos: [],

  sistemasLabel: 'Sistemas para empresas',
  sistemasTitle: 'Para quem precisa de mais\ndo que um site.',
  sistemasDescription: 'Sistemas de gestão, plataformas operacionais e aplicativos mobile desenvolvidos para as regras específicas do seu negócio.',
  sistemaDemos: [],

  reforcosLabel: 'Reforço de equipes',
  reforcosTitle: 'Ferramentas que\na equipe\nrealmente usa.',
  reforcosDescription: 'Cada equipe tem um jeito de trabalhar. Construímos o software que encaixa nesse jeito, não o contrário.',
  equipesCellOneTitle: 'Integração com\nseu processo',
  equipesCellOneDescription: 'A EVRE entra no seu fluxo de trabalho existente. Sprints, revisões e entregas contínuas sem mudar como sua equipe funciona.',
  equipesCellTwoTitle: 'Foco no que\nvocê precisa',
  equipesCellTwoDescription: 'Você define a prioridade, a EVRE executa. Sem overhead de gestão nem curva de aprendizado prolongado.',
  equipesCellThreeTitle: 'Resultado\nverificável',
  equipesCellThreeDescription: 'Comece com um projeto de escopo definido. Avalie a qualidade do trabalho antes de qualquer comprometimento maior.',

  ctaTitle: 'Vamos\nconversar.',
  ctaButtonText: 'Chamar no WhatsApp',
  contactEmail: 'contato@evre.com.br',

  footerText: 'EVRE Software House',

  meta: {
    title: 'EVRE Software House | Desenvolvimento de Software Sob Medida',
    description: 'Sites, sistemas e plataformas desenvolvidos sob medida para o seu modelo de negócio.',
    cannonicalUrl: '/',
  },
};
