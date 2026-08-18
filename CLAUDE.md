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

## Elvégzett lépések
- 1. lépés KÉSZ: Docker Compose stack (MySQL, Mailpit, MinIO, Nginx placeholder)
- 2. lépés KÉSZ: ASP.NET Core projekt, EF Core entitások, migrációk, seed adatok
- 3. lépés KÉSZ: JWT auth, BCrypt, refresh token rotáció, remember me

## Seed adatok
- Admin user: admin@supportportal.dev / Admin1234!
- 5 teszt ticket különböző státuszokkal
- Master SLA policy (mind a 4 prioritáshoz)
- Munkaidő: H-P 8:00-17:00

## Következő feladat (4. lépés)
Ticket CRUD API a /api/portal/tickets/ útvonalon:
- GET /tickets — lista (szűrés státusz/prioritás/kategória szerint, lapozás)
- GET /tickets/{id} — részletek
- POST /tickets — létrehozás
- PUT /tickets/{id} — szerkesztés
- PATCH /tickets/{id}/status — státusz módosítás
- PATCH /tickets/{id}/assign — hozzárendelés
- PATCH /tickets/{id}/csm — CSM flag toggle
- POST /tickets/{id}/merge — merge ajánlat elfogadása