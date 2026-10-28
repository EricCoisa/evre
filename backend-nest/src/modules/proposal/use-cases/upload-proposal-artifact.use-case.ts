import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { ProposalArtifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { StorageService } from '../../storage/storage.service';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import {
  PROPOSAL_ARTIFACT_CONFIG_KEYS,
  PROPOSAL_ARTIFACT_CONTENT_TYPES,
  PROPOSAL_ARTIFACT_DEFAULT_MAX_SIZE_BYTES,
  type ProposalArtifactContentType,
} from 'src/domain/proposal/proposal-artifact.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';

export interface UploadProposalArtifactFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Sobe o artefato (HTML/imagem único) de uma proposta; a chave de storage é imutável — substituir cria linha nova. */
@Injectable()
export class UploadProposalArtifactUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly storageService: StorageService,
    private readonly systemConfig: SystemConfigurationService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    proposalId: string,
    file: UploadProposalArtifactFile | undefined,
    user: AuthenticatedUser,
  ): Promise<ProposalArtifact> {
    const proposal = await this.findOne.execute(proposalId, user);

    if (!file) {
      throw new BadRequestException(
        this.i18n.t('proposal.artifact.invalid_content_type'),
      );
    }

    const ext =
      PROPOSAL_ARTIFACT_CONTENT_TYPES[
        file.mimetype as ProposalArtifactContentType
      ];
    if (!ext) {
      throw new BadRequestException(
        this.i18n.t('proposal.artifact.invalid_content_type'),
      );
    }

    const maxSizeBytes = await this.readMaxSizeBytes();
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(this.i18n.t('proposal.artifact.too_large'));
    }

    const key = this.storageService.buildKey(
      `proposals/${proposal.id}/artifacts`,
      ext,
    );
    await this.storageService.upload(key, file.buffer, file.mimetype);

    const created = await this.prisma.proposalArtifact.create({
      data: {
        proposalId: proposal.id,
        storageKey: key,
        fileName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        createdById: user.id,
      },
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.CREATE,
        message: `Artefato enviado para a proposal: ${created.fileName}`,
        metadata: { proposalId: proposal.id, artifactId: created.id },
      },
      user.id,
    );

    return created;
  }

  private async readMaxSizeBytes(): Promise<number> {
    const raw = await this.systemConfig.getValueOrNull(
      PROPOSAL_ARTIFACT_CONFIG_KEYS.maxSizeBytes,
    );
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : PROPOSAL_ARTIFACT_DEFAULT_MAX_SIZE_BYTES;
  }
}
