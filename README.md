# ZIA — Frontend (copilot-frontend)

Interface web de ZIA, l'assistant IA de la ZAS : chat RAG en streaming, gestion du corpus documentaire, outils (analyse de documents, contrôle d'identité, Sumex, synthèse de carrière) et administration.

Stack : Angular 17 (NgModules), Oblique 11, Angular Material, ngx-translate (fr/de/it), ngx-markdown, Jest.

## Prérequis

- Node.js 20+ et npm (registre interne Nexus configuré).
- Le backend `copilot-backend` accessible sur `http://localhost:8080` pour le développement local.

```bash
npm ci
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm start` / `npm run start:dev` | Serveur de dev sur `http://localhost:4200` (configuration development). |
| `npm run build:prod` | Build de production dans `dist/zas-eak-copilot-frontend/browser`. |
| `npm test` | Tests unitaires Jest. Un seul fichier : `npx ng test --test-path-pattern=<motif>`. |
| `npm run lint` / `npm run format` | ESLint (+ Prettier) ; `format` applique les corrections automatiques. |

Vérification rapide des types (TS + templates) sans build : `npx ngc -p tsconfig.app.json --noEmit`.

## Développement local

`proxy.conf.json` redirige `/zia/api/**` vers `http://localhost:8080` (backend). En local, l'intercepteur `BlueGatewayInterceptorV2` injecte un jeton de développement (`src/app/core/app-configuration/token.ts`, à ne pas commiter).

L'environnement (local, dev, test, prod…) est déterminé à l'exécution à partir de l'URL (`core/app-configuration`), il n'y a pas de fichiers `environment.*.ts`.

## Structure

```
src/app/
  chat/        Chat RAG (streaming, pièces jointes, formulaires dynamiques)
  corpus/      Documents personnels et sources officielles
  tools/       Outils métier (analyse de documents, identité, Sumex, carrière)
  admin/       Administration (feedbacks/KPI, FAQ, sources, workspaces, alertes…)
  shared/      Composants, services, modèles, intercepteurs et utilitaires partagés
  core/        Configuration applicative et gestion globale des erreurs
src/assets/i18n/   Traductions fr / de / it
```

## Docker

L'image est construite à partir du build Angular déjà produit (pas de build dans le Dockerfile) :

```bash
npm run build:prod
docker build -t copilot-frontend .
docker compose up   # http://localhost:8080
```

Base : `nginx:ubi-angular` (image ZAS), servie sur le port 8080.

## Conventions

Voir [`AGENTS.md`](AGENTS.md) pour les conventions de code, de branches et de validation.
