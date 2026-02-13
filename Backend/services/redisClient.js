import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();

/*
    Upstash is serverless.
    No connect() needed.
*/

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

console.log("✅ Upstash Redis ready");


/*
    LOCKED CACHE HELPER
    -------------------
    ✔ prevents duplicate AI calls
    ✔ handles cooldown
    ✔ protects free quota
*/

export const getOrSetCacheLocked = async (
    key,
    cb,
    ttl = 21600,   // 6 hours
    lockTtl = 20   // seconds
) => {

    try {

        // ✅ 1 — CHECK CACHE
        const cached = await redis.get(key);

        if (cached) {
            console.log(`⚡ Cache hit → ${key}`);
            return cached;
        }


        // ✅ 2 — TRY LOCK
        const lockKey = `lock:${key}`;

        const lock = await redis.set(lockKey, "1", {
            nx: true,
            ex: lockTtl,
        });


        // If lock NOT acquired → someone else is analyzing
        if (!lock) {

            console.log(`⏳ Waiting for existing analysis → ${key}`);

            const waitInterval = 400;
            const maxWait = 10000;
            let waited = 0;

            while (waited < maxWait) {

                await new Promise(r => setTimeout(r, waitInterval));
                waited += waitInterval;

                const retryCache = await redis.get(key);

                if (retryCache) {
                    console.log(`⚡ Cache filled after wait → ${key}`);
                    return retryCache;
                }
            }

            throw new Error("Timeout waiting for AI analysis.");
        }


        // ✅ 3 — RUN EXPENSIVE TASK
        const freshData = await cb();


        // ✅ 4 — STORE CACHE
        await redis.set(key, freshData, {
            ex: ttl,
        });


        return freshData;

    } catch (err) {

        console.error("Redis cache error:", err);

        // fallback — still return AI result
        return await cb();

    } finally {

        // Always release lock
        await redis.del(`lock:${key}`);
    }
};
