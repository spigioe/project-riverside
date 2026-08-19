# Support Portál

## Tech Stack
- Backend: ASP.NET Core (.NET 9), EF Core (MySQL provider), BCrypt, FluentValidation, NSwag/OpenAPI
- Frontend: Vite + React 19 + TypeScript + React Query + Zustand
- DB: MySQL 8
- Docker Compose: db, mailpit, minio (backend+frontend lokálisan fut)

## Architektúra
- Layered: Controller → Service → Repository
- Portal API (/api/portal/) — JWT Bearer auth
- Developer API (/api/v1/) — X-Api-Key header auth (saját "ApiKey" AuthenticationScheme)

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
- 10. lépés KÉSZ: ClickUp integráció — ticket linkelés, státusz szinkron, háttérjob
  - IClickUpLinkService: CRUD (GET/POST/DELETE /tickets/{id}/clickup) + SyncLinkAsync (manuális/on-demand)
  - ClickUpSyncBackgroundService (IHostedService, PeriodicTimer 30 perc, IServiceScopeFactory) → SyncAllActiveLinksAsync
  - IIntegrationService.GetDecryptedApiKeyAsync() — belső, nem maszkolt kulcs a ClickUpLinkService számára
  - API kulcs hiányában graceful skip: ClickUpSyncLogs sorba logolva ("ClickUp API kulcs nincs beállítva."), nincs kivétel
  - On-demand szinkron: GET /tickets/{id} a válasz visszaküldése UTÁN, `Task.Run` + saját IServiceScopeFactory scope-ban,
    nem várva meg (fire-and-forget) — a kérés-scope DbContext nem használható a válasz után, ezért kötelező az új scope
  - Frontend nem duplikálja a szinkront ticket megnyitáskor (a CLAUDE.md 10. lépés terve ezt is kérte) — a backend már
    automatikusan elindítja on-demand-ban; a TicketDetailPage csak megjeleníti a cache-elt linkeket, "Szinkronizálás"
    gombbal kézi triggerelhető
  - Frontend: ClickUp szekció a ticket jobb oldali panelen — státusz chip (progress=kék, complete/done=zöld, blocked=piros,
    egyéb=szürke), "Link hozzáadása" modal (task URL-ből auto task ID kinyerés), "Szinkronizálás" + "Törlés" gomb linkenként
  - Tesztelve: curl E2E (login → GET ticket → POST link → POST sync → DELETE link), ClickUpSyncLogs sorok ellenőrizve
    valós (de érvénytelen) API kulccsal — 401 Unauthorized eset graceful, nem crashel
  - GET/POST/DELETE /api/portal/tickets/{id}/clickup[/{linkId}]
  - POST /{linkId}/sync — manuális státusz szinkron
  - ClickUpSyncBackgroundService: 30 perces PeriodicTimer, graceful shutdown fix
  - On-demand szinkron: GET /tickets/{id} fire-and-forget háttérben (nem blokkolja a betöltést)
  - Graceful skip ha nincs API kulcs beállítva
  - EmailPollingService shutdown bug javítva (OperationCanceledException wrap)
  - Frontend: ClickUp panel ticket detail-ben, státusz chipek, "Link hozzáadása" modal
