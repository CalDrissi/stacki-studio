# Stacki Studio — virtusoperandi deployment

Installation-specific, **non-secret** record for this fork (`CalDrissi/stacki-studio`).
Secrets live only in Cloudflare Worker secrets and git-ignored `*.local.*` files.

## Topology (Cloudflare account `2e6317da…`)

| Piece | Value |
| --- | --- |
| Website Worker | `stacki-studio` → https://stacki.virtusoperandi.com (serves the site + `/studio` gateway) |
| Editor Worker | `stacki-studio-editor` → https://stacki-preview.virtusoperandi.com (preview origin; Container + Durable Object + R2) |
| R2 drafts bucket | `stacki-studio-editor-drafts` (private) |
| Edited repository | `CalDrissi/stacki-studio` @ `main` (one installation edits exactly one repo) |
| Access mode | Numeric-ID allowlist: `EDITOR_GITHUB_IDS=5814645` (CalDrissi). `EDITOR_ACCESS` is omitted on purpose. |

Local (git-ignored) configs: `studio/cloudflare/wrangler.local.jsonc` and
`studio/cloudflare/site.wrangler.local.jsonc` — copies of the tracked examples
with the values above.

## Current state (2026-11-21)

- Both Workers are LIVE on the custom domains; `/studio` serves the real
  sign-in screen and `/__studio-deployment` reports the deployed revision.
- **Degraded mode:** the Cloudflare account is on Workers **Free**, which
  rejects `limits.cpu_ms` (error 100328) and Cloudflare **Containers**
  (`/containers/me` unauthorized). The editor Worker is therefore deployed from
  `studio/cloudflare/wrangler.local-nocontainer.jsonc` — identical, minus the
  container attachment. Sign-in/auth is fully functional once the GitHub App
  exists, but opening the draft workspace (preview container) requires
  **Workers Paid (~$5/mo) + Containers**: upgrade the plan, restore the
  `limits` lines, then `npx wrangler deploy --config cloudflare/wrangler.local.jsonc`
  (the container image already builds cleanly with local Docker).
- Secrets `SESSION_SECRET` + `CONTAINER_TOKEN` are set. GitHub App secrets
  pending the owner step below.

## Deploy commands

```sh
set -a; . /path/to/cloudflare.local.env; set +a   # CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
cd studio
npm run build
npx wrangler deploy --config cloudflare/wrangler.local.jsonc        # editor (needs Docker running)
npm --prefix .. run build
npx wrangler deploy --config cloudflare/site.wrangler.local.jsonc --tag "$(git rev-parse HEAD)"
```

## Finishing the GitHub App (owner, ~2 minutes)

The GitHub App must be registered by the owner's GitHub account (browser step —
cannot be done by an API token). Everything around it is scripted:

1. Open `studio/scripts/github-app-manifest.html` in a browser signed in as
   **CalDrissi**, click **Create GitHub App on github.com**, then **Create GitHub App**.
2. GitHub redirects to `https://stacki.virtusoperandi.com/?code=XXXX` — copy `code`.
3. Run `node studio/scripts/github-app-finish.mjs convert <code>`
   (exchanges the code for App ID / client ID / client secret / private key,
   patches the local config, stores the two GitHub Worker secrets).
4. Click the printed `…/installations/new` link and install the app on
   **CalDrissi/stacki-studio** only.
5. Run `node studio/scripts/github-app-finish.mjs install-id`, then redeploy the
   editor Worker (command printed by the script).

Manual alternative: GitHub → Settings → Developer settings → GitHub Apps → New.
Homepage `https://stacki.virtusoperandi.com`, OAuth callback
`https://stacki.virtusoperandi.com/studio/auth/callback`, permissions
Contents: Read & write + Metadata: Read, no webhook. Then fill
`GITHUB_APP_ID` / `GITHUB_CLIENT_ID` / `GITHUB_INSTALLATION_ID` in
`studio/cloudflare/wrangler.local.jsonc` and `wrangler secret put`
`GITHUB_PRIVATE_KEY` + `GITHUB_CLIENT_SECRET`.

## Worker secrets (editor Worker)

| Secret | State |
| --- | --- |
| `SESSION_SECRET` | set (random 32 bytes) |
| `CONTAINER_TOKEN` | set (random 32 bytes) |
| `GITHUB_PRIVATE_KEY` | set by step 3 above |
| `GITHUB_CLIENT_SECRET` | set by step 3 above |

## Website HQ integration

HQ (https://websites.virtusoperandi.com) shows a **Stacki Studio** card on
`/settings` that live-probes `https://stacki.virtusoperandi.com/studio`.
Fleet note: Stacki is GitHub-only; both current fleet sites are GitLab-backed,
so their dashboards honestly show "Stacki: GitHub repos only" instead of a fake
edit link.
