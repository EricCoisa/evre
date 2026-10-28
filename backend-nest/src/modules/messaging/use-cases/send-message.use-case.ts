import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type {
  MediaFile,
  SendMessageInput,
} from 'src/domain/interface/messaging-provider.interface';
import {
  MessagingMessageTypeConst,
  typeFromMime,
} from 'src/domain/messaging/messaging.const';
import { MessagingService } from '../messaging.service';
import { MessagingTemplateService } from '../messaging-template.service';
import type { SendMessageDto } from '../dto/send-message.dto';

/** Arquivo recebido por multipart (`Express.Multer.File` sem acoplar o use-case ao multer). */
export interface UploadedMedia {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** O multer decodifica o nome do arquivo como latin1; sem isto, "relatório.pdf" chega como "relatÃ³rio.pdf". */
function decodeFileName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8');
}

interface BuiltInput {
  input: SendMessageInput;
  bypassOptOut?: boolean;
  templateId?: string;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly templates: MessagingTemplateService,
    private readonly i18n: I18nService,
  ) {}

  /** `upload` presente = anexo do operador; o tipo sai do mimetype quando o DTO não o informa. */
  async execute(
    dto: SendMessageDto,
    userId: string | null,
    upload?: UploadedMedia,
  ): Promise<string> {
    const { input, bypassOptOut, templateId } = await this.build(dto, upload);
    return this.messagingService.send(input, {
      userId,
      connectionId: dto.connectionId,
      bypassOptOut,
      templateId,
    });
  }

  private async build(
    dto: SendMessageDto,
    upload?: UploadedMedia,
  ): Promise<BuiltInput> {
    const file: MediaFile | undefined = upload && {
      data: upload.buffer,
      mimeType: upload.mimetype,
    };
    const type =
      dto.type ??
      (file ? typeFromMime(file.mimeType) : MessagingMessageTypeConst.TEXT);
    const base = { phone: dto.phone };
    const media = { mediaUrl: dto.mediaUrl, file };

    switch (type) {
      case MessagingMessageTypeConst.TEXT:
        return {
          input: { ...base, type, text: this.required(dto.text, 'text', type) },
        };
      case MessagingMessageTypeConst.TEMPLATE: {
        // `reserved` fica de fora de propósito: pelo HTTP o valor das reservadas vem só do contexto.
        const { resolved, bypassOptOut, templateId } =
          await this.templates.resolve({
            templateId: this.required(dto.templateId, 'templateId', type),
            phone: dto.phone,
            values: dto.values,
          });
        return {
          input: { ...base, type, template: resolved },
          bypassOptOut,
          templateId,
        };
      }
      case MessagingMessageTypeConst.AUDIO:
        return { input: { ...base, type, ...media } };
      case MessagingMessageTypeConst.DOCUMENT:
        return {
          input: {
            ...base,
            type,
            ...media,
            caption: dto.caption,
            fileName: this.required(
              dto.fileName ?? (upload && decodeFileName(upload.originalname)),
              'fileName',
              type,
            ),
          },
        };
      default:
        return { input: { ...base, type, ...media, caption: dto.caption } };
    }
  }

  private required(
    value: string | undefined,
    field: string,
    type: string,
  ): string {
    if (!value) {
      throw new BadRequestException(
        this.i18n.t('messaging.field_required', { args: { field, type } }),
      );
    }
    return value;
  }
}
