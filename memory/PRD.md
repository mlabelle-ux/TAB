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
- [x] Icône calendrier pour sélection de date future
- [x] Trois modes de vue : Détaillé, Complet, Abrégé
- [x] Tri par Circuit (numérique) ou par Nom (alphabétique)
- [x] Icône handicapé ♿ à côté du circuit si "Adapté" est coché
- [x] Section "Remplacements" fixe en haut
- [x] Info-bulle (tooltip) au survol des blocs
- [x] **DRAG AND DROP** - Glisser-déposer les blocs pour réassigner à un autre conducteur
- [x] Modal de confirmation avant réassignation

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
- [x] Quarts spéciaux Admin et Mécano avec heures fixes **modifiables**
- [x] Case "Adapté?" en haut du formulaire
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
- [x] **Fériés/Congés n'impactent pas Admin et Mécano**

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

### Calcul des heures
- [x] Fusion des intervalles pour éviter les doubles comptages
- [x] Quarts Admin/Mécano: heures fixes modifiables (défaut 8h)
- [x] Admin/Mécano non impactés par jours fériés/congés

## Tâches futures (Backlog)
- [ ] Pop-up de gestion de conflits lors de chevauchements > 5 min
- [ ] Alertes visuelles (icônes) pour heures hebdomadaires > 39h ou < 15h

## Dernière mise à jour
11 janvier 2026 - Implémentation du Drag and Drop
