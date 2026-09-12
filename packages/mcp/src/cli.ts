#!/usr/bin/env node

/**
 * SwarmProof MCP Server — Stdio JSON-RPC 2.0 Transport
 *
 * Implements the Model Context Protocol (MCP) over standard I/O for
 * Cursor, Claude Desktop, Windsurf, and autonomous agent runners.
 */

import * as readline from "node:readline";
import { SwarmProofApiClient, createToolRegistry } from "./index.js";

const client = new SwarmProofApiClient();
const tools = createToolRegistry(client);

const SERVER_NAME = "swarmproof-mcp";
const SERVER_VERSION = "0.1.0";

function log(...args: unknown[]): void {
  process.stderr.write(`[swarmproof-mcp] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")}\n`);
}

function sendResponse(id: string | number | null, result?: unknown, error?: { code: number; message: string; data?: unknown }): void {
  const payload: Record<string, unknown> = {
    jsonrpc: "2.0",
    id,
  };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result ?? {};
  }
  const json = JSON.stringify(payload);
  process.stdout.write(`${json}\n`);
}

async function handleRequest(message: Record<string, unknown>): Promise<void> {
  const id = (message.id as string | number | null) ?? null;
  const method = message.method as string;
  const params = (message.params as Record<string, unknown>) ?? {};

  // Handle notifications (no id)
  if (id === null || id === undefined) {
    if (method === "notifications/initialized") {
      log("Client initialized connection.");
    }
    return;
  }

  switch (method) {
    case "initialize": {
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      });
      break;
    }

    case "ping": {
      sendResponse(id, {});
      break;
    }

    case "tools/list": {
      sendResponse(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      break;
    }

    case "tools/call": {
      const toolName = params.name as string;
      const toolArguments = (params.arguments as Record<string, unknown>) ?? {};
      const tool = tools.find((t) => t.name === toolName);

      if (!tool) {
        sendResponse(id, undefined, {
          code: -32601,
          message: `Tool not found: ${toolName}`,
        });
        return;
      }

      try {
        log(`Executing tool "${toolName}"...`);
        const output = await tool.run(toolArguments);
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: typeof output === "string" ? output : JSON.stringify(output, null, 2),
            },
          ],
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`Error in tool "${toolName}": ${errMsg}`);
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: `Error executing ${toolName}: ${errMsg}`,
            },
          ],
          isError: true,
        });
      }
      break;
    }

    default: {
      sendResponse(id, undefined, {
        code: -32601,
        message: `Method not found: ${method}`,
      });
      break;
    }
  }
}

function start(): void {
  log(`Starting SwarmProof MCP server v${SERVER_VERSION} (stdio)...`);
  log(`Connected API target: ${process.env.SWARMPROOF_API_URL ?? "http://localhost:3001"}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let buffer = "";

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Handle Content-Length headers if sent by some MCP clients
    if (trimmed.startsWith("Content-Length:")) {
      return;
    }

    buffer += trimmed;

    try {
      const parsed = JSON.parse(buffer);
      buffer = "";
      handleRequest(parsed).catch((err) => {
        log("Unhandled request error:", err);
      });
    } catch {
      // Incomplete JSON chunk, keep buffering
    }
  });

  process.on("SIGINT", () => {
    log("Received SIGINT, shutting down.");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down.");
    process.exit(0);
  });
}

start();
