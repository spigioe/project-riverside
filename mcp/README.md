# Support Portal MCP szerver

Node.js alapú MCP (Model Context Protocol) szerver, ami a Support Portál Developer API-ját
(`/api/v1/*`) teszi elérhetővé Claude számára stdio-n keresztül.

## Előfeltétel

- A backend fut (`cd backend/SupportPortal && dotnet run`, port 5000)
- Van egy Developer API kulcs a `/settings/integration` oldalon generálva

## Telepítés és indítás

```bash
cd mcp
npm install
cp .env.example .env   # majd töltsd ki a SUPPORT_PORTAL_API_KEY-t
node server.js
```

A szerver stdio-n kommunikál — sikeres indításkor egy állapotüzenetet ír a stderr-re
("Support Portal MCP szerver elindult..."), a stdout kizárólag az MCP JSON-RPC protokollé.

## Elérhető tool-ok

| Tool | Leírás |
|---|---|
| `list_tickets` | Ticketek listázása szűrőkkel (status, priority, category, search, limit) |
| `get_ticket` | Egy ticket részletei — üzenetekkel és ClickUp linkekkel együtt |
| `create_ticket` | Új ticket létrehozása |
| `reply_to_ticket` | Válasz küldése (publikus vagy belső megjegyzés) |
| `update_ticket_status` | Ticket státuszának módosítása |
| `get_analytics` | Statisztikák: kategóriánkénti/státuszonkénti megoszlás, SLA teljesítés, legutóbbi aktivitás |

## Claude Desktop konfiguráció

Add hozzá a Claude Desktop konfigurációs fájljához (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "support-portal": {
      "command": "node",
      "args": ["/path/to/support-portal/mcp/server.js"],
      "env": {
        "SUPPORT_PORTAL_API_KEY": "az_api_kulcs_ide",
        "SUPPORT_PORTAL_BASE_URL": "http://localhost:5000"
      }
    }
  }
}
```

Cseréld le a `/path/to/support-portal` részt a repo tényleges elérési útjára, és az API kulcsot
egy a `/settings/integration` oldalon generált, aktív Developer API kulcsra.

## Tesztelés MCP kliens nélkül

A szerver egy sima stdio process, JSON-RPC üzenetekkel — kézzel nem praktikus tesztelni.
Induláskor a stderr-re írt állapotüzenet és a folyamat életben maradása (nem lép ki hibával)
jelzi, hogy sikeresen kapcsolódott és regisztrálta a tool-okat. A ténylegesen működő
tool-hívásokat Claude Desktopból vagy más MCP kliensből érdemes kipróbálni.
