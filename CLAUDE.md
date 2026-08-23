# Support Portál

## Tech Stack
- Backend: ASP.NET Core (.NET 9), EF Core (MySQL/Pomelo), BCrypt, FluentValidation, NSwag/OpenAPI
- Frontend: Vite + React 19 + TypeScript + React Query + Zustand
- DB: MySQL 8
- Docker Compose: db, mailpit, minio (backend+frontend lokálisan fut)

## Architektúra
- Layered: Controller → Service → Repository
- Portal API (/api/portal/) — JWT Bearer auth
- Developer API (/api/v1/) — X-Api-Key auth (SHA-256 hash, nem BCrypt)

## Konvenciók
- FluentValidation minden endpointon, ProblemDetails (RFC 7807) hibáknál
- NSwag generálja a TS interfészeket — kézzel ne írj API típusokat
- Magyar hibaüzenetek, [ProducesResponseType] kötelező
- NE futtass docker compose build — WSL2 crash-t okoz

## Dev környezet
```bash
docker compose up -d db mailpit minio
cd backend/SupportPortal && dotnet run   # port 5000
cd frontend && npm run dev               # port 5173
```
- http://localhost:5173 | Mailpit: :8025 | MinIO: :9001 (minioadmin/minioadmin123)
- Login: admin@supportportal.dev / Admin1234!

## Fontos technikai döntések
- Mailpit-nek NINCS IMAP — EmailService a Mailpit HTTP API-t pollozza (ne változtasd)
- IEmailService.SendAsync → Task<string> (Message-ID visszaadva thread matchinghez)
- API kulcs: SHA-256 hash-elve, csak létrehozáskor látható egyszer
- AiService model: claude-sonnet-4-6
- MinIO: IFileStorageService absztrakción keresztül
- MergeAsync: üzenetek source_ticket_id-val kerülnek át a target ticketre
- user_preferences: ticketDetailView, ticketDetailSplitReversed, ticketPropertiesAutosave, ticketListView, emailSignature
- TipTap editor: @tiptap/react + starter-kit + link + underline, DOMPurify minden megjelenített HTML-en
- EF Core GroupBy bug (Pomelo): ToListAsync() + in-memory map, ne GroupBy().Select() SQL-ben

## Design tokenek
- /docs/Support Portal v2.dc.html — wireframe mockup
- --navy: #10162F | --primary: #4A6CF7 | --purple: #6D3FC7 (AI)
- shadow-pop: 4px 4px 0 0 #10162F | border-radius: 4px | Inter/Space Grotesk/JetBrains Mono

## Elvégzett lépések
1. Docker Compose stack
2. ASP.NET Core, EF Core entitások, migrációk, seed adatok
3. JWT auth, BCrypt, refresh token, remember me
4. Ticket CRUD API (status/assign/csm/merge)
5. React scaffold (Vite+TS+React Query+Zustand+NSwag)
6. Ticket lista + detail nézet
7. Email fogadás (Mailpit HTTP API polling, thread matching, outbound reply)
8. SSE értesítések + Login form
9. Beállítások menü (users/sla/email/notifications/tickets/integration/system)
10. ClickUp integráció (link CRUD, 30 perces background szinkron)
11. Developer API + MCP szerver (6 tool)
12. AI funkciók (summarize/suggest-reply/classify, graceful degradation)
13a. Backend: CSM entitás, dashboard widgets, user preferences táblák
13b. Frontend: CSM settings, dashboard, preferences, kártya nézet
14. CSM dropdown ticket detail-ben, custom field-ek (Text/Select/Boolean)
15. Classic/Split dual-view, TipTap rich text editor, CC/BCC
16. Ticket info blokk, canned response insert, link popover
17. Csatolmányok (MinIO), lezárás gomb, tevékenységnapló
18. Email aláírás, blockquote, email előnézet modal
19. Bejövő email csatolmányok, merge modal, kapcsolódó ticketek
20. Freshdesk-szerű merge (üzenet migráció, dual audit log, értesítés)
21. Merge UX (amber banner, disabled composer, source ticket elválasztó)
22. SLA visszaszámláló a ticket detail fejlécben (metaRow jobb oldalán, zöld/amber/piros badge)
23. Részletes kártya nézet (DetailedCard) + jobb oldali szűrőpanel, PATCH /tickets/{id}/priority
24. Idézett reply toggle (blockquote / "---" / "On...wrote:" parse, "···" gomb, grey expand), multi-sender RawEmailParts scaffold (longtext nullable, TicketMessageDto, frontend render logic kész, mindig null egyelőre)
25. Kontaktok és cégek — Company + Contact entitás, auto-upsert ticket létrehozáskor/email feldolgozáskor, REST API (/api/portal/contacts + /api/portal/companies), PATCH /tickets/{id}/contact, TicketDetailDto kibővítve, settings oldalak (/settings/contacts, /settings/companies), ticket lista céges szűrő, KONTAKT ADATOK panel a ticket detail sidebarban
26. Egyéni státuszok — TicketCustomStatus entitás (Key/Name/ColorVariant/IconKey/DisplayOrder/IsActive), migráció, CRUD API (/api/portal/settings/custom-statuses), PATCH /tickets/{id}/custom-status, 14 FA ikon + 7 szín, /settings/custom-statuses beállítások oldal, StatusBadge custom megjelenítéssel, DetailedCard status dropdown (beépített + egyéni státuszok), TicketDetailPage státusz select kibővítve, minden nézetben customStatusKey alapján badge
27. Soft-delete, lezártak elrejtése, inline property editing — IsDeleted flag (migráció, global query filter), DELETE /tickets/{id} endpoint, alapértelmezetten lezártak elrejtve (IncludeClosed query param), "Lezártak" toggle gomb a filter barban, inline státusz/prioritás/típus dropdownok minden nézetben (Táblázat, Kártyák, Részletes), törlés gomb minden sorban/kártyán és TicketDetailPage-en
28. SLA backend újraépítés — RestructureSla migráció (sla_policy_domains DROP, sla_policies újrastrukturálva: name+is_default+business_hours_only+updated_at), sla_policy_priorities (sla_policy_id, priority string, response/resolution_time_minutes), sla_policy_companies (sla_policy_id, company_id FK), ISlaService CRUD + FindPolicyForTicketAsync (email domain→company→policy, is_default fallback), ISlaCalculationService + SlaCalculationService (working hours logika kiszervezve), CRUD API (/api/portal/sla/policies GET/GET{id}/POST/PUT{id}/DELETE{id}), seed: "Master SLA" policy + 4 prioritás sor, NSwag újragenerálva

