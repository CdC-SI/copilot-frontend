# AGENTS.md — copilot-frontend

Frontend Angular de ZIA (ZAS/EAK-Copilot) : chat RAG en streaming, gestion des corpus/sources,
outils métier (`/tools` : résumé de carrière, analyse de documents, identity check, Sumex) et
administration (workspaces, FAQ, sources, alertes, feedback/KPI, comptes, rétention).

## Stack

- **Angular 22** (composants **standalone**, sans NgModule : `bootstrapApplication` dans `main.ts`, providers dans
  `app.config.ts` dont `provideZoneChangeDetection()`, routes dans `app.routes.ts`), **TypeScript 6.0**, **RxJS**,
  Node 22.22+/24.15+ (`engines`). Templates en control flow (`@if`/`@for`/`@switch`) ;
  OnPush + signals pour le chat (page, sous-composants, composants partagés du chat) ; `ChangeDetectionStrategy.Eager`
  explicite ailleurs (corpus, admin, outils, aide). Le `router-outlet` est dans
  `ob-master-layout`, OnPush : `AppComponent.ngDoCheck` le marque à chaque cycle pour que les pages routées se
  mettent à jour après un timer ou une réponse HTTP (à retirer quand elles seront en signals).
- UI : **Oblique 16** (`@oblique/oblique`, master layout, inputs en signals) + Angular Material/CDK 22
  + **ZDS 22** (`@zas-design-system/zas-design-system` : environnements, gateway, jeton `blue`).
- i18n : **ngx-translate 18** (`TranslateService` fourni par `provideObliqueConfiguration`,
  `TranslatePipe` importé par chaque composant, `getCurrentLang()`), fichiers `src/assets/i18n/{fr,de,it}.json`.
- Tests : **Jest 30** via `@angular-builders/jest` (`tests/` : `jest.config.js`, `setupJest.ts`, mocks).
  Les paquets publiés en ESM seul (`.js`) importés par les composants doivent figurer dans
  `transformIgnorePatterns` (`jest.config.js`). Instancier une classe qui utilise `inject()` hors TestBed :
  `runInInjectionContext(Injector.create({providers: [...]}), () => new Classe())`.
- Couverture : calculée sur tout `src/app` (`collectCoverageFrom`, y compris les fichiers sans test), rapport
  `coverage/` (html, lcov, `coverage-summary.json`). Seuils **à cliquet** par dossier (`coverageThreshold` dans
  `jest.config.js`) : relevés au niveau atteint quand une PR l'améliore, jamais baissés. Un dossier listé est
  exclu du seuil `global`.
