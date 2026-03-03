import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config.js";
import { GrafanaClient } from "../src/grafanaClient.js";

function createConfig() {
  return loadConfig({
    GRAFANA_URL: "https://grafana.example.com",
    GRAFANA_API_TOKEN: "token",
    MCP_TRANSPORTS: "stdio",
    GRAFANA_DATASOURCE_ALLOWLIST: "allowed-ds",
    GRAFANA_MAX_POINTS: "10"
  });
}

describe("GrafanaClient", () => {
  it("builds request for list dashboards", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      expect(String(input)).toContain("/api/search");
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify([{ uid: "uid-1", title: "Main" }]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const client = new GrafanaClient(createConfig(), fetchMock as typeof fetch);
    const result = await client.listDashboards({ query: "main", limit: 5 });
    expect(result).toHaveLength(1);
  });

  it("rejects datasources outside allowlist", async () => {
    const fetchMock = vi.fn();
    const client = new GrafanaClient(createConfig(), fetchMock as typeof fetch);

    await expect(
      client.queryInstant({
        datasourceUid: "not-allowed",
        query: "up"
      })
    ).rejects.toThrow(/Datasource not allowed/);
  });

  it("enforces max points for range query", async () => {
    const fetchMock = vi.fn();
    const client = new GrafanaClient(createConfig(), fetchMock as typeof fetch);

    await expect(
      client.queryRange({
        datasourceUid: "allowed-ds",
        query: "up",
        startUnixMs: 0,
        endUnixMs: 20000,
        stepSeconds: 1
      })
    ).rejects.toThrow(/GRAFANA_MAX_POINTS/);
  });
});
