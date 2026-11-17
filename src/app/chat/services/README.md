# Chat Component - Architecture Refactorisée

## Vue d'ensemble

Le composant Chat a été refactorisé pour améliorer la lisibilité et réduire la complexité cognitive. Le composant principal est passé de ~600 lignes à ~230 lignes en extrayant les responsabilités dans des services dédiés.

## Architecture

### Services

#### 1. **ChatStreamProcessorService** (`chat-stream-processor.service.ts`)
Applique les événements typés du flux de réponse (T1) au message de l'assistant.

**Contrat (SSE `event: <type>` + `data: <json>`, cf. `shared/model/chat-stream-event.ts`) :**
- `start {conversationId, messageId}` : premier événement (`generationId` du message).
- `status {code, label}` : étape en cours, affichée tant que la réponse n'a pas commencé (`message.status`).
- `text_delta {text}`, `source {…}`, `suggestion {text}`, `workspace {name}`.
- `done {messageId, interrupted}` : terminal, émis **après** l'enregistrement de l'échange (`id`, `isCompleted`).
- `error {code, message}` : terminal, rien n'est enregistré.

**Méthodes principales :**
- `processEvent(event: ChatStreamEvent, message: ChatMessage): StreamProcessingResult` (`completed`, `failed`, `newSuggestions`)
- `interrupt(message: ChatMessage)` : arrêt, réponse partielle conservée

#### 2. **ChatConversationManagerService** (`chat-conversation-manager.service.ts`)
Gère l'état des conversations et des messages.

**Responsabilités :**
- Maintient la Map des messages par conversation
- Ajoute, récupère et supprime des messages (`addMessage` renvoie le message créé, que chaque requête de streaming alimente directement)
- Convertit les messages d'historique en messages de chat

**Méthodes principales :**
- `getMessages(conversationId: string | null): ChatMessage[]`
- `addMessage(...): ChatMessage`
- `historyMessageToChatMessage(historyMessage: ChatHistoryMessage): ChatMessage`

#### 3. **ChatSuggestionService** (`chat-suggestion.service.ts`)
Gère les suggestions d'actions (traduire, résumer, expliquer, etc.).

**Responsabilités :**
- Fournit les suggestions par défaut
- Gère les suggestions spécifiques dynamiques
- Traite les actions de suggestion (affichage de formulaire ou remplissage du champ de recherche)

**Méthodes principales :**
- `getDefaultSuggestions(): ActionSuggestion[]`
- `handleSuggestionAction(action: string, messages: ChatMessage[])`
- `addSpecificSuggestion(action: string)`

#### 4. **ChatAutocompleteService** (`chat-autocomplete.service.ts`)
Gère l'autocomplétion pour les questions FAQ et les commandes.

**Responsabilités :**
- Détermine le service d'autocomplétion approprié (FAQ ou commandes)
- Formate les labels des options
- Vérifie les types d'options (Command vs IQuestion)

**Méthodes principales :**
- `getOptionService(isCommandMode: boolean, hasCurrentConversation: boolean)`
- `getOptionLabel(option: AutocompleteType, isCommandMode: boolean)`
- `isCommand(option: AutocompleteType): boolean`

#### 5. **UserAuthDialogService** (`user-auth-dialog.service.ts`)
Gère l'affichage des dialogues d'authentification.

**Responsabilités :**
- Vérifie si l'utilisateur est enregistré
- Affiche le dialogue approprié selon le statut (GUEST, JOHN_DOE, PENDING)

**Méthodes principales :**
- `isRegistered(): boolean`
- `showAuthDialog(...): MatDialogRef<any> | null`

### Constantes

#### **chat.constants.ts**
Contient les constantes partagées :
- `DEFAULT_CHAT_SUGGESTIONS` - Les 5 suggestions par défaut
- `LANGUAGE_MAP` - Mapping des codes de langue (de, fr, it)
- `NEW_CHAT_KEY` - Clé pour les nouvelles conversations

## Composant Principal

Le `ChatComponent` agit maintenant comme un orchestrateur léger qui :
- Délègue le traitement du streaming au `ChatStreamProcessorService`
- Délègue la gestion des messages au `ChatConversationManagerService`
- Délègue la gestion des suggestions au `ChatSuggestionService`
- Délègue l'autocomplétion au `ChatAutocompleteService`
- Délègue l'authentification au `UserAuthDialogService`

### Flux de streaming simplifié

```
sendToLLM()
  ↓
ragService.process().subscribe({            // Observable<ChatStreamEvent>, regroupé par frame (FrameBatcher)
  next: event → processStreamEvent(event)
                  ↓
                streamProcessor.processEvent(event, message)
                  ↓
                Retourne { completed, failed, newSuggestions }
                  ↓
                Actions basées sur le résultat
  complete: si la conversation est provisoire → refreshConversations() (titre généré, sélection par conversationId)
})
```

### Stop et régénération (F3b)

- **Stop** : `POST /conversations/{id}/generations/{generationId}/stop` ; le flux continue jusqu'à `done {interrupted: true}`,
  émis après l'enregistrement de la réponse partielle (`stopping` pendant l'attente). Sans réponse du backend (404, erreur,
  10 s), la requête est abandonnée : la réponse est interrompue et `replaceableId = generationId`.
- **Navigation** : abandon de la requête (le backend enregistre la réponse partielle).
- **Régénérer / Modifier** : uniquement sur une réponse terminée ; envoie `replaceMessageId = id ?? replaceableId`. Le backend
  attend les enregistrements en cours et refuse (409) une réponse qui n'est plus la dernière : le tour est alors rétabli.

## Avantages du refactoring

1. **Séparation des préoccupations** - Chaque service a une responsabilité unique et bien définie
2. **Réduction de la complexité cognitive** - Le composant principal est maintenant ~60% plus petit
3. **Meilleure testabilité** - Chaque service peut être testé isolément
4. **Maintenance facilitée** - Les changements sont localisés dans les services appropriés
5. **Réutilisabilité** - Les services peuvent être injectés dans d'autres composants si nécessaire
6. **Lisibilité améliorée** - La logique métier complexe est déplacée hors du composant

## Migration

### Avant
```typescript
// 598 lignes avec méthode buildResponseWithLLMChunk de 180 lignes
// 13 services injectés
// Logique métier mélangée avec la logique UI
```

### Après
```typescript
// 230 lignes
// 5 services métier + 8 services utilitaires
// Séparation claire entre orchestration et logique métier
```

## Compatibilité

✅ Aucune modification de l'interface publique du composant
✅ Le template HTML reste inchangé
✅ Toutes les fonctionnalités sont préservées
✅ Aucune breaking change

