import { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { createHttpServer, HttpServerHandle } from "../src/httpServer.js";
import { createGrafanaMcpServer } from "../src/mcpServer.js";
import { GrafanaApi } from "../src/types.js";

function createApiStub(): GrafanaApi {
  return {
    health: async () => ({ database: "ok", version: "11.1.0" }),
    listDashboards: async () => [{ uid: "uid-1", title: "Main" }],
    getDashboard: async (uid: string) => ({ dashboard: { uid } }),
    listDatasources: async () => [{ id: 1, uid: "ds", name: "Prom", type: "prometheus" }],
    queryInstant: async () => ({ status: "success" }),
    queryRange: async () => ({ status: "success" })
  };
}

describe("http integration", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) await cleanup();
    cleanup = undefined;
  });

  it("requires bearer auth for /mcp", async () => {
    const config = loadConfig({
      GRAFANA_URL: "https://grafana.example.com",
      GRAFANA_API_TOKEN: "token",
      MCP_TRANSPORTS: "http",
      MCP_HTTP_BEARER_TOKEN: "mcp-secret"
    });

    const httpHandle = await createHttpServer(config, () => createGrafanaMcpServer(config, createApiStub()));
    await new Promise<void>((resolve) => httpHandle.server.listen(0, "127.0.0.1", () => resolve()));

    cleanup = async () => {
      await new Promise<void>((resolve, reject) => httpHandle.server.close((err) => (err ? reject(err) : resolve())));
      await httpHandle.closeSessions();
    };

    const address = httpHandle.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });

    expect(response.status).toBe(401);
  });

  it("handles authenticated MCP requests", async () => {
    const config = loadConfig({
      GRAFANA_URL: "https://grafana.example.com",
      GRAFANA_API_TOKEN: "token",
      MCP_TRANSPORTS: "http",
      MCP_HTTP_BEARER_TOKEN: "mcp-secret"
    });

    const httpHandle: HttpServerHandle = await createHttpServer(config, () => createGrafanaMcpServer(config, createApiStub()));
    await new Promise<void>((resolve) => httpHandle.server.listen(0, "127.0.0.1", () => resolve()));

    const address = httpHandle.server.address() as AddressInfo;

    const client = new Client({ name: "http-test-client", version: "0.0.1" });
    const clientTransport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`), {
      requestInit: {
        headers: {
          Authorization: "Bearer mcp-secret"
        }
      }
    });

    await client.connect(clientTransport);

    const result = await client.callTool({
      name: "grafana.list_dashboards",
      arguments: { limit: 1 }
    });

    const firstText = result.content?.[0] && "text" in result.content[0] ? result.content[0].text : "";
    expect(firstText).toContain("uid-1");

    cleanup = async () => {
      await client.close();
      await new Promise<void>((resolve, reject) => httpHandle.server.close((err) => (err ? reject(err) : resolve())));
      await httpHandle.closeSessions();
    };
  });
});
