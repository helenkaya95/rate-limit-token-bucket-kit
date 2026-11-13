export class TokenBucketError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenBucketError';
  }
}

export class TokenBucket {
  #capacity;
  #tokens;
  #refillIntervalMs;
  #clock;
  #lastRefill;

  constructor(capacity, refillIntervalMs, clock = Date.now) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new TokenBucketError('capacity must be a positive integer');
    }
    if (!Number.isFinite(refillIntervalMs) || refillIntervalMs <= 0) {
      throw new TokenBucketError('refillIntervalMs must be a positive finite number');
    }
    if (typeof clock !== 'function') {
      throw new TokenBucketError('clock must be a function returning a timestamp in milliseconds');
    }

    this.#capacity = capacity;
    this.#tokens = capacity;
    this.#refillIntervalMs = refillIntervalMs;
    this.#clock = clock;
    this.#lastRefill = clock();
  }

  get capacity() {
    return this.#capacity;
  }

  get refillIntervalMs() {
    return this.#refillIntervalMs;
  }

  get tokens() {
    this.#refill();
    return this.#tokens;
  }

  #refill() {
    const now = this.#clock();
    const elapsed = now - this.#lastRefill;
    if (elapsed >= this.#refillIntervalMs) {
      const intervals = Math.floor(elapsed / this.#refillIntervalMs);
      this.#tokens = Math.min(this.#capacity, this.#tokens + intervals);
      this.#lastRefill += intervals * this.#refillIntervalMs;
    }
  }

  tryTake() {
    this.#refill();
    if (this.#tokens > 0) {
      this.#tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    }
    const now = this.#clock();
    const elapsed = now - this.#lastRefill;
    const remaining = this.#refillIntervalMs - (elapsed % this.#refillIntervalMs);
    return { allowed: false, retryAfterMs: remaining };
  }
}
