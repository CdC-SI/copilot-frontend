# Chat Component - Architecture Refactorisée

## Vue d'ensemble

Le composant Chat a été refactorisé pour améliorer la lisibilité et réduire la complexité cognitive. Le composant principal est passé de ~600 lignes à ~230 lignes en extrayant les responsabilités dans des services dédiés.

## Architecture

### Services

#### 1. **ChatStreamProcessorService** (`chat-stream-processor.service.ts`)
Gère le traitement des chunks de streaming du LLM.

**Responsabilités :**
- Parse les tags XML dans les chunks (12 types de tags: tool, intent, source, routing, etc.)
- Gère les états de traitement des messages (isRetrieving, isValidating, isRouting, etc.)
- Extrait les sources et les suggestions depuis les messages
- Retourne des signaux pour les actions à effectuer (enableSearch, refreshConversations, etc.)

**Méthodes principales :**
- `processChunk(chunk: string, message: ChatMessage): StreamProcessingResult`

#### 2. **ChatConversationManagerService** (`chat-conversation-manager.service.ts`)
Gère l'état des conversations et des messages.

**Responsabilités :**
- Maintient la Map des messages par conversation
- Gère l'ID de conversation en cours de streaming
- Ajoute, récupère et supprime des messages
- Convertit les messages d'historique en messages de chat

**Méthodes principales :**
- `getMessages(conversationId: string | null): ChatMessage[]`
- `addMessage(...)`
- `setActiveStreamingConversation(conversationId: string | null)`
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
ragService.process().subscribe({
  next: chunk → processStreamChunk(chunk)
                  ↓
                streamProcessor.processChunk(chunk, message)
                  ↓
                Retourne { shouldEnableSearch, shouldRefreshConversations, hasNewSuggestion }
                  ↓
                Actions basées sur le résultat
})
```

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

