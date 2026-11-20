# Chat - Architecture

## Vue d'ensemble

La page de chat est découpée en un état central à base de signals (`ChatStore` et ses stores spécialisés), des services
métier sans état d'affichage, et des sous-composants `OnPush` qui ne font que lire l'état et appeler le store.

```
ChatComponent (conteneur : mise en page, dépôt/collage de pièces jointes, Échap, dialogues d'inscription)
├── ChatSidebarComponent   historique (chat-history), nouvelles conversations, aide sur les modes
├── ChatTimelineComponent  messages (chat-message → source-list, workspace-badge, message-action), bandeau LLM seul,
│                          défilement et bouton « dernière question »
└── ChatComposerComponent  formulaire dynamique, suggestions, saisie (FAQ, commandes), Stop/Envoyer,
    └── ChatAttachmentsComponent  pièces jointes (progression, échec, nouvel essai, téléchargement, délai dépassé)
```

## Stores (`src/app/chat/*.store.ts`)

Fournis par `ChatComponent` (`providers`) : l'état d'affichage est réinitialisé à chaque ouverture de la page et les
générations non terminées sont annulées à sa destruction (`ngOnDestroy`). Le cache des messages
(`ChatConversationManagerService`) et les suggestions restent au niveau `root`, comme avant.

- **`ChatStore`** : façade utilisée par les composants. Signals en lecture seule (`messages`, `conversationTitles`,
  `currentConversation`, `isGenerating`, `isStopping`, `attachments`, `replayableTurn`…) et méthodes
  explicites (`send`, `newChat`, `selectConversation`, `stopGeneration`, `regenerateLastAnswer`, `editLastQuestion`,
  `addAttachments`…). Les demandes de défilement passent par `scrollRequests`.
- **`ChatConversationsStore`** : titres de l'historique (triés, jamais modifiés en place), conversation courante,
  mode LLM seul, conversation provisoire puis titre généré.
- **`ChatGenerationStore`** : générations en cours (plusieurs à la fois), streaming, Stop (`STOP_TIMEOUT_MS`),
  abandon, erreurs (409 → restauration du tour, 401, flux incomplet).
- **`ChatAttachmentsStore`** : envoi, nouvel essai, suppression, téléchargement et suivi du traitement des pièces
  jointes (`pollUntil` : 15 s, 240 tentatives, puis bandeau et rafraîchissement manuel).

### Messages immuables

Un `ChatMessage` n'est jamais modifié en place : chaque mise à jour le remplace dans la liste (signal par conversation).
Pendant le streaming, les événements sont regroupés par frame (`FrameBatcher`) : une nouvelle version de la réponse par
frame. Chaque message porte un `clientId` stable (suivi `@for`, cible des générations), une génération dont la réponse
a été remplacée n'a donc plus d'effet.

## Services

### ChatStreamProcessorService (`chat-stream-processor.service.ts`)
Applique les événements typés du flux de réponse (T1) au message de l'assistant.

**Contrat (SSE `event: <type>` + `data: <json>`, cf. `shared/model/chat-stream-event.ts`) :**
- `start {conversationId, messageId}` : premier événement (`generationId` du message).
- `status {code, label}` : étape en cours, affichée tant que la réponse n'a pas commencé (`message.status`).
- `text_delta {text}`, `source {…}`, `suggestion {text}`, `workspace {name}`.
- `done {messageId, interrupted}` : terminal, émis **après** l'enregistrement de l'échange (`id`, `isCompleted`).
- `error {code, message}` : terminal, rien n'est enregistré.

**Méthodes :**
- `apply(message, events): StreamProcessingResult` : nouvelle version du message (`message`) et `completed`, `failed`,
  `newSuggestions` ; le message reçu n'est pas modifié.
- `interrupt(message): ChatMessage` : arrêt, réponse partielle conservée (nouvelle version).

### ChatConversationManagerService (`chat-conversation-manager.service.ts`)
Cache des messages par conversation (un signal par conversation, `null` = nouvelle conversation).
- `messages(conversationId)` (signal), `getMessages`, `find(conversationId, clientId)`
- `addMessage(...)`, `replaceMessage`, `patchMessage`, `setConversationMessages`, `deleteConversation`
- `initNewChat`, `transferNewChatToConversation`, `historyMessageToChatMessage`

### ChatSuggestionService (`chat-suggestion.service.ts`)
Suggestions d'actions : `suggestions` (signal : suggestions par défaut + suggestions propres à la dernière réponse),
`addSpecificSuggestion`, `setSpecificSuggestionsFromMessages`, `handleSuggestionAction` (formulaire ou préfixe).

### ChatAutocompleteService (`chat-autocomplete.service.ts`)
Autocomplétion des questions FAQ et des commandes (`/`) : `getOptionService`, `getOptionLabel`, `isCommand`.

### UserAuthDialogService (`user-auth-dialog.service.ts`)
Dialogues selon le statut de l'utilisateur (GUEST, JOHN_DOE, PENDING) : `isRegistered`, `showAuthDialog`.

### Constantes (`chat.constants.ts`)
`DEFAULT_CHAT_SUGGESTIONS`, `LANGUAGE_MAP`, `NEW_CHAT_KEY`.

## Stop et régénération (F3b)

- **Stop** : `POST /conversations/{id}/generations/{generationId}/stop` ; le flux continue jusqu'à `done {interrupted: true}`,
  émis après l'enregistrement de la réponse partielle (`stopping` pendant l'attente). Sans réponse du backend (404, erreur,
  10 s), la requête est abandonnée : la réponse est interrompue et `replaceableId = generationId`.
- **Navigation** : abandon de la requête (le backend enregistre la réponse partielle).
- **Régénérer / Modifier** : uniquement sur une réponse terminée ; envoie `replaceMessageId = id ?? replaceableId`. Le backend
  attend les enregistrements en cours et refuse (409) une réponse qui n'est plus la dernière : le tour est alors rétabli.
