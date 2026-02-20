import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('localhost'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('3306'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('blackfyre_hud'),
  DB_CONNECTION_LIMIT: z.string().transform(Number).default('10'),

  // Second Life
  SL_REGION_SECRET: z.string().default('dev-secret'),
  SL_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Discord OAuth
  DISCORD_CLIENT_ID: z.string().default(''),
  DISCORD_CLIENT_SECRET: z.string().default(''),
  DISCORD_REDIRECT_URI: z.string().default('http://localhost:3000/api/auth/discord/callback'),

  // JWT
  JWT_SECRET: z.string().default('change-me'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('debug'),
  LOG_FILE: z.string().default('logs/blackfyre.log'),

  // WebSocket
  WS_HEARTBEAT_INTERVAL: z.string().transform(Number).default('30000'),
  WS_RECONNECT_TIMEOUT: z.string().transform(Number).default('5000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = {
  server: {
    port: parsed.data.PORT,
    host: parsed.data.HOST,
    nodeEnv: parsed.data.NODE_ENV,
    isDev: parsed.data.NODE_ENV === 'development',
    isProd: parsed.data.NODE_ENV === 'production',
  },
  database: {
    host: parsed.data.DB_HOST,
    port: parsed.data.DB_PORT,
    user: parsed.data.DB_USER,
    password: parsed.data.DB_PASSWORD,
    database: parsed.data.DB_NAME,
    connectionLimit: parsed.data.DB_CONNECTION_LIMIT,
  },
  secondLife: {
    regionSecret: parsed.data.SL_REGION_SECRET,
    allowedOrigins: parsed.data.SL_ALLOWED_ORIGINS.split(','),
  },
  discord: {
    clientId: parsed.data.DISCORD_CLIENT_ID,
    clientSecret: parsed.data.DISCORD_CLIENT_SECRET,
    redirectUri: parsed.data.DISCORD_REDIRECT_URI,
  },
  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
  },
  logging: {
    level: parsed.data.LOG_LEVEL,
    file: parsed.data.LOG_FILE,
  },
  websocket: {
    heartbeatInterval: parsed.data.WS_HEARTBEAT_INTERVAL,
    reconnectTimeout: parsed.data.WS_RECONNECT_TIMEOUT,
  },
} as const;

export type Config = typeof config;
