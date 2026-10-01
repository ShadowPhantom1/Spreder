import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(12).default('dev-secret-change-in-production-min-32-chars!!'),
  JWT_EXPIRY: z.string().default('7d'),
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASS: z.string().min(6).default('admin123456'),
  DATABASE_TYPE: z.enum(['mongo','local']).default('local'),
  MONGODB_URI: z.string().optional().default(''),
  POLL_INTERVAL_MS: z.coerce.number().default(5000),
  DISPATCH_BATCH_SIZE: z.coerce.number().default(80),
  DISPATCH_DELAY_MS: z.coerce.number().default(0),
  ACK_TIMEOUT_MS: z.coerce.number().default(8000),
})

export const config = EnvSchema.parse(process.env)

// non-blocking production warnings (was crashing Render before — min12 + refine on default admin123456)
if (config.NODE_ENV === 'production') {
  if (config.ADMIN_PASS === 'admin123456') console.warn('[config] WARN: ADMIN_PASS is still default admin123456 — set a strong ADMIN_PASS (12+ chars) in Render env for production!')
  else if (config.ADMIN_PASS.length < 12) console.warn('[config] WARN: ADMIN_PASS < 12 chars — recommended >=12 in production')
  if (config.JWT_SECRET === 'dev-secret-change-in-production-min-32-chars!!') console.warn('[config] WARN: JWT_SECRET is still default dev value — set a strong 32+ char JWT_SECRET in Render env!')
  else if (config.JWT_SECRET.length < 32) console.warn('[config] WARN: JWT_SECRET < 32 chars — recommended >=32 in production')
}

export type Config = typeof config
