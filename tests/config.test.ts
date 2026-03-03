import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("requires MCP_HTTP_BEARER_TOKEN when http transport is enabled", () => {
    expect(() =>
      loadConfig({
        GRAFANA_URL: "https://grafana.example.com",
        GRAFANA_API_TOKEN: "token",
        MCP_TRANSPORTS: "http"
      })
    ).toThrow(/MCP_HTTP_BEARER_TOKEN/);
  });

  it("parses defaults and allowlist", () => {
    const cfg = loadConfig({
      GRAFANA_URL: "https://grafana.example.com",
      GRAFANA_API_TOKEN: "token",
      MCP_TRANSPORTS: "stdio,http",
      MCP_HTTP_BEARER_TOKEN: "abc",
      GRAFANA_DATASOURCE_ALLOWLIST: "a,b"
    });

    expect(cfg.mcpHttpPort).toBe(8080);
    expect(cfg.datasourceAllowlist.has("a")).toBe(true);
    expect(cfg.datasourceAllowlist.has("b")).toBe(true);
  });
});
