# AGENTS.md — copilot-frontend

Frontend Angular de ZIA (ZAS/EAK-Copilot) : chat RAG en streaming, gestion des corpus/sources,
outils métier (`/tools` : résumé de carrière, analyse de documents, identity check, Sumex) et
administration (workspaces, FAQ, sources, alertes, feedback/KPI, comptes, rétention).

## Stack

- **Angular 22** (architecture à **NgModules** : `AppModule`, `SharedModule`, `MaterialModule` ;
  composants `standalone: false`, migration standalone prévue en FE1b), **TypeScript 6.0**, **RxJS**,
  Node 22.22+/24.15+ (`engines`). Templates en control flow (`@if`/`@for`/`@switch`) ;
  `ChangeDetectionStrategy.Eager` explicite (passage OnPush prévu avec FE1b/FE4). Le `router-outlet` est dans
  `ob-master-layout`, OnPush : `AppComponent.ngDoCheck` le marque à chaque cycle pour que les pages routées se
  mettent à jour après un timer ou une réponse HTTP (à retirer quand elles seront en signals).
- UI : **Oblique 16** (`@oblique/oblique`, master layout, inputs en signals) + Angular Material/CDK 22
  + **ZDS 22** (`@zas-design-system/zas-design-system` : environnements, gateway, jeton `blue`).
- i18n : **ngx-translate 18** (`TranslateService` fourni par `provideObliqueConfiguration`,
  `TranslatePipe` exporté par `SharedModule`, `getCurrentLang()`), fichiers `src/assets/i18n/{fr,de,it}.json`.
- Tests : **Jest 30** via `@angular-builders/jest` (`tests/` : `jest.config.js`, `setupJest.ts`, mocks).
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
- Nouveaux composants : rester cohérent avec les NgModules existants tant que la migration standalone
  (FE1b) n'est pas faite ; utiliser le control flow (`@if`/`@for`), pas `*ngIf`/`*ngFor`.
- Tout texte visible passe par ngx-translate : ajouter la clé dans **fr, de et it** (y compris
  `aria-label`).
- Éviter `any` ; typer les modèles dans `shared/model`.
- Ajouter des tests Jest (`*.spec.ts` à côté du fichier) pour la logique de service/utilitaire modifiée.

## Git

- Base d'intégration : `Jarvis` ; production : `master`. Jamais de commit direct sur ces branches.
- Branches de travail : `feature/<nom>` (ou `chore/…`, `bugfix/…`) depuis `Jarvis`, PR vers `Jarvis`.
- Messages de commit au format Conventional Commits (`feat: …`, `fix: …`, `chore: …`).
