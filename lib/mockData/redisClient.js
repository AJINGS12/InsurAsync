// Singleton Redis client, cached on globalThis so serverless function
// invocations and Next.js dev's module reloading don't each open a
// new connection.

import { createClient } from "redis";

export async function getRedisClient() {
  if (!globalThis.__insurasyncRedisClient) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => console.error("[redis] Client error:", err));
    await client.connect();
    globalThis.__insurasyncRedisClient = client;
  }
  return globalThis.__insurasyncRedisClient;
}