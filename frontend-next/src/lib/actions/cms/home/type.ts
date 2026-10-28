import { SEOMetadata } from "../types";

export interface HomeService {
  id?: string;
  iconName: "layout-grid" | "layers" | "database" | "smartphone";
  title: string;
  description: string;
}

export interface HomeProcessStep {
  id?: string;
  stepNumber: string;
  symbol: '<' | '/' | '>';
  title: string;
  description: string;
}

export interface HomeData {
  id: string;
  title: string;

  // Hero Section
  heroTitle: string;
  heroDescription: string;
  heroPrimaryButtonText: string;
  heroSecondaryButtonText: string;
  heroWhatsappNumber: string;

  // Services Section ("O que desenvolvemos")
  servicesTitle: string;
  servicesDescription: string;
  services: HomeService[];

  // Process Section ("Como trabalhamos")
  processTitle: string;
  processDescription: string;
  processSteps: HomeProcessStep[];

  // CTA Section ("Vamos conversar?")
  ctaTitle: string;
  ctaDescription: string;
  ctaWhatsappButtonText: string;
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

// Dados padrão caso o CMS não tenha dados
export const defaulHometData: Partial<HomeData> = {
  title: 'Home',
  heroTitle: 'Desenvolvimento de software sob medida para empresas e produtos digitais.',
  heroDescription: 'Desenvolvemos sistemas, plataformas e aplicativos sob medida para o seu modelo de negócio.',
  heroPrimaryButtonText: 'Falar no WhatsApp',
  heroSecondaryButtonText: 'Conhecer nossos serviços',
  heroWhatsappNumber: '5534953301409',

  servicesTitle: 'O que desenvolvemos',
  servicesDescription: 'Soluções digitais sob medida para resolver necessidades reais da sua operação.',
  services: [
    {
      iconName: 'layout-grid',
      title: 'Sistemas Web & Plataformas',
      description: 'Painéis de gestão, ferramentas operacionais e sistemas customizados para as necessidades e regras da sua empresa.'
    },
    {
      iconName: 'smartphone',
      title: 'Aplicativos Mobile (iOS & Android)',
      description: 'Aplicativos rápidos e responsivos para equipes externas, clientes ou produtos digitais específicos.'
    },
    {
      iconName: 'database',
      title: 'Integrações & Automação',
      description: 'Conexão entre sistemas, gateways de pagamento, ERPs e APIs para unificar seus dados e processos.'
    }
  ],

  processTitle: 'Como trabalhamos',
  processDescription: 'Processo direto e transparente para garantir previsibilidade em cada etapa.',
  processSteps: [
    {
      stepNumber: '01',
      symbol: '<',
      title: 'Planejamento & Arquitetura',
      description: 'Alinhamos as regras de negócio, definimos os requisitos técnicos e estruturamos o cronograma e escopo de cada entrega.'
    },
    {
      stepNumber: '02',
      symbol: '/',
      title: 'Desenvolvimento & Validação',
      description: 'Construção do sistema em ciclos com testes contínuos e validações em ambiente seguro antes da publicação.'
    },
    {
      stepNumber: '03',
      symbol: '>',
      title: 'Implantação & Suporte',
      description: 'Lançamento em produção, entrega de toda a infraestrutura e acompanhamento técnico para assegurar a estabilidade.'
    }
  ],

  ctaTitle: 'Vamos conversar sobre o seu projeto?',
  ctaDescription: 'Entre em contato diretamente para avaliarmos sua demanda e entender como podemos ajudar.',
  ctaWhatsappButtonText: 'Chamar no WhatsApp',
  contactEmail: 'contato@evre.com.br',

  footerText: 'EVRE Software House',
  meta: {
    title: 'EVRE Software House | Desenvolvimento de Software Sob Medida',
    description: 'Desenvolvimento de sistemas web, plataformas e soluções sob medida para empresas.',
    cannonicalUrl: '/',
  }
};
