import { AppConfig } from "./types.js";
import { ConfigError } from "./errors.js";

function parseRequiredString(value: string | undefined, key: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return trimmed;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parsePositiveInt(value: string | undefined, key: string, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(`${key} must be a positive integer.`);
  }
  return parsed;
}

function parseTransports(value: string | undefined): Array<"stdio" | "http"> {
  const raw = value?.trim() || "stdio";
  const parts = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new ConfigError("MCP_TRANSPORTS must include at least one transport.");
  }

  const unique = new Set<string>(parts);
  const allowed = new Set(["stdio", "http"]);

  for (const transport of unique) {
    if (!allowed.has(transport)) {
      throw new ConfigError(`Unsupported transport in MCP_TRANSPORTS: ${transport}`);
    }
  }

  return Array.from(unique) as Array<"stdio" | "http">;
}

function parseAllowlist(value: string | undefined): Set<string> {
  if (!value?.trim()) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const grafanaUrlString = parseRequiredString(env.GRAFANA_URL, "GRAFANA_URL");
  let grafanaUrl: URL;

  try {
    grafanaUrl = new URL(grafanaUrlString);
  } catch {
    throw new ConfigError("GRAFANA_URL must be a valid URL.");
  }

  if (grafanaUrl.protocol !== "https:" && grafanaUrl.protocol !== "http:") {
    throw new ConfigError("GRAFANA_URL must use http or https.");
  }

  const mcpTransports = parseTransports(env.MCP_TRANSPORTS);
  const mcpHttpBearerToken = env.MCP_HTTP_BEARER_TOKEN?.trim() || undefined;

  if (mcpTransports.includes("http") && !mcpHttpBearerToken) {
    throw new ConfigError("MCP_HTTP_BEARER_TOKEN is required when MCP_TRANSPORTS includes http.");
  }

  return {
    grafanaUrl,
    grafanaApiToken: parseRequiredString(env.GRAFANA_API_TOKEN, "GRAFANA_API_TOKEN"),
    grafanaOrgId: parseOptionalInt(env.GRAFANA_ORG_ID),
    mcpTransports,
    mcpHttpHost: env.MCP_HTTP_HOST?.trim() || "127.0.0.1",
    mcpHttpPort: parsePositiveInt(env.MCP_HTTP_PORT, "MCP_HTTP_PORT", 8080),
    mcpHttpBearerToken,
    datasourceAllowlist: parseAllowlist(env.GRAFANA_DATASOURCE_ALLOWLIST),
    queryTimeoutMs: parsePositiveInt(env.GRAFANA_QUERY_TIMEOUT_MS, "GRAFANA_QUERY_TIMEOUT_MS", 10_000),
    maxPoints: parsePositiveInt(env.GRAFANA_MAX_POINTS, "GRAFANA_MAX_POINTS", 2_000),
    maxResponseBytes: parsePositiveInt(env.MCP_MAX_RESPONSE_BYTES, "MCP_MAX_RESPONSE_BYTES", 200_000)
  };
}
