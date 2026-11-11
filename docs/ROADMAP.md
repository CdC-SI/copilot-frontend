# ZIA – Roadmap d'amélioration (technique & fonctionnel)

> Document vivant. Il couvre l'écosystème ZIA : `copilot-frontend`, `copilot-backend`, `zia-rag` et `zia-translation`. Les identifiants (T*, B*, FE*, F*, V*) permettent de référencer les propositions dans les issues et les PR.

## 1. Contexte et diagnostic

Périmètre analysé : `copilot-frontend` (Angular 17), `copilot-backend` (Spring Boot 4.1.1, Spring AI 2.0.1, Java 25), `zia-rag`, `zia-translation`.

**Points forts actuels**
- Stack backend moderne (Boot 4 / Spring AI 2 / Java 25). Il y a déjà une boucle agentique : le LLM décide d'appeler `RAGTool` et `ConversationAttachmentTool` (`@Tool` + `ToolContext`).
- RAG déjà poussé : réécriture, compression et multi-query, hybride vector + BM25, reranker externe, filtres par workspace ou par user, inférence du workspace et suivi des corrections.
- Des briques métier existent déjà : résumé de carrière par NAVS (Gaime / Nuxeo / JMS), Sumex (vision et conversion XML), identity check (VIPS), OCR, classification, traduction, FAQ, feedback et KPI.
- `zia-translation` est bien conçu : nombreux tests, extraction structurée avec score de confiance, outil acronymes avec garde-fou anti-boucle, développement piloté par specs avec l'agent Copilot.

**Faiblesses principales**
- Ces briques ne sont pas reliées entre elles. Les « outils » métier sont des écrans séparés (`/tools?menu=`), pas des outils que le chat peut appeler. `zia-rag` et `zia-translation` ne sont appelés ni par le backend ni par le front.
- La logique RAG existe deux fois (backend et `zia-rag`), avec des comportements différents : pas de seuil ni de réécriture de requête dans `zia-rag`.
- Le protocole de streaming repose sur des pseudo-balises XML dans le texte (`<tool_use>`, `<routing>`, `<source>`…), parsées par regex côté front. C'est fragile et ça perd l'information : quel outil a tourné, avec quels arguments, pour quel résultat.
- Front vieillissant :
  - Angular 17 n'est plus supporté, il manque 3 à 4 versions majeures.
  - 2 fichiers de test pour environ 80 composants et services.
  - `chat.component` fait 751 lignes et injecte 14 services.
  - Le Dockerfile lance `ng serve` en production.
- Côté backend :
  - Pas de `ChatMemory`, pas d'advisors standard (`RAGAdvisor` est du code mort), prompts en dur (`RAGPrompts` fait 920 lignes).
  - Pas de suivi des tokens, pas de retry ni de fallback sur les appels LLM, pas de tracing distribué, pas d'évaluation.
  - Environ 9 % de classes de test.

---

## 2. Améliorations techniques

### 2.1 Fondations transverses (prérequis à la vision « hub agentique »)

| # | Amélioration | Pourquoi | Complexité |
|---|---|---|---|
| T1 | **Protocole de streaming typé**. Remplacer les balises XML par des événements SSE nommés et en JSON (`event: status` / `tool_call` / `tool_result` / `text_delta` / `source` / `suggestion` / `approval_required` / `done` / `error`). Une option est de s'aligner sur un standard existant (AG-UI ou le format Vercel AI SDK) pour pouvoir changer de front plus tard. | Socle de toute l'UX agentique : timeline des étapes, cartes de résultat, validation par l'utilisateur. Supprime les bugs de regex. | Moyenne |
| T2 | **Un seul service RAG**. Faire de `zia-rag` LE service de retrieval : y porter réécriture, multi-query, seuils et reranking, et ajouter une fusion RRF pour l'hybride. Le backend l'appelle comme un outil, idéalement via MCP. Sinon, supprimer `zia-rag`. | Supprime le doublon, rend le RAG réutilisable par d'autres applications ou agents, et permet de le faire évoluer indépendamment. | Moyenne |
| T3 | **Observabilité LLM de bout en bout**. Export OpenTelemetry (Micrometer Tracing) vers Langfuse : le repo `copilot-langfuse` existe déjà dans le workspace. Ajouter des métriques de tokens et de coût par utilisateur, workspace et outil, et propager le `X-Correlation-Id` du front jusqu'aux outils. | Indispensable pour déboguer les agents multi-étapes et suivre les coûts et la latence. | Faible à moyenne |
| T4 | **Pipeline d'évaluation (LLMOps)**. Construire un jeu « golden » à partir des feedbacks négatifs et des FAQ validées. Utiliser les évaluateurs Spring AI (`RelevancyEvaluator`, `FactCheckingEvaluator`) ou un LLM-as-judge. Lancer la campagne en CI (job Jenkins nocturne) à chaque changement de prompt, de modèle ou de chunking. | Aujourd'hui, toute modification de prompt ou de modèle part sans filet. | Moyenne |
| T5 | **Garde-fous et conformité**. Détection et masquage des données personnelles (NAVS, noms) avant les logs ou les traces. Protection contre la prompt injection venant des documents et des résultats d'outils. `SafeGuardAdvisor`. Le repo `ai-guard` du workspace pourrait servir. Audit immuable de chaque appel d'outil. | Données AVS/AI sensibles (nLPD). Devient critique dès que ZIA pilote des applications. | Moyenne |

