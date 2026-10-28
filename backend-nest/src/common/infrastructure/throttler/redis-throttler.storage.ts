import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';

// ThrottlerStorageRecord not re-exported from @nestjs/throttler barrel
type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

const NOT_BLOCKED: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0,
};

// Custom storage because @nestjs-throttler/storage-redis doesn't exist on npm;
// uses ioredis already installed via bullmq.
@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      { keyPrefix: `${process.env.APP_NAME}:` },
    );
    this.redis.on('error', (err) =>
      this.logger.warn('Redis connection error', err.message),
    );
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const blockKey = `${key}:${throttlerName}:block`;
    const hitsKey = `${key}:${throttlerName}:hits`;

    // Fail open — Redis down means no rate limiting, not a broken app
    try {
      const blockTtl = await this.redis.pttl(blockKey);
      if (blockTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockTtl / 1000),
        };
      }

      const totalHits = await this.redis.incr(hitsKey);
      if (totalHits === 1) {
        await this.redis.pexpire(hitsKey, ttl);
      }

      const hitsTtl = await this.redis.pttl(hitsKey);
      const timeToExpire = Math.ceil(hitsTtl / 1000);

      if (totalHits > limit) {
        const blockMs = blockDuration > 0 ? blockDuration : ttl;
        await this.redis.set(blockKey, '1', 'PX', blockMs);
        return {
          totalHits,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockMs / 1000),
        };
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (err) {
      this.logger.warn(
        'Redis throttler unavailable, allowing request',
        (err as Error).message,
      );
      return NOT_BLOCKED;
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
