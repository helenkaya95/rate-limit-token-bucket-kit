# rate-limit-token-bucket-kit

A token bucket rate limiter that tracks a capacity of tokens refilling at a steady interval, telling you whether a request may proceed and how long to wait if not.

```js
import { TokenBucket } from 'rate-limit-token-bucket-kit';

const bucket = new TokenBucket(10, 1000); // 10 tokens, one refilled every second

const result = bucket.tryTake();
if (result.allowed) {
  // proceed with the request
} else {
  console.log(`Retry in ${result.retryAfterMs} ms`);
}
```

## Why this exists

Most rate limiters either smooth traffic with a leaky bucket or hard-cap per window. A token bucket allows bursts up to a capacity while enforcing a long-term average, which matches how APIs often want to behave: a client may fire off a handful of requests at once, but sustained traffic is limited.

The trade-off is that the bucket only refills in whole tokens at fixed intervals. That makes the arithmetic exact and the retry hint precise, at the cost of a request occasionally waiting up to one full interval even when a fractional token might have accrued under a continuous model. The interval is the unit of fairness.

## Time source

The constructor takes an optional `clock` function returning milliseconds. This is not decoration: it lets tests advance time deterministically without sleeping, and it lets callers share a monotonic clock across many buckets. The default is `Date.now`.

## Edge to know

If you never call `tryTake` or read `tokens`, the bucket does not refill. Refill is computed lazily on access, so a bucket left idle for a long time will be full when you next touch it, but a bucket that is polled frequently will also be full. There is no background timer, which keeps the library free of handles and easy to reason about.

## API

`new TokenBucket(capacity, refillIntervalMs, clock?)`

- `capacity` — positive integer, maximum tokens.
- `refillIntervalMs` — positive finite number, milliseconds between token refills.
- `clock` — optional function returning a millisecond timestamp. Defaults to `Date.now`.

Throws `TokenBucketError` if any argument is invalid.

`bucket.tryTake()` — returns `{ allowed: boolean, retryAfterMs: number }`. When allowed, `retryAfterMs` is `0`. When not, it is the milliseconds until the next token becomes available.

`bucket.tokens` — current token count, triggering a refill check.

`bucket.capacity` — the configured capacity.

`bucket.refillIntervalMs` — the configured interval.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