### 2.2 Backend (`copilot-backend`)

| # | Amélioration | Détail |
|---|---|---|
| B1 | `ChatClient.Builder` centralisé | Un bean unique avec des advisors par défaut (logging, safeguard, usage de tokens, mémoire), au lieu des 3 appels `ChatClient.create(...)` dispersés. |
| B2 | Mémoire conversationnelle Spring AI | `JdbcChatMemoryRepository` avec `MessageChatMemoryAdvisor`, ou au minimum une fenêtre glissante avec résumé des anciens tours. Remplace l'historique reconstruit à la main et maîtrise la taille du contexte. |
| B3 | Prompts externalisés | Templates `.st` (`PromptTemplate`) versionnés, voire stockés en base et éditables par les admins avec un historique. Découper `RAGPrompts` (920 lignes). Relier chaque version de prompt aux évaluations (T4). |
| B4 | Résilience des appels LLM | Resilience4j (retry, circuit breaker, timeouts) et un modèle de repli. Aujourd'hui seuls les réglages par défaut du SDK s'appliquent. |
| B5 | Nettoyage | Supprimer ou adopter `RAGAdvisor` (code mort). Retirer la config `py-backend` héritée. Rebrancher `PublicChatController` sur le flux à outils, ou le supprimer. Corriger le TODO du keystore identity-check. |
| B6 | Sécurité de la configuration | Sortir `client-keystore.p12` de `src/main/resources` pour le passer en secret OCP. Niveaux de log par défaut à INFO, au lieu de DEBUG/TRACE. |
| B7 | Tests | Tests unitaires et d'intégration sur `RAGTool`, `RAGChatService`, retrievers, joiner et reranker, avec un stub HTTP du LLM (le mécanisme existe déjà dans `MigrationStartupIT`). |
| B8 | Performance | Threads virtuels Java 25 (`spring.threads.virtual.enabled`) pour les appels LLM bloquants. Utiliser Caffeine (déjà en dépendance, jamais utilisé) pour settings, workspaces et embeddings de requêtes fréquentes. Paralléliser les étapes RAG indépendantes. |
| B9 | Qualité du RAG | Seuil de similarité. Chunking structurel ou contextuel (« contextual retrieval »). Métadonnées de version et de validité des directives (avec filtre « version en vigueur à la date X »). Citations au niveau du passage. Cache sémantique des questions fréquentes, en lien avec la FAQ. |
| B10 | Jobs asynchrones | Uniformiser `@Async`, poller d'embedding et résumés dans un modèle « Task » commun, persistant et observable. Ce même modèle servira aux tâches agentiques longues (F8). |

### 2.3 Frontend (`copilot-frontend`)

