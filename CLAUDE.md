# Support Portál

## Tech Stack
- Backend: ASP.NET Core (.NET 9), EF Core (MySQL provider), BCrypt, FluentValidation, NSwag/OpenAPI
- Frontend: Vite + React 19 + TypeScript + React Query + Zustand
- DB: MySQL 8
- Docker Compose: db, mailpit, minio (backend+frontend lokálisan fut)

## Architektúra
- Layered: Controller → Service → Repository
- Portal API (/api/portal/) — JWT Bearer auth, frontend használja
- Developer API (/api/v1/) — X-Api-Key auth, MCP és külső integrációk

## Konvenciók
- Szerver oldali validáció: FluentValidation minden endpointon
- Visszatérési formátum hibánál: ProblemDetails (RFC 7807)
- NSwag generálja a TS interfészeket — kézzel ne írj API típusokat
- Kommentek és hibaüzenetek: magyar nyelven
- [ProducesResponseType] minden controller actionön kötelező
- NE futtass docker compose build parancsot — WSL2 crash-t okoz

## Dev környezet indítása
```bash
# 1. terminál — infrastruktúra
docker compose up -d db mailpit minio

# 2. terminál — backend
cd backend/SupportPortal && dotnet run   # port 5000

# 3. terminál — frontend
cd frontend && npm run dev               # port 5173
```
- Böngésző: http://localhost:5173
- Mailpit UI: http://localhost:8025
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)
- Bejelentkezés: admin@supportportal.dev / Admin1234!

## Fájlok amikhez NE nyúlj
- .env
- backend/obj/ és backend/bin/
- EF Core migrációkat csak `dotnet ef migrations add` generálja

## Dokumentáció
- /docs/support_portal_tervezes_v1.docx — teljes tervezési döntések
- /docs/support_portal_ek_diagramok.docx — adatbázis E-K diagramok
- /docs/Support Portal v2.dc.html — wireframe mockup (design referencia)
- CSS token rendszer: neo-brutalist, --navy: #10162F, --primary: #4A6CF7
- Fontok: Inter (body), Space Grotesk (heading), JetBrains Mono (ID, timestamp)
- Komponensek: shadow-pop (4px 4px 0 0 navy), pill badge-ek, 4px border-radius, nincs gradient

## Elvégzett lépések
- 1. lépés KÉSZ: Docker Compose stack
- 2. lépés KÉSZ: ASP.NET Core projekt, EF Core entitások, migrációk, seed adatok
- 3. lépés KÉSZ: JWT auth, BCrypt, refresh token rotáció, remember me
- 4. lépés KÉSZ: Ticket CRUD API — 17/17 teszt zöld
- 5. lépés KÉSZ: React scaffold — Vite+TS+React Query+Zustand+NSwag
- 6. lépés KÉSZ: Ticket lista + detail nézet — design tokenek 100% egyezés
- 7. lépés KÉSZ: Email fogadás — Mailpit HTTP API polling, thread matching, outbound reply
  - Mailpit-nek NINCS IMAP — HTTP API-t használ a poller, ne változtasd meg
