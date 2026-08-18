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

## Seed adatok
- Admin user: admin@supportportal.dev / Admin1234!
- 5 teszt ticket különböző státuszokkal
- Master SLA policy (mind a 4 prioritáshoz)
- Munkaidő: H-P 8:00-17:00

## Következő feladat (5. lépés)
React frontend scaffold:
- Vite + React 19 + TypeScript projekt a /frontend mappában
- React Query (server state), Zustand (UI state)
- NSwag kliens generálás a backend OpenAPI specből
- Frontend Dockerfile frissítése (multi-stage: node build + nginx serve)
- Alap routing: /login, /tickets, /tickets/:id