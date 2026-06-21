# shinyrepowoker

A Cloudflare Worker that proxies a private GitHub repository as a personal Maven repository. Maven artifact paths under `/repo1648/` map directly to file paths in the GitHub repo. All access requires HTTP Basic authentication with role-based permissions.

## Features

- **Read proxy** (GET/HEAD): streams artifacts from `raw.githubusercontent.com` with token auth
- **Deploy** (PUT): uploads artifacts via the GitHub Contents API
- **Basic auth**: multiple users with `readonly` (GET/HEAD) and `readwrite` (GET/HEAD/PUT) roles

## Environment Variables

| Variable | Type | Description |
|---|---|---|
| `GITHUB_TOKEN` | secret | GitHub Personal Access Token with repo access |
| `GITHUB_OWNER` | var | GitHub username or organization |
| `GITHUB_REPO` | var | Private repository name |
| `PROXY_USERS` | secret | Base64-encoded JSON array of users |

`PROXY_USERS` format (before base64):

```json
[
  {"username":"alice","password":"readpass","role":"readonly"},
  {"username":"bob","password":"writepass","role":"readwrite"}
]
```

Set secrets with:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put PROXY_USERS
```

## Develop

```bash
npm run dev:vinext
```

## Deploy

```bash
npm run deploy:vinext
```