| # | Amélioration | Détail |
|---|---|---|
| FE1 | Montée de version Angular | Passer de 17 à 20/21 étape par étape avec `ng update`, et Oblique en conséquence. Composants standalone, signals, nouveau control flow, guards fonctionnels. |
| FE2 | Streaming robuste | `AbortController` (bouton « Stop » et annulation à la navigation). Vérifier `response.ok`. Ne pas perdre la fin de buffer incomplète. Passer par un client commun pour réutiliser le rafraîchissement du token `blue`, qui court-circuite aujourd'hui l'interceptor. Gérer la reconnexion. |
| FE3 | Performance du rendu | Regrouper les chunks (par `requestAnimationFrame` ou throttle) avant le re-rendu Markdown. `OnPush` et signals sur les messages. Virtual scroll pour les longues conversations. Lazy loading des routes `admin` et `tools` pour sortir chart.js et jspdf du bundle principal. |
| FE4 | Découpage de `chat.component` | Créer un `ChatStore` (signals) et des sous-composants : timeline, composer, panneau sources, panneau contexte. Réunir les trois logiques de polling (chat, corpus, identity check) dans un utilitaire commun. |
| FE5 | Tests | Tests Jest sur services et stream processor, et quelques parcours e2e Playwright : chat, upload, admin. |
| FE6 | Hygiène | Supprimer les dépendances inutilisées (`angular-oauth2-oidc`, `jwt-decode`) et déclarer `nanoid`. Purger les champs morts de `ChatRequest`. Typer les `any` (vision, identity check). Ajouter un `ErrorHandler` global. Mettre à jour le README. |
| FE7 | Docker et production | Build multi-étapes : build Node, puis nginx (non-root) qui sert `dist/`, avec une image Node versionnée. |
| FE8 | Accessibilité et i18n | Région `aria-live` pour la réponse streamée. Traduire les `aria-label` codés en dur. Script de contrôle des clés i18n manquantes entre fr, de et it (fr compte environ 10 % de contenu en plus). Faire suivre `LOCALE_ID` la langue choisie. |

### 2.4 Services satellites
- `zia-translation` :
  - Les job stores en mémoire et le stockage sur le système de fichiers empêchent de passer à plusieurs replicas. Persister en base ou Redis (le repo `copilot-redis` existe).
  - La spec `java-21` contredit le pom en Java 25 : à clarifier.
- Étendre le workflow « spec → issue → agent Copilot → PR » de `zia-translation` (`CONTRIBUTING.md`, `.copilot/`) aux repos `copilot-backend` et `copilot-frontend`.

---

## 3. Améliorations fonctionnelles et UX

### 3.1 UX du chat (gains rapides et visibles)
- **F1 – Timeline des étapes de l'agent** (dépend de T1). Afficher « Recherche dans les directives AI… → 5 sources → Lecture de la pièce jointe… », avec les outils appelés. Bloc dépliable pour les experts. Renforce la confiance et l'explicabilité.
- **F2 – Citations vérifiables**. Cliquer sur une source ouvre le PDF à la bonne page, passage surligné, dans un panneau latéral. Badge « version en vigueur / obsolète ».
- **F3 – Contrôle de la génération**. Boutons Stop, Régénérer, Modifier la question. Poser une question de suivi sur un passage sélectionné (« explique ce paragraphe »).
- **F4 – Canvas / document de travail**. Pour la rédaction (courriers, notes, décisions), un éditeur à côté du chat où ZIA propose et l'utilisateur corrige. Export DOCX/PDF.
- **F5 – Bibliothèque de prompts et de « recettes » partagées**. Commandes `/` paramétrables, par équipe ou par workspace. Ex. `/courrier-refus`, `/résumé-dossier`, `/comparer-versions`. Le mode commande existe déjà côté front.
- **F6 – Dictée vocale** (STT). Le TTS existe déjà. Préférences personnelles mémorisées : langue de réponse, ton, signature, service.
- **F7 – Traduction intégrée au chat**. Brancher `zia-translation` comme outil : « traduis ma réponse en allemand », « traduis cette pièce jointe », avec le glossaire officiel.

### 3.2 Cas d'usage métier à forte valeur
- **F8 – Tâches longues en arrière-plan avec notification**. « Prépare le résumé du dossier X et préviens-moi. » Une boîte « Mes tâches » dans ZIA. Généralise le pattern déjà en place pour les résumés de carrière (B10).
- **F9 – Vue 360° d'un dossier (NAVS)**. Un panneau « contexte dossier » épinglé à la conversation. ZIA agrège documents GED (Nuxeo/Gaime), résumé de carrière et dernières pièces, et toutes les questions sont posées dans ce contexte.
- **F10 – Tri du courrier entrant**. Classification, extraction structurée (profils de `zia-translation`), proposition de traitement et de service destinataire, brouillon de réponse.
- **F11 – Vérification de complétude ou de conformité**. « Ce dossier de demande AI est-il complet ? » Checklist générée depuis les directives (RAG et sortie structurée), avec les pièces manquantes et leurs références.
- **F12 – Calculs déterministes via outils**. Barèmes, tarifs AI (`ii_tariffs` existe déjà), délais, échéances. Le LLM orchestre mais ne calcule jamais lui-même.
- **F13 – Suivi des changements réglementaires**. « Qu'est-ce qui a changé entre la version N et N+1 de la directive X ? » Diff sémantique, avec alerte aux utilisateurs des workspaces concernés (les alertes existent déjà).
- **F14 – Contrôle de factures Sumex dans le chat**. Déposer une facture déclenche extraction, contrôle de plausibilité tarifaire et anomalies, avec conversion en XML. Les briques existent déjà.
- **F15 – Formation et onboarding**. Mode « tuteur » ou quiz sur les directives pour les nouveaux collaborateurs, avec cas pratiques générés.
- **F16 – Boucle d'amélioration continue**. Le feedback négatif ouvre une revue par un expert. La correction alimente la FAQ et le jeu d'évaluation (T4). Tableau de bord des « trous » documentaires : questions sans bonne source, ce qui déclenche une demande de source.

### 3.3 Vision : ZIA, hub agentique des gestionnaires
- **V1 – MCP comme standard d'intégration**.
  - Chaque application métier est exposée comme serveur MCP : GED, Gaime, Sumex, identity check, traduction, RAG, résumés, puis les applications tierces. On utilise le starter Spring AI MCP server avec les annotations `@McpTool`.
  - `copilot-backend` devient client MCP et orchestrateur.
  - Un registre d'outils filtre les outils selon le rôle, le workspace et le statut interne ou externe de l'utilisateur.
- **V2 – Identité déléguée**. Les outils agissent avec les droits de l'utilisateur : propagation ou échange du token `blue` (on-behalf-of), jamais un compte technique tout-puissant. Audit complet (T5).
- **V3 – Humain dans la boucle**.
  - Les outils en lecture s'exécutent automatiquement.
  - Les outils en écriture (créer une tâche, envoyer un courrier, modifier un dossier) produisent une carte « Action proposée » que l'utilisateur valide, modifie ou refuse. Côté Spring AI, on désactive l'exécution interne des outils pour ces cas.
- **V4 – Agents spécialisés et routage**.
  - Les workspaces servent de base aux agents de domaine (AVS, AI, APG…) : chacun a ses outils et ses sources.
  - Un routeur ou orchestrateur délègue, en reprenant les patterns décrits dans Spring AI (routing, orchestrator-workers, evaluator-optimizer).
  - Recherche dynamique d'outils quand le catalogue grossit.
- **V5 – ZIA partout**.
  - Un widget ou panneau latéral intégrable dans les autres applications, avec des liens profonds porteurs de contexte (`/chat?navs=…&doc=…`).
  - L'API publique (`/api/public/v1/chat`) est rebranchée pour que les autres applications appellent ZIA.
  - Option : exposer ZIA lui-même comme serveur MCP.
- **V6 – Interface générative**. Les résultats d'outils s'affichent en composants riches : tableaux, formulaires pré-remplis, fiches assuré, graphiques. Ils ne se limitent plus à du Markdown.

---

## 4. Feuille de route proposée (par phases, sans dates)

1. **Phase 0 – Gains rapides** : FE2, FE6, FE7, B5, B6, FE3 (regroupement des chunks), F3.
2. **Phase 1 – Fondations** : T1, T3, B1, B2, B3, B4, FE1, FE4, puis T2.
3. **Phase 2 – Qualité et confiance** : T4, T5, B7, FE5, B9, F1, F2, F16.
4. **Phase 3 – Valeur métier** : F7, F12, F14, F9, F10, F11, F5, F4, F8.
5. **Phase 4 – Hub agentique** : V1, V2, V3, V4, V6, V5.

## 5. Notes et hypothèses
- Ces propositions s'appuient sur la lecture du code. Les noms d'applications tierces à piloter (au-delà de Gaime, Nuxeo, Sumex et VIPS) restent à identifier avec les métiers.
- Il faut vérifier la compatibilité des modèles internes (vLLM, endpoints OpenAI-compatibles) avec le tool calling parallèle et la sortie structurée stricte avant V1 et V4.
- Il faut valider avec le juridique et la protection des données (nLPD) avant que ZIA ne déclenche des actions en écriture (V3).

