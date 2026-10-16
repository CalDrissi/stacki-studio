# Set up Stacki Studio

This guide is for a person or coding agent installing an independent copy. All deployment configurations are examples. Bring your own accounts, repository, GitHub App, domains, and secrets. No hosted installation or billing authorization is included.

## 1. Start locally

Install Git, Node.js 22.19 or newer, and npm. Fork this repository into your own GitHub account, then clone **your fork** and enter its directory. Check `git remote -v` before any push; publishing must target your repository.

```sh
npm ci
npm --prefix studio ci
npm run studio
```

Open <http://localhost:4350/studio>. No external credentials are needed for local editing. The editor makes a separate draft under `studio/.studio/workspace`; edits do not overwrite the source checkout. Local Publish requires the optional GitHub server environment described in [the Cloudflare guide](studio/docs/cloudflare.md#local-server-configuration).

The default port is 4350. If occupied, run `PORT=4351 npm run studio`. Keep local development bound to loopback. Stop this editor using Ctrl+C in its terminal.

## 2. Gather deployment values

An agent should complete local installation before requesting information that is still missing. Use the owner's existing authorization and preferences. Record personal settings only in ignored local files or the deployment provider's settings. Never request that the owner paste private keys or tokens into an issue, commit, or public document.

| Value                                     | Where it comes from                                                   |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Cloudflare account ID                     | The owner's Cloudflare account                                        |
| GitHub repository and branch              | The owner's fork, for example `YOUR_OWNER/YOUR_REPOSITORY` and `main` |
| Website Worker name                       | A name available in the owner's account; example `stacki-studio`      |
| Editor Worker name                        | A separate name; example `stacki-studio-editor`                       |
| Private R2 bucket                         | A bucket for this installation's shared drafts                        |
| Website origin                            | HTTPS origin, for example `https://example.com`                       |
| Preview origin                            | Separate HTTPS origin, for example `https://preview.example.com`      |
| GitHub App ID, client ID, installation ID | The owner's new GitHub App and repository installation                |
| Usage budget and notification recipient   | The owner's hosting preference; configure in Cloudflare, not in Git   |

