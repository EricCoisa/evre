/** Cache em memória e curta duração para mídia pedida várias vezes seguidas, compartilhando a ida ao provider entre pedidos simultâneos. */
export class MediaCache<T extends { data: Buffer }> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<T>>();
  private bytes = 0;

  constructor(
    private readonly ttlMs = 60_000,
    private readonly maxBytes = 32 * 1024 * 1024,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    this.evictExpired();
    const hit = this.entries.get(key);
    if (hit) return hit.value;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        this.store(key, value);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private store(key: string, value: T): void {
    // Maior que o teto: serve a quem pediu e não retém.
    if (value.data.length > this.maxBytes) return;
    this.bytes += value.data.length;
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    // Map preserva a ordem de inserção: o primeiro é o mais antigo.
    for (const [oldKey, entry] of this.entries) {
      if (this.bytes <= this.maxBytes) break;
      this.drop(oldKey, entry.value);
    }
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.drop(key, entry.value);
    }
  }

  private drop(key: string, value: T): void {
    this.entries.delete(key);
    this.bytes -= value.data.length;
  }
}
