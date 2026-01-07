export class Mail {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  performedById?: string | null;
  provider?: string;
  metadata?: any;
}
