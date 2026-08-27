# Suivi Heures de Travail

Application 100% locale (aucune connexion internet requise) pour remplacer ton fichier Excel :
tu saisis chaque jour ton heure d'entrée (check in) et de sortie (check out), l'app calcule
automatiquement les heures travaillées, l'écart, les heures supplémentaires et le cumul —
avec un dashboard mensuel.

Toutes les données sont stockées **uniquement sur ton téléphone**, dans le stockage local du
navigateur (localStorage). Rien n'est envoyé sur internet.

## Contenu du dossier

- `index.html` — l'application
- `style.css`, `app.js` — style et logique
- `manifest.json`, `sw.js`, `icon.svg` — pour pouvoir "installer" l'app comme une vraie appli
- `README.md` — ce fichier

## Fonctionnement

- **Cycle mensuel (période de paie)** : le mois de l'entreprise ne va pas du 1er au 30. Dans
  Réglages, tu choisis le jour de début de cycle (par défaut **26**) : chaque période va alors
  du 26 au 25 du mois suivant. Tout le calcul (onglets Historique et Dashboard : heures
  travaillées, écart, heures supplémentaires, cumul de fin de période, calendrier, alertes) se
  base sur cette période et non sur le mois calendaire. Mets **1** pour revenir à un mois
  classique du 1er au dernier jour.
- **Samedi et dimanche** sont non travaillés par défaut (modifiable dans Réglages).
- **Heures requises par défaut** : 8h30 par jour travaillé (modifiable dans Réglages, et
  ajustable pour un jour précis dans l'onglet Saisie, par ex. pour un jour férié).
- **Permissions de sortie** : minutes autorisées d'absence qui ne pénalisent pas le cumul.
- **Cumul** : total cumulé (heures en plus ou en moins) calculé sur l'historique complet.
- Onglet **Dashboard** : statistiques du mois, graphique par jour, alertes (sortie oubliée,
  absence non saisie, etc.).
- Onglet **Réglages** : export JSON (sauvegarde complète), export CSV (format proche de ton
  ancien Excel), import JSON, réinitialisation.

**Pense à exporter une sauvegarde JSON de temps en temps** (Réglages > Exporter), pour ne pas
perdre tes données si tu changes de téléphone ou effaces les données du navigateur.

## Mettre l'app sur ton téléphone

### Option 1 — la plus simple (fonctionne tout de suite, hors ligne)

1. Copie **tout le dossier `work`** sur ton téléphone (câble USB, Google Drive, WhatsApp à toi-même,
   Bluetooth, etc.) — garde tous les fichiers ensemble dans le même dossier.
2. Sur le téléphone, ouvre `index.html` avec Chrome (ou ton navigateur).
3. Ajoute un raccourci sur l'écran d'accueil : menu ⋮ du navigateur > "Ajouter à l'écran d'accueil".
4. Utilise l'app hors ligne comme d'habitude — les données restent enregistrées entre les ouvertures.

Limite : certains navigateurs sont plus restrictifs sur `localStorage` en `file://`. Chrome pour
Android fonctionne normalement. Si jamais les données ne se sauvegardent pas, utilise l'option 2.

### Option 2 — version "vraie appli" installable (PWA), toujours sans internet

Cette option héberge le dossier en local sur ton téléphone lui-même (aucune connexion internet,
juste une adresse locale `localhost`), ce qui permet l'installation complète en PWA (icône,
plein écran, fonctionne même avion).

1. Installe une appli de serveur local gratuite, par exemple **"Servez"**, **"KSWEB"** ou
   **Termux** (`pkg install python`, puis `python -m http.server 8000` dans le dossier `work`).
2. Lance le serveur en pointant sur le dossier `work`.
3. Ouvre `http://localhost:8000` dans Chrome.
4. Menu ⋮ > "Installer l'application" (ou "Ajouter à l'écran d'accueil").
5. L'app s'installe comme une vraie appli, avec son icône, et continue de fonctionner hors ligne
   ensuite grâce au cache local (`sw.js`).

## Utilisation sur PC (pour tester avant de transférer)

Double-clique simplement sur `index.html`, ou ouvre-le avec ton navigateur.