Hosting requires a Cloudflare plan supporting Workers, Containers, Durable Objects, and R2, plus a Docker-compatible engine with Buildx for local Container deployment. Verify current [Container requirements](https://developers.cloudflare.com/containers/get-started/) and pricing with the owner. Usage alerts notify; they do not cap spending. Do not enable optional paid AI unless requested.

## 3. Create local configurations

From the repository root:

```sh
cp studio/cloudflare/wrangler.jsonc studio/cloudflare/wrangler.local.jsonc
cp studio/cloudflare/site.wrangler.jsonc studio/cloudflare/site.wrangler.local.jsonc
```

Both copies are ignored by Git and excluded from the Container build context. Edit those copies, leaving the public examples generic. No personal configuration from the template author is provided.

In `studio/cloudflare/wrangler.local.jsonc`:

- Set `name` to the editor Worker name.
- Set `r2_buckets[0].bucket_name` to the private drafts bucket.
- Set `STUDIO_ORIGIN` to the website origin, without a trailing slash.
- Set `PREVIEW_ORIGIN` to the separate preview origin, without a trailing slash.
- Set `SITE_DEPLOYMENT_URL` to the website origin followed by `/__studio-deployment`.
- Replace the GitHub repository, branch, App ID, installation ID, and client ID placeholders.
- Replace `EDITOR_GITHUB_IDS` with the owner's numeric GitHub ID if using the allowlist mode. It is not used in `github` mode.
- Keep `EDITOR_ACCESS` set to `"github"` for the requested open sign-in behavior.

In `studio/cloudflare/site.wrangler.local.jsonc`, set `name` to the website Worker name and `services[0].service` to the editor Worker name. Keep the `/studio` gateway, assets paths, and version metadata binding.

Set `CLOUDFLARE_ACCOUNT_ID` in the deployment shell to select the owner's account. Authenticate with Wrangler using that account; automation may instead use a scoped `CLOUDFLARE_API_TOKEN` stored in its secret store. These are not Astro public environment variables.

Use separate same-site HTTPS origins for the editor shell and preview, such as `example.com` and `preview.example.com`. Untrusted page scripts must not share the editor shell's origin. Add the corresponding custom domains to the website and editor Workers in Cloudflare. Set `SITE_URL` in `src/consts.ts` to the public website origin when configuring the owner's website.

**Access behavior:** `EDITOR_ACCESS: "github"` lets any user who completes GitHub OAuth edit and publish the same shared website, even without repository collaborator access. It does not create a separate workspace per visitor. Preserve this setting when requested. An owner who wants restricted access can later choose `"repository"` and redeploy; the alternative allowlist mode is documented in [the Cloudflare guide](studio/docs/cloudflare.md#routing).

## 4. Create the owner's GitHub App

In GitHub Settings → Developer settings → GitHub Apps, register a new App for this installation:

1. Use the website origin as its homepage and `https://YOUR_WEBSITE_HOST/studio/auth/callback` as its OAuth callback URL.
2. Grant repository **Contents: Read and write** and **Metadata: Read**. Webhooks are not required by this application.
3. Generate a client secret and an App private key. Store them securely outside this checkout.
4. Install the App only on the owner's website repository. Record the App ID, client ID, and installation ID in the ignored editor config.
5. If people outside the App owner's account need to sign in, make the App registration public. A public App registration does not supply its private key to visitors. See [GitHub's App visibility documentation](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private).

## 5. Create resources and store secrets

The following commands run from `studio/`. Start the Docker-compatible engine before deployment.

```sh
cd studio
npx wrangler login
npx wrangler whoami
npx wrangler r2 bucket create YOUR_BUCKET_NAME
npm run build
npx wrangler secret put GITHUB_PRIVATE_KEY --config cloudflare/wrangler.local.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET --config cloudflare/wrangler.local.jsonc
npx wrangler secret put SESSION_SECRET --config cloudflare/wrangler.local.jsonc
npx wrangler secret put CONTAINER_TOKEN --config cloudflare/wrangler.local.jsonc
```

Use the interactive prompts; do not put secret values in shell command arguments or tracked files. If Wrangler asks to create the not-yet-existing Worker when saving a secret, use the editor Worker name from the local config. Generate independent cryptographically random values of at least 32 bytes for `SESSION_SECRET` and `CONTAINER_TOKEN`, and store them securely. The GitHub private key must include its PEM boundaries and newlines.

[Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/) supply credentials to the Worker at runtime. Do not put secret values in Wrangler `vars`, `PUBLIC_*` variables, website assets, or browser code. Local `.env` variants, `.dev.vars` variants, `.pem`, `.key`, Wrangler state, and browser test outputs are ignored; this does not protect a file that was already committed.

## 6. Deploy the editor and website

From `studio/`, after replacing the placeholders and storing secrets:

```sh
npm run build
npx wrangler deploy --config cloudflare/wrangler.local.jsonc
npm --prefix .. run build
npx wrangler deploy --config cloudflare/site.wrangler.local.jsonc --tag "$(git rev-parse HEAD)"
```

The editor deploy creates the configured Container and Durable Object resources. Deploy it first so the website's service binding can resolve it. Configure the custom domains chosen earlier and ensure the App callback matches the website exactly.

The root `wrangler.jsonc` is for an assets-only website. It does not include `/studio`; do not use it to deploy the complete application. `npm run deploy:site` uses the tracked site configuration, so use the explicit local-config command above when your private settings differ.

## 7. Connect publishing to deployment

Studio Publish commits validated website changes to the configured repository and branch. A GitHub commit does not itself deploy the website. Connect the **website Worker** to that repository and branch in Cloudflare Workers Builds:

- Root directory: repository root.
- Build command: `npm run build`.
- Deploy command: `npx wrangler deploy --config studio/cloudflare/site.wrangler.jsonc --tag "$WORKERS_CI_COMMIT_SHA"`.

The ignored local config will not exist in CI. The tracked site config's Worker name and editor service name must match this installation. The supplied generic names can be used in separate Cloudflare accounts; if you rename them, update those nonsecret names in your fork's tracked site config too. Select the owner's account through the Cloudflare integration or its deployment environment. Keep account credentials in the provider's secret store. Custom domains can be configured in the dashboard without committing them.

The CMS can be deployed manually with the local config whenever editor code changes. It does not need a second automatic build connection for website publishing to work.

Studio checks `/__studio-deployment` against the published Git revision. Keep the version metadata binding and commit tag so it can confirm the website is live.

## 8. Verify and hand off

Run from the repository root:

```sh
npm run check
npm run build
npm --prefix studio run verify
```

The browser suite expects the bundled homepage fixture. Use a fresh, separate test draft so it cannot edit your normal draft. From the repository root, start this in another terminal:

```sh
STUDIO_WORKSPACE=.studio/browser-check PORT=4395 npm run studio
```

After the server reports ready, copy the fixture into that test draft, then run the suite:

```sh
cp studio/test/fixtures/homepage.astro studio/.studio/browser-check/src/pages/index.astro
STUDIO_URL=http://localhost:4395/studio npm --prefix studio run test:browser
```

Use an unused workspace directory and port for each clean run, and stop the test server afterward. Do not use an existing personal draft or a hosted production URL for this fixture test.

The browser suite defaults to Google Chrome on macOS. On other systems, set `CHROME_PATH` to your installed Chrome/Chromium executable. Adjust `STUDIO_URL` to match the chosen test port. The suite edits the separate draft, not the source checkout.

On the owner's actual hosted installation, verify:

- The website loads, and an unauthenticated `/studio` request starts GitHub login.
- A second real GitHub account can sign in under `github` mode.
- Two signed-in browsers see shared edits and reconnect correctly.
- Preview scripts run on the separate preview origin.
- A deliberate test publish creates a commit in the owner's repository, triggers the website build, and reports the matching revision live. Restore the test content afterward.
- Sign-out works and secrets do not appear in browser responses or generated assets.

Do not claim hosted login, billing alerts, or publishing are verified based only on local checks. Report the local path, owner repository, chosen origins, access mode, validation results, and any remaining external setup. Never include secret values in the handoff.
