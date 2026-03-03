import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import { createGrafanaMcpServer } from "../src/mcpServer.js";
import { GrafanaApi } from "../src/types.js";

const config = loadConfig({
  GRAFANA_URL: "https://grafana.example.com",
  GRAFANA_API_TOKEN: "token",
  MCP_TRANSPORTS: "stdio"
});

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

describe("stdio integration", () => {
  let serverClose: (() => Promise<void>) | undefined;
  let clientClose: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (clientClose) await clientClose();
    if (serverClose) await serverClose();
    clientClose = undefined;
    serverClose = undefined;
  });

  it("serves tool calls over MCP", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const server = createGrafanaMcpServer(config, createApiStub());
    await server.connect(serverTransport);
    serverClose = async () => server.close();

    const client = new Client({ name: "test-client", version: "0.0.1" });
    await client.connect(clientTransport);
    clientClose = async () => client.close();

    const result = await client.callTool({
      name: "grafana.health",
      arguments: {}
    });

    const firstText = result.content?.[0] && "text" in result.content[0] ? result.content[0].text : "";
    expect(firstText).toContain("database");
    expect(firstText).toContain("ok");
  });
});
