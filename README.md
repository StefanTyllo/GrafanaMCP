# GrafanaMCP

Dockerized MCP server for Grafana with:

- `stdio` transport for local MCP clients
- authenticated HTTP transport (`POST /mcp`)
- read-only Grafana tools with strict query guardrails

## Features

- Tools:
  - `grafana.health`
  - `grafana.list_dashboards`
  - `grafana.get_dashboard`
  - `grafana.list_datasources`
  - `grafana.query_instant`
  - `grafana.query_range`
- Guardrails:
  - datasource allowlist (`GRAFANA_DATASOURCE_ALLOWLIST`)
  - per-request timeout (`GRAFANA_QUERY_TIMEOUT_MS`)
  - max points for range queries (`GRAFANA_MAX_POINTS`)
  - max tool response payload (`MCP_MAX_RESPONSE_BYTES`)
- Secrets stay out of git via `.env.local` and GitHub Actions secrets.

## Requirements

- Node.js 22.x
- npm 10+
- Grafana service account token with read-only permissions

## Quick Start (Local)

```bash
npm ci
cp .env.example .env.local
npm run dev
```

### Local `.env.local` notes

- Set `GRAFANA_URL` and `GRAFANA_API_TOKEN`.
- If `MCP_TRANSPORTS` includes `http`, set `MCP_HTTP_BEARER_TOKEN`.

## Run Modes

### `stdio` only

```bash
MCP_TRANSPORTS=stdio npm run start
```

### HTTP only

```bash
MCP_TRANSPORTS=http MCP_HTTP_HOST=0.0.0.0 MCP_HTTP_PORT=8080 npm run start
```

### both

```bash
MCP_TRANSPORTS=stdio,http npm run start
```

## HTTP API

- `GET /healthz` -> server health
- `POST /mcp` -> MCP Streamable HTTP endpoint

Authentication for `/mcp`:

- Header: `Authorization: Bearer <MCP_HTTP_BEARER_TOKEN>`

## Docker

```bash
docker build -t ghcr.io/stefantyllo/grafanamcp:local .
docker run --rm -p 8080:8080 --env-file .env.local ghcr.io/stefantyllo/grafanamcp:local
```

## Tests

```bash
npm test
npm run build
```

## Publish image to GHCR

Workflow: `.github/workflows/release-image.yml`

Published tags:

- `ghcr.io/stefantyllo/grafanamcp:latest` (from `main`)
- `ghcr.io/stefantyllo/grafanamcp:vX.Y.Z` (from git tags)

## Security

- Never commit `.env.local` or real catalog files with secrets.
- Use GitHub repository/environment secrets for CI/CD.
- Runtime errors are redacted to avoid leaking bearer tokens.
