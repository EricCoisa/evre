import {
  Body,
  Controller,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  DeleteApi,
  GetApi,
  PatchApi,
  PostApi,
} from 'src/common/decorators/api-method.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import {
  FeatureFlagGuard,
  RequireFeature,
} from 'src/modules/feature-flag/feature-flag.guard';
import { JwtOrApiKeyAuthGuard } from 'src/common/guards/jwt-or-api-key.guard';
import { ScopeGuard } from 'src/common/guards/scope.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
import { StartTimerUseCase } from './use-cases/start-timer.use-case';
import { StopTimerUseCase } from './use-cases/stop-timer.use-case';
import { GetActiveTimerUseCase } from './use-cases/get-active-timer.use-case';
import { ListTimeEntriesUseCase } from './use-cases/list-time-entries.use-case';
import { UpdateTimeEntryUseCase } from './use-cases/update-time-entry.use-case';
import { DeleteTimeEntryUseCase } from './use-cases/delete-time-entry.use-case';
import { CreateManualEntryUseCase } from './use-cases/create-manual-entry.use-case';

@ApiTags('Time Tracking')
@Controller('time-tracking')
@UseGuards(JwtOrApiKeyAuthGuard, ScopeGuard, RolesGuard, FeatureFlagGuard)
@RequireFeature('FEATURE_TIME_TRACKING')
@Roles('ADMIN', 'MODERATOR')
export class TimeTrackingController {
  constructor(
    private readonly startTimerUseCase: StartTimerUseCase,
    private readonly stopTimerUseCase: StopTimerUseCase,
    private readonly getActiveTimerUseCase: GetActiveTimerUseCase,
    private readonly listTimeEntriesUseCase: ListTimeEntriesUseCase,
    private readonly updateTimeEntryUseCase: UpdateTimeEntryUseCase,
    private readonly deleteTimeEntryUseCase: DeleteTimeEntryUseCase,
    private readonly createManualEntryUseCase: CreateManualEntryUseCase,
  ) {}

  @PostApi({
    path: 'start',
    summary: 'Inicia um novo cronômetro ou faz switch atômico do timer ativo',
    status: 'CREATED',
    authenticated: true,
  })
  async startTimer(
    @Body(new ZodValidationPipe(StartTimerDto)) dto: StartTimerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.startTimerUseCase.execute(user.id, dto);
  }

  @PostApi({
    path: 'stop',
    summary: 'Finaliza o cronômetro atualmente ativo para o usuário',
    status: 'OK',
    authenticated: true,
  })
  async stopTimer(@CurrentUser() user: AuthenticatedUser) {
    return this.stopTimerUseCase.execute(user.id);
  }

  @GetApi({
    path: 'active',
    summary: 'Retorna o cronômetro ativo do usuário com indicador de esquecimento',
    status: 'OK',
    authenticated: true,
  })
  async getActiveTimer(@CurrentUser() user: AuthenticatedUser) {
    return this.getActiveTimerUseCase.execute(user.id);
  }

  @GetApi({
    path: '',
    summary: 'Lista histórico de registros de tempo com filtros e paginação',
    status: 'OK',
    authenticated: true,
  })
  async listTimeEntries(
    @Query(new ZodValidationPipe(ListTimeEntriesDto)) dto: ListTimeEntriesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listTimeEntriesUseCase.execute(dto, user);
  }

  @PostApi({
    path: 'manual',
    summary: 'Cria uma entrada retroativa manual de tempo trabalhado',
    status: 'CREATED',
    authenticated: true,
  })
  async createManualEntry(
    @Body(new ZodValidationPipe(CreateManualEntryDto)) dto: CreateManualEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createManualEntryUseCase.execute(user.id, dto);
  }

  @PatchApi({
    path: ':id',
    summary: 'Edita um registro de tempo existente, marcando-o como editado manualmente',
    status: 'OK',
    authenticated: true,
  })
  async updateTimeEntry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTimeEntryDto)) dto: UpdateTimeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateTimeEntryUseCase.execute(id, dto, user);
  }

  @DeleteApi({
    path: ':id',
    summary: 'Exclui um registro de tempo ou descarta o timer ativo',
    status: 'OK',
    authenticated: true,
  })
  async deleteTimeEntry(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deleteTimeEntryUseCase.execute(id, user);
  }
}