- 8. lépés KÉSZ: SSE értesítések + Login form
- 9. lépés KÉSZ: Beállítások menü
  - /settings/users — felhasználó kezelés (CRUD, soft delete, szerepkör)
  - /settings/sla — Master SLA + domain kivételek + munkaidő konfig
  - /settings/email — read-only email konfig
  - /settings/notifications — trigger toggle-ök userenként
  - /settings/tickets — kategóriák (fa struktúra) + canned response-ok (folder+response)
  - /settings/integration — ClickUp API kulcs konfig + Developer API kulcsok
  - /settings/system — Audit log (lapozás, szűrés)
  - RequireRole guard: /settings/* csak Admin+MasterAdmin, /settings/system csak MasterAdmin
- 10. lépés KÉSZ: ClickUp integráció
  - GET/POST/DELETE /api/portal/tickets/{id}/clickup[/{linkId}]
  - POST /{linkId}/sync — manuális státusz szinkron
  - ClickUpSyncBackgroundService: 30 perces PeriodicTimer, graceful shutdown fix
  - On-demand szinkron: GET /tickets/{id} fire-and-forget háttérben
  - Graceful skip ha nincs API kulcs beállítva
  - EmailPollingService shutdown bug javítva (OperationCanceledException wrap)
  - Frontend: ClickUp panel ticket detail-ben, státusz chipek, "Link hozzáadása" modal
- 11. lépés KÉSZ: Developer API + MCP szerver
  - ApiKeyAuthenticationHandler: X-Api-Key header, SHA-256 hash lookup
    (nem BCrypt — egyenlőség alapú keresés, szándékos eltérés dokumentálva)
  - GET/POST /api/v1/tickets, GET /api/v1/tickets/{id}, PATCH /{id}/status
  - GET/POST /api/v1/tickets/{id}/messages
  - Analytics: /api/v1/analytics/tickets-by-category, tickets-by-status, sla-compliance, recent-activity
  - GroupBy EF Core bug javítva: anonymous type projection → DTO mapping in-memory
  - OpenAPI split: v1 (Portal/JWT) + /swagger/developer/ (Developer API/X-Api-Key)
  - MCP szerver: /mcp/server.js, @modelcontextprotocol/sdk
  - 6 MCP tool: list_tickets, get_ticket, create_ticket, reply_to_ticket, update_ticket_status, get_analytics
  - "MCP szerver" API kulcs aktív a DB-ben (/settings/integration-ban látható)
- 12. lépés KÉSZ: AI funkciók a portálon belül (Anthropic .NET SDK)
  - NuGet: Anthropic 12.40.0 (`dotnet add package Anthropic`)
  - Model: claude-opus-5 — FONTOS ELTÉRÉS a tervtől (ami "claude-sonnet-4-6"-ot írt elő): a claude-api
    skill egyértelmű, jelenlegi irányelve szerint mindig claude-opus-5-öt kell használni, hacsak a
    felhasználó kifejezetten mást nem kér — ez nem a felhasználó kérése volt, hanem egy korábbi
    (feltehetően elavult) terv-jegyzet, ezért a skill iránymutatását követtem
  - IAiService + AiService: SummarizeAsync/SuggestReplyAsync/ClassifyAsync, mind AiOperationResult<T>-et
    ad vissza (Success/TicketNotFound/Unavailable) — SOHA nem dob kivételt AI hiba esetén
  - API kulcs hiányában (vagy bármilyen Anthropic API hiba esetén) graceful degradation: 503
    ProblemDetails magyar üzenettel, a ticket funkcionalitás nem sérül
  - AiSettings: Anthropic:ApiKey appsettings-ből, ha üres → ANTHROPIC_API_KEY env var fallback
  - Osztályozásnál (classify) nincs C# SDK structured output API dokumentálva a skillben, ezért a
    modell egy szigorúan JSON-only system prompt utasítást kap, a választ JsonDocument.Parse
    dolgozza fel (markdown code fence / extra szöveg esetére ExtractJsonObject véd)
  - POST /api/portal/tickets/{id}/ai/{summarize,suggest-reply,classify} — külön TicketAiController
    (nem a TicketController-ben, az már 200+ soros)
  - Minden AI hívás logolva az AiInteractions táblába (PromptSnapshot, ResponseSnapshot, ModelUsed,
    TokensUsed, InteractionType) — a tábla már a kezdeti migrációból megvolt, nem kellett új migráció
  - Frontend: "AI asszisztens" szekció a ticket jobb oldali panelen (Tulajdonságok és ClickUp között),
    3 gomb (Összefoglaló / Válasz javaslat / Kategorizálás), loading state gombonként, inline eredmény
    — válasz javaslat a reply composerbe töltődik (szerkeszthető), kategorizálásnál Elfogadás/Elvetés
    (Elfogadás a meglévő PUT /tickets/{id}-t hívja a javasolt kategóriával/prioritással)
  - Új CSS token: --purple: #6D3FC7 (index.css) — a meglévő --purple-bg/-text/-border tint tokenek
    mellé, az AI gombok/eredménydoboz kereteként
  - Tesztelve: 503 graceful degradation API kulcs nélkül, 404 nemlétező ticketre, "Elfogadás" PUT
    payload alakja élesben (ticket 1-en, utána visszaállítva) — VALÓS Anthropic API kulcs nem volt
    elérhető ebben a környezetben, a tényleges Claude-hívás (summarize/suggest-reply/classify
    ténylegesen értelmes válasza) még nincs élesben kipróbálva
  - Claude Desktop MCP bekötés (a terv 12. lépés első fele) felhasználói oldali, helyi lépés — ezt
    nem tudtam elvégezni/tesztelni ebben a környezetben, a meglévő "MCP szerver" kulcs (11. lépésből)
    használható hozzá

## Seed adatok
- Admin user: admin@supportportal.dev / Admin1234!
- 5 teszt ticket különböző státuszokkal
- Master SLA policy (mind a 4 prioritáshoz)
- Munkaidő: H-P 8:00-17:00

## Developer API kulcs
- "MCP szerver" nevű aktív kulcs a DB-ben — /settings/integration oldalon látható
- SHA-256 hash alapú authentikáció (X-Api-Key header)
- Curl teszt: curl -H "X-Api-Key: {kulcs}" http://localhost:5000/api/v1/tickets

## MCP szerver
- Helye: /mcp/server.js
- Indítás: cd mcp && npm install && node server.js
- Szükséges env: SUPPORT_PORTAL_API_KEY, SUPPORT_PORTAL_BASE_URL=http://localhost:5000
- Claude Desktop config példa: /mcp/README.md-ben

## Nyitott hibák / TODO
- [ ] Notification bell SSE tesztelése több userrel
- [ ] CSM user hozzárendelés dropdown a ticket properties panelben
- [ ] README.md hiányzik (setup leírás új gépre)
- [ ] ClickUp UI vizuális ellenőrzése böngészőben
- [ ] Settings UI vizuális ellenőrzése böngészőben (9. lépés)
- [ ] MCP szerver Claude Desktop-pal való tesztelése (felhasználói oldali lépés)
- [ ] AI funkciók (12. lépés) valós Anthropic API kulccsal még nincsenek kipróbálva — csak a graceful
      degradation (kulcs nélkül) és a 404 eset lett tesztelve ebben a környezetben
- [ ] AI funkciók UI vizuális ellenőrzése böngészőben (12. lépés)

## Következő feladat (13. lépés)
Még nincs meghatározva.