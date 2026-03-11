# Career Summary Component

## Description

Le composant `CareerSummaryComponent` permet aux administrateurs de générer et consulter des résumés de carrière scolaire pour un assuré ou sa famille via leur numéro AVS (NAVS).

## Fonctionnalités

### 1. Création de résumés
- Input pour saisir un numéro AVS au format `756.1234.5678.90`
- Validation du format du numéro AVS
- Création d'une tâche de résumé via l'API backend
- Si un résumé existe déjà pour ce NAVS, il est retourné directement

### 2. Liste des tâches de résumé
- Affichage de toutes les tâches de résumé avec leur statut :
  - **EN_COURS** : Traitement en cours (icône horloge, orange)
  - **TERMINEE** : Traitement terminé (icône checkmark, vert)
  - **ERREUR** : Erreur lors du traitement (icône cancel, rouge)
- Bouton de rafraîchissement manuel de la liste
- Tri des tâches par date de création (plus récentes en premier)
- Affichage de la date de création pour chaque tâche

### 3. Visualisation des résumés
- Affichage du contenu Markdown des résumés terminés
- Navigation simple entre la liste et la vue détaillée
- Informations contextuelles (NAVS, date de dernière mise à jour)

## API Backend

### Endpoints utilisés

#### POST `/api/summaries/{navs}`
Crée une nouvelle tâche de résumé pour le numéro AVS spécifié.
- **Retour 201 CREATED** : Nouvelle tâche créée
- **Retour 200 OK** : Tâche existante déjà terminée

#### GET `/api/summaries`
Récupère la liste de toutes les tâches de résumé.

#### GET `/api/summaries/{id}`
Récupère le détail d'une tâche terminée avec son contenu Markdown.
- **Retour 200 OK** : Résumé disponible
- **Retour 404 NOT FOUND** : Tâche introuvable
- **Retour 409 CONFLICT** : Tâche non terminée

## Permissions

Ce composant est accessible uniquement aux utilisateurs ayant le rôle **ADMIN**.

## Traductions

Le composant est entièrement traduit en 3 langues :
- Français (fr)
- Allemand (de)
- Italien (it)

Toutes les clés de traduction sont préfixées par `career-summary.*`

## Structure des fichiers

```
tools/career-summary/
├── career-summary.component.ts       # Logique du composant
├── career-summary.component.html     # Template
└── career-summary.component.scss     # Styles
```

## Modèles de données

Définis dans `shared/model/summary.ts` :
- `SummaryTaskStatus` : Enum des statuts
- `SummaryTaskCreatedResponse` : Réponse de création
- `SummaryTaskResponse` : Informations d'une tâche
- `SummaryDetailResponse` : Détail complet avec Markdown

## Service

Le service `SummaryService` (`shared/services/summary.service.ts`) gère toutes les communications avec l'API backend.

## Dépendances

- Angular Material (cards, buttons, forms, icons, lists, spinner)
- ngx-markdown (affichage du contenu Markdown)
- Oblique (design system)
- ReactiveFormsModule (gestion du formulaire)

## Utilisation

Le composant est intégré dans la page Tools Home et peut être sélectionné via le bouton "Résumé de carrière scolaire" (visible uniquement pour les admins).

