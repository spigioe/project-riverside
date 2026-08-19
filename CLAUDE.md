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

## Következő feladat (16. lépés)
(Még nincs kitűzve.)
