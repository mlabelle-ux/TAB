# PRD - Gestion des horaires des conducteurs d'autobus scolaire

## Description du projet
Application web pour la gestion des horaires des conducteurs d'autobus scolaire pour Les Berlines Trip à Bord.

## Stack technique
- **Frontend:** React, Tailwind CSS, Shadcn/UI
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

### Gestion des Employés ✅
- [x] CRUD complet
- [x] Champs: Nom, Date d'embauche, Téléphone, Courriel, Berline, Matricule
- [x] En-têtes de colonnes figés (sticky header)
- [x] Tri par colonne
- [x] Prévention des doublons (backend)

### Gestion des Écoles ✅
- [x] CRUD complet avec couleur unique
- [x] Catégorisation par:
  - Type: Primaire, Secondaire, Autre
  - Commission scolaire: CSSRDN, CS Samares, CSSMI, CS Laval, CS Longueuil, CSDM
  - Ville: Montréal, Laval, Prévost, Sainte-Sophie, Lachute, St-Jérôme, St-Janvier, St-Colomban, St-Hippolyte
- [x] Modification des listes de catégories

### Gestion des Assignations ✅
- [x] Création de circuits avec quarts (AM/MIDI/PM)
- [x] Quarts spéciaux Admin et Mécano avec heures fixes modifiables
- [x] Case "Adapté?" pour les circuits de transport adapté
- [x] Périodes d'assignation prédéfinies (gérables)
- [x] Assignation à un conducteur pour une période
- [x] Conducteurs triés alphabétiquement
- [x] Assignations triées par numéro de circuit (Admin/Mécano à la fin)
- [x] Sélection des jours de la semaine (L,M,M,J,V) par bloc
- [x] HLP avant et après chaque bloc

### Gestion des Absences ✅
- [x] Création/modification/suppression des absences
- [x] Sélection de quarts spécifiques ou tous les quarts
- [x] Désassignation automatique vers "Remplacements"
- [x] Conducteurs triés alphabétiquement
- [x] Quart MECANO ajouté aux types

### Jours Fériés et Congés ✅
- [x] Option Férié ou Congé
- [x] Sélection journée unique ou période
- [x] Weekends exclus automatiquement
- [x] Note: Fériés/Congés n'impactent pas Admin et Mécano

### Tâches Temporaires ✅
- [x] Création de tâches ponctuelles
- [x] Conducteurs triés alphabétiquement
- [x] Détection de conflits d'horaire
- [x] Ne pas doubler les heures lors de chevauchements

### Rapports PDF ✅
- [x] Format portrait
- [x] En-têtes sur chaque page (LongTable)
- [x] 3 options de sélection de dates:
  - Du 1er au 15 du mois
  - Du 16 au dernier jour du mois
  - Dates personnalisées
- [x] Options de tri: Alphabétique, Matricule, Date d'embauche
- [x] Liste des employés triée alphabétiquement pour sélection

### Système de connexion ✅
- [x] Connexion par mot de passe
- [x] 5 administrateurs prédéfinis
- [x] Mode clair et sombre

## Calcul des heures
- Fusion des intervalles de temps pour éviter les doubles comptages
- Quarts Admin/Mécano: heures fixes par jour (modifiables, défaut 8h)
- Quarts Admin/Mécano non impactés par jours fériés

## Collections MongoDB
- `admins`: Administrateurs
- `employees`: Employés
- `schools`: Écoles
- `assignments`: Assignations
- `absences`: Absences
- `holidays`: Jours fériés et congés
- `temporary_tasks`: Tâches temporaires

## Tâches futures (Backlog)
- [ ] Pop-up de gestion de conflits lors de chevauchements > 5 min
- [ ] Drag and Drop pour modifier les quarts/blocs
- [ ] Alertes visuelles (icônes "!" et "¡") pour les heures hebdomadaires > 39h ou < 15h

## Dernière mise à jour
11 janvier 2026
