import { GuardrailError } from "./errors.js";
import { AppConfig, DashboardSummary, DatasourceSummary, GrafanaApi, GrafanaHealth, QueryInstantInput, QueryRangeInput } from "./types.js";

type FetchFn = typeof fetch;

type AllowedRequest = { method: "GET" | "POST"; pathPrefix: string };

const ALLOWED_REQUESTS: AllowedRequest[] = [
  { method: "GET", pathPrefix: "/api/health" },
  { method: "GET", pathPrefix: "/api/search" },
  { method: "GET", pathPrefix: "/api/datasources" },
  { method: "GET", pathPrefix: "/api/dashboards/uid/" },
  { method: "GET", pathPrefix: "/api/datasources/proxy/uid/" }
];

function validateRequest(method: "GET" | "POST", path: string): void {
  const allowed = ALLOWED_REQUESTS.some((rule) => rule.method === method && path.startsWith(rule.pathPrefix));
  if (!allowed) {
    throw new GuardrailError(`Rejected non-read-only Grafana route: ${method} ${path}`);
  }
}

function normalizeLimit(input: number | undefined): number {
  if (!input) return 20;
  return Math.min(Math.max(input, 1), 200);
}

function assertDatasourceAllowed(allowlist: Set<string>, datasourceUid: string): void {
  if (allowlist.size === 0) return;
  if (!allowlist.has(datasourceUid)) {
    throw new GuardrailError(`Datasource not allowed by GRAFANA_DATASOURCE_ALLOWLIST: ${datasourceUid}`);
  }
}

function assertRangePoints(maxPoints: number, startUnixMs: number, endUnixMs: number, stepSeconds: number): void {
  if (endUnixMs <= startUnixMs) {
    throw new GuardrailError("query_range requires end_unix_ms greater than start_unix_ms.");
  }

  const durationSeconds = (endUnixMs - startUnixMs) / 1000;
  const points = Math.floor(durationSeconds / stepSeconds) + 1;

  if (points > maxPoints) {
    throw new GuardrailError(`query_range exceeded GRAFANA_MAX_POINTS (${maxPoints}). Requested points: ${points}`);
  }
}

export class GrafanaClient implements GrafanaApi {
  private readonly config: AppConfig;
  private readonly fetchImpl: FetchFn;

  constructor(config: AppConfig, fetchImpl: FetchFn = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async health(): Promise<GrafanaHealth> {
    return this.requestJson<GrafanaHealth>("GET", "/api/health");
  }

  async listDashboards(input: { query?: string; limit?: number }): Promise<DashboardSummary[]> {
    const params = new URLSearchParams();
    params.set("type", "dash-db");
    params.set("limit", String(normalizeLimit(input.limit)));
    if (input.query?.trim()) {
      params.set("query", input.query.trim());
    }

    return this.requestJson<DashboardSummary[]>("GET", `/api/search?${params.toString()}`);
  }

  async getDashboard(uid: string): Promise<unknown> {
    return this.requestJson("GET", `/api/dashboards/uid/${encodeURIComponent(uid)}`);
  }

  async listDatasources(): Promise<DatasourceSummary[]> {
    return this.requestJson<DatasourceSummary[]>("GET", "/api/datasources");
  }

  async queryInstant(input: QueryInstantInput): Promise<unknown> {
    assertDatasourceAllowed(this.config.datasourceAllowlist, input.datasourceUid);
    const params = new URLSearchParams();
    params.set("query", input.query);

    if (input.timeUnixMs) {
      params.set("time", String(Math.floor(input.timeUnixMs / 1000)));
    }

    const path = `/api/datasources/proxy/uid/${encodeURIComponent(input.datasourceUid)}/api/v1/query?${params.toString()}`;
    return this.requestJson("GET", path);
  }

  async queryRange(input: QueryRangeInput): Promise<unknown> {
    assertDatasourceAllowed(this.config.datasourceAllowlist, input.datasourceUid);
    assertRangePoints(this.config.maxPoints, input.startUnixMs, input.endUnixMs, input.stepSeconds);

    const params = new URLSearchParams();
    params.set("query", input.query);
    params.set("start", (input.startUnixMs / 1000).toFixed(3));
    params.set("end", (input.endUnixMs / 1000).toFixed(3));
    params.set("step", String(input.stepSeconds));

    const path = `/api/datasources/proxy/uid/${encodeURIComponent(input.datasourceUid)}/api/v1/query_range?${params.toString()}`;
    return this.requestJson("GET", path);
  }

  private async requestJson<T = unknown>(method: "GET" | "POST", pathWithQuery: string): Promise<T> {
    const [path] = pathWithQuery.split("?");
    validateRequest(method, path);

    const target = new URL(pathWithQuery, this.config.grafanaUrl);

    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${this.config.grafanaApiToken}`
    });

    if (typeof this.config.grafanaOrgId === "number") {
      headers.set("X-Grafana-Org-Id", String(this.config.grafanaOrgId));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.queryTimeoutMs);

    try {
      const response = await this.fetchImpl(target, {
        method,
        headers,
        signal: controller.signal
      });

      const text = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      const maybeJson = contentType.includes("application/json") && text.trim().length > 0;

      if (!response.ok) {
        throw new Error(`Grafana request failed (${response.status}) for ${method} ${path}. Body: ${text.slice(0, 400)}`);
      }

      if (!maybeJson) {
        return text as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new GuardrailError(`Grafana request timed out after ${this.config.queryTimeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
