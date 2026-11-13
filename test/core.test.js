import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket, TokenBucketError } from '../src/index.js';

function fakeClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms) => { now += ms; },
  };
}

test('constructor validates capacity', () => {
  assert.throws(() => new TokenBucket(0, 1000), TokenBucketError);
  assert.throws(() => new TokenBucket(-1, 1000), TokenBucketError);
  assert.throws(() => new TokenBucket(1.5, 1000), TokenBucketError);
});

test('constructor validates refill interval', () => {
  assert.throws(() => new TokenBucket(1, 0), TokenBucketError);
  assert.throws(() => new TokenBucket(1, -100), TokenBucketError);
  assert.throws(() => new TokenBucket(1, Infinity), TokenBucketError);
});

test('constructor validates clock', () => {
  assert.throws(() => new TokenBucket(1, 1000, null), TokenBucketError);
  assert.throws(() => new TokenBucket(1, 1000, 123), TokenBucketError);
});

test('starts full and allows up to capacity', () => {
  const clock = fakeClock();
  const bucket = new TokenBucket(2, 1000, clock.now);
  assert.equal(bucket.tokens, 2);
  assert.deepEqual(bucket.tryTake(), { allowed: true, retryAfterMs: 0 });
  assert.deepEqual(bucket.tryTake(), { allowed: true, retryAfterMs: 0 });
  assert.deepEqual(bucket.tryTake(), { allowed: false, retryAfterMs: 1000 });
});

test('refills one token per interval', () => {
  const clock = fakeClock();
  const bucket = new TokenBucket(1, 500, clock.now);
  assert.equal(bucket.tryTake().allowed, true);
  clock.advance(499);
  assert.equal(bucket.tryTake().allowed, false);
  clock.advance(1);
  assert.equal(bucket.tryTake().allowed, true);
});

test('refill caps at capacity', () => {
  const clock = fakeClock();
  const bucket = new TokenBucket(3, 100, clock.now);
  bucket.tryTake();
  bucket.tryTake();
  bucket.tryTake();
  clock.advance(1000);
  assert.equal(bucket.tokens, 3);
  assert.equal(bucket.tryTake().allowed, true);
  assert.equal(bucket.tryTake().allowed, true);
  assert.equal(bucket.tryTake().allowed, true);
  assert.equal(bucket.tryTake().allowed, false);
});

test('retryAfterMs reports time to next token', () => {
  const clock = fakeClock(0);
  const bucket = new TokenBucket(1, 1000, clock.now);
  bucket.tryTake();
  clock.advance(250);
  assert.deepEqual(bucket.tryTake(), { allowed: false, retryAfterMs: 750 });
  clock.advance(750);
  assert.deepEqual(bucket.tryTake(), { allowed: true, retryAfterMs: 0 });
});

test('retryAfterMs is full interval when no time has passed', () => {
  const clock = fakeClock(0);
  const bucket = new TokenBucket(1, 1000, clock.now);
  bucket.tryTake();
  assert.deepEqual(bucket.tryTake(), { allowed: false, retryAfterMs: 1000 });
});

test('multiple intervals refill multiple tokens', () => {
  const clock = fakeClock();
  const bucket = new TokenBucket(5, 100, clock.now);
  for (let i = 0; i < 5; i++) bucket.tryTake();
  clock.advance(350);
  assert.equal(bucket.tokens, 3);
});

test('tokens getter triggers refill', () => {
  const clock = fakeClock();
  const bucket = new TokenBucket(2, 1000, clock.now);
  bucket.tryTake();
  clock.advance(1000);
  assert.equal(bucket.tokens, 2);
});

test('capacity and refillIntervalMs are exposed', () => {
  const bucket = new TokenBucket(7, 1234, () => 0);
  assert.equal(bucket.capacity, 7);
  assert.equal(bucket.refillIntervalMs, 1234);
});

test('clock is called on each operation', () => {
  let calls = 0;
  const clock = () => { calls++; return 0; };
  const bucket = new TokenBucket(1, 1000, clock);
  assert.equal(calls, 1);
  bucket.tryTake();
  assert.equal(calls, 2);
  bucket.tokens;
  assert.equal(calls, 3);
});