## MCP szerver
- /mcp/server.js | cd mcp && node server.js
- Env: SUPPORT_PORTAL_API_KEY, SUPPORT_PORTAL_BASE_URL=http://localhost:5000
- Claude Desktop config: /mcp/README.mdt

## Nyitott TODO
- [ ] README.md hiányzik
- [x] ~~SLA due date kalkuláció ticket létrehozáskor (SlaDueAt mindig null)~~ — MEGOLDVA: ISlaService.CalculateSlaDueAtAsync, munkaidős számítással, ticket létrehozáskor és email-feldolgozáskor is beállítva
- [ ] Bejövő email csatolmányok Mailpit part letöltése — TODO a kódban
- [ ] Notification bell SSE több userrel nem tesztelt
- [ ] MCP + AI valós API kulccsal nem tesztelt
- [ ] Dashboard drag-and-drop nincs (MVP: checkbox lista)
- [ ] Ticket #12, #13 + test CSM bent van dev DB-ben

## Holnap scope
- Email fejléc megjelenítés bejövő üzeneteknél
- Spam jelölés funkció
- Ticket felosztás (split)
- [x] ~~SLA visszaszámláló a fejlécen~~ — KÉSZ (22. lépés)
- [x] ~~Idézett reply toggle + RawEmailParts scaffold~~ — KÉSZ (24. lépés)
- [ ] Részletes kártya nézet vizuális ellenőrzése böngészőben (nincs Playwright)

## Később implementálandó
- Képbeszúrás inline, karakterszámláló, localStorage piszkozat, fullscreen, késleltetett küldés
- Dashboard TrendChart/RecentActivity (Developer API adatforrás kell)
- Email auto-routing, ünnepnapok kezelése, ClickUp webhook

## Előző feladat
Kontaktok és cégek — automatikus mentés, CRUD, ticket panel.

### Adatmodell (migráció)
companies: id, name, domain (nullable), created_at
contacts: id, email UNIQUE, name, company_id FK nullable, created_at, updated_at

### Backend

Automatikus kontakt létrehozás:
- TicketEmailProcessor.ProcessOneAsync: ha új ticket jön ismeretlen feladótól →
  upsert a contacts táblába (email alapján, ha már létezik nem írja felül)
- Ticket létrehozásnál (POST /api/portal/tickets) is: ha requester_email még nem szerepel → upsert
- Ha a kontakt email domainje egyezik egy company.domain-nel → automatikusan hozzárendeli

Contacts API (/api/portal/contacts):
- GET /contacts (lapozás, keresés név/email/cég szerint)
- GET /contacts/{id} (kontakt + cég + utolsó 10 ticket)
- POST /contacts
- PUT /contacts/{id}
- DELETE /contacts/{id} (soft: ha van ticketje, csak deaktiválás)

Companies API (/api/portal/companies):
- GET /companies (lapozás, keresés)
- GET /companies/{id} (cég + kontaktok listája + utolsó 10 ticket)
- POST /companies
- PUT /companies/{id}
- DELETE /companies/{id}

Ticket detail kiegészítés:
- GET /tickets/{id} válaszba: contactId, contactName, companyId, companyName
- PATCH /tickets/{id}/contact — manuális kontakt hozzárendelés ({ contactId })

[ProducesResponseType] + FluentValidation + magyar hibák mindenhol.
NSwag újragenerálás.

### Frontend — Beállítások

/settings/contacts oldal:
- Kontaktok táblázat (név, email, cég, létrehozva, műveletek)
- Szűrés: keresőmező, cég dropdown
- Hozzáadás/Szerkesztés modal (email, név, cég dropdown)
- Törlés gomb

