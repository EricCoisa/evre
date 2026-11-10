import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  TIME_TRACKING_CONFIG_KEYS,
  TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS,
} from 'src/domain/time-tracking/time-tracking.const';

@Injectable()
export class GetActiveTimerUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigurationService,
  ) {}

  async execute(userId: string) {
    const active = await this.prisma.timeEntry.findFirst({
      where: {
        userId,
        endTime: null,
      },
      orderBy: {
        startTime: 'desc',
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!active) {
      return {
        entry: null,
        isForgotten: false,
        thresholdHours: TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS,
      };
    }

    let thresholdHours = TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS;
    try {
      const configVal = await this.systemConfig.getValueOrNull(
        TIME_TRACKING_CONFIG_KEYS.forgottenThresholdHours,
      );
      if (configVal && !Number.isNaN(Number(configVal))) {
        thresholdHours = Number(configVal);
      }
    } catch {
      thresholdHours = TIME_TRACKING_DEFAULT_FORGOTTEN_THRESHOLD_HOURS;
    }

    const elapsedMs = Date.now() - new Date(active.startTime).getTime();
    const isForgotten = elapsedMs >= thresholdHours * 3600 * 1000;

    return {
      entry: active,
      isForgotten,
      thresholdHours,
    };
  }
}
