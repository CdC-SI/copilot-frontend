# AGENTS.md — copilot-frontend

Frontend Angular de ZIA (ZAS/EAK-Copilot) : chat RAG en streaming, gestion des corpus/sources,
outils métier (`/tools` : résumé de carrière, analyse de documents, identity check, Sumex) et
administration (workspaces, FAQ, sources, alertes, feedback/KPI, comptes, rétention).

## Stack

- **Angular 17** (architecture à **NgModules** : `AppModule`, `SharedModule`, `MaterialModule` ;
  aucun composant standalone pour l'instant), **TypeScript 5.4**, **RxJS**.
- UI : **Oblique 11** (`@oblique/oblique`, master layout) + Angular Material/CDK + `zas-design-system`
  (environnements, gateway, jeton `blue`).
- i18n : **ngx-translate**, fichiers `src/assets/i18n/{fr,de,it}.json`.
- Tests : **Jest** via `@angular-builders/jest` (`tests/` : `jest.config.js`, `setupJest.ts`, mocks).
- Lint/format : ESLint (`@angular-eslint`) + Prettier (`.prettierrc`).

## Commandes

- Dev : `npm run start:dev` (proxy `/zia/api/**` → `http://localhost:8080`, voir `proxy.conf.json`).
- Build : `npm run build` ; production : `npm run build:prod`.
- Tests : `npm test` (Jest) ; un fichier : `npx ng test --test-path-pattern=<motif>`.
- Lint : `npm run lint` ; correction auto : `npm run format`.
- Après une modification : au minimum `npm run build` (ou les diagnostics IDE), plus `npm run lint`
  sur les fichiers touchés, avant de conclure.

## Organisation (`src/app`)

- `core/app-configuration/` : configuration par environnement (détection via l'URL), gateway,
  authentification. `token.ts` contient un jeton mock **local** : ne jamais committer de modification.
- `chat/` : `chat.component` (gros composant, découpage prévu — FE4) et `chat/services/`
  (stream processor, conversation manager, suggestions, autocomplete).
- `corpus/`, `tools/<outil>/`, `admin/<écran>/`, `tips/`.
- `shared/` : `components`, `services` (API, auth…), `interceptors`, `model`, `pipes`, `utils`,
  `constants`, `material`.
- Les appels API passent par `ConfigurationService.backendApi(subPath)`.

## Conventions de code

- Style Prettier : **tabulations**, guillemets simples, point-virgule, pas d'espace dans les accolades
  (`{a}`), pas de virgule finale, `arrowParens: avoid`.
- Injection par constructeur avec `private readonly`. Services `providedIn: 'root'`.
- Nouveaux composants : rester cohérent avec les NgModules existants tant que la migration Angular
  (FE1) n'est pas faite.
- Tout texte visible passe par ngx-translate : ajouter la clé dans **fr, de et it** (y compris
  `aria-label`).
- Éviter `any` ; typer les modèles dans `shared/model`.
- Ajouter des tests Jest (`*.spec.ts` à côté du fichier) pour la logique de service/utilitaire modifiée.

## Git

- Base d'intégration : `Jarvis` ; production : `master`. Jamais de commit direct sur ces branches.
- Branches de travail : `feature/<nom>` (ou `chore/…`, `bugfix/…`) depuis `Jarvis`, PR vers `Jarvis`.
- Messages de commit au format Conventional Commits (`feat: …`, `fix: …`, `chore: …`).
