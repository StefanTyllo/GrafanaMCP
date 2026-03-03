import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { encodeResultWithLimit } from "./response.js";
import { AppConfig, GrafanaApi } from "./types.js";

function asTextResult(payload: unknown, maxBytes: number) {
  return {
    content: [
      {
        type: "text" as const,
        text: encodeResultWithLimit(payload, maxBytes)
      }
    ]
  };
}

export function createGrafanaMcpServer(config: AppConfig, api: GrafanaApi): McpServer {
  const server = new McpServer({ name: "GrafanaMCP", version: "0.1.0" });

  server.registerTool(
    "grafana.health",
    {
      description: "Read Grafana health status.",
      inputSchema: z.object({})
    },
    async () => asTextResult(await api.health(), config.maxResponseBytes)
  );

  server.registerTool(
    "grafana.list_dashboards",
    {
      description: "List dashboards from Grafana.",
      inputSchema: z.object({
        query: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(200).optional()
      })
    },
    async ({ query, limit }) => asTextResult(await api.listDashboards({ query, limit }), config.maxResponseBytes)
  );

  server.registerTool(
    "grafana.get_dashboard",
    {
      description: "Get dashboard JSON by UID.",
      inputSchema: z.object({
        uid: z.string().min(1)
      })
    },
    async ({ uid }) => asTextResult(await api.getDashboard(uid), config.maxResponseBytes)
  );

  server.registerTool(
    "grafana.list_datasources",
    {
      description: "List Grafana datasources.",
      inputSchema: z.object({})
    },
    async () => asTextResult(await api.listDatasources(), config.maxResponseBytes)
  );

  server.registerTool(
    "grafana.query_instant",
    {
      description: "Execute an instant Prometheus query via a datasource proxy.",
      inputSchema: z.object({
        datasource_uid: z.string().min(1),
        query: z.string().min(1),
        time_unix_ms: z.number().int().positive().optional()
      })
    },
    async ({ datasource_uid: datasourceUid, query, time_unix_ms: timeUnixMs }) =>
      asTextResult(await api.queryInstant({ datasourceUid, query, timeUnixMs }), config.maxResponseBytes)
  );

  server.registerTool(
    "grafana.query_range",
    {
      description: "Execute a range Prometheus query via a datasource proxy.",
      inputSchema: z.object({
        datasource_uid: z.string().min(1),
        query: z.string().min(1),
        start_unix_ms: z.number().int().positive(),
        end_unix_ms: z.number().int().positive(),
        step_seconds: z.number().int().min(1)
      })
    },
    async ({ datasource_uid: datasourceUid, query, start_unix_ms: startUnixMs, end_unix_ms: endUnixMs, step_seconds: stepSeconds }) =>
      asTextResult(
        await api.queryRange({ datasourceUid, query, startUnixMs, endUnixMs, stepSeconds }),
        config.maxResponseBytes
      )
  );

  return server;
}
