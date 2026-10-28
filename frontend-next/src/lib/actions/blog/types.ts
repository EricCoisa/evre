export interface Post {
  id: number;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: any; // Rich text from Payload (lexical) — no upstream type available
  slug: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  // Adicione outros campos se necessário, ex.: image, author
}