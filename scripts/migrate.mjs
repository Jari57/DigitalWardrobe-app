import nextEnv from '@next/env';
import { spawnSync } from 'node:child_process';
nextEnv.loadEnvConfig(process.cwd());
const value = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!value) throw new Error('Database configuration is missing.');
const url = new URL(value);
// Neon documents the direct endpoint as the same hostname without -pooler.
// Only migration subprocesses use it; application traffic retains pooling.
if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
const result = spawnSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url.href, CHECKPOINT_DISABLE: '1' } },
);
process.exit(result.status ?? 1);
