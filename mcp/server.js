#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Egyszerű .env betöltés külső csomag nélkül — csak helyi teszteléshez (`node server.js`);
// a Claude Desktop config JSON-ban az env blokk közvetlenül process.env-be kerül, ez nem kell hozzá.
function loadDotEnv() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
  let content;
  try {
    content = readFileSync(envPath, "utf-8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const API_KEY = process.env.SUPPORT_PORTAL_API_KEY;
const BASE_URL = process.env.SUPPORT_PORTAL_BASE_URL ?? "http://localhost:5000";

if (!API_KEY) {
  console.error("Hiba: a SUPPORT_PORTAL_API_KEY környezeti változó nincs beállítva.");
  process.exit(1);
}

async function callApi(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "X-Api-Key": API_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.title ?? data?.detail ?? response.statusText;
    throw new Error(`Support Portal API hiba (${response.status}): ${detail}`);
  }

  return data;
}

function toolResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function buildQueryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

const server = new McpServer({ name: "support-portal", version: "1.0.0" });

server.registerTool(
  "list_tickets",
  {
    title: "Ticketek listázása",
    description: "Support portál ticketek listázása szűrési feltételekkel",
    inputSchema: {
      status: z.enum(["New", "Open", "Pending", "Resolved", "Closed"]).optional()
        .describe("Ticket státusz szerinti szűrés"),
      priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional()
        .describe("Prioritás szerinti szűrés"),
      category: z.number().int().optional().describe("Kategória azonosító szerinti szűrés"),
      search: z.string().optional().describe("Szabad szöveges keresés (tárgy, bejelentő email/név)"),
      limit: z.number().int().min(1).max(100).default(20).describe("Visszaadott ticketek maximális száma"),
    },
  },
  async ({ status, priority, category, search, limit }) => {
    const qs = buildQueryString({
      Status: status,
      Priority: priority,
      CategoryId: category,
      Search: search,
      PageSize: limit ?? 20,
      Page: 1,
    });
    const result = await callApi("GET", `/api/v1/tickets${qs}`);
    return toolResult(result);
  },
);

server.registerTool(
  "get_ticket",
  {
    title: "Ticket részleteinek lekérése",
    description: "Egy ticket részletes adatainak és üzeneteinek lekérése",
    inputSchema: {
      ticket_id: z.number().int().describe("A ticket azonosítója"),
    },
  },
  async ({ ticket_id }) => {
    const result = await callApi("GET", `/api/v1/tickets/${ticket_id}`);
    return toolResult(result);
  },
);

server.registerTool(
  "create_ticket",
  {
    title: "Új ticket létrehozása",
    description: "Új support ticket létrehozása",
    inputSchema: {
      subject: z.string().describe("A ticket tárgya"),
      body: z.string().describe("A ticket leírása"),
      requester_email: z.string().email().describe("A bejelentő email címe"),
      requester_name: z.string().describe("A bejelentő neve"),
      priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium").describe("Prioritás"),
      category_id: z.number().int().optional().describe("Kategória azonosító"),
    },
  },
  async ({ subject, body, requester_email, requester_name, priority, category_id }) => {
    const result = await callApi("POST", "/api/v1/tickets", {
      subject,
      body,
      priority: priority ?? "Medium",
      categoryId: category_id ?? null,
      requesterEmail: requester_email,
      requesterName: requester_name,
      assignedToId: null,
    });
    return toolResult(result);
  },
);

server.registerTool(
  "reply_to_ticket",
  {
    title: "Válasz küldése egy ticketre",
    description: "Válasz küldése egy ticketre (publikus reply vagy belső megjegyzés)",
    inputSchema: {
      ticket_id: z.number().int().describe("A ticket azonosítója"),
      body: z.string().describe("Az üzenet szövege"),
      is_internal_note: z.boolean().default(false).describe("true esetén belső megjegyzés, nem kerül kiküldésre emailben"),
    },
  },
  async ({ ticket_id, body, is_internal_note }) => {
    const result = await callApi("POST", `/api/v1/tickets/${ticket_id}/messages`, {
      body,
      isInternalNote: is_internal_note ?? false,
    });
    return toolResult(result);
  },
);

server.registerTool(
  "update_ticket_status",
  {
    title: "Ticket státuszának módosítása",
    description: "Ticket státuszának módosítása",
    inputSchema: {
      ticket_id: z.number().int().describe("A ticket azonosítója"),
      status: z.enum(["New", "Open", "Pending", "Resolved", "Closed"]).describe("Az új státusz"),
    },
  },
  async ({ ticket_id, status }) => {
    await callApi("PATCH", `/api/v1/tickets/${ticket_id}/status`, { status });
    return toolResult({ ticketId: ticket_id, status });
  },
);

const ANALYTICS_PATHS = {
  tickets_by_category: "/api/v1/analytics/tickets-by-category",
  tickets_by_status: "/api/v1/analytics/tickets-by-status",
  sla_compliance: "/api/v1/analytics/sla-compliance",
  recent_activity: "/api/v1/analytics/recent-activity",
};

server.registerTool(
  "get_analytics",
  {
    title: "Support statisztikák lekérése",
    description: "Support statisztikák lekérése: kategóriánkénti megoszlás, SLA teljesítés, aktivitás",
    inputSchema: {
      type: z.enum(["tickets_by_category", "tickets_by_status", "sla_compliance", "recent_activity"])
        .describe("A lekérdezni kívánt statisztika típusa"),
      date_from: z.string().optional().describe("Kezdő dátum (ISO 8601), csak a tickets_by_*/sla_compliance típusokhoz"),
      date_to: z.string().optional().describe("Záró dátum (ISO 8601), csak a tickets_by_*/sla_compliance típusokhoz"),
    },
  },
  async ({ type, date_from, date_to }) => {
    const path = ANALYTICS_PATHS[type];
    const qs = buildQueryString(
      type === "recent_activity"
        ? { limit: 20 }
        : { DateFrom: date_from, DateTo: date_to },
    );
    const result = await callApi("GET", `${path}${qs}`);
    return toolResult(result);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`Support Portal MCP szerver elindult (${BASE_URL} ellen hitelesítve).`);
