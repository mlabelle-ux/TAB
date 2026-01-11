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
- [x] Plage horaire 5h00 à 18h59 (colonnes élargies de 25%)
- [x] Bouton "Aujourd'hui" pour revenir à la date actuelle
- [x] Icône calendrier pour sélection de date (corrigé - sans décalage de fuseau horaire)
- [x] Trois modes de vue : Détaillé, Complet, Abrégé
- [x] Tri par Circuit (numérique) ou par Nom (alphabétique)
- [x] Icône handicapé ♿ à côté du circuit si "Adapté" est coché
- [x] Info-bulle (tooltip) au survol des blocs

### Section Remplacements ✅ (P0 - 11 janv. 2026)
- [x] Section fixe en haut du tableau
- [x] Blocs positionnés selon leur heure prévue sur la timeline
- [x] Badge affichant le nombre d'éléments non assignés
- [x] Affichage des blocs des conducteurs absents (rouge)
- [x] Affichage des blocs non assignés (orange)
- [x] Zone droppable pour désassigner temporairement

### Drag and Drop Temporaire ✅ (P0 - 11 janv. 2026)
- [x] Réassignation temporaire pour la journée seulement (pas permanente)
- [x] Stockage en backend via `/api/temporary-reassignments`
- [x] Glisser vers un conducteur = réassigner pour la journée
- [x] Glisser vers Remplacements = désassigner pour la journée
- [x] Indicateur visuel (bordure orange) pour les blocs réassignés
- [x] Toast de confirmation pour chaque action

### Circuit visible quand absent ✅ (P2 - 11 janv. 2026)
- [x] Numéro de circuit reste visible en rouge quand conducteur absent
- [x] Badge "ABS" affiché
- [x] Ligne avec fond rouge subtil

### Gestion des Employés ✅
- [x] CRUD complet
- [x] Champs: Nom, Date d'embauche, Téléphone, Courriel, Berline, Matricule
- [x] En-têtes de colonnes figés (sticky header)
- [x] Tri par colonne
- [x] Prévention des doublons (backend)

### Gestion des Écoles ✅
- [x] CRUD complet avec couleur unique
- [x] Catégorisation par Type, Commission scolaire, Ville
- [x] Modification des listes de catégories

### Gestion des Assignations ✅
- [x] Création de circuits avec quarts (AM/MIDI/PM)
- [x] Quarts spéciaux Admin et Mécano avec heures fixes modifiables
- [x] Case "Adapté?" à droite du champ numéro de circuit (repositionné - 11 janv. 2026)
- [x] Périodes d'assignation prédéfinies (gérables via bouton "Périodes")
- [x] Assignations triées par circuit (Admin/Mécano à la fin)
- [x] Conducteurs triés alphabétiquement
- [x] Sélection des jours de la semaine (L,M,M,J,V) par bloc

### Gestion des Absences ✅
- [x] Création/modification/suppression des absences
- [x] Sélection de quarts spécifiques (AM, MIDI, PM, Admin, Mécano)
- [x] Conducteurs triés alphabétiquement

### Jours Fériés et Congés ✅
- [x] Option **Férié** ou **Congé** (avec badges colorés)
- [x] Sélection journée unique ou période
- [x] Fériés/Congés n'impactent pas Admin et Mécano

### Tâches Temporaires ✅
- [x] Création de tâches ponctuelles
- [x] Conducteurs triés alphabétiquement
- [x] Détection de conflits d'horaire
- [x] Draggable pour réassignation

### Rapports PDF ✅
- [x] Format portrait
- [x] En-têtes sur chaque page (LongTable)
- [x] 3 options de dates (1-15, 16-fin, personnalisé)
- [x] Options de tri: Alphabétique, Matricule, Date d'embauche

### Calcul des heures ✅
- [x] Fusion des intervalles pour éviter les doubles comptages
- [x] Quarts Admin/Mécano: heures fixes modifiables (défaut 8h)
- [x] Admin/Mécano non impactés par jours fériés/congés

### Navigation ✅ (P2 - 11 janv. 2026)
- [x] Tous les onglets ont des icônes (Calendar, Users, School, ClipboardList, UserX, CalendarOff, FileText)

## Tâches futures (Backlog)
- [ ] Pop-up de gestion de conflits lors de chevauchements > 5 min
- [ ] Historique des réassignations (journal d'audit)
- [ ] Exportation des données en format Excel/CSV

## Annulé
- ~~Alertes visuelles pour heures hebdomadaires~~ (déjà parfait - icône triangle existante)

## Collections MongoDB
- `admins` - Administrateurs
- `employees` - Conducteurs
- `schools` - Écoles
- `assignments` - Assignations de circuits
- `absences` - Absences des conducteurs
- `holidays` - Jours fériés et congés
- `temporary_tasks` - Tâches ponctuelles
- `temporary_reassignments` - Réassignations temporaires (drag & drop)

## Dernière mise à jour
11 janvier 2026 - Toutes les corrections P0/P1/P2 complétées et testées
