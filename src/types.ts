export interface GrafanaHealth {
  database: string;
  version: string;
  commit?: string;
}

export interface DashboardSummary {
  id?: number;
  uid: string;
  title: string;
  uri?: string;
  url?: string;
  folderUid?: string;
  folderTitle?: string;
  type?: string;
}

export interface DatasourceSummary {
  id: number;
  uid: string;
  name: string;
  type: string;
  access?: string;
  isDefault?: boolean;
}

export interface QueryInstantInput {
  datasourceUid: string;
  query: string;
  timeUnixMs?: number;
}

export interface QueryRangeInput {
  datasourceUid: string;
  query: string;
  startUnixMs: number;
  endUnixMs: number;
  stepSeconds: number;
}

export interface GrafanaApi {
  health(): Promise<GrafanaHealth>;
  listDashboards(input: { query?: string; limit?: number }): Promise<DashboardSummary[]>;
  getDashboard(uid: string): Promise<unknown>;
  listDatasources(): Promise<DatasourceSummary[]>;
  queryInstant(input: QueryInstantInput): Promise<unknown>;
  queryRange(input: QueryRangeInput): Promise<unknown>;
}

export interface AppConfig {
  grafanaUrl: URL;
  grafanaApiToken: string;
  grafanaOrgId?: number;
  mcpTransports: Array<"stdio" | "http">;
  mcpHttpHost: string;
  mcpHttpPort: number;
  mcpHttpBearerToken?: string;
  datasourceAllowlist: Set<string>;
  queryTimeoutMs: number;
  maxPoints: number;
  maxResponseBytes: number;
}