- 11. lépés KÉSZ: Developer API réteg (/api/v1/) + MCP szerver
  - ApiKeyAuthenticationHandler (AuthenticationHandler<ApiKeyAuthenticationSchemeOptions>, scheme name "ApiKey"):
    X-Api-Key header → SHA-256 hash → ApiKeys.KeyHash egyezés (NEM BCrypt — ld. lentebb miért), is_active+
    lejárat+user.is_active ellenőrzés, last_used_at frissítés, 401 ProblemDetails HandleChallengeAsync-ben
  - FONTOS ELTÉRÉS a tervtől: a kulcsot SHA-256-tal hasheljük, nem BCrypt-tel — ez már az ApiKeyService-ben
    (9. lépés) is így volt, és BCrypt salted hash-nél nincs O(1) DB lookup egyenlőséggel (csak minden aktív
    kulcson végigiterálva Verify()-jal), a SHA-256 viszont determinisztikus és indexelhető. Nem változtattuk
    meg a meglévő tárolást, a handler ehhez illeszkedik.
  - Endpointok: GET/POST /api/v1/tickets, GET /api/v1/tickets/{id} (üzenetek+ClickUp linkek beágyazva,
    TicketDetailWithRelationsDto), PATCH /{id}/status, GET/POST /{id}/messages — mind a meglévő
    ITicketService/IClickUpLinkService-t hívja (nincs duplikált business logika a Portal API-hoz képest)
  - TicketSource bővítve: + Api (string oszlop, nincs migráció) — API-n át létrehozott ticketek jelölésére
  - ITicketService.CreateTicketAsync(request, userId, source = Manual) — opcionális source paraméter,
    a Portal API hívásai változatlanok maradnak (default Manual)
  - TicketListQuery bővítve: + DateFrom/DateTo (Portal API-t nem érinti, nem küld ilyet)
  - Analytics: GET /api/v1/analytics/{tickets-by-category,tickets-by-status,sla-compliance,recent-activity}
  - FONTOS EF Core/Pomelo bug: `GroupBy(...).Select(g => new RecordDto(g.Key, g.Count()))` NEM fordítható le
    (InvalidOperationException futásidőben) — anonim típusra kell vetíteni a GroupBy Select-ben, a record DTO-t
    csak utána, memóriában építeni. Lásd AnalyticsService.cs — ha új grouped analytics endpoint kell, kövesd
    ugyanezt a mintát.
  - recent-activity: nincs esemény/audit log tábla ami ezt tárolná (az AuditLogs tábla soha nincs írva sehol —
    ez már a 9. lépés óta így van) — ezért Ticket.CreatedAt + TicketMessage.CreatedAt összefésüléséből építjük
    memóriában, időrendben csökkenő sorrendbe rendezve
  - Két külön NSwag OpenAPI dokumentum: "v1" (Portal, JWT, ebből generál a frontend TS klienst) és "developer"
    (/swagger/developer/swagger.json, X-Api-Key security scheme) — AddOpenApiDocument.PostProcess szűri szét
    a document.Paths-t /api/v1/ prefix alapján, mindkét irányban. A frontend NSwag klienshez NEM adtunk hozzá
    developer klienst — azt a Node MCP szerver hívja nyers HTTP-vel, nincs rá szükség TS oldalon.
  - /mcp/server.js: Node.js MCP szerver, @modelcontextprotocol/sdk (NEM @anthropic-ai/mcp-server-sdk, az a
    tervben szereplő csomagnév nem létezik) + zod, stdio transport. 6 tool: list_tickets, get_ticket,
    create_ticket, reply_to_ticket, update_ticket_status, get_analytics — mind a Developer API-t hívja fetch-csel
  - /mcp/.env egyszerű, függőség nélküli betöltése (csak helyi node server.js teszteléshez — Claude Desktop
    configban az env blokk közvetlenül megy, nem kell .env)
  - mcp/node_modules/ .gitignore-hoz adva
  - Tesztelve: curl E2E (401 kulcs nélkül/rossz kulccsal/visszavont kulccsal, 200 érvényes kulccsal,
    last_used_at frissül), mind a 4 analytics endpoint valós adaton, MCP szerver stdio JSON-RPC harness-szel
    (initialize → tools/list → tools/call list_tickets/get_analytics/get_ticket hibás id-vel → isError:true)
  - Claude Desktophoz aktív teszt API kulcs hagyva ("MCP szerver" néven /settings/integration alatt) manuális
    kipróbáláshoz


## Seed adatok
- Admin user: admin@supportportal.dev / Admin1234!
- 5 teszt ticket különböző státuszokkal
- Master SLA policy (mind a 4 prioritáshoz)
- Munkaidő: H-P 8:00-17:00

## Nyitott hibák / TODO
- [ ] Notification bell SSE tesztelése több userrel
- [ ] CSM user hozzárendelés dropdown a ticket properties panelben (boolean flag megvan, de nincs user picker)
- [ ] README.md hiányzik (setup leírás új gépre)
- [ ] 9. lépés UI tesztelése böngészőben még nem történt meg
- [ ] 10. lépés (ClickUp) UI tesztelése böngészőben még nem történt meg — API-n keresztül végigtesztelve, de valós
      ClickUp API kulccsal (nem csak 401-es teszt kulccsal) még nem lett kipróbálva a teljes szinkron
- [ ] 11. lépés (Developer API + MCP) Claude Desktopból élőben még nem lett kipróbálva — csak stdio JSON-RPC
      teszt harness-szel, Claude Desktop nem elérhető ebben a környezetben

## Következő feladat (12. lépés)
Még nincs meghatározva.