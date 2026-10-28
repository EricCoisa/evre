import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;
  private readonly subscribers: Redis[] = [];

  /** `APP_NAME` isola as keys de cada app num Redis compartilhado entre projetos. */
  private readonly channelPrefix = `${process.env.APP_NAME}:`;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      { keyPrefix: this.channelPrefix },
    );
    this.redis.on('error', (err) =>
      this.logger.warn('Redis connection error', err.message),
    );
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch {
      // Cache miss is safe — fall through to DB
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // Failed invalidation is not fatal
    }
  }

  async increment(key: string, n = 1): Promise<void> {
    try {
      await this.redis.incrby(key, n);
    } catch {
      // Non-critical counter, safe to skip
    }
  }

  async sadd(key: string, member: string): Promise<void> {
    try {
      await this.redis.sadd(key, member);
    } catch {
      // Non-critical set op, safe to skip
    }
  }

  async scard(key: string): Promise<number> {
    try {
      return await this.redis.scard(key);
    } catch {
      return 0;
    }
  }

  /** Adquire um lock (SET NX); falha aberta, retornando `true` se o Redis estiver inacessível. */
  async setnx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.warn(
        `Redis indisponível ao adquirir o lock "${key}" — seguindo sem lock: ${String((err as Error)?.message ?? err)}`,
      );
      return true;
    }
  }

  /**
   * Publica num canal. Falha engolida: quem publica não pode quebrar por causa de quem escuta.
   * `keyPrefix` do cliente não alcança PUBLISH/SUBSCRIBE (canal não é uma key), por isso o prefixo é manual aqui.
   */
  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.redis.publish(this.channelPrefix + channel, message);
    } catch {
      // Sem Redis o evento só chega a quem está neste processo.
    }
  }

  /** Escuta um canal usando uma conexão própria, dedicada ao modo subscriber. */
  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    const prefixedChannel = this.channelPrefix + channel;
    try {
      const subscriber = this.redis.duplicate();
      subscriber.on('error', (err) =>
        this.logger.warn('Redis subscriber error', err.message),
      );
      subscriber.on('message', (received, message) => {
        if (received === prefixedChannel) handler(message);
      });
      await subscriber.subscribe(prefixedChannel);
      this.subscribers.push(subscriber);
    } catch (err) {
      this.logger.warn(
        `Não foi possível assinar "${channel}": ${String((err as Error)?.message ?? err)}`,
      );
    }
  }

  async onModuleDestroy() {
    await Promise.all(this.subscribers.map((sub) => sub.quit().catch(() => 0)));
    await this.redis.quit();
  }
}
