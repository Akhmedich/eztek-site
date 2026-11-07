# Working on EZTek as a team

For developers joining the project. Read this first, then `README.md`, `CONTRIBUTING.md` and `docs/ops.md`.

## Who
| Person | GitHub | Supabase (organization Eztek) | `/admin/` |
|---|---|---|---|
| Akhmed Bektimirov, owner | `Akhmedich` (repository owner) | Owner | admin |
| Mansur | not yet | Developer | admin |
| Igor | `igorvaschuk` (write) | Developer | admin |

The repository is **public**: never commit keys, passwords, personal emails or client data.

## Access: everyone signs in as themselves
Nobody shares a password or a key. Each person gets an invitation to their own email:
- **GitHub:** owner adds you in Settings > Collaborators (`Add people`). Collaborators of a personal repository can push; the review rule below is what keeps `main` clean.
- **Supabase:** owner invites you in the organization's Team page as **Developer** (works with the database and functions, cannot delete the project). The invitation expires after 24 hours.
- **Staff dashboard `/admin/`:** open https://akhmedich.github.io/eztek-site/admin/, sign in with the email link once, then ask the owner (or Claude, on the owner's word) to add you to `staff`.
- **Service keys** (Stripe, Anthropic, Web3Forms) live in Supabase Edge Function secrets and GitHub Actions variables. The functions and the site read them from there; nobody copies them by hand.

## Local setup
Node 22 (as in CI) and git.
```bash
git clone https://github.com/Akhmedich/eztek-site.git
cd eztek-site
npm ci
npm run dev          # http://localhost:4321/eztek-site/
```
Line endings are LF everywhere (`.gitattributes`), so a Windows checkout does not show every file as changed.

Without settings the forms run in preview mode: nothing is sent, the success screen says so. That is the safe default for local work, because there is one database and it is live (see below). To try `/admin/` or the portal locally, copy `.env.example` to `.env` and fill in the publishable key from Supabase > Project Settings > API Keys. Sign-in links return to the redirect URLs set in Supabase > Authentication > URL Configuration; the owner adds `http://localhost:4321/eztek-site/admin/` there once if local sign-in is needed.

## One live database
There is no staging database: `eztek-ops` holds real leads, clients and jobs.
- Read freely; change data only on purpose, one row at a time, never delete rows.
- Never put the `service_role` key or the database password in `.env`, code or chat.
- Schema changes: a new file in `supabase/migrations/`, `npm run test:db` passes (in-memory Postgres, no live data), pull request, then any one of the three (Akhmed, Mansur, Igor) says yes and it is applied. Details and the version rule are in `CLAUDE.md`.
- Edge functions deploy from `main` only, with `verify_jwt` as set in `supabase/config.toml`. Any one of the three may approve a deploy.

## Workflow
1. Branch from `main`: `feature/<short-name>` or `fix/<short-name>`. Never push to `main`.
2. Before the pull request: `npm run check`, `npm run test:db`, `npm run build`; look at changed pages at about 400 px wide, light and dark.
3. Pull request into `main`, one topic, what changed and how to check it. Another person reviews before merge.
4. Business facts (prices, licenses, client names) change only with the owner's confirmation (`CONTRIBUTING.md`).

## Claude Code
`CLAUDE.md` holds the rules every Claude session follows in this repository, whoever runs it.
- `.mcp.json` connects Claude to the database as `eztek-ops`: run `/mcp`, pick it and sign in with **your own** Supabase account.
- A local session (Claude Desktop > Code > environment **Local**, this folder) can also use Chrome through the Claude in Chrome extension: `/chrome` > Enabled by default.
