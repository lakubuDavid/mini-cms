import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

function logCacheError(operation: string, error: unknown) {
  console.error(`[cache] ${operation} failed:`, error instanceof Error ? error.message : error);
}

export const redis = new Redis({
  url: env.UPSTASH_REDIS_KV_REST_API_URL ?? "https://example.upstash.io",
  token: env.UPSTASH_REDIS_KV_REST_API_TOKEN ?? "development-token",
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

export async function invalidateCollectionCache(
  slug: string,
  environmentId?: string,
) {
  if (environmentId) {
    await invalidateCache(`collection:${slug}:env:${environmentId}`);
  } else {
    await invalidateCache(`collection:${slug}`);
  }
}

/**
 * Invalidate all cache keys matching a collection pattern.
 * This is used when the environment isn't known at invalidation time.
 */
export async function invalidateCollectionCacheByPattern(slug: string) {
  // We use a scan-based approach for Redis pattern matching
  try {
    const pattern = `*:${slug}:*`;
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `*collection*${slug}*`,
        count: 50,
      });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch (error) {
    logCacheError("invalidateCollectionCacheByPattern", error);
  }
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
