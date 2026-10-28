import { Injectable } from '@nestjs/common';
import { MessagingService } from '../messaging.service';

/** Tipos que o navegador exibe sem executar nada. O resto (HTML, SVG, scripts) só baixa. */
const INLINE_MIME =
  /^(image\/(png|jpe?g|gif|webp|bmp)|video\/(mp4|webm|ogg|quicktime|3gpp)|audio\/[\w.+-]+|application\/pdf)(;|$)/i;

export interface MessageMedia {
  data: Buffer;
  mimeType: string;
  fileName?: string;
  inline: boolean;
}

/** Serve a mídia como `inline` só para tipos de exibição segura, para não executar conteúdo do remetente no domínio do painel. */
@Injectable()
export class GetMessageMediaUseCase {
  constructor(private readonly messagingService: MessagingService) {}

  async execute(messageId: string): Promise<MessageMedia> {
    const media = await this.messagingService.downloadMedia(messageId);
    const inline = INLINE_MIME.test(media.mimeType);
    return {
      ...media,
      mimeType: inline ? media.mimeType : 'application/octet-stream',
      inline,
    };
  }
}
