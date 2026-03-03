import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { safeErrorMessage } from "./redaction.js";
import { createGrafanaMcpServer } from "./mcpServer.js";
import { GrafanaClient } from "./grafanaClient.js";
import { createHttpServer } from "./httpServer.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const api = new GrafanaClient(config);

  const shutdownTasks: Array<() => Promise<void>> = [];

  if (config.mcpTransports.includes("stdio")) {
    const server = createGrafanaMcpServer(config, api);
    const stdio = new StdioServerTransport();
    await server.connect(stdio);
    console.error("[GrafanaMCP] stdio transport connected");

    shutdownTasks.push(async () => {
      await server.close();
      await stdio.close();
    });
  }

  if (config.mcpTransports.includes("http")) {
    const httpHandle = await createHttpServer(config, () => createGrafanaMcpServer(config, api));

    await new Promise<void>((resolve) => {
      httpHandle.server.listen(config.mcpHttpPort, config.mcpHttpHost, () => resolve());
    });

    console.error(`[GrafanaMCP] http transport listening on http://${config.mcpHttpHost}:${config.mcpHttpPort}`);

    shutdownTasks.push(async () => {
      await new Promise<void>((resolve, reject) => {
        httpHandle.server.close((error) => (error ? reject(error) : resolve()));
      });
      await httpHandle.closeSessions();
    });
  }

  const shutdown = async () => {
    const tasks = [...shutdownTasks].reverse();
    for (const task of tasks) {
      try {
        await task();
      } catch (error) {
        console.error(`[GrafanaMCP] shutdown error: ${safeErrorMessage(error, [config.grafanaApiToken, config.mcpHttpBearerToken ?? ""])} `);
      }
    }
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

start().catch((error) => {
  console.error(`[GrafanaMCP] startup failed: ${safeErrorMessage(error)}`);
  process.exit(1);
});
