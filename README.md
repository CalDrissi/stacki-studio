# Stacki Studio

A collaborative visual CMS for an Astro website, built with Lumos for Astro. The website lives at the repository root; the editor, Cloudflare Workers, and Container live in `studio/`.

## Set up your copy

Give your coding agent this instruction:

> Read AGENTS.md and SETUP.md. Set up this project locally first, then help me deploy it using my own GitHub repository, GitHub App, and Cloudflare account. Keep credentials and personal deployment settings out of Git. Preserve the requested EDITOR_ACCESS setting and verify the actual installation before reporting it as ready.

See **[SETUP.md](SETUP.md)** for the complete installation and deployment procedure.

```sh
npm ci
npm --prefix studio ci
npm run studio
```

Open <http://localhost:4350/studio>. Local editing needs no Cloudflare account or GitHub credentials. Drafts live in `studio/.studio/workspace`; the original website source is preserved.

The Cloudflare template sets `EDITOR_ACCESS` to `"github"`: **anyone who signs in with GitHub can edit and publish your installation's shared website**. This is a shared editor, not an isolated site for each visitor. Hosting and publishing require the owner's configuration; a fork does not inherit credentials or access to another installation.

## Project layout

```text
stacki-studio/
├── AGENTS.md           # Instructions for coding agents
├── SETUP.md            # Installation and deployment
├── LUMOS.md            # Website component and styling conventions
├── src/                # Astro website
├── public/             # Public website assets
└── studio/
    ├── src/            # Editor and server
    ├── cloudflare/     # Generic deployment configurations
    ├── scripts/        # Build and development tools
    ├── test/           # Automated and browser checks
    └── vendor/         # Attributed upstream modules
```

## Development

Use Node.js 22.19 or newer and npm. Run commands from the repository root unless a guide says otherwise.

| Command                                | Purpose                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `npm run studio`                       | Start the editor with a separate draft website        |
| `npm run dev`                          | Start the website without the editor                  |
| `npm run check`                        | Check the Astro website                               |
| `npm run build`                        | Build the website                                     |
| `npm --prefix studio run verify`       | Check, lint, format-check, test, and build the editor |
| `npm --prefix studio run test:browser` | Test a running local draft editor                     |

Additional documentation: [editor guide](studio/README.md), [Cloudflare architecture](studio/docs/cloudflare.md), and [Lumos](https://lumosframework.com).

## License

[MIT](LICENSE). Upstream notices and provenance remain under `studio/vendor/`. The owner's copyright attribution uses the public account name `flowtricks`.
