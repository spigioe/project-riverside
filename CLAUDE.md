# Support Portál

## Tech Stack
- Backend: ASP.NET Core (.NET 9), EF Core (MySQL provider), BCrypt, FluentValidation, NSwag/OpenAPI
- Frontend: Vite + React 19 + TypeScript + React Query + Zustand
- DB: MySQL 8
- Docker Compose: db, mailpit, minio (backend+frontend lokálisan fut)

## Architektúra
- Layered: Controller → Service → Repository
- Portal API (/api/portal/) — JWT Bearer auth
- Developer API (/api/v1/) — API key auth (later)

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

## Következő feladat (11. lépés)
Még nincs meghatározva.