import { randomUUID } from "node:crypto";
import { createServer, Server, ServerResponse } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { isAuthorizedBearer } from "./auth.js";
import { safeErrorMessage } from "./redaction.js";
import { AppConfig } from "./types.js";

interface SessionEntry {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

export interface HttpServerHandle {
  server: Server;
  closeSessions: () => Promise<void>;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(text));
  res.end(text);
}

export async function createHttpServer(config: AppConfig, createMcpServer: () => McpServer): Promise<HttpServerHandle> {
  const sessions = new Map<string, SessionEntry>();

  const closeSessions = async () => {
    const entries = Array.from(sessions.values());
    sessions.clear();
    for (const entry of entries) {
      await entry.server.close().catch(() => undefined);
      await entry.transport.close().catch(() => undefined);
    }
  };

  const server = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const rawUrl = req.url ?? "/";
    const pathname = new URL(rawUrl, "http://localhost").pathname;

    if (pathname === "/healthz") {
      if (method !== "GET") {
        writeJson(res, 405, { error: "Method not allowed." });
        return;
      }

      writeJson(res, 200, {
        status: "ok",
        service: "GrafanaMCP",
        transports: config.mcpTransports,
        active_sessions: sessions.size
      });
      return;
    }

    if (pathname === "/mcp") {
      if (!["GET", "POST", "DELETE"].includes(method)) {
        writeJson(res, 405, { error: "Method not allowed." });
        return;
      }

      if (!config.mcpHttpBearerToken || !isAuthorizedBearer(req, config.mcpHttpBearerToken)) {
        res.setHeader("www-authenticate", 'Bearer realm="mcp"');
        writeJson(res, 401, { error: "Unauthorized" });
        return;
      }

      const incomingSessionId = req.headers["mcp-session-id"];
      const sessionId = typeof incomingSessionId === "string" ? incomingSessionId : undefined;

      try {
        if (sessionId) {
          const existing = sessions.get(sessionId);
          if (!existing) {
            writeJson(res, 404, {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32001, message: "Session not found" }
            });
            return;
          }

          await existing.transport.handleRequest(req, res);
          if (method === "DELETE") {
            sessions.delete(sessionId);
            await existing.server.close().catch(() => undefined);
            await existing.transport.close().catch(() => undefined);
          }
          return;
        }

        if (method !== "POST") {
          writeJson(res, 405, { error: "Initialization requires POST /mcp without mcp-session-id." });
          return;
        }

        let initializedSessionId: string | undefined;
        const newServer = createMcpServer();
        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (id) => {
            initializedSessionId = id;
          },
          onsessionclosed: (id) => {
            const entry = sessions.get(id);
            if (!entry) return;
            sessions.delete(id);
            void entry.server.close();
            void entry.transport.close();
          }
        });

        await newServer.connect(newTransport);
        await newTransport.handleRequest(req, res);

        if (initializedSessionId) {
          sessions.set(initializedSessionId, { server: newServer, transport: newTransport });
          return;
        }

        await newServer.close().catch(() => undefined);
        await newTransport.close().catch(() => undefined);
      } catch (error) {
        writeJson(res, 400, {
          error: safeErrorMessage(error, [config.grafanaApiToken, config.mcpHttpBearerToken])
        });
      }

      return;
    }

    writeJson(res, 404, { error: "Not found" });
  });

  return { server, closeSessions };
}