/settings/companies oldal:
- Cégek táblázat (név, domain, kontaktok száma, műveletek)
- Hozzáadás/Szerkesztés modal (név, domain)
- Törlés gomb

Beállítások submenu kiegészítés:
- "Kontaktok" és "Cégek" menüpont (Admin+MasterAdmin)

### Frontend — Ticket lista szűrés

A meglévő filter bar-ba (táblázat és részletes nézet):
- Cég dropdown szűrő (GET /companies alapján)
- Kontakt keresés (email/név, GET /contacts?search=)

### Frontend — Ticket detail kontakt panel

Jobb oldalsávban új szekció "KONTAKT ADATOK" (a TICKET ADATOK alatt, összecsukható):
- Kontakt neve (kattintható → /settings/contacts/{id})
- Email cím
- Cég neve (ha van)
- "Korábbi jegyek" lista — az adott kontakt összes ticketje (GET /contacts/{id} alapján)
  Max 5 megjelenítve, "Összes megtekintése" link
- Ha nincs kontakt rendelve: "Ismeretlen kontakt" szöveg + "Hozzárendelés" gomb (PATCH /tickets/{id}/contact)

### Konvenciók
- NE futtass docker compose build
- NSwag újragenerálás szükséges
- Commit: "feat: contacts and companies - auto-save, CRUD, ticket panel"
- CLAUDE.md frissítése

## ## Következő feladat (23. lépés)
IMAP/SMTP email connector — Gmail és általános IMAP támogatás.

### Backend

Új implementáció: `ImapEmailService` (/Infrastructure/Services/ImapEmailService.cs)
- Implementálja az `IEmailService` interface-t (SendAsync + FetchNewAsync)
- NuGet: MailKit már telepítve van

FetchNewAsync:
- ImapClient → IMAP host:port (SSL), bejelentkezés user/pass-szal
- INBOX mappa, csak olvasatlan (Unseen) üzenetek
- Feldolgozás után: jelöld Seen-nek (SetFlags Seen)
- InboundEmail record visszaadása (From, Subject, Body, MessageId, InReplyTo, References)
- Ha csatlakozás sikertelen: loggolj és adj vissza üres listát (ne crashelj)

SendAsync:
- SmtpClient → SMTP host:port (TLS/SSL), bejelentkezés user/pass-szal
- MimeMessage összeállítás (From = a konfigurált support email cím)
- CC/BCC támogatás (már megvan a base implementációban, ugyanúgy)
- Message-ID visszaadása thread matchinghez

Konfiguráció (MailSettings kiterjesztése):
```json
{
  "Mail": {
    "Provider": "Mailpit",
    "SmtpHost": "localhost",
    "SmtpPort": 1025,
    "ImapHost": "localhost",
    "ImapPort": 1143,
    "Username": "",
    "Password": "",
    "FromAddress": "support@supportportal.dev",
    "UseSsl": false,
    "PollIntervalSeconds": 60
  }
}
```

Provider alapján DI factory:
- Ha Provider == "Mailpit" → MailpitEmailService (jelenlegi HTTP API alapú)
- Ha Provider == "Gmail" vagy "Imap" → ImapEmailService
- Program.cs-ben: switch a Mail:Provider értéke alapján

appsettings.Development.json maradjon Mailpit-es.
Új appsettings.Gmail.json.example fájl (nem commitolni valós adatokkal):
```json
{
  "Mail": {
    "Provider": "Gmail",
    "SmtpHost": "smtp.gmail.com",
    "SmtpPort": 587,
    "ImapHost": "imap.gmail.com",
    "ImapPort": 993,
    "Username": "support.teszt@gmail.com",
    "Password": "xxxx xxxx xxxx xxxx",
    "FromAddress": "support.teszt@gmail.com",
    "UseSsl": true
  }
}
```

### Frontend — Email konfiguráció beállítások oldal

A /settings/email oldal jelenleg read-only. Tedd szerkeszthetővé:
- Provider választó: Mailpit / Gmail+IMAP
- Ha Mailpit: SMTP host/port, Mailpit API URL (jelenlegi mezők)
- Ha Gmail/IMAP: SMTP host/port, IMAP host/port, Username, Password (masked), From address, SSL toggle
- "Kapcsolat tesztelése" gomb → GET /api/portal/settings/email/test
  Backend: próbál IMAP-on bejelentkezni → siker/hiba visszaadása
- "Mentés" gomb → PUT /api/portal/settings/email
  A konfig appsettings-be NEM írható vissza runtime-ban — a backend menti integration_settings táblába
  (ugyanúgy mint a ClickUp API kulcs, AES-256 titkosítva)
  Restart után az integration_settings-ből tölti be felül az appsettings értékeit

Backend: GET/PUT /api/portal/settings/email + GET /api/portal/settings/email/test
[ProducesResponseType] + FluentValidation + magyar hibák

### Konvenciók
- NE futtass docker compose build
- NSwag újragenerálás
- Commit: "feat: IMAP/SMTP email connector, Gmail support, email settings UI"
- CLAUDE.md frissítése