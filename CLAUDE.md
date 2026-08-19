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
- - 8. lépés KÉSZ: SSE értesítések + Login form
  - Login form: email/jelszó/remember me, redirect /tickets-re, magyar hibaüzenet
  - SSE endpoint: /api/portal/notifications/stream (JWT query param auth)
  - NotificationService: ConcurrentDictionary nyitott kapcsolatok, trigger küldés
  - NotificationsController: stream + REST (lista, olvasottnak jelölés)
  - useNotifications hook: EventSource + reconnect + polling fallback
  - Toast komponens: jobb felső sarok, 5mp auto-eltűnés, kattintásra navigál
  - NotificationBell: olvasatlan számlálóval, legördülő lista

## Dev stack (Docker crash miatt módosítva)
- Dockerben CSAK: db, mailpit, minio (docker compose up -d db mailpit minio)
- Backend lokálisan: dotnet run (port 5000)
- Frontend lokálisan: npm run dev (port 5173)
- NE futtass docker compose build parancsot — WSL2 crash-t okoz

## Seed adatok
- Admin user: admin@supportportal.dev / Admin1234!
- 5 teszt ticket különböző státuszokkal
- Master SLA policy (mind a 4 prioritáshoz)
- Munkaidő: H-P 8:00-17:00

## Nyitott hibák / TODO
- [ ] Notification bell SSE tesztelése több userrel (egyelőre csak self-trigger hiányzik)
- [ ] CSM user hozzárendelés a tickethez (jelenleg csak boolean flag + badge) — beállítások után implementálandó
- [ ] README.md hiányzik (setup leírás új gépre)

## Következő feladat (9. lépés)
Beállítások menü implementálása — az összes konfigurációs felület.