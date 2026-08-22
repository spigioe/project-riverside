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
- 13a. lépés KÉSZ: Backend + adatmodell — UX fejlesztések előkészítése (CSM, dashboard, preferences)
  - KIZÁRÓLAG backend — a "13a" jelzés szándékos: a terv "Settings kiegészítés: /settings/csm oldal"
    pontja NEM készült el, az a felhasználó explicit kérése szerint egy külön (13b, frontend) lépés lesz
  - Migráció: `UxImprovements` (20260819105949) — CsmManagers, CsmDomains, DashboardWidgets,
    UserPreferences táblák + Tickets.CsmId (nullable FK, SetNull on delete). Alkalmazva és tesztelve
    élő MySQL-en (dev DB-n), pontosan a terv szerinti oszlopokkal/constraintekkel
  - CsmManagers.Email UNIQUE — a tervben nem szerepelt explicit, de a "duplikált CSM email" hiba
    kezeléséhez szükséges volt (409 Conflict CreateCsmResult.EmailTaken/UpdateCsmResult.EmailTaken)
  - CsmDomains.EmailDomain NEM unique (sem globálisan, sem CSM-enként) — szándékosan, mert a terv
    kimondja, hogy több CSM is felelős lehet ugyanarra a domainre ("az első találat kerül beállításra")
  - ICsmService.FindCsmIdForEmailAsync: domain → CsmDomains egyezés, OrderBy(Id) ASC → első (legkorábban
    létrehozott) találat CsmId-ja. Ugyanez a metódus hívva mindkét helyen (lásd lent), nincs duplikált logika
  - DELETE /api/portal/csm/{id}: a terv "törlés (soft: csak ha nincs aktív ticket...)" szövegét ÚGY
    értelmeztem, hogy ez egy feltételes HARD delete, nem entity-szintű soft-delete — a csm_managers
    tábla tervezett oszlopai között (id, name, email, created_at) nincs is_active/deleted_at mező, tehát
    soft-delete flag fizikailag nem is lett volna hova tenni. "Aktív ticket" = Status New/Open/Pending
    (nem Resolved/Closed). Ha van ilyen → 409 DeleteCsmResult.HasActiveTickets
  - Automatikus CSM hozzárendelés MINDKÉT helyen bekötve és élesben tesztelve:
    - TicketService.CreateTicketAsync (POST /api/portal/tickets) — csm.FindCsmIdForEmailAsync(requesterEmail)
    - TicketEmailProcessor.ProcessOneAsync — csak ÚJ ticketnél (nem meglévő ticket új üzeneténél, ott
      nincs értelme, a ticket CsmId-ja már be van állítva vagy szándékosan üres)
    - Élő teszt: SMTP-n (Mailpit) küldött email mol.hu domainről → EmailPollingService felkapta →
      ticket CsmId helyesen kitöltve (DB-ben ellenőrizve)
  - Dashboard widgets default-listája (unresolved, overdue, open, unassigned) automatikusan mentésre
    kerül a DB-be az ELSŐ GET /widgets hívásnál (nem csak visszaadva) — pontosan a terv szerint,
    tesztelve: második GET hívás ugyanazokat az Id-kat adja vissza, nem generál újakat
  - PUT /api/portal/dashboard/widgets: replace-all (töröl mindent a userhez, majd újra beszúr) —
    FluentValidation ellenőrzi hogy a WidgetType-ok egyediek-e a request-en belül (a UNIQUE(user_id,
    widget_type) DB constraint helyett egy értelmezhető 400-as hibát ad vissza, nem nyers DB kivételt)
  - GET /api/portal/dashboard/stats: sla_compliance mezőhöz ÚJRAHASZNÁLVA a meglévő
    IAnalyticsService.GetSlaComplianceAsync-et (11. lépésből) — nincs duplikált SLA-számítási logika.
    unresolved = Status New/Open/Pending; overdue = SlaBreach==true; due_today = SlaDueAt ma van ÉS nem
    breach-elt ÉS nincs lezárva; unassigned = AssignedToId==null ÉS nincs merge-elve
  - GET /api/portal/me/preferences: ha nincs UserPreferences sor, default (true, Table) VISSZAADVA de
    NEM perzisztálva — a terv csak a dashboard widgeteknél írta elő az auto-persist-et explicit módon,
    a preferences-nél nem; a sor csak az első PUT-nál jön létre (upsert)
  - GET /api/portal/tickets kiegészítve: requesterCompany (RequesterEmail domain-je, memóriában
    számolva a lekérdezés után — egyszerű string-művelet, nincs értelme SQL-be tolni),
    lastMessageBody/lastMessageAt (korrelált subquery `t.Messages.OrderByDescending(...).FirstOrDefault()`
    — ez JÓL fordult le Pomelo-n, nem ütközött a 11. lépésben talált GroupBy-buggal, mert nincs GroupBy)
  - EF Core/Pomelo óvatosság (11. lépés tanulsága): a nested-collection-projection mintát (pl. CSM
    domain lista egy Select()-en belül `.Select(...).ToList()`-tal) NEM SQL-ben próbáltam megoldani —
    CsmService mindenhol előbb `.Include().ToListAsync()`-kal materializál, utána map-el DTO-vá
    memóriában (lásd CategoryService.GetTreeAsync is hasonlóan jár el, nem véletlen egyezés)
  - Minden új endpoint tesztelve curl-lel: CSM CRUD (siker+409 email ütközés+400 domain formátum+409
    aktív ticket miatt nem törölhető), dashboard widgets (default lista+replace-all+400 duplikált típus),
    dashboard stats, user preferences (default+update), ticket lista requesterCompany/lastMessage mezők
  - NEM készült el (explicit felhasználói kérésre, 13b lesz): /settings/csm frontend oldal, dashboard
    widget UI, user preferences UI, ticket lista card nézet ami a requesterCompany/lastMessage-t
    megjelenítené — a mezők megvannak a backend válaszban, de a frontend még nem használja őket
- 13b. lépés KÉSZ: Frontend — CSM, dashboard widgets, user preferences UI
  - Pontosan a 13a. lépés "NEM készült el" listájának 4 pontja + egy tudatos scope-bővítés (lásd lent)
  - /settings/csm oldal (SettingsCsmPage): CSM tábla (név, email, domain chip-ek), Hozzáadás/Szerkesztés
    modal, Törlés (confirm + 409 "aktív ticket miatt nem törölhető" hibaüzenet megjelenítve).
    Domainek beviteli mezője: egyetlen vesszővel elválasztott text input (nem dinamikus chip-input
    komponens) — a meglévő minta (pl. CreateApiKeyModal) sem használ ennél összetettebb widgetet,
    nem indokolt itt egyedi komponenst építeni
  - Új top-level route-ok (App.tsx, AppLayout Outlet alatt, NEM /settings alatt, mert nem admin-only):
    /dashboard, /preferences. Sidebar nav: "Dashboard" link a "Jegyek" elé; user dropdown: "Preferenciák"
    a "Kijelentkezés" fölé (AppLayout.module.css: .userDropdownItemNeutral — a meglévő .userDropdownItem
    pirosra van hardcode-olva a kijelentkezéshez, semleges színű variánsra volt szükség)
  - Dashboard widget UI (DashboardPage): FONTOS SCOPE-DÖNTÉS — a widget típusok közül csak 6 (Unresolved,
    Overdue, DueToday, Open, Unassigned, SlaCompliance) jelenik meg választhatóként/renderelhetőként.
    A TrendChart és RecentActivity NINCS bekötve, mert nincs hozzá Portal API adatforrás — a
    /api/v1/analytics/* endpointok (11. lépés) csak a Developer API-n, X-Api-Key authentikációval
    érhetők el, a JWT-s Portal frontend nem hívhatja őket. Ezt nem próbáltam megkerülni (pl. újra
    implementálni Portal oldalon), mert az explicit kérésen túlmutatna
  - Widget pozicionálás: EGYSZERŰ, egysoros, sorrend szerinti auto-pozíció (checkbox be/kikapcsolás →
    PositionX = index a bejelölt lista sorrendjében, PositionY=0, Width/Height=1 mindig) — NINCS
    drag-and-drop grid szerkesztő, bár a backend séma (PositionX/Y/Width/Height) ezt lehetővé tenné.
    MVP-döntés: a "widget UI" követelmény egy működő, konfigurálható nézetet jelent, nem feltétlenül
    egy teljes grid-builder-t; utóbbi jelentős többletmunka lenne, nyitva hagyva egy jövőbeli lépésnek
  - Preferences UI (PreferencesPage): TicketPropertiesAutosave checkbox + TicketListView select, mentés
    gombbal (PUT /me/preferences). React state derived-during-render mintával épült (nincs useEffect a
    kezdeti szinkronizáláshoz) — az oxlint react(set-state-in-effect) warningja miatt, amit egy korábbi,
    effect-alapú verzió generált; a végleges megoldás draft state-et null-ról indít és a lekérdezett
    adatra esik vissza amíg a user nem érint egy mezőt sem
  - A két preferencia TÉNYLEGESEN be van kötve, nem csak elmenthető/megjeleníthető:
    - ticketListView: a TicketsPage a preferenciából inicializálja az induló nézetet (táblázat/kártya),
      a user a nézetváltó gombokkal a munkamenetben szabadon módosíthatja, de csak a Preferenciák oldalon
      keresztüli mentés perzisztálja — a TicketsPage-en való váltás NEM ír vissza automatikusan a
      preferenciákba (szándékos: elkerüli a meglepetésszerű "minden kattintás ment" viselkedést)
    - ticketPropertiesAutosave: EZ SZÁNDÉKOS SCOPE-BŐVÍTÉS a 4 listázott ponton túl — ha kikapcsolva,
      a TicketDetailPage "Tulajdonságok" panelén a Felelős/Státusz mezők nem mentenek azonnal
      onChange-kor, hanem draft állapotba kerülnek, "Mentés" gomb jelenik meg (csak akkor aktív, ha
      tényleg változott valami), és csak a ténylegesen módosult mező(ke)t küldi el (assign/status külön
      endpoint, csak azt hívja ami eltér az eredetitől). Indoklás: egy preferencia, aminek sehol nincs
      tényleges hatása, hiányos deliverable lenne — a mező neve ("ticket_properties_autosave") egyértelmű
      szándékot fejez ki. A CSM jelölés toggle gomb TUDATOSAN NINCS ennek alávetve — egy single-click
      boolean toggle-nél nincs értelme "staged" módnak, azonnali marad autosave állapottól függetlenül
  - Ticket lista kártya nézet (TicketsPage): requesterCompany + lastMessageBody/lastMessageAt
    megjelenítve kártyánként (subject 2 sorra clamp-elve, utolsó üzenet 140 karakterre vágva). A
    táblázat nézet változatlan, a kártya nézet egy teljesen külön render ág, nem közös komponens —
    elég egyszerű minta ahhoz, hogy a duplikáció ne érje meg az absztrakciót
  - NEM érintett (explicit kívül esik a 13b hatókörén, külön TODO tétel marad): ticket properties panel
    CSM megjelenítés/kézi felülírás — a TicketDetailDto (backend) jelenleg nem tartalmazza a CsmId/CsmName
    mezőket, ennek hozzáadása backend-változás lenne, ami túlmutat egy "csak frontend" lépésen
  - Tesztelve: `tsc -b` és `npm run build` tiszta (production build is), `oxlint` az érintett fájlokon
    tiszta (0 új warning — a 2 meglévő react(set-state-in-effect) warning a SettingsSlaPage/
    SettingsNotificationsPage-ben előzőleg is megvolt, nem ehhez a lépéshez tartozik). Minden új frontend
    oldal által hívott endpoint curl-lel újra ellenőrizve élő adaton (CSM lista, dashboard widgets/stats,
    preferences, ticket lista requesterCompany/lastMessage mezők) — a válasz alakja pontosan egyezik
    azzal, amit a frontend kód vár. BÖNGÉSZŐS vizuális/interakciós tesztelés NEM történt — nincs
    böngésző-automatizálási eszköz elérhető ebben a környezetben, ezt a felhasználónak kézzel kell
    ellenőriznie
  - Dev DB takarítás: a 13a. lépés teszteléséből visszamaradt user preferences (autosave=false,
    listView=Card) és dashboard widgets (SlaCompliance+TrendChart) VISSZAÁLLÍTVA alapértelmezettre
    (autosave=true, listView=Table; widgets=Unresolved/Overdue/Open/Unassigned), hogy tiszta állapotból
    induljon a manuális tesztelés
- 14. lépés KÉSZ: CSM dropdown a ticket properties panelben + custom field-ek (backend + settings UI +
  ticket detail UI)
  - Backend, CSM assign: `TicketDetailDto` kiegészítve `CsmId`/`CsmName`-mel (a korábban a 13b TODO
    listáján hagyott hiányosság). `PATCH /api/portal/tickets/{id}/csm-assign` (`CsmAssignRequest{ CsmId }`)
    — `TicketService.AssignCsmAsync`: 404 ha a ticket nem létezik, 400 `CsmNotFound` ha a megadott CsmId
    nem szerepel a `csm_managers` táblában (nem FluentValidation-ban, mert DB-lookup kell hozzá — ugyanaz
    a minta, mint a `TicketMergeResult`/`TicketAssignResult` service-szintű enumoknál)
  - Backend, custom field-ek: `CustomFieldDefinitionsController` (`/api/portal/custom-fields/definitions`,
    CRUD, Admin+MasterAdmin a mutáló endpointokon) + `TicketCustomFieldsController`
    (`/api/portal/tickets/{id}/custom-fields`, GET+PUT). `CustomFieldService`:
    - `FieldKey` auto-generálás a névből (ékezet-eltávolítás + slugify, pl. "Súlyosság" → "sulyossag"),
      ütközésnél `-2`, `-3`, … suffix; explicit megadott `FieldKey`-nél 409 helyett 409 `FieldKeyTaken`
      (ütközés esetén)
    - `CustomFieldValue` entitás EntityType/EntityId polimorf kulcspárt használ (jelenleg mindig
      "ticket"+TicketId) — ezt használtuk lookup kulcsként, NEM a `CustomFieldValue.TicketId` shadow FK-t
      (ami a kezdeti migrációból megmaradt, nem ehhez a relációhoz tervezve) — lásd kommentet a
      `CustomFieldService.cs` tetején
    - `UpdateValuesAsync`: batch upsert, üres/null érték → törli a sort (nincs "üres string" mint állapot
      a DB-ben); Select típusnál a service ellenőrzi, hogy az érték szerepel-e az `Options` listában (400
      `InvalidOptionValue` ha nem)
    - `CustomFieldType` enum már eleve tartalmazott `Number`/`Date` értéket is a `Text/Boolean/Select`
      mellett (a terv csak ez utóbbi hármat kérte a UI-hoz) — a create/edit modal típusválasztója
      szándékosan csak a három kért típust kínálja fel, de a tábla/renderelés minden enum-értékre felkészült
      (label van rá), ha valaha DB-ből mégis bekerülne Number/Date
  - Developer API (`GET /api/v1/tickets/{id}`): `TicketDetailWithRelationsDto` kiegészítve
    `CustomFields: CustomFieldSummaryDto[]`-vel (fieldKey/name/fieldType/value — redukált alak, nincs
    benne definitionId/options, AI-nak átadható formátum a terv szerint)
  - NSwag újragenerálva (`nswag run nswag.json`, a helyi `dotnet run`-nal futó backend swagger.json-jából) —
    `generated-client.ts` tartalmazza az összes új típust/klienst, bekötve `api/index.ts`-be
    (`customFieldDefinitionsClient`, `ticketCustomFieldsClient`)
  - Frontend, ticket detail: a "CSM jelölés" toggle MELLÉ (nem helyett) került egy "CSM felelős" dropdown
    a Tulajdonságok panelben, ugyanazt az autosave/draft mintát követve, mint a Felelős/Státusz mezők
    (`draftCsmId`, `ticketClient.assignCsm`). Az "Egyéni mezők" panel a `GetValues` válasz alapján
    típus szerint renderel (Text→input, Select→select, Boolean→a meglévő toggle komponens újrafelhasználva).
    Az egyéni mező értékek EGY közös local state-ben (`customFieldValues`) élnek autosave alatt IS — nem
    csak draft módban —, mert különben gépelés közben az input "visszaugrana" a debounce-olt PUT
    válaszára várva; autosave=true esetén mezőnkénti 500ms debounce (`setTimeout` per `definitionId`,
    `customFieldTimers` ref-ben tárolva) küld PUT-ot, autosave=false esetén a meglévő "Mentés" gombhoz
    csatlakozik (a `savePropertiesMutation` most a CSM-et és a ténylegesen megváltozott egyéni mezőket is
    elküldi, csak azt ami eltér a szerver állapottól) — a "Mentés" gomb MEGJELENIK az Egyéni mezők panelen
    is (nem csak a Tulajdonságok panelen), hogy egyértelmű legyen, hogy onnan is menthető, bár ugyanazt a
    mutation-t hívja
  - Frontend, `/settings/tickets`: új "Egyéni mezők" szekció a Kategóriák és Válaszsablonok alatt,
    ugyanazt a tábla+modal mintát követve, mint a `/settings/csm` oldal — lista (név, típus badge,
    kötelező, sorrend, műveletek) + "+ Új mező" modal (típus szerint feltételesen megjelenő opciók input)
    + "Deaktiválás" gomb (a DELETE endpoint soft-delete-et csinál: `IsActive=false`, a definíció NEM tűnik
    el a DB-ből, csak a listákból)
  - Tesztelve curl-lel élő adaton: custom field definition CRUD (Text+Select létrehozás, GET lista,
    UTF-8 ékezetes slug), ticket custom-fields GET (üres érték=null) + PUT (siker + 400 invalid Select
    opció), csm-assign PATCH (siker + 404 nemlétező ticket + 400 nemlétező CsmId), GET ticket válaszban
    csmId/csmName jelen van. Minden teszt adat (2 teszt custom field definition, ticket #1 csm-assign)
    utólag visszaállítva/deaktiválva, tiszta állapotból indulhat a böngészős tesztelés. A Developer API
    v1 `customFields` mezőt NEM teszteltem curl-lel — nem volt elérhető plaintext Developer API kulcs
    ebben a környezetben (a kulcs SHA-256 hash-elve tárolódik, csak létrehozáskor látható egyszer a
    Settings/Integration oldalon) — csak kód-review-val ellenőriztem
  - `tsc -b` és `npm run build` tiszta, `oxlint` az érintett fájlokon (`TicketDetailPage.tsx`,
    `SettingsTicketsPage.tsx`, `api/index.ts`) 0 warning
  - BÖNGÉSZŐS vizuális/interakciós tesztelés NEM történt ehhez a lépéshez sem — nincs
    böngésző-automatizálási eszköz ebben a környezetben (ld. TODO lista)
- 15. lépés KÉSZ: Ticket detail nézet átalakítás — Classic/Split nézet, TipTap rich text editor, CC/BCC
  - Migráció: `AddTicketDetailViewAndMessageCcBcc` — `UserPreferences.TicketDetailView` (enum,
    string-konverzió, default Classic) + `TicketDetailSplitReversed` (bool) + `TicketMessages.Cc`/`Bcc`
    (nullable string). MySQL/Pomelo figyelmeztetést adott, hogy longtext oszlopon nem támogat konstans
    DEFAULT-ot — a meglévő (dev DB-ben lévő) sorok emiatt üres stringet kaptak volna a
    `TicketDetailView`-ra, ami érvénytelen lett volna az enum string-konverziónak; a migráció Up()-ja
    ezért explicit `UPDATE ... SET TicketDetailView = 'Classic' WHERE ... = '' OR IS NULL` sorral zárul
    — ez élesben (üres tábla esetén) no-op, csak a jelen dev DB-hez volt szükséges biztonsági háló
  - Backend, `POST /tickets/{id}/messages`: `CreateTicketMessageRequest` kiegészítve `Cc`/`Bcc`
    (nullable string, vesszővel elválasztott lista) mezőkkel. `CreateTicketMessageRequestValidator`:
    `[GeneratedRegex]`-alapú email-lista validáció (`.Must(BeAValidEmailList)`, csak ha nem üres) —
    nem `.EmailAddress()`-t használ, mert az egyetlen címre vonatkozik, itt vesszővel tagolt listát kell
    ellenőrizni. `IEmailService.SendAsync` kiegészítve opcionális `cc`/`bcc` paraméterrel,
    `EmailService`: `MimeMessage.Cc`/`Bcc` feltöltve (`AddAddresses` helper, vesszőnként `MailboxAddress.Parse`)
  - Backend, email body formátum ELTÉRÉS: mivel a válasz composer mostantól TipTap-ból HTML-t ad, az
    `EmailService.SendAsync` a body-t `TextPart("html")`-ként küldi ki (korábban `"plain"` volt) — ez a
    teljes kimenő email tartalmára vonatkozik, nem csak az új mezőkre, de a terv nem tért ki rá explicit
    módon, logikus következménye a rich text editor bevezetésének
  - Backend, `TicketMessageDto` kiegészítve `Cc`/`Bcc`-vel — `TicketService.GetMessagesAsync` és
    `AddMessageAsync` mindkét select-je frissítve
  - Frontend: `@tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-underline`
    telepítve (pontosan a kért csomaglista) + `dompurify`/`@types/dompurify` (ÚJ, a terven felül) — a
    beérkező (email eredetű) üzenetek body-ja tetszőleges külső HTML lehet (`EmailService.FetchNewAsync`
    a `detail.HTML`-t is felhasználja fallbackként), sanitálás nélkül XSS-t engedne be a
    `dangerouslySetInnerHTML`-lel renderelt buborékokba — a terv "sanitálva!" felkiáltása miatt ez
    kötelező függőségnek számított, nem választásnak
  - `components/RichTextEditor/RichTextEditor.tsx`: toolbar Bold|Italic|Underline|Bullet lista|Számozott
    lista|Link|elválasztó|Sablon gomb|Törlés gomb (pontosan a terv szerinti sorrend/tartalom). Link
    beszúrás `window.prompt`-tal (a projektben már használt egyszerű böngésző-dialógus minta, pl.
    `confirm()` a törlés megerősítéseknél — nem indokolt emiatt egyedi modal). Placeholder szöveg NEM a
    `@tiptap/extension-placeholder` csomaggal (az nem szerepelt a kért telepítési listában), hanem egy
    saját, `editor.isEmpty` állapot alapján feltételesen renderelt, abszolút pozicionált overlay div-vel
    — így nem került be extra függőség a terven felül. `content` prop külső (canned response, AI
    javaslat, Törlés) frissítése `editor.commands.setContent(..., { emitUpdate: false })`-dal
    szinkronizálva, csak ha ténylegesen eltér az aktuális `editor.getHTML()`-től (ne írja felül gépelés
    közben)
  - `lib/sanitizeHtml.ts` (DOMPurify wrapper) + `components/SafeHtml/SafeHtml.tsx` (memoizált sanitált
    HTML render) — minden üzenet body ezen keresztül jelenik meg, mind a Classic, mind a Split nézetben
  - `lib/htmlText.ts`: `plainTextToHtml` (soronként `<p>` — a canned response body és az AI válasz
    javaslat plain textként jön a backendtől, ezt kell a TipTap editorba tölteni sortörés-megtartással)
    + `isHtmlEmpty` (a Küldés gomb enabled állapotához, mivel a body immár HTML string, nem plain text)
  - `pages/TicketDetail/ReplyComposer.tsx`: Válasz/Belső jegyzet tab (változatlan minta), Címzett mező
    (ticket.requesterEmail, **readOnly**, nem szerkeszthető) + összecsukható CC/BCC (alapból csak a
    Címzett látszik, "+ CC / BCC" gombra nyílik ki) — csak Válasz módban jelenik meg (Belső jegyzetnél
    nincs email küldés). SCOPE-DÖNTÉS: a terv "Címzett... felülírható (input mező)" pontját NEM
    implementáltam szerkeszthetőként, mert a backend `POST /messages` explicit mező-listája (terv
    "Backend módosítások" szekció) KIZÁRÓLAG `cc`/`bcc`-t sorol fel, "to" mezőt nem — a tényleges
    email címzett a `TicketService.SendReplyEmailAsync`-ben továbbra is mindig `ticket.RequesterEmail`.
    Egy szerkeszthető, de a szerver által csendben figyelmen kívül hagyott mező megtévesztő UX lett
    volna, ezért inkább read-only-vá tettem és itt dokumentálom az eltérést, mint hogy hamis
    funkcionalitást mutassak
  - `pages/TicketDetail/MessageThread.tsx`: közös `MessageBubble` komponens `detailed` prop-pal — Classic
    nézetben `detailed=false` (a "jelenlegi buborék stílus" megtartva: avatar, név, idő, Belső badge,
    sanitált HTML body), Split nézetben `detailed=true` (pluszban: irány ikon ↑/↓, feladó email,
    Kimenőnél "Címzett:" sor, CC/BCC esetén összecsukható "Részletek" gomb) — a terv ezt a plusz
    fejléc-infót kifejezetten csak a Split nézethez írta elő
  - Split nézet: `styles.splitLayout` (CSS grid, 1fr 1fr, 1200px alatt 1 oszlopra esik vissza) — bal
    panelben `MessageThread detailed`, jobb panelben `ReplyComposer`, a sorrendet a
    `ticketDetailSplitReversed` preferencia dönti el ("⇄ Csere" gomb). Húzható elválasztó (resizable)
    NEM készült el — a terv ezt explicit opcionálisnak jelölte ("ha komplex: fix 50/50 arány is
    elfogadható"), fix 1fr/1fr grid arányt implementáltam
  - Nézet váltó + Csere gomb a ticket cím sorában jobb oldalt (`styles.titleRow`/`viewToggleRow`) — mindkettő
    közvetlenül a `PUT /me/preferences`-t hívja (teljes preferencia objektum, a nem érintett mezők a
    lekérdezett aktuális értékről), a query cache-t `setQueryData`-val frissítve — nincs külön "Mentés"
    gomb, minden kattintás azonnal perzisztál (ez eltér a `ticketPropertiesAutosave` draft mintától, de
    a terv itt nem írt elő draft/mentés flow-t a nézetváltáshoz, egy kétállapotú toggle-nél nem is
    indokolt)
  - NSwag újragenerálva (a backend dev szerver újraindítva, hogy a `dotnet build` utáni NSwag lépés friss
    swagger.json-t lásson — a `GenerateApiClient` MSBuild target `http://localhost:5000`-ről húzza a
    sémát, HA a szerver fut; ha nem, csak figyelmeztet és kihagyja, nem töri el a buildet)
  - Tesztelve curl-lel élő adaton: `GET`/`PUT /me/preferences` (`ticketDetailView`/
    `ticketDetailSplitReversed` mezők), `POST /tickets/1/messages` HTML body + CC + BCC-vel (siker,
    201, majd törölve) + érvénytelen CC-vel (400), a kimenő email Mailpit HTTP API-n keresztül
    ellenőrizve hogy a CC/BCC ténylegesen bekerült a MIME fejlécekbe. Teszt adatok (üzenet #19,
    preferencia módosítások) utólag visszaállítva/törölve
  - `tsc -b`, `npm run build` (production) és `oxlint` tiszta — 0 új warning (a 2 meglévő
    `react(set-state-in-effect)` figyelmeztetés a Settings oldalakon változatlan, nem ehhez a lépéshez
    tartozik)
  - BÖNGÉSZŐS vizuális/interakciós tesztelés NEM történt ehhez a lépéshez sem (nincs
    böngésző-automatizálási eszköz ebben a környezetben) — a `vite dev` szerver élő fájljait curl-lel
    ellenőriztem (mind a négy új fájl hiba nélkül transform-ál), de a tényleges editor-interakció
    (formázás, link beszúrás, canned response betöltés, split nézet swap, resize) manuális kipróbálást
    igényel
- 16. lépés KÉSZ: Rich text editor és ticket detail layout finomítás (kizárólag frontend, NSwag
  változatlan)
  - `pages/TicketDetail/TicketInfoPanel.tsx` (ÚJ): kompakt, label:érték-páros ticket info blokk
    (`--bg-alt` háttér, `--border-light` keret) — badge sor (Státusz/Prioritás/Kategória), majd
    Azonosító/Tárgy/Forrás/Létrehozva/Kérelmező/Email/Cég/CSM felelős sorok, végül a kitöltött custom
    field-ek. `collapsible` prop (opcionális, alapból nyitva) — Classic nézetben `true`, Split nézetben
    `false` (ott a panel eleve csak akkor látszik, ha a felhasználó lefelé görget, nincs értelme
    összecsukni). A "cég" mezőt NEM a backendből kapja (a `TicketDetailDto`-n nincs `requesterCompany`,
    az csak a lista DTO-n van a 13a. lépésből) — a frontend maga vágja le a domain-t
    `requesterEmail`-ből (`lib/format.ts` `getRequesterCompany`), ugyanazt az egyszerű string-műveletet
    ismételve, amit a backend a lista végponton csinál; NEM indokolt emiatt backend-mezőt bővíteni egy
    tisztán frontend lépésben
  - Split nézet: a jobb (composer) panel most `composer` + `TicketInfoPanel` egymás alatt
    (`styles.splitInfoPanel`: `max-height: 260px; overflow-y: auto`). A composer TipTap editorja
    magasabb lett Split nézetben — `RichTextEditor` új `minHeight` prop-ja egy `--editor-min-height`
    CSS custom property-t állít be inline style-lal (Split: 300px, Classic: a meglévő 88px marad,
    nincs prop átadva)
  - Classic nézet: `TicketInfoPanel` (`collapsible=true`) a jobb oldalsáv TETEJÉN, a "Tulajdonságok"
    kártya FELETT, alapból nyitva (helyi `useState`, nincs perzisztálva — a terv nem írta elő, hogy a
    nyitott/zárt állapot megmaradjon nézetváltás/újratöltés között)
  - Canned response beszúrás: `RichTextEditor` `forwardRef`-fel `RichTextEditorHandle`-t exponál
    (`insertContent(html)`, ami `editor.chain().focus().insertContent(html).run()`-t hív). A
    `ReplyComposer` a canned response kiválasztásakor ezt hívja `onBodyChange(plainTextToHtml(...))`
    helyett — kurzor pozícióra szúr be, nem ír felül. Az "üres editornál a teljes tartalom betöltődik"
    elvárás KÜLÖN ESETKEZELÉS NÉLKÜL teljesül: TipTap-ban `insertContent` egy üres editorban a (0.
    pozíciójú) kurzorhoz szúr be, ami gyakorlatilag megegyezik a teljes tartalom betöltésével — nem
    kellett `editor.isEmpty` alapján elágazni
  - Link popover: a `Link` gomb már nem `window.prompt()`-ot hív, hanem egy saját `LinkPopover`
    komponenst nyit meg (`RichTextEditor.tsx`-en belül, nem külön fájlban — elég kicsi ahhoz, hogy ne
    érje meg szétszedni), a gomb alatt abszolút pozicionálva (`styles.linkButtonWrapper` position:relative
    wrapper). URL input + Alkalmaz/Mégse gomb, `--navy` keret + `--shadow-pop-sm` (a tervben szereplő
    "--border" token NEM létezik a CSS token rendszerben, `--border-light`/`--navy` van — a toolbar
    gombok mintáját követve `--navy`-t használtam, konzisztensen a többi toolbar elemmel). Escape és
    külső kattintás zár (`document` szintű `mousedown`/`keydown` listener, csak amíg a popover nyitva
    van). Kijelölt szöveg esetén a meglévő `setLink` logika fut (a kijelölt szöveg marad a link szövege);
    üres kijelölésnél ÚJ ág: `insertContent`-tel egy `<a href="...">URL</a>` HTML-t szúr be, mert a
    TipTap `setLink` collapsed selection esetén nem hoz létre látható szöveget, csak egy "stored mark"-ot
    a következő gépeléshez — ez a tervben elvárt "az URL maga lesz a megjelenített szöveg" viselkedést
    közvetlenül nem adta volna. Üres URL-lel "Alkalmaz" = unlink (a korábbi `window.prompt`-os
    változat is így kezelte az üres inputot, megtartva ezt a viselkedést)
  - `tsc -b`, `npm run build` (production) és `oxlint` (`TicketDetailPage.tsx`, `ReplyComposer.tsx`,
    `TicketInfoPanel.tsx`, `MessageThread.tsx`, `RichTextEditor.tsx`, `lib/format.ts`) tiszta — 0
    warning
  - BÖNGÉSZŐS vizuális/interakciós tesztelés NEM történt ehhez a lépéshez sem (nincs
    böngésző-automatizálási eszköz ebben a környezetben) — a `vite dev` élő fájljait curl-lel
    ellenőriztem (mind a négy érintett/új fájl hiba nélkül transform-ál), de a tényleges viselkedés
    (info panel elrendezés Split/Classic nézetben, összecsukás, canned response tényleges kurzor-pozíció
    beszúrás, link popover pozicionálása/Escape/külső kattintás) manuális kipróbálást igényel
- 17. lépés KÉSZ: Csatolmányok, Lezárás gomb, tevékenységnapló
  - Csatolmányok, backend: A terv "FileStorage + TicketAttachment entitások már megvannak" állítása
    RÉSZBEN téves volt — a `FileStorage` entitás MÁR TARTALMAZ egy `MessageId` FK-t
    `TicketMessage`-re (`TicketMessage.Attachments` nav property is megvolt rá), tehát ez MAGA az
    attachment-tábla, külön `TicketAttachment` entitás nem létezett és nem is kellett (a
    `file_storage`/`ticket_attachments` a tervben csak fogalmi leírás volt, nem szó szerinti
    táblanév — a tényleges táblanevek PascalCase-ek, `FileStorages`). `IFileStorageService`
    ("az absztrakció már megvan" — ez SEM volt igaz, nem létezett) + `MinioFileStorageService` ÚJ:
    `EnsureBucketExistsAsync`/`UploadAsync`/`DownloadAsync`, `Minio` NuGet (7.0.0, már a csproj-ban
    volt, csak nem volt bekötve) `IMinioClient`-tel (`AddMinio` DI extension). A pontos SDK API-t
    (`PutObjectArgs`/`GetObjectArgs` fluent builder alak) egy ideiglenes próba-konzolprojekttel
    ellenőriztem élő MinIO ellen (reflection + tényleges upload/download roundtrip), mert a
    csomag verziója (7.0.0) újabb, mint amit dokumentációból biztosan ismertem
  - `MinioSettings` (`Application/DTOs/MinioSettings.cs`) + `appsettings.Development.json` "Minio"
    szekció (Endpoint=localhost:9000, a `.env` MINIO_ROOT_USER/PASSWORD/BUCKET értékeivel) — a
    docker-compose a `backend` konténernek env var-ként adja át ugyanezt, de a backend lokálisan fut
    (`dotnet run`), így az appsettings-nek is tartalmaznia kellett. Bucket létrehozás
    (`EnsureBucketExistsAsync`) a Development induláskor (a migráció+seed blokk mellett)
  - `POST /tickets/{id}/messages` mostantól KIZÁRÓLAG multipart/form-data-t fogad (nem JSON) —
    `CreateTicketMessageFormRequest` (`[FromForm]`, `List<IFormFile>? Attachments`). SZÁNDÉKOS
    ELTÉRÉS a terv "a meglévő JSON body mellé fájl feltöltés" megfogalmazásától: ASP.NET Core-ban
    egy action nem tud egyszerre `[FromBody]` JSON-t ÉS `[FromForm]` fájlokat fogadni ugyanabból a
    body-ból, a form mezők (Body/Cc/Bcc/IsInternalNote) simán megfelelnek a JSON mezőknek — a
    Developer API-s `POST /api/v1/tickets/{id}/messages` VÁLTOZATLANUL JSON-t fogad
    (`CreateTicketMessageRequest`), ott nincs fájlfeltöltés-igény, a két endpoint mostantól két
    külön DTO-t használ ugyanarra a service-metódusra (`ITicketService.AddMessageAsync` kapott egy
    opcionális `IReadOnlyList<IFormFile>? attachments = null` paramétert, defaulttal, hogy a V1
    controller hívása ne törjön)
  - Validáció (`CreateTicketMessageFormRequestValidator`): max 5 fájl, max 10MB/fájl, engedélyezett
    kiterjesztések (pdf/doc/docx/xls/xlsx/png/jpg/jpeg/gif/txt/zip) — `RuleForEach` + `ChildRules`
  - `GET /tickets/{id}/attachments` + `GET /attachments/{id}/download` — ÚJ `TicketAttachmentsController`
    (`api/portal` route, mert a download endpoint NEM ticket-scoped). `IAttachmentService`/
    `AttachmentService`: a letöltés a backendEN KERESZTÜL streamel (nem presigned MinIO URL) —
    így a JWT auth természetesen érvényesül rajta, nincs extra CORS/publikus MinIO endpoint
    kockázat. NSwag ezt automatikusan `Promise<FileResponse>`-ra generálta (`{ data: Blob, fileName,
    status }`), ehhez nem kellett kézzel semmit írni
  - NSwag/Axios ismert inkompatibilitás: a generált `download()` kód `new Blob([...], { type:
    response.headers["content-type"] })`-öt ír, de az axios `AxiosHeaderValue` típusa (null-t is
    tartalmazó unió) nem fér bele a natív `BlobPropertyBag.type: string`-be — ez MINDIG típushibás
    lenne `tsc` alatt, FÜGGETLENÜL attól, hogy mit csinálunk, mert a `generated-client.ts` minden
    backend build-nél újragenerálódik (kézzel nem javítható tartósan). Megpróbáltam egy globális
    `BlobPropertyBag` deklaráció-merge-dzsel bővíteni a típust — ez NEM MŰKÖDÖTT (TS
    "Subsequent property declarations must have the same type" hibát ad, a merge nem enged
    típus-bővítést egy már létező property-n, még `any`-vel sem). VÉGSŐ MEGOLDÁS: egy `sed`
    utófeldolgozó lépés a `SupportPortal.csproj` `GenerateApiClient` MSBuild targetjében, közvetlenül
    az `nswag run` után — `as string | undefined` cast-ot fűz a sorhoz minden regenerálás után.
    Tesztelve: `dotnet build` → a sor ténylegesen patch-elve → `tsc -b` tiszta
  - Csatolmányok, frontend: `RichTextEditor` toolbar ÚJ opcionális `onAttachClick` prop (📎 gomb, a
    "Sablon" gomb mellett — a terv "a toolbar-ban" kérte, nem a composer láblécében).
    `ReplyComposer`: rejtett `<input type="file" multiple>` + kiválasztott fájlok chip-lista
    (fájlnév+méret+X törlés gomb) + kliens oldali validáció (max 5 fájl, max 10MB/fájl, hibaüzenet
    inline). Az `attachments: File[]` állapot a `TicketDetailPage`-ben él (ugyanaz a lifting minta,
    mint `replyBody`/`cc`/`bcc`), küldéskor `ticketClient.addMessage(id, body, isInternalNote, cc,
    bcc, attachments.map(f => ({ data: f, fileName: f.name })))` — az NSwag-generált szignatúra
    pozicionális paraméterekre vált (nem egy request-objektumra), mert a backend action mostantól
    `[FromForm]`
  - `MessageThread`/`MessageBubble`: ÚJ `attachments: AttachmentDto[]` prop (a `TicketDetailPage`
    egyetlen `GET /tickets/{id}/attachments` hívással tölti be MIND az összeset, a `MessageBubble`
    `messageId` szerint szűri) — típus szerinti ikon (🖼️/📄/📦/📝/📊/📃/📎), fájlnév, méret, kattintásra
    letöltés (`ticketAttachmentsClient.download` → Blob → ideiglenes `<a download>` link, mert a
    böngésző natív letöltés-linkje nem tudna JWT Authorization headert küldeni). Kép típusoknál
    (`image/*`) inline thumbnail: a kép TARTALMÁT is a hitelesített `download()` hívással tölti be
    (`useEffect` + object URL + cleanup-kori `revokeObjectURL`), NEM sima `<img src={downloadUrl}>`-jal
    — utóbbi nem küldene Authorization headert, 401-et kapna
  - Lezárás gomb: a `titleRow`-ban, a Classic/Split váltó ELŐTT — csak akkor látszik, ha a
    `ticket.status` nem Closed és nem Resolved. A MEGLÉVŐ `statusMutation`-t hívja (nincs külön
    mutation), `confirm()` dialógus (a projekt már meglévő mintája, pl. ClickUp link törlésnél) —
    `shared.secondaryButton` stílus (a terv "secondary gomb, --border keret" kérése szerint; a
    `--border` token NEM létezik, `--border-light` van, a `.secondaryButton` már ezt használja)
  - Tevékenységnapló, backend: `IAuditLogService` KIEGÉSZÍTVE egy `LogAsync` write metódussal — ez
    ELŐTTE NEM LÉTEZETT (a service KIZÁRÓLAG a `/settings/system` audit log OLVASÁSÁT szolgálta ki,
    semmi nem írt bele — a terv "valószínűleg nincs bekötve" gyanúja helytálló volt, ténylegesen
    SEMMI nem volt bekötve). Bekötve: `TicketService` (created, status_changed, assigned,
    csm_flagged, csm_assigned, priority_changed, category_changed, message_sent — ez utóbbihoz
    `AddMessageAsync` mostantól minden híváskor logol), `CustomFieldService.UpdateValuesAsync`
    (custom_field_changed, mezőnként, CSAK a ténylegesen változott mezőkre), `ClickUpLinkService`
    (clickup_link_added/clickup_link_removed). Ehhez több service-metódus szignatúrája bővült egy
    `currentUserId int` paraméterrel (`AssignCsmAsync`, `UpdateTicketAsync`,
    `CustomFieldService.UpdateValuesAsync`, `ClickUpLinkService.DeleteLinkAsync`) — a hívó
    controllerekben ez már elérhető volt `User.GetUserId()`-vel, csak eddig nem lett átadva
  - "Ticket lezárva (closed)" a tervben KÜLÖN felsorolt pont — ÖSSZEVONVA a `status_changed`
    action-nel (nem külön "closed" action), mert a Lezárás gomb ÚGYIS a meglévő
    `PATCH .../status`-t hívja `Closed`-dal, a `status_changed` bejegyzés ("Státusz módosítva: X →
    Lezárva") már pontosan ezt az eseményt írja le — egy külön, redundáns "closed" action-nek nem
    lett volna hozzáadott információtartalma
  - Old/new value formátum action-önként ELTÉR (dokumentálva `lib/activityFormat.ts` tetején): a
    legtöbb action egyszerű string old/new (pl. `status_changed`: `"New"`→`"Open"`, a nyers enum
    string), DE a `custom_field_changed`-nél egy JSON objektum (`{"fieldName":...,"value":...}`),
    mert a mező NEVÉT is át kellett adni, és az `AuditLog` táblának nincs külön oszlopa erre — ezt
    egyedül ennél az action-nél kellett, a többinél a plain string elég volt
  - `GET /tickets/{id}/activity` — `TicketController`-ben (nem külön controller, mert szorosan a
    ticket-hez tartozik, mint a `/messages`), `Take(50)`, `OrderByDescending(CreatedAt)`
  - Tevékenységnapló, frontend: `TicketActivityLog` (ÚJ, `pages/TicketDetail/`) — accordion,
    alapból ZÁRVA, a fejléc ("Tevékenységnapló · N esemény") a `useQuery`-t FÜGGETLENÜL az
    összecsukott állapottól betölti (nem `enabled: open`-nel), hogy a fejléc számlálója nyitás
    előtt is helyes legyen. A thread ALATT jelenik meg MINDKÉT nézetben (Classic: közvetlenül a
    `MessageThread` után; Split: a thread-panelen belül, a `MessageThread` után — mindkét
    `splitReversed` ágban külön beszúrva, mert a JSX két külön blokkban van). `formatActivityAction`
    (`lib/activityFormat.ts`) fordítja magyarra az action+old/new párokat — a `STATUS_LABELS`/
    `PRIORITY_LABELS` konstansokat KIEMELTEM a `StatusBadge`/`PriorityBadge` komponensekből egy
    közös `lib/ticketLabels.ts`-be (korábban a komponens-fájlból exportálva lettek volna, ami
    `react(only-export-components)` oxlint warningot adott — a Fast Refresh csak akkor működik
    jól, ha egy fájl KIZÁRÓLAG komponenst exportál)
  - Bejövő email csatolmányok: NEM implementálva, TODO-ként jelölve `TicketEmailProcessor.cs`-ben
    (kommentben) ÉS itt lent a TODO listában — a Mailpit HTTP API `Attachments`/`PartID` mezőit és
    egy külön `GET .../part/{PartID}` hívást igényelne, ami az `EmailService`/`InboundEmail`
    réteget is bővítené; a KIMENŐ (portál→email) csatolmányok viszont teljesen működnek, ahogy a
    terv előírta minimumként
  - Tesztelve élő adaton (ticket #1-en, curl-lel): fájlfeltöltés csatolmánnyal (201, MinIO-ba
    ténylegesen feltöltve), `GET .../attachments` (helyes `downloadUrl`), letöltés (200, helyes
    tartalom/fájlnév/Content-Type), érvénytelen kiterjesztés (400), 6 fájl egyszerre (400, "max 5"),
    404 nemlétező ticket/attachment-re, `status_changed`/`priority_changed`/`category_changed`/
    `csm_assigned`/`message_sent`/`clickup_link_added`/`clickup_link_removed` audit bejegyzések
    mindegyike (helyes old/new érték). Minden teszt adat (üzenetek, csatolmány DB-sor, audit log
    sorok, ClickUp link) utólag törölve/visszaállítva — ticket #1 végállapota megegyezik a lépés
    eleji állapottal
  - `tsc -b`, `npm run build` (production) és `oxlint` (`TicketDetailPage.tsx`, `ReplyComposer.tsx`,
    `MessageThread.tsx`, `TicketActivityLog.tsx` (ÚJ), `RichTextEditor.tsx`, `StatusBadge.tsx`,
    `PriorityBadge.tsx`, `lib/format.ts`, `lib/activityFormat.ts` (ÚJ), `lib/ticketLabels.ts` (ÚJ),
    `api/index.ts`) tiszta — 0 új warning (a `TicketInfoPanel.tsx` 3 meglévő
    `no-unused-vars`/pre-existing warningja a 16. lépésből maradt ott, nem ehhez a lépéshez
    tartozik, nem nyúltam hozzá)
  - BÖNGÉSZŐS vizuális/interakciós tesztelés NEM történt ehhez a lépéshez sem (nincs
    böngésző-automatizálási eszköz ebben a környezetben) — a `vite dev` élő fájljait curl-lel
    ellenőriztem (mind a nyolc érintett/új fájl hiba nélkül transform-ál), de a tényleges viselkedés
    (fájl csatolás/eltávolítás UI, kép thumbnail betöltés, Lezárás confirm dialog, tevékenységnapló
    accordion nyitás/zárás) manuális kipróbálást igényel
- 18. lépés KÉSZ: Rich text editor bővítések — agent aláírás, idézet gomb, email előnézet
  - Migráció: `AddEmailSignature` — `UserPreferences.EmailSignature` (nullable `longtext`). Mivel
    nullable (nincs non-nullable enum-konverziós csapda, mint a 15. lépés `TicketDetailView`-jánál),
    a migráció egyszerű `AddColumn`, nem kellett benne backfill `UPDATE`. Alkalmazva és tesztelve élő
    MySQL-en. `UpdateUserPreferenceRequestValidator` kiegészítve egy `MaximumLength(2000)` szabállyal
    az `EmailSignature`-re — ez NEM szerepelt a tervben explicit módon, de a többi szöveges mezőhöz
    (pl. custom field érték) hasonlóan indokolt korlát volt egy szabadon írható textarea-nál
  - `GET`/`PUT /api/portal/me/preferences` kiegészítve `emailSignature`-rel (`UserPreferenceDto`/
    `UpdateUserPreferenceRequest`), NSwag újragenerálva (a `dotnet run`-nal futó backend újraindítva,
    hogy a friss modellt lássa a swagger.json, majd `dotnet build` a `nswag run` MSBuild target
    kiváltásához — docker compose build NEM futott, a terv tiltása szerint)
  - TALÁLT ÉS JAVÍTOTT MEGLÉVŐ HIBA (a feladat explicit hatókörén túl, de ugyanazt a payload-építő
    kódot érintette): a `PreferencesPage.tsx` mentés mutation-je eddig a `UpdateUserPreferenceRequest`
    4 mezője közül csak kettőt (`ticketPropertiesAutosave`, `ticketListView`) küldte el — a
    `ticketDetailView`/`ticketDetailSplitReversed` mezők hiányoztak a payloadból, ami azt jelentette,
    hogy a Preferenciák oldalról MINDEN mentés csendben visszaállította ezt a két mezőt az alapértékére
    (Classic/false), felülírva a ticket detail nézetváltó gombjaival korábban beállított értéket. Mivel
    ugyanide kellett az `emailSignature` mezőt is felvenni, itt javítottam: a mentés mostantól a
    `preferencesQuery.data`-ból veszi át a `ticketDetailView`/`ticketDetailSplitReversed` aktuális
    értékét (nem írja felül), curl-lel visszaellenőrizve (`ticketDetailView` a teszt előtti "Split"
    értéken maradt egy PreferencesPage-stílusú mentés szimulációja után is)
  - `/preferences` oldal: "Email aláírás" textarea (4 sor, `shared.field` minta, a meglévő
    `SettingsShared.module.css` `.field textarea` stílusával — nem kellett új CSS), ugyanabba a
    `draft`/`setDraft` state-be integrálva, mint az autosave/listView (nincs setState-in-effect)
  - ReplyComposer aláírás + idézet automatikus beszúrás EGY KÖZÖS, mount-kori, ref-guardolt
    `useEffect`-ben történik (nem két külön effect, mert mindkettő ugyanazt a kezdeti editor-tartalmat
    építi fel egyszerre): megvárja, amíg MIND a `signature` (preferenciák), MIND a `lastInboundBody`
    (üzenetlista) prop eldől (`undefined` = "még tölt", ne csináljon semmit) — így egy lassabb hálózati
    válasz esetén sem marad ki az auto-kitöltés. Csak EGYSZER fut le (`initializedRef`), és csak ha a
    body ekkor még üres — ha a user már gépelt valamit, mielőtt az adatok betöltöttek, nem nyúl hozzá.
    ISMERT KORLÁT (nem javítva, mert a `replyBody`/`cc`/`bcc`/`attachments` state a `TicketDetailPage`-ben
    is így viselkedik már a 15. lépés óta): kliensoldali navigáció ticket A-ról ticket B-re (route param
    csere, nem teljes remount) NEM reseteli ezt az effektet — az aláírás/idézet csak az ELSŐ megnyitott
    ticketnél kerül automatikusan beszúrásra ugyanabban a böngésző-munkamenetben
  - Aláírás beszúrás (`lib/htmlText.ts` `buildSignatureHtml`): `--` elválasztó sor + soronkénti `<p>`,
    mindegyik egy `lineClassName`-t kap (grey stílushoz). PROBLÉMA amit ez megold: a TipTap paragraph
    node ALAPÉRTELMEZETTEN NEM őriz meg tetszőleges `class` attribútumot parse/szerializálás közben —
    ezért egy kis saját `ParagraphAttributes` TipTap `Extension` (`RichTextEditor.tsx`,
    `addGlobalAttributes`) kell hozzá, ami a `class`-t globális attribútumként regisztrálja a
    `paragraph` node type-ra. Enélkül a `styles.emailSignatureLine` class egy `setContent` kör után
    egyszerűen eltűnt volna a doksziból
  - `RichTextEditorHandle` új metódussal bővült: `setContentAndFocusStart(html)` — ez KÜLÖNBÖZIK a
    meglévő `insertContent`-től (ami a kurzorhoz szúr be, `emitUpdate` mellett): ez a teljes kezdeti
    tartalmat állítja be `emitUpdate: false`-zal (nem hív onChange-et), majd a kurzort a dokumentum
    ELEJÉRE fókuszálja (`focus('start')`) — mivel a beszúrt HTML `<p></p>`-vel kezdődik (üres bekezdés),
    ez pontosan "a kurzor az idézet/aláírás ELÉ" viselkedést adja. A hívó (`ReplyComposer`) a
    `setContentAndFocusStart` hívás UTÁN külön `onBodyChange(html)`-t is hív, hogy a szülő
    (`TicketDetailPage`) `replyBody` state-je szinkronban maradjon — enélkül a `RichTextEditor` meglévő
    "külső content-frissítés szinkronizálása" effektje (16. lépésből) visszaírta volna az editort az
    (időközben már elavult) `content` propra
  - Idézet gomb: `@tiptap/extension-blockquote` NEM lett telepítve — a `StarterKit` (már telepített
    csomag) alapból tartalmazza (`starter-kit` v3.30.2 `blockquote: Partial<BlockquoteOptions> | false`),
    csak a toolbar gombot (`"` ikon, `toggleBlockquote()`, a U után) és a CSS-t (`--bg-alt` háttér,
    bal oldali 3px `--primary` border, `italic`) kellett hozzáadni
  - Automatikus idézet: `TicketDetailPage` számolja ki `lastInboundBody`-t (`messages` lista utolsó
    `MessageDirection.Inbound` üzenetének body-ja, `undefined` amíg `messagesQuery` tölt, `null` ha
    nincs bejövő üzenet). A `ReplyComposer`-ben egy checkbox ("Eredeti üzenet idézése a válaszban",
    alapból BEKAPCSOLVA, csak akkor látszik ha van mit idézni és nem belső jegyzet mód) vezérli — DE
    csak a fenti EGYSZERI mount-kori beszúrás pillanatában számít: ha a user a beszúrás UTÁN kapcsolja
    ki/be, az már NEM módosítja a már beszúrt tartalmat (nincs élő, Gmail-szerű "idézett szöveg
    megjelenítése/elrejtése" szinkron) — ez SZÁNDÉKOS EGYSZERŰSÍTÉS, összhangban a terv saját
    "(opcionálisan, toggle-lel kapcsolható ki)" megfogalmazásával, ami magát a funkciót is opcionálisnak
    jelölte. A bejövő üzenet body-ja (ami tetszőleges külső HTML lehet emailből) a meglévő
    `sanitizeHtml` (DOMPurify) függvényen megy át beszúrás előtt (`buildQuoteHtml`), ugyanazzal a
    fenyegetettségi modellel, mint a `SafeHtml` komponens megjelenítésnél. A blockquote CSS-e
    `white-space: pre-wrap`-et is kapott — ugyanaz a védőháló, mint a `.bubble` osztálynál (15. lépés
    TODO-ja: régi üzenetek plain text body-ja), hogy a régi, HTML-t nem tartalmazó bejövő üzenetek
    idézése is olvasható maradjon
  - Email előnézet: ÚJ `pages/TicketDetail/EmailPreviewModal.tsx`, a meglévő `Modal` komponensre épül,
    amit egy opcionális `maxWidth` prop-pal bővítettem (a terv "max-width 700px" kérése miatt — a
    többi hívó helyen változatlan marad az alapértelmezett 480px). A fejléc sorokhoz (Tárgy/Tól/Nek/
    CC/BCC) a `TicketInfoPanel`-ből már ismert `.infoRow`/`.infoRowLabel`/`.infoRowValue` osztályokat
    használtam újra (`TicketDetailPage.module.css`-ben definiálva, nem hoztam létre külön CSS modult a
    modalhoz, ahogy a többi `TicketDetail/*.tsx` fájl sem teszi). A törzs `SafeHtml`-lel renderelődik.
    FONTOS ÉRTELMEZÉSI DÖNTÉS: mivel az aláírás és az idézet (a fenti két pont szerint) VALÓDI,
    szerkeszthető editor-tartalomként kerül be a body-ba (nem csak küldéskor/előnézetkor hozzáfűzött
    extra darab), a terv "Aláírás az alján" bullet pontja MAGÁTÓL teljesül azzal, hogy a modal az
    editor HTML tartalmát (`body`) rendereli — nem lett külön "aláírás szekció" hozzáadva a modalhoz,
    mert az duplikálná a már a body-ban szereplő aláírást. Az "Előnézet" gomb (`shared.secondaryButton`,
    a composer lábléc "Küldés" gombja mellett) csak "Válasz" módban jelenik meg (belső jegyzetnél nincs
    email küldés). A modal "Küldés" gombja a meglévő `onSend`-et hívja, majd bezárja a modalt
  - `Tól`/`fromName`/`fromEmail` az `useAuthStore().user`-ből jön (a bejelentkezett ügyintéző neve/
    email címe) — ez NEM szerepel a `TicketDetailDto`-ban, nem kellett hozzá backend-mező, mivel a
    kliensoldalon már elérhető az auth store-ból
  - Backend restart: a `dotnet run` folyamatot újraindítottam (nem docker compose-szal, azt a terv
    tiltja), hogy a friss `UserPreference.EmailSignature` mezőt lássa a NSwag-generáláshoz szükséges
    élő swagger.json — ez normál dev workflow lépés, nem docker-t érintő újraindítás
  - Tesztelve curl-lel élő adaton: `GET`/`PUT /me/preferences` `emailSignature` mezővel (kerekítve
    UTF-8 ékezetes szöveggel + `\n` sortöréssel), 2001 karakteres aláírás → 400 (MaximumLength), a
    teszt előtti `ticketDetailView` ("Split") érték visszaállítva a curl-tesztek után. A tényleges
    TipTap-interakciót (aláírás/idézet automatikus beszúrás kurzorpozícióval, blockquote toggle gomb,
    Előnézet modal renderelése/Küldés gomb) NEM lehetett curl-lel tesztelni
  - `tsc -b`, `npm run build` (production) és `oxlint` (minden érintett/új fájl: `PreferencesPage.tsx`,
    `TicketDetailPage.tsx`, `ReplyComposer.tsx`, `EmailPreviewModal.tsx` (ÚJ), `RichTextEditor.tsx`,
    `Modal.tsx`, `lib/htmlText.ts`) tiszta — 0 új warning
  - BÖNGÉSZŐS vizuális/interakciós tesztelés NEM történt ehhez a lépéshez sem (nincs
    böngésző-automatizálási eszköz ebben a környezetben) — a `vite dev` élő fájljait (beleértve a
    két érintett CSS modult is) curl-lel ellenőriztem, hiba nélkül transform-álnak, de a tényleges
    viselkedés (aláírás vizuális elkülönülése/kurzorpozíció, idézet gomb, checkbox, Előnézet modal
    elrendezése) manuális kipróbálást igényel
- 19. lépés KÉSZ: Bejövő email csatolmányok, merge gomb, kapcsolódó ticketek
  - Bejövő email csatolmányok, backend: `InboundEmail` (`Application/DTOs/InboundEmail.cs`) kiegészítve
    `IReadOnlyList<InboundEmailAttachment> Attachments`-szel, új `InboundEmailAttachment(Filename,
    ContentType, Data)` record ugyanabban a fájlban. `EmailService.FetchNewAsync`: a `MailpitMessageDetail`
    record kapott egy `List<MailpitAttachment>? Attachments` mezőt (`PartID`, `FileName`, `ContentType`) —
    a Mailpit tényleges JSON válaszát élőben (Mailpit HTTP API-n keresztül, teszt SMTP emaillel)
    ellenőriztem, a mező mindig jelen van (`[]` ha nincs csatolmány), `PartID` string ("2", "3", ...).
    Minden `Attachments` elemre `GetByteArrayAsync($"/api/v1/message/{id}/part/{PartID}")` tölti le a
    nyers bájtokat (ez a végpont NEM JSON-t ad vissza, ezért nem a meglévő `JsonOptions`-os
    `GetFromJsonAsync`-et használja)
  - `TicketEmailProcessor` konstruktora kiegészült `IFileStorageService`-szel és
    `IOptions<MinioSettings>`-szel (ugyanaz a kettő, amit a `TicketService` is kap) — mindkettő már
    regisztrálva volt DI-ban a 17. lépésből, nem kellett új `Program.cs` bejegyzés. Új privát
    `UploadAttachmentsAsync(ticketId, messageId, attachments)` helper, ami sorról sorra megismétli a
    kimenő csatolmányoknál (`TicketService.AddMessageAsync`) már meglévő MinIO-feltöltési mintát
    (`tickets/{ticketId}/{messageId}/{guid}-{filename}` object key, `FileStorage` sor), csak
    `IFormFile.OpenReadStream()` helyett egy `MemoryStream(attachment.Data)`-val
  - TALÁLT ÉS MEGOLDOTT STRUKTURÁLIS HIÁNYOSSÁG: a meglévő ticket-létrehozó ág (`ProcessOneAsync`,
    ha nincs egyező meglévő ticket) SOHA nem hozott létre `TicketMessage` sort az induló emailhez — a
    tartalom kizárólag a `ticket.Body` mezőben landolt, aminek viszont nincs `Id`-ja, amihez egy
    `FileStorage.MessageId` FK-t kapcsolni lehetne. Mivel ez a mező a frontenden SEHOL nincs
    megjelenítve (átvizsgáltam a `TicketInfoPanel`-t és a `MessageThread`-et is — egyik sem rendereli
    a `ticket.Body`-t), a MINIMÁLIS beavatkozást választottam: csak akkor hozok létre egy kezdő bejövő
    `TicketMessage`-t az új ticket ágban, ha az emailnek TÉNYLEGESEN van csatolmánya (attachment
    nélküli új ticketeknél a viselkedés változatlan, semmi nem változik a meglévő ticketeknél sem).
    Élőben tesztelve mindkét ág: (1) válasz egy meglévő ticketre csatolmánnyal — a csatolmány a már
    létező bejövő `TicketMessage`-hez kapcsolódott, (2) vadonatúj ticket csatolmánnyal — a kezdő
    `TicketMessage` létrejött és a csatolmány ahhoz kapcsolódott, mindkettő `GET
    /tickets/{id}/attachments`-szel és tényleges letöltéssel (byte-tartalom egyezés) ellenőrizve
  - Merge gomb, backend: a terv "Backend — már megvan" állítása RÉSZBEN volt pontos — a `MergeAsync`
    ténylegesen működött, de (a 17. lépésben minden más ticket-mutációra bevezetett audit logolással
    ellentétben) NEM logolt semmit az `AuditLogs` táblába. Ugyanazt a mintát követve, mint az
    `AssignCsmAsync`/`UpdateTicketAsync`-nál (17. lépés), a `MergeAsync` szignatúrája kapott egy
    `currentUserId` paramétert (`ITicketService`, `TicketService`, az egyetlen hívó
    `TicketController.MergeTicket` már rendelkezésre álló `User.GetUserId()`-vel hívja), és sikeres
    merge után `auditLogService.LogAsync(currentUserId, "ticket", id, "merged", null, $"#{targetTicketId}")`
    ír egy bejegyzést — csak a forrás ticketre (a cél ticket állapota nem változik a merge-nél, nincs
    mit logolni rajta). Élőben tesztelve (majd visszaállítva): self-merge → 409, sikeres merge → 204 +
    `IsMerged`/`MergedIntoTicketId`/`Status=Closed` helyesen beállítva + `merged` audit bejegyzés
    `newValue="#{targetId}"` alakban a tevékenységnaplóban
  - `GET /api/portal/tickets/search?q=&limit=10` — ÚJ `TicketSearchResultDto(Id, Subject, Status,
    RequesterEmail)`, `TicketService.SearchAsync`: ha `q` numerikus, `Id`-ra IS illeszt (nem csak
    `Subject`/`RequesterEmail Contains`-ra) — a terv "ticket ID vagy tárgy alapján keresés" pontja
    miatt. `!IsMerged` szűrés a találatokon SAJÁT DÖNTÉS (a terv nem írta elő explicit módon) — enélkül
    egy már összevont ticketet lehetne kiválasztani cél gyanánt a merge modalban, ami úgyis azonnal
    409 `TargetAlreadyMerged`-et adna a `MergeAsync`-től, feleslegesen rossz UX. `limit` 1–50 közé
    clamp-elve (alapérték 10, ugyanaz a minta mint a `TicketListQuery.PageSize`-nál)
  - A terv "FluentValidation: merge-nél targetTicketId nem lehet ugyanaz mint az aktuális ticket ID"
    pontját SZÁNDÉKOSAN NEM egy validátor-szabályként implementáltam — a `MergeTicketRequestValidator`
    csak a request body-t látja (`TargetTicketId`), az útvonal `{id}` paramétere nem érhető el belőle.
    Ez már ELŐZŐLEG is meg volt oldva service-szinten (`TicketMergeResult.SelfMerge`, a 17. lépés előtti
    kódban), ugyanazt a mintát követve, mint a DB-lookupot igénylő egyéb service-szintű enumok
    (`TicketCsmAssignResult.CsmNotFound` stb.) — nem hoztam létre duplikált ellenőrzést
  - `GET /api/portal/tickets/{id}/related` — ÚJ `TicketRelatedDto(Id, Subject, Status, Priority,
    CreatedAt)`, `TicketService.GetRelatedAsync`: `RequesterEmail` egyezés, kizárja az aktuális és a
    `IsMerged` ticketeket, `Take(5)`, `OrderByDescending(CreatedAt)`, pontosan a terv szerint. Mindkét
    új végpont a `TicketController`-ben, a `GetTickets`/`GetActivity` mellett (route ütközés nincs, a
    `{id:int}` constraint miatt a `search` szegmens nem illeszkedik az `{id:int}` mintára)
  - NSwag újragenerálva (a `dotnet run` háttérfolyamat újraindítva, hogy a friss swagger.json-t lássa,
    majd `dotnet build` a `nswag run` MSBuild target kiváltásához) — `generated-client.ts` tartalmazza
    `ticketClient.searchTickets`/`getRelated`-et és a két új DTO-t
  - Frontend: `pages/TicketDetail/MergeModal.tsx` (ÚJ) — kétlépcsős modal (keresés → megerősítés),
    300ms debounce ugyanazzal a `setTimeout`/`clearTimeout` mintával, mint a `TicketsPage` keresőmezője
    (nincs külön debounce-könyvtár a projektben). Keresési találatok `<button>` elemekként (nem
    `<div>`), mert kattinthatónak kell lenniük — ehhez ÚJ `.searchResultItem` CSS osztály (button-reset:
    `font: inherit`, `color: inherit`, a `.clickUpItem` border/padding/background mintáját követve).
    Megerősítéskor `ticketClient.mergeTicket` hívás, sikeres válasz után: `['ticket', targetId]` és
    `['tickets']` (lista) invalidálás, toast (`useToastStore.addToast` — ez volt az ELSŐ hely a
    kódbázisban, ahol egy mutation `onSuccess`-e közvetlenül hív toast-ot, eddig kizárólag az SSE
    notification hook hívta), majd `navigate(`/tickets/${targetId}`)`
  - `pages/TicketDetail/RelatedTicketsSection.tsx` (ÚJ) — a `ClickUpSection` ALATT a jobb panelben.
    `react-router-dom` `Link`-kel (nem `<a href>`-fel) navigál a kapcsolódó ticketre, a meglévő
    `.clickUpList`/`.clickUpItem`/`.clickUpItemHeader`/`.clickUpMeta` CSS osztályokat újrahasznosítva
    (nem kellett hozzá új CSS blokk, a `Link` `display:block` inline style-lal kapja meg a szükséges
    block-szintű megjelenítést, mert alapból inline elem)
  - "Összevonás" gomb a `titleRow`/`viewToggleRow`-ban, a Lezárás gomb ELŐTT — `!ticket.isMerged`
    esetén látszik (a terv szerint), a meglévő `shared.secondaryButton` stílussal. "ÖSSZEVONVA → #Y"
    badge a `metaRow`-ban, a `StatusBadge` ELŐTT — `badgeStyles.badge`+`badgeStyles.dark` (ugyanaz a
    variáns, mint a `Closed` státuszé) + ÚJ `.mergedBadge` CSS osztály (`text-decoration: none;
    cursor: pointer`), `react-router-dom` `Link`-ként renderelve a cél ticketre
  - Tesztelve élőben, valódi Mailpit SMTP + polling ciklussal (60 másodperces `PollIntervalSeconds`,
    NEM csökkentve a teszthez, kivárva a tényleges ciklust): (1) csatolmányos válasz egy meglévő
    ticketre (`Re: [#15] ...` subject-tag egyezés) — a csatolmány (PNG) megjelent a
    `/tickets/{id}/attachments` végponton, letöltve és a byte-tartalom BÁJTRA PONTOSAN egyezett a
    elküldött fájléval; (2) csatolmányos email vadonatúj ticket-témával — új ticket jött létre, kezdő
    `TicketMessage` + csatolmány (PDF) helyesen kapcsolódva, letöltve és tartalma egyezett;
    (3) `GET /tickets/search?q=...` numerikus és szöveges kereséssel; (4) `GET /tickets/{id}/related`
    egyező és nem egyező requester email-lel, 404 nemlétező ticketre; (5) merge: self-merge → 409,
    sikeres merge → audit log bejegyzés, majd manuálisan VISSZAÁLLÍTVA (`IsMerged`/
    `MergedIntoTicketId` visszaállítva, a teszt audit sor törölve). Minden teszt közben létrejött
    plusz adat (teszt `TicketMessage`/`FileStorage`/`EmailQueue` sorok, a vadonatúj teszt ticket) a
    tesztelés után SQL-lel törölve — a dev DB végállapota megegyezik a lépés eleji állapottal (ticket
    #14/#15 pontosan az eredeti állapotukban)
  - BÖNGÉSZŐS vizuális/interakciós tesztelés: MEGKÍSÉRELVE, de VÉGÜL NEM SIKERÜLT — ellentétben a
    korábbi lépésekkel (ahol egyáltalán nem állt rendelkezésre böngésző-automatizálási eszköz), itt
    telepítettem Playwright-ot (`npx playwright install chromium`, sikeresen letöltötte a binárisokat),
    DE a headless Chromium indítása lib hiány miatt elhasal (`libnspr4.so: cannot open shared object
    file`) — a hiányzó rendszer-csomagok telepítéséhez (`playwright install --with-deps`) root jogosultság
    kellene, a környezetben NINCS jelszó nélküli `sudo` (`sudo -n true` → "interactive authentication
    is required"). Emiatt a merge modal/badge/kapcsolódó jegyek szekció tényleges vizuális
    megjelenése és kattintás-viselkedése (a keresési találatok gomb-stílusa, a badge pozicionálása a
    metaRow-ban, a modal két állapota közti váltás) NEM lett manuálisan ellenőrizve — csak a `tsc -b`,
    `npm run build` (production) és `oxlint` (érintett fájlok: `TicketDetailPage.tsx`,
    `TicketDetailPage.module.css`, `MergeModal.tsx` (ÚJ), `RelatedTicketsSection.tsx` (ÚJ)) tiszta
    lefutása, valamint a `vite dev` élő fájljainak hiba nélküli transform-álása (curl-lel ellenőrizve)
    igazolja, hogy a kód szintaktikailag/típusilag helyes

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
- [ ] README.md hiányzik (setup leírás új gépre)
- [ ] 14. lépés UI vizuális/interakciós ellenőrzése böngészőben MÉG NEM TÖRTÉNT MEG (CSM dropdown,
      egyéni mezők a ticket detail panelen, Custom field-ek szekció a /settings/tickets oldalon)
- [ ] Developer API v1 `GET /api/v1/tickets/{id}` `customFields` mezője NEM lett curl-lel tesztelve
      (nem volt elérhető plaintext Developer API kulcs ebben a környezetben — csak kód-review történt)
- [ ] ClickUp UI vizuális ellenőrzése böngészőben
- [ ] Settings UI vizuális ellenőrzése böngészőben (9. lépés)
- [ ] MCP szerver Claude Desktop-pal való tesztelése (felhasználói oldali lépés)
- [ ] AI funkciók (12. lépés) valós Anthropic API kulccsal még nincsenek kipróbálva — csak a graceful
      degradation (kulcs nélkül) és a 404 eset lett tesztelve ebben a környezetben
- [ ] AI funkciók UI vizuális ellenőrzése böngészőben (12. lépés)
- [ ] 13b. lépés UI vizuális/interakciós ellenőrzése böngészőben MÉG NEM TÖRTÉNT MEG — nincs
      böngésző-automatizálási eszköz ebben a környezetben; curl-lel csak a backend kontraktusok lettek
      ellenőrizve, a React render/interakció (pl. draft mentés flow, widget checkbox, kártya nézet
      layout) manuális kipróbálást igényel
- [ ] Dashboard widget drag-and-drop pozicionálás nincs implementálva — jelenleg csak be/kikapcsolható
      widget lista, auto-sorrendben (ld. 13b összefoglaló, szándékos MVP-döntés)
- [ ] Teszt adatok: ticket #12, #13 és CSM "Kovács Anna Módosítva" (id=1) a 13a. lépés teszteléséből
      bent maradtak a dev DB-ben (nem törölhetők FK constraint miatt Notifications tábla felől) —
      ártalmatlanok, de ha tiszta demo state kell, kézzel törlendők vagy DB reseteld
- [ ] 15. lépés UI vizuális/interakciós ellenőrzése böngészőben MÉG NEM TÖRTÉNT MEG (Classic/Split
      váltás, panel csere, TipTap toolbar formázás gombok, link beszúrás, canned response modal
      betöltés, belső jegyzet sárga háttér, CC/BCC összecsukható panel) — nincs böngésző-automatizálási
      eszköz ebben a környezetben
- [ ] 15. lépés: a terv "Címzett... felülírható" pontja szándékosan NEM lett szerkeszthető (read-only
      marad) — a backend `POST /messages` nem támogat cél-cím felülírást, csak `cc`/`bcc`-t; ha ez
      valódi igény, backend-bővítés szükséges hozzá (lásd 15. lépés összefoglaló)
- [ ] Régi (15. lépés előtti) TicketMessages sorok body-ja plain text, nem HTML — megjelenítéskor a
      `.bubble` `white-space: pre-wrap`-je miatt vizuálisan még rendben jelennek meg, de nem lettek
      migrálva HTML-re; ez nem hiba, csak érdemes tudni demózáskor
- [ ] 16. lépés UI vizuális/interakciós ellenőrzése böngészőben MÉG NEM TÖRTÉNT MEG (ticket info blokk
      elrendezés Split alsó panelben és Classic oldalsávban, összecsukás Classic nézetben, canned
      response beszúrás kurzor pozícióra nem üres editornál, link popover pozicionálás/Escape/külső
      kattintás bezárás, üres kijelöléssel beszúrt link szövege) — nincs böngésző-automatizálási eszköz
      ebben a környezetben
- [x] ~~Bejövő email csatolmányok NINCSENEK feldolgozva~~ — MEGOLDVA a 19. lépésben (lásd ott)
- [ ] 17. lépés UI vizuális/interakciós ellenőrzése böngészőben MÉG NEM TÖRTÉNT MEG (fájl csatolás/
      eltávolítás gomb és lista a composerben, kép thumbnail betöltés a buborékokban, Lezárás gomb
      confirm dialog, tevékenységnapló accordion nyitás/zárás mindkét nézetben) — nincs
      böngésző-automatizálási eszköz ebben a környezetben
- [ ] `SupportPortal.csproj` `GenerateApiClient` target kiegészítve egy `sed` utófeldolgozó lépéssel
      (lásd 17. lépés összefoglaló) — ismert NSwag/Axios kvirk kerülő megoldása (fájlletöltő
      végpontok `Blob`/`content-type` típusütközése); ha egy jövőbeli NSwag verzió javítja ezt
      upstream, a sed lépés no-op-pá válik (nem talál illeszkedő sort), nem árt, de érdemes tudni
      róla, ha valaki a generált kliens szerkezetét vizsgálja
- [ ] 18. lépés UI vizuális/interakciós ellenőrzése böngészőben MÉG NEM TÖRTÉNT MEG (aláírás
      automatikus beszúrása + vizuális elkülönülése + kurzorpozíció, idézet toolbar gomb, automatikus
      idézet checkbox, Email előnézet modal elrendezése/Küldés gomb) — nincs böngésző-automatizálási
      eszköz ebben a környezetben
- [ ] A ticketDetailView/ticketDetailSplitReversed "elfelejtő mentés" hiba javítva a PreferencesPage-en
      (lásd 18. lépés összefoglaló) — ÉRDEMES ellenőrizni böngészőben, hogy a nézetváltó gombokkal
      beállított Split/Csere állapot tényleg túléli a Preferenciák oldalról való mentést
- [ ] Az automatikus idézet checkbox csak a mount-kori egyszeri beszúrás pillanatában hat — ha a user
      utólag kapcsolja ki/be, a már beszúrt idézet nem tűnik el/jelenik meg automatikusan (szándékos
      egyszerűsítés, lásd 18. lépés összefoglaló); ha ez valódi igény, egy élő szinkronizálást kellene
      építeni rá
- [ ] 19. lépés UI vizuális/interakciós ellenőrzése böngészőben MÉG NEM TÖRTÉNT MEG (Összevonás gomb,
      merge modal keresés/kiválasztás/megerősítés két állapota, ÖSSZEVONVA badge pozíció és kattintás,
      Kapcsolódó jegyek szekció lista/üres állapot) — lásd a 19. lépés összefoglalójában: EBBEN a
      lépésben megpróbáltam Playwright-tal böngésző-automatizálást beüzemelni (korábbi lépésekben ez
      elvi lehetőségként sem merült fel), de a headless Chromium hiányzó rendszer-shared library-k
      (`libnspr4.so` stb.) miatt nem indul el, a telepítéshez (`playwright install --with-deps`) pedig
      root/sudo kellene, ami nem elérhető ebben a környezetben (`sudo -n true` elutasítva) — ha egy
      jövőbeli környezetben ezek a rendszer-csomagok telepítve vannak (vagy sudo elérhető), a
      Playwright-alapú tesztelés innentől megismételhető (a driver script ötlete: `chromium.launch()`,
      login `#email`/`#password`+`button[type=submit]`, navigálás `/tickets/{id}`-re)
- [ ] A `/settings/tickets` "MinIO orphan blob" takarítás NEM történt meg: a 19. lépés böngésző-cél
      nélküli, valódi Mailpit SMTP-n átküldött teszt csatolmányai (screenshot.png, dokumentum.pdf)
      MinIO-ban FIZIKAILAG bent maradtak (a DB-sorokat töröltem, de a MinIO objektumokat nem) — ez
      ugyanaz a minta, amit a korábbi lépések is követtek (a DB takarítás dokumentálva volt, a MinIO
      blob-ok törlése nem), ártalmatlan, csak dev-bucket helyfoglalás

## Rich text editor — később implementálandó (18. lépés terv 4. pontja, dokumentálva, NEM implementálva)
- Képbeszúrás inline — a StarterKit nem tartalmaz Image extension-t (`@tiptap/extension-image` külön
  telepítés), az inline kép tárolása valószínűleg a meglévő MinIO/`IFileStorageService` (17. lépés)
  útvonalát követné, de ezt még nem terveztük meg
- Vízszintes elválasztó — a StarterKit HorizontalRule extension-je már benne van a csomagban
  (hasonlóan a blockquote-hoz), csak egy toolbar gomb kellene hozzá
- Szöveg szín — `@tiptap/extension-color` + `@tiptap/extension-text-style` külön telepítést igényelne
- Karakter/szószámláló — `@tiptap/extension-character-count` külön telepítést igényelne
- Mentett piszkozat (localStorage) — a `replyBody`/`cc`/`bcc` state jelenleg nincs perzisztálva ticketek
  vagy oldal-újratöltés között (lásd a 18. lépés összefoglalójában az "ismert korlát" bekezdést)
- Fullscreen mód
- Késleltetett küldés — a `TicketService`/email-küldés jelenlegi útvonala szinkron, ehhez valamilyen
  ütemezett háttérfeladat (pl. a meglévő `PeriodicTimer`-alapú background service minta, lásd
  `ClickUpSyncBackgroundService`) kellene
