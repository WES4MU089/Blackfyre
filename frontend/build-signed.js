/**
 * Build script that loads Azure signing credentials from .env.signing
 * and runs the electron-vite build + electron-builder pipeline.
 */
const { execSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const envPath = resolve(__dirname, '.env.signing');
const env = { ...process.env };

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.trim().match(/^(\w+)=(.+)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  console.log('[build] Loaded Azure signing credentials from .env.signing');
  console.log('[build] AZURE_TENANT_ID:', env.AZURE_TENANT_ID ? 'set' : 'MISSING');
  console.log('[build] AZURE_CLIENT_ID:', env.AZURE_CLIENT_ID ? 'set' : 'MISSING');
  console.log('[build] AZURE_CLIENT_SECRET:', env.AZURE_CLIENT_SECRET ? 'set' : 'MISSING');
} else {
  console.warn('[build] No .env.signing found — build will be unsigned');
}

// Build first
execSync('electron-vite build', { stdio: 'inherit', env, cwd: __dirname });

// Then run electron-builder with env vars propagated
execSync('electron-builder --win nsis', { stdio: 'inherit', env, cwd: __dirname });