- Utilitaires de test partagés dans `src/testing/` (hors couverture) : `stream-events.ts` (fabriques
  d'événements du flux, `answerTurn`, `toSse`), `fixtures.ts` (utilisateur, titres, conversations) — sans
  dépendance Angular, importables par Jest et Playwright — et `angular.ts` (stubs `TranslateService`,
  notifications Oblique, `provideApiTesting()` : `HttpTestingController` et `backendApi` préfixé par `TEST_API`),
  `shared-components.ts` (icônes de test `provideTestIcons()`, `detectAsyncChanges(fixture)` pour un composant
  `Eager` mis à jour hors événement DOM — les tests sont sans zone.js) et `admin.ts` (stubs `ob-file-upload`,
  `MatDialog`/`MatDialogRef`, fabriques admin ; remplace `ng2-charts` : l'importer avant un composant à graphique).
  Les réutiliser plutôt que redéfinir des mocks locaux. Les services d'API sans logique sont testés ensemble,
  par table (`shared/services/api-services.spec.ts`) : y ajouter une ligne par nouvelle route.
- Specs de composants : remplacer les enfants lourds par des stubs (`TestBed.overrideComponent(X, {remove: {imports},
  add: {imports}})`, y compris `MatIcon`), piloter par le DOM ou `componentRef.setInput` (OnPush). Retirer
  `ObButtonDirective` des imports si une info-bulle est détruite pendant le test (l'observateur Oblique plante sous jsdom).
- e2e : **Playwright** (`playwright.config.ts`, dossier `e2e/`, hors Jest). `ng serve` est lancé sur le port 4300
  (réutilisé s'il tourne déjà) et le backend est simulé par `page.route` (`e2e/support/mock-backend.ts` :
  utilisateur, historique, réponses SSE scriptées ou erreurs HTTP (`reply`, `replyHttpError`), flux piloté étape par
  étape (`manualStream`), arrêt, décisions d'approbation, pièces jointes (envoi retenu par `gate()`, suivi), vues et
  fichiers des sources ; requêtes reçues notées pour les assertions ; requête non prévue → réponse vide notée dans `unexpected`).
  Page objet `e2e/support/chat-page.ts` ; sélecteurs par rôle et libellé accessibles (fr). Navigateur : Edge du
  poste (`channel: 'msedge'`, téléchargement des navigateurs Playwright bloqué) ; `E2E_CHANNEL=chromium` sinon.
- Lint/format : ESLint 10 en flat config (`eslint.config.mjs`, paquets `angular-eslint` et
  `typescript-eslint`) + Prettier (`.prettierrc`).
- `package.json` : `allowScripts` liste les paquets autorisés à exécuter un script d'installation,
  épinglés par version : à revoir à chaque montée de version (`npm approve-scripts`, npm ≥ 11.16).

## Commandes

- Dev : `npm run start:dev` (proxy `/zia/api/**` → `http://localhost:8080`, voir `proxy.conf.json`).
- Build : `npm run build` ; production : `npm run build:prod`.
- Tests : `npm test` (Jest, avec couverture) ; un fichier : `npx ng test --test-path-patterns=<motif>`.
- e2e : `npm run e2e` (Playwright) ; un parcours : `npm run e2e -- --grep <motif>` ; rapport :
  `npx playwright show-report`.
- Lint : `npm run lint` ; correction auto : `npm run format`.
- Après une modification : au minimum `npm run build` (ou les diagnostics IDE), plus `npm run lint`
  sur les fichiers touchés, avant de conclure.

## Organisation (`src/app`)

- `core/app-configuration/` : configuration par environnement (détection via l'URL), gateway,
  authentification. `token.ts` contient un jeton mock **local** : ne jamais committer de modification.
- `chat/` : `chat.component` (conteneur fin), sous-composants `chat-sidebar`, `chat-timeline`, `chat-composer`
  (+ `chat-attachments`) ; état dans `ChatStore` (façade signals, fournie par la page) et ses stores
  (conversations, génération, pièces jointes) ; `chat/services/` (stream processor, conversation manager, suggestions,
  autocomplete). Les messages sont immuables (remplacés, identifiés par `clientId`). Polling : `shared/utils/poll-until.ts`.
- `corpus/`, `tools/<outil>/`, `admin/<écran>/`, `tips/`.
- `shared/` : `components`, `services` (API, auth…), `interceptors`, `model`, `pipes`, `utils`,
  `constants`.
- Les appels API passent par `ConfigurationService.backendApi(subPath)`.
- Citations (F2c) : le texte des réponses contient le marqueur canonique `[^n]` (numéro de la source affichée,
  événement SSE `citation {n, source}` puis `source` avec `citation`). Helpers dans `shared/utils/citations.ts`
  (traitement hors code, retrait, conversion pour la copie) ; pastilles posées après le rendu Markdown par la
  directive `markdown[zcoCitations]` (`shared/components/citations/`). Toute sortie texte d'une réponse (copie,
  lecture vocale, FAQ…) doit convertir ou retirer les marqueurs.
- Panneau des sources (F2d) : `shared/components/source-viewer/`. `SourceViewerStore` est fourni par la page hôte
  (chat, corpus) ; sans lui, les sources gardent le téléchargement et les liens directs. Le panneau charge
  `GET /api/source-documents/{id}` (`SourceView` : `display` choisi par le backend) puis `/file` pour un PDF.
  pdf.js (`pdfjs-dist`) n'est chargé qu'à l'ouverture d'un PDF (chunk à la demande, `PdfJsService`) ; worker,
  CMaps, polices standard, WASM et profils ICC sont copiés dans `assets/pdfjs` par `angular.json` (aucun CDN).
  Tests : remplacer `PdfJsService` par un faux (jsdom n'a ni canvas ni `Blob.arrayBuffer`) ; le rendu réel
  est couvert par l'e2e `source-viewer.spec.ts` (PDF généré par `e2e/support/pdf.ts`).

## Conventions de code

- Style Prettier : **tabulations**, guillemets simples, point-virgule, pas d'espace dans les accolades
  (`{a}`), pas de virgule finale, `arrowParens: avoid`.
- Injection avec `inject()` (`private readonly x = inject(X)`, déclaré après les champs publics : règle
  `member-ordering`), pas de paramètres de constructeur (`prefer-inject`). Services `providedIn: 'root'`.
- Composants standalone (`prefer-standalone`) : importer dans `imports` exactement ce que le template utilise
  (pas de module « fourre-tout ») ; utiliser le control flow (`@if`/`@for`), pas `*ngIf`/`*ngFor`.
- Tout texte visible passe par ngx-translate : ajouter la clé dans **fr, de et it** (y compris
  `aria-label`).
- Éviter `any` ; typer les modèles dans `shared/model`.
- Ajouter des tests Jest (`*.spec.ts` à côté du fichier) pour la logique de service/utilitaire modifiée ;
  un parcours utilisateur nouveau ou modifié s'accompagne d'un scénario e2e.

## Git

- Base d'intégration : `Jarvis` ; production : `master`. Jamais de commit direct sur ces branches.
- Branches de travail : `feature/<nom>` (ou `chore/…`, `bugfix/…`) depuis `Jarvis`, PR vers `Jarvis`.
- Messages de commit au format Conventional Commits (`feat: …`, `fix: …`, `chore: …`).
