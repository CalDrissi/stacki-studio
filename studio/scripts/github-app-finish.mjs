#!/usr/bin/env node
/**
 * Stacki Studio — finish GitHub App setup after the manifest flow.
 *
 * Usage (from the repository root, with Cloudflare env sourced):
 *
 *   1. node studio/scripts/github-app-finish.mjs convert <code>
 *      Exchanges the one-hour manifest `code` (from the redirect URL) for the
 *      App credentials, writes them to git-ignored local files, patches the
 *      PENDING_GITHUB_APP placeholders in studio/cloudflare/wrangler.local.jsonc,
 *      and stores GITHUB_PRIVATE_KEY + GITHUB_CLIENT_SECRET as Worker secrets.
 *
 *   2. Install the app on CalDrissi/stacki-studio (the script prints the URL —
 *      one click: Install → Only select repositories → stacki-studio).
 *
 *   3. node studio/scripts/github-app-finish.mjs install-id
 *      Looks up the installation id with an App JWT, patches the config, and
 *      prints the redeploy command.
 *
 * Secrets are written only to git-ignored local files and Wrangler's secret
 * store — never to tracked files, argv, or logs.
 */
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const studioDir = join(here, '..');
const configPath = join(studioDir, 'cloudflare', 'wrangler.local.jsonc');
const pemPath = join(studioDir, 'cloudflare', 'github-app.local.pem');
const metaPath = join(studioDir, 'cloudflare', 'github-app.local.json');

function patchConfig(replacements) {
  let text = readFileSync(configPath, 'utf8');
  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.split(placeholder).join(value);
  }
  writeFileSync(configPath, text);
}

function putSecret(name, value) {
  execFileSync('npx', ['wrangler', 'secret', 'put', name, '--config', 'cloudflare/wrangler.local.jsonc'], {
    cwd: studioDir,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

const [, , command, arg] = process.argv;

if (command === 'convert') {
  if (!arg) {
    console.error('Usage: node studio/scripts/github-app-finish.mjs convert <code>');
    process.exit(1);
  }
  const res = await fetch(`https://api.github.com/app-manifests/${encodeURIComponent(arg)}/conversions`, {
    method: 'POST',
    headers: { accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    console.error(`Conversion failed: HTTP ${res.status} — the code may be expired (1 hour) or already used.`);
    process.exit(1);
  }
  const app = await res.json();
  writeFileSync(pemPath, app.pem, { mode: 0o600 });
  writeFileSync(
    metaPath,
    JSON.stringify({ id: app.id, slug: app.slug, client_id: app.client_id, html_url: app.html_url }, null, 2),
    { mode: 0o600 },
  );
  patchConfig({
    '"GITHUB_APP_ID": "PENDING_GITHUB_APP"': `"GITHUB_APP_ID": "${app.id}"`,
    '"GITHUB_CLIENT_ID": "PENDING_GITHUB_APP"': `"GITHUB_CLIENT_ID": "${app.client_id}"`,
  });
  console.log(`App created: ${app.slug} (id ${app.id}, client ${app.client_id})`);
  console.log('Storing Worker secrets via wrangler…');
  putSecret('GITHUB_PRIVATE_KEY', app.pem);
  putSecret('GITHUB_CLIENT_SECRET', app.client_secret);
  console.log('\nNext: install the app on the repository (one click):');
  console.log(`  ${app.html_url}/installations/new`);
  console.log('Then run: node studio/scripts/github-app-finish.mjs install-id');
} else if (command === 'install-id') {
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const pem = readFileSync(pemPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iat: now - 60, exp: now + 540, iss: String(meta.id) })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(pem).toString('base64url');
  const jwt = `${unsigned}.${signature}`;
  const res = await fetch('https://api.github.com/app/installations', {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    console.error(`Installation lookup failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const installations = await res.json();
  if (!installations.length) {
    console.error(`No installation found — install the app first: ${meta.html_url}/installations/new`);
    process.exit(1);
  }
  const installation = installations[0];
  patchConfig({ '"GITHUB_INSTALLATION_ID": "PENDING_GITHUB_APP"': `"GITHUB_INSTALLATION_ID": "${installation.id}"` });
  console.log(`Installation id ${installation.id} (account ${installation.account.login}) written to wrangler.local.jsonc.`);
  console.log('Redeploy the editor Worker:');
  console.log('  cd studio && npx wrangler deploy --config cloudflare/wrangler.local.jsonc');
} else {
  console.error('Usage: node studio/scripts/github-app-finish.mjs <convert <code> | install-id>');
  process.exit(1);
}
