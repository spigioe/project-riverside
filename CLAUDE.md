# Support Portál

## Tech Stack
- Backend: ASP.NET Core (.NET 9), EF Core (MySQL provider), BCrypt, FluentValidation, NSwag/OpenAPI
- Frontend: Vite + React 19 + TypeScript + React Query + Zustand
- DB: MySQL 8
- Docker Compose: backend, db, frontend, mailpit, minio

## Architektúra
- Layered: Controller → Service → Repository
- Portal API (/api/portal/) — JWT Bearer auth
- Developer API (/api/v1/) — API key auth

## Konvenciók
- Szerver oldali validáció: FluentValidation minden endpointon
- Visszatérési formátum hibánál: ProblemDetails (RFC 7807)
- NSwag generálja a TS interfészeket — kézzel ne írj API típusokat
- Kommentek és hibaüzenetek: magyar nyelven

## Dev környezet
- `docker compose up -d` — teljes stack indítás
- Mailpit UI: http://localhost:8025
- MinIO Console: http://localhost:9001
- Backend: http://localhost:5000
- Frontend: http://localhost:80

## Fájlok amikhez NE nyúlj
- .env
- backend/obj/ és backend/bin/
- EF Core migrációkat csak `dotnet ef migrations add` generálja

## Dokumentáció
- /docs/support_portal_tervezes_v1.docx — teljes tervezési döntések
- /docs/support_portal_ek_diagramok.docx — adatbázis E-K diagramok
- /docs/Support Portal v2.dc.html - wireframe diagram
- CSS token rendszer: neo-brutalist, --navy: #10162F, --primary: #4A6CF7, Inter + Space Grotesk + JetBrains Mono
- Komponensek: shadow-pop (4px 4px 0 0 navy), pill badge-ek, 4px border-radius, nincs gradient

## Elvégzett lépések
- 1. lépés KÉSZ: Docker Compose stack (MySQL, Mailpit, MinIO, Nginx placeholder)
- 2. lépés KÉSZ: ASP.NET Core projekt, EF Core entitások, migrációk, seed adatok
- 3. lépés KÉSZ: JWT auth, BCrypt, refresh token rotáció, remember me
- 4. lépés KÉSZ: Ticket CRUD API (/api/portal/tickets/) — 17/17 teszt zöld
  - GET /tickets (szűrés, lapozás), GET /tickets/{id}
  - POST /tickets, PUT /tickets/{id}
  - PATCH /{id}/status, /{id}/assign, /{id}/csm
  - POST /{id}/merge (cascade: auto-close, isMerged, mergedIntoTicketId)
  - FluentValidation + magyar ProblemDetails hibák
- 5. lépés KÉSZ: React scaffold — 14/14 teszt zöld (1 defect fixed)
  - Vite 8 + React 19 + TypeScript, react-router-dom v6 (pinned)
  - React Query 5, Zustand, axios JWT interceptor
  - NSwag 14 → typed API kliens (/frontend/src/api/generated-client.ts)
  - [ProducesResponseType] minden controller actionön — kötelező konvenció
  - Frontend Docker: multi-stage (node:20-alpine → nginx:alpine)
  - Routes: /login, /tickets, /tickets/:id (placeholder-ök)
- 6. lépés KÉSZ: Ticket lista + detail nézet — 37/38 teszt, 1 finding
  - TicketsPage: filter bar (státusz, prioritás, search), táblázat, lapozó
  - TicketDetailPage: conversation thread, reply composer, properties panel
  - GET+POST /tickets/{id}/messages endpoint hozzáadva
  - GET /users endpoint hozzáadva (assign dropdownhoz)
  - Design tokenek: 100% egyezés a mockuppal (F1-F3 mind pass)
  - Finding (nyitott): POST body kulcs teljesen kihagyva → vegyes EN+HU validációs hiba
  - Fix: minden required non-nullable DTO property-re NotNull() FluentValidation rule + [JsonRequired]
  - Finding LEZÁRVA: SuppressImplicitRequiredAttributeForNonNullableReferenceTypes + NotNull()+Cascade(Stop)
  - Side effect lezárva: LoginRequest + RefreshRequest FluentValidation validátorok hozzáadva
- 7. lépés KÉSZ: Email fogadás + email → ticket konverzió — végigtesztelve élő Mailpittel
  - **FONTOS FELFEDEZÉS: a Mailpit NEM biztosít IMAP szervert** (csak SMTP+POP3+HTTP API — lásd `mailpit --help`).
    A docker-compose 1143-as "IMAP" port mappingje soha nem volt valós — eltávolítva.
    Bejövő email lekérdezés ezért Mailpit HTTP API-n keresztül (GET /api/v1/messages, /message/{id},
    /message/{id}/headers, PUT /api/v1/messages a "seen" jelöléshez), NEM MailKit ImapClienttel.
    Kimenő küldés (SMTP) változatlanul MailKit SmtpClienttel megy, az működött elsőre.
  - MailSettings: SmtpHost/Port, ApiBaseUrl (Mailpit API), PollIntervalSeconds, FromAddress
  - EmailPollingService (BackgroundService, PeriodicTimer, IServiceScopeFactory) — 60mp
  - TicketEmailProcessor: thread matching In-Reply-To → References → Subject [#ID] → új ticket
  - Dedup: EmailQueue.ExternalMessageId UNIQUE + "seen" jelölés Mailpit API-n
  - EmailQueueStatus bővítve: + Received (bejövő emailek logolásához, nincs migráció — longtext oszlop)
  - POST /tickets/{id}/messages (nem internal note) → automatikus kimenő válaszemail,
    In-Reply-To/References az adott ticket legkorábbi bejövő emailjére mutat
  - Teszt: SMTP küldés → új ticket (New/Email) → API reply → Mailpit-ben helyes fejlécekkel →
    threadelt válasz email → ugyanahhoz a tickethez (nem új) → subject [#ID] tag is működik önmagában

## Seed adatok
- Admin user: admin@supportportal.dev / Admin1234!
- 5 teszt ticket különböző státuszokkal
- Master SLA policy (mind a 4 prioritáshoz)
- Munkaidő: H-P 8:00-17:00

## Következő feladat (8. lépés)
SSE értesítések + Login form — ezzel élesíthetői állapotba kerül az alap rendszer.

### SSE értesítések
- Backend: GET /api/portal/notifications/stream — SSE endpoint, JWT auth
- Triggerek: new_ticket, assigned, csm_flagged, new_message, status_changed, sla_warning, sla_breached
- Minden trigger feature flag-gel kapcsolható (notification_preferences tábla)
- Polling fallback: ha SSE kapcsolat megszakad, 30mp-es polling
- Frontend: useNotifications hook, toast értesítések a jobb felső sarokban

### Login form
- /login route — jelenleg placeholder
- Email + jelszó + "Megjegyez" checkbox
- Sikeres login → redirect /tickets-re
- Hibás login → magyar hibaüzenet
- Design: a mockup login oldala alapján (/docs/Support Portal v2.dc.html)