import { SEOMetadata } from '../types';

export interface LegalPageData {
  id: string;
  title: string;
  slug: string;
  /** JSON do editor Lexical — o shape é do Payload, consumido por `<RichText />`. */
  content: unknown;
  published: boolean;
  meta?: SEOMetadata;
  updatedAt?: string;
}
