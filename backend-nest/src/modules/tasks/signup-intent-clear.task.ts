import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SignupIntentClearTask {
  private readonly logger = new Logger(SignupIntentClearTask.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSignupIntentCleanup() {
    const result = await this.prisma.signupIntent.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.log(`Signup intents removidos: ${result.count}`);
  }
}
