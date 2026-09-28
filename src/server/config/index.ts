import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(32).default('dev-secret-change-in-production-min-32-chars!!'),
  JWT_EXPIRY: z.string().default('7d'),
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASS: z.string().min(12).refine(v=> v!=='admin123456', 'Default password not allowed in production').default('admin123456'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI required — fully Mongo now (no local fallback)').default('mongodb+srv://z4x7272_db_user:eKbrq6FKAqBzqrLG@cluster0.sztzbyx.mongodb.net/?appName=Cluster0'),
  POLL_INTERVAL_MS: z.coerce.number().default(5000),
  DISPATCH_BATCH_SIZE: z.coerce.number().default(80),
  DISPATCH_DELAY_MS: z.coerce.number().default(0),
  ACK_TIMEOUT_MS: z.coerce.number().default(8000),
})

export const config = EnvSchema.parse(process.env)
export type Config = typeof config
