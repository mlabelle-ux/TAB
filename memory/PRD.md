# Les Berlines Trip à Bord - Gestion des Horaires

## Problem Statement Original
Site web de gestion des horaires pour 75+ conducteurs d'autobus scolaire (lundi-vendredi uniquement).

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Auth**: Mot de passe simple pour 5 administrateurs

## Core Requirements (Static)
1. Grille horaire 5h-20h avec colonnes figées
2. Gestion des employés (150+)
3. Gestion des écoles avec couleurs (150+)
4. Gestion des assignations/quarts/blocs
5. Gestion des absences avec désassignation automatique
6. Section Remplacements sticky
7. 3 modes d'affichage (Détaillé, Complet, Abrégé)
8. Alertes visuelles heures (>39h rouge, <15h jaune)
9. Export PDF des rapports d'heures
10. Mode clair/sombre

## User Personas
- 5 Administrateurs: Fernand Alary (1600), Chantal Lachapelle (2201), Mélissa Aubuchon (2202), Benoit Dallaire (2203), Maxime Labelle (2204)

## What's Been Implemented (2026-01-11)
- [x] Page de connexion avec authentification par mot de passe
- [x] Dashboard avec grille horaire (colonnes figées gauche/droite)
- [x] Navigation par semaine (lundi-vendredi)
- [x] CRUD Employés complet
- [x] CRUD Écoles avec couleurs personnalisables
- [x] CRUD Assignations avec quarts (AM/PM/MIDI) et blocs
- [x] Gestion des absences avec désassignation automatique
- [x] Section Remplacements sticky
- [x] 3 modes d'affichage
- [x] CRUD Jours fériés
- [x] Export PDF des rapports d'heures
- [x] Mode clair/sombre
- [x] Bouton +Tâche temporaire

## Prioritized Backlog

### P0 (Critical)
- [x] Tous les P0 complétés

### P1 (High)
- [ ] Drag & drop des quarts/blocs pour modifications exceptionnelles
- [ ] Pop-up validation lors des modifications
- [ ] Pop-up conflits d'horaire (>5 min chevauchement)
- [ ] Synchronisation du scroll horizontal entre toutes les lignes

### P2 (Medium)
- [ ] Assignation rapide depuis section Remplacements
- [ ] Améliorer l'alignement visuel des blocs avec les heures
- [ ] Vue hebdomadaire complète (5 jours en colonnes)

### P3 (Low)
- [ ] Import/Export données Excel
- [ ] Notifications email pour absences
- [ ] Historique des modifications

## Next Action Items
1. Implémenter le drag & drop pour déplacer les quarts/blocs
2. Ajouter la synchronisation du scroll horizontal
3. Créer le pop-up de validation pour les modifications
4. Implémenter la détection de conflits d'horaire
