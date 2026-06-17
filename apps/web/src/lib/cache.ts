import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

function logCacheError(operation: string, error: unknown) {
  console.error(`[cache] ${operation} failed:`, error instanceof Error ? error.message : error);
}

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

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch (error) {
    logCacheError("getCached", error);
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds = 60) {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    logCacheError("setCached", error);
  }
}

export async function invalidateCache(key: string) {
  try {
    await redis.del(key);
  } catch (error) {
    logCacheError("invalidateCache", error);
  }
}

export async function invalidateCollectionCache(slug: string) {
  await invalidateCache(`collection:${slug}`);
}

export async function checkRateLimit(
  identifier: string,
): Promise<{ success: boolean; reset?: number }> {
  try {
    const result = await apiRateLimit.limit(identifier);
    return { success: result.success, reset: result.reset };
  } catch (error) {
    logCacheError("rateLimit", error);
    // Allow request when rate limiter is unavailable
    return { success: true };
  }
}
