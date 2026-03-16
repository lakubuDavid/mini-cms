import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export const redis = new Redis({
  url:
    env.UPSTASH_REDIS_REST_URL ??
    env.KV_REST_API_URL ??
    "https://example.upstash.io",
  token:
    env.UPSTASH_REDIS_REST_TOKEN ??
    env.KV_REST_API_TOKEN ??
    "development-token",
});

export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(env.RATE_LIMIT_TOKENS_PER_MINUTE, "1 m"),
  analytics: true,
  prefix: "mini-cms:ratelimit",
});

export async function getCached<T>(key: string) {
  return redis.get<T>(key);
}

export async function setCached<T>(key: string, value: T, ttlSeconds = 60) {
  await redis.set(key, value, { ex: ttlSeconds });
}

export async function invalidateCache(key: string) {
  await redis.del(key);
}

export async function invalidateCollectionCache(slug: string) {
  await invalidateCache(`collection:${slug}`);
}
