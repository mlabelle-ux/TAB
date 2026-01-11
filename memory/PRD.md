# PRD - Gestion des horaires des conducteurs d'autobus scolaire

## Description du projet
Application web pour la gestion des horaires des conducteurs d'autobus scolaire pour Les Berlines Trip à Bord.

## Stack technique
- **Frontend:** React, Tailwind CSS, Shadcn/UI, @dnd-kit
- **Backend:** FastAPI (Python)
- **Base de données:** MongoDB

## Fonctionnalités implémentées

### Vue Horaire (Dashboard) ✅
- [x] Affichage des horaires du Lundi au Vendredi
- [x] Colonnes fixes pour "Conducteur" et "Circuit" à gauche
- [x] Colonnes "Jour" et "Semaine" à droite pour les totaux
- [x] Plage horaire 5h00 à 18h59
- [x] Bouton "Aujourd'hui" pour revenir à la date actuelle
- [x] Icône calendrier pour sélection de date (corrigé UTC-5 - 11 janv. 2026)
- [x] Tri par Circuit (numérique) ou par Nom (alphabétique)
- [x] Icône handicapé ♿ à côté du circuit si "Adapté"
- [x] Info-bulle (tooltip) au survol des blocs

### Modes de vue ✅ (Corrigé 11 janv. 2026)
- [x] **Mode Détaillé:** Affiche les blocs d'école + blocs HLP jaunes séparés avant/après
- [x] **Mode Complet:** Affiche les blocs avec HLP inclus dans leur durée
- [x] **Mode Abrégé:** Affiche les quarts de travail (AM bleu, PM orange, MIDI vert) au lieu des blocs individuels

### Section Remplacements ✅
- [x] Section fixe en haut du tableau
- [x] Blocs positionnés selon leur heure prévue sur la timeline
- [x] Badge affichant le nombre d'éléments non assignés
- [x] Affichage des blocs des conducteurs absents (rouge)
- [x] Affichage des blocs non assignés (orange)
- [x] Zone droppable pour désassigner temporairement
- [x] **Blocs restent visibles** après drag vers Remplacements (corrigé 11 janv. 2026)

### Drag and Drop Temporaire ✅
- [x] Réassignation temporaire pour la journée seulement
- [x] Stockage en backend via `/api/temporary-reassignments`
- [x] Glisser vers un conducteur = réassigner pour la journée
- [x] Glisser vers Remplacements = désassigner pour la journée
- [x] Indicateur visuel (bordure orange) pour les blocs réassignés
- [x] Toast de confirmation pour chaque action

### Circuit visible quand absent ✅
- [x] Numéro de circuit reste visible en rouge quand conducteur absent
- [x] Badge "ABS" affiché
- [x] Ligne avec fond rouge subtil

### Gestion des Employés ✅
- [x] CRUD complet
- [x] Champs: Nom, Date d'embauche, Téléphone, Courriel, Berline, Matricule
- [x] En-têtes de colonnes figés (sticky header)
- [x] Tri par colonne
- [x] **Case "Inactif"** avec icône UserX (ajouté 11 janv. 2026)
- [x] **Compteur "X actifs"** dans l'en-tête
- [x] **Case "Afficher inactifs"** pour filtrer
- [x] **Employés inactifs cachés** des listes déroulantes et vue horaire
- [x] **Doublons de berline permis** si l'un des employés est inactif

### Gestion des Écoles ✅
- [x] CRUD complet avec couleur unique
- [x] Catégorisation par Type, Commission scolaire, Ville
- [x] Modification des listes de catégories

### Gestion des Assignations ✅
- [x] Création de circuits avec quarts (AM/MIDI/PM)
- [x] Quarts spéciaux Admin et Mécano avec heures fixes modifiables
- [x] **Case "Adapté?"** avec seulement l'icône ♿ (mot retiré 11 janv. 2026)
- [x] Périodes d'assignation prédéfinies
- [x] Assignations triées par circuit
- [x] Conducteurs triés alphabétiquement (actifs seulement)
- [x] Sélection des jours de la semaine (L,M,M,J,V) par bloc

### Gestion des Absences ✅
- [x] Création/modification/suppression des absences
- [x] Sélection de quarts spécifiques
- [x] Conducteurs triés alphabétiquement (actifs seulement)

### Jours Fériés et Congés ✅
- [x] Option **Férié** ou **Congé**
- [x] Sélection journée unique ou période
- [x] Fériés/Congés n'impactent pas Admin et Mécano

### Tâches Temporaires ✅
- [x] Création de tâches ponctuelles
- [x] Conducteurs triés alphabétiquement (actifs seulement)
- [x] Détection de conflits d'horaire
- [x] Draggable pour réassignation

### Rapports PDF ✅
- [x] Format portrait
- [x] En-têtes sur chaque page
- [x] 3 options de dates (1-15, 16-fin, personnalisé)
- [x] Options de tri: Alphabétique, Matricule, Date d'embauche

### Calcul des heures ✅
- [x] Fusion des intervalles pour éviter les doubles comptages
- [x] Quarts Admin/Mécano: heures fixes modifiables
- [x] Admin/Mécano non impactés par jours fériés/congés

### Navigation ✅
- [x] Tous les onglets ont des icônes

## Tâches futures (Backlog)
- [ ] Historique des réassignations (journal d'audit)
- [ ] Pop-up de gestion de conflits lors de chevauchements > 5 min
- [ ] Exportation des données en format Excel/CSV
- [ ] Les heures de travail suivent le déplacement des quarts/blocs (calcul dynamique)

## Collections MongoDB
- `admins` - Administrateurs
- `employees` - Conducteurs (avec is_inactive)
- `schools` - Écoles
- `assignments` - Assignations de circuits (avec is_adapted)
- `absences` - Absences des conducteurs
- `holidays` - Jours fériés et congés
- `temporary_tasks` - Tâches ponctuelles
- `temporary_reassignments` - Réassignations temporaires (drag & drop)

## Dernière mise à jour
11 janvier 2026 - Corrections modes de vue (HLP, quarts), calendrier UTC-5, employés inactifs, case Adapté
