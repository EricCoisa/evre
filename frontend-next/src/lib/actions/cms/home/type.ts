import { SEOMetadata } from "../types";

export interface ShowcaseDemo {
  url: string;
  label: string;
  id?: string;
}

export interface ShowcaseSectionBlock {
  blockType: 'showcase';
  id?: string;
  anchorId: string;
  navLabel?: string;
  label: string;
  title: string;
  description: string;
  mediaPosition?: 'left' | 'right';
  demosInteractive?: boolean;
  demos?: ShowcaseDemo[];
}

export interface CardItem {
  title: string;
  description: string;
  id?: string;
}

export interface CardsGridSectionBlock {
  blockType: 'cardsGrid';
  id?: string;
  anchorId: string;
  navLabel?: string;
  label: string;
  title: string;
  description: string;
  cards?: CardItem[];
}

export type HomeSectionBlock = ShowcaseSectionBlock | CardsGridSectionBlock;

export interface HomeData {
  id: string;
  title: string;

  // Hero
  heroTitle: string;
  heroDescription: string;
  heroCta: string;
  heroWhatsappNumber: string;

  // Seções dinâmicas e agnósticas (criadas e ordenadas pelo CMS)
  sections: HomeSectionBlock[];

  // Contact form section
  contactFormLabel: string;
  contactFormTitle: string;
  contactFormDescription: string;
  contactFormButtonText: string;
  contactFormSuccessMessage: string;

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
  heroDescription: 'Sistemas, plataformas e sites desenvolvidos para o seu modelo de negócio.',
  heroCta: 'Falar no WhatsApp',
  heroWhatsappNumber: '5534953301409',

  sections: [
    {
      blockType: 'showcase',
      anchorId: 'sites',
      navLabel: 'Sites',
      label: 'Sites & Landing Pages',
      title: 'Faça da internet uma vitrine para sua empresa',
      description: 'Sites institucionais, landing pages com design sob medida, integrados ao seu processo de vendas.',
      mediaPosition: 'right',
      demos: [],
    },
    {
      blockType: 'showcase',
      anchorId: 'sistemas',
      navLabel: 'Sistemas',
      label: 'Sistemas para empresas',
      title: 'Para quem precisa de mais\ndo que um site.',
      description: 'Sistemas de gestão, plataformas operacionais e aplicativos mobile desenvolvidos para as regras específicas do seu negócio.',
      mediaPosition: 'left',
      demos: [],
    },
    {
      blockType: 'cardsGrid',
      anchorId: 'equipes',
      navLabel: 'Equipes',
      label: 'Parceria em desenvolvimento',
      title: 'Sua equipe com mais capacidade de produção.',
      description: 'Somamos conhecimento técnico à sua operação, seja para atender novas demandas ou fortalecer projetos em andamento.',
      cards: [
        { title: 'Integração com\nseu processo', description: 'A EVRE entra no seu fluxo de trabalho existente. Sprints, revisões e entregas exatamente como sua equipe funciona.' },
        { title: 'Foco no que\nvocê precisa', description: 'Contribuímos com profissionais de desenvolvimento para atender novas demandas, acelerar entregas e ampliar a capacidade de execução da sua equipe.' },
        { title: 'Resultado\nverificável', description: 'Comece com um projeto de escopo definido. Avalie a qualidade do trabalho antes de qualquer comprometimento maior.' },
      ],
    },
  ],

  contactFormLabel: 'Entre em contato',
  contactFormTitle: 'Manda uma\nmensagem.',
  contactFormDescription: 'Responderemos em breve.',
  contactFormButtonText: 'Enviar',
  contactFormSuccessMessage: 'Mensagem enviada! Entraremos em contato em breve.',

  ctaTitle: 'Vamos\nconversar.',
  ctaButtonText: 'Chamar no WhatsApp',
  contactEmail: 'contato@evre.com.br',

  footerText: 'EVRE Software House',

  meta: {
    title: 'EVRE Software House | Desenvolvimento de Software Sob Medida',
    description: 'Sites, sistemas e plataformas desenvolvidos sob medida para o seu modelo de negócio.',
    canonicalUrl: '/',
  },
};
