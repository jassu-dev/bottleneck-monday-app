import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected to Redis server at', redisUrl);
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

// Cache Helpers
export const DEFAULT_CACHE_TTL_SECONDS = 600; // 10 minutes cache TTL

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err: any) {
    console.warn(`[Redis Cache] Failed to read key ${key}:`, err.message);
    return null;
  }
};

export const setCachedData = async (
  key: string,
  value: any,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS
): Promise<void> => {
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err: any) {
    console.warn(`[Redis Cache] Failed to set key ${key}:`, err.message);
  }
};

export const invalidateBoardCache = async (boardId: string): Promise<void> => {
  try {
    const keys = await redisClient.keys(`*:${boardId}*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`[Redis Cache] Invalidated ${keys.length} cache keys for board ${boardId}`);
    }
  } catch (err: any) {
    console.warn(`[Redis Cache] Invalidation error for board ${boardId}:`, err.message);
  }
};

export default redisClient;
