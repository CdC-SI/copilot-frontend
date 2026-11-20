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
- Lint/format : ESLint 10 en flat config (`eslint.config.mjs`, paquets `angular-eslint` et
  `typescript-eslint`) + Prettier (`.prettierrc`).
- `package.json` : `allowScripts` liste les paquets autorisés à exécuter un script d'installation,
  épinglés par version : à revoir à chaque montée de version (`npm approve-scripts`, npm ≥ 11.16).

## Commandes

- Dev : `npm run start:dev` (proxy `/zia/api/**` → `http://localhost:8080`, voir `proxy.conf.json`).
- Build : `npm run build` ; production : `npm run build:prod`.
- Tests : `npm test` (Jest) ; un fichier : `npx ng test --test-path-patterns=<motif>`.
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
- Ajouter des tests Jest (`*.spec.ts` à côté du fichier) pour la logique de service/utilitaire modifiée.

## Git

- Base d'intégration : `Jarvis` ; production : `master`. Jamais de commit direct sur ces branches.
- Branches de travail : `feature/<nom>` (ou `chore/…`, `bugfix/…`) depuis `Jarvis`, PR vers `Jarvis`.
- Messages de commit au format Conventional Commits (`feat: …`, `fix: …`, `chore: …`).
