# 05 — Plan d'implémentation (à valider avant de coder)

## 1. Décisions à valider

| # | Décision | Options | Recommandation |
|---|---|---|---|
| **D-1** | Moteur de routage vélo | (a) Géoplateforme `bdtopo-pgr` + contraintes BD TOPO · (b) BRouter (OSM, profil `fastbike`, serveur public ou auto-hébergé) · (c) hybride a→b en repli | **(a)**, sous réserve du spike S0. Cohérent avec l'esprit IGN (données publiques, pas de dépendance tierce). (b) seulement si S0 montre que les contraintes ne sont pas supportées ou trop lentes. |
| **D-2** | Architecture | (a) Ajouter un transport `bike` dans `RouteDraw` · (b) **Module dédié `src/js/bike-route/`** réutilisant services et composants | **(b)** : `RouteDraw` (1 377 l., méthodes privées) n'est pas extensible sans risque de régression ; le vélo a des panneaux propres (pentes, montées, voies, export). Les interactions carte sont reprises/adaptées de `RouteDraw`. Une factorisation commune pourra suivre, hors périmètre. |
| **D-3** | Point d'entrée | (a) Nouvel item « Planifier une sortie vélo » · (b) Choix « Vélo » dans « Tracer un itinéraire » | **(a)** : plus découvrable, permet un panneau dédié. |
| **D-4** | Altitude dans les GPX des itinéraires existants (piéton/voiture) | Oui / Non | **Oui, mais dans une PR séparée** après la V1 (on garde ce périmètre propre). |
| **D-5** | Tests | Aucun (état actuel) · `node --test` sur la logique pure (sans dépendance ajoutée) | **`node --test`** pour `bike-analysis` et `gpx-writer`. |
| **D-6** | Périmètre V1 | Must + Should du doc 02 ; F-11 (POI), F-16 (boucle auto), bornes km en V1.1 | À confirmer |

## 2. Architecture cible

```
src/js/bike-route/
├── bike-route.js            Contrôleur : état, historique, écouteurs carte, orchestration
├── bike-route-dom.js        Mixin DOM : panneau fiche (C-05…C-12), barre d'édition
├── bike-route-styles.js     Couches MapLibre (C-03, C-04)
├── bike-route-settings.js   Réglages + persistance Preferences (C-13)
├── bike-route-export.js     Feuille Exporter (C-16) → gpx-writer + Filesystem/Share
├── bike-routing-service.js  Adaptateur moteur (D-1) : computeLeg(a, b, pref) → {coords, distance, ways[]}
└── bike-analysis.js         PUR : échantillonnage, lissage, D+/D−, pentes, montées, vitesse, répartitions
src/js/utils/gpx-writer.js   PUR : GPX 1.1 (trk/rte/wpt, ele, type, simplification)
src/html/tabs/bikeRouteWindow.html, bikeRouteSaveWindow.html
src/css/bike-route.css       + tokens dans colors.css, import dans app.scss
src/css/assets/bike-route/   pictos (doc 04 §1.4)
test/bike-route/*.test.mjs   tests node --test
```

Modèle de données d'un parcours enregistré (compatible « Enregistrés ») :
```js
{
  id, name, description, visible, transport: "bike",
  data: {
    distance, duration, points, steps,           // même forme que RouteDraw
    elevationData,                               // + échantillonnage fin
    bike: {
      settings: { level, flatSpeed, preference, maxDescentSpeed },
      waypoints: [{ id, type, name, note, coordinates, offset /* m le long du tracé */ }],
      climbs: [...], ways: [...], surfaces: [...], warnings: [...]
    }
  }
}
```
Les champs `bike.climbs/ways/surfaces/warnings` sont des caches recalculables
(on recalcule si absents → robustesse aux versions).

Fichiers existants modifiés (impacts limités et listés) :
`nav.html`, `nav.js` (open/close `bikeRoute`, `bikeRouteSave`), `state.js` (retour Android),
`controls.js` (instanciation), `dom.js` (boutons flottants), `index.html` (injection des tabs),
`mapButtons.html` (barre d'édition), `colors.css`, `app.scss`,
`my-account.js` / `my-account-dom.js` (ouverture, picto, export des parcours `bike`),
`elevation-line-control.js` (option `gradientColors`, bandes de montées — rétro-compatible),
`services/elevation-line.js` (paramètre `sampling` optionnel, défaut inchangé 200),
`package.json` (script `test`).

## 3. Phases

Estimations en jours de développement (j), hors recette sur appareil par l'équipe.

### S0 — Spike routage (1 j) → débloque D-1
- Appels manuels `getcapabilities` + `itineraire?resource=bdtopo-pgr` avec
  `constraints` (bannir `waytype=autoroute`, `nature` chemin/sentier/escalier/empierrée/bac,
  préférer/éviter `importance`) et `waysAttributes=nature|importance`.
- 10 parcours tests (Chevreuse, Vexin, Alpes, Paris intra-muros, Bretagne…) :
  temps de réponse, absence d'autoroute/sentier, cohérence sens uniques.
- Même jeu sur BRouter `fastbike` pour comparaison.
- **Livrable** : note de résultats dans `docs/velo-route/S0-routage.md` + choix D-1.
- Point d'arrêt : je reviens vers vous avec le résultat avant P2.

### P1 — Fondations et squelette (1,5 j)  → F-01, C-01, C-02, C-05 (vide)
- Tokens `--bike-*` dans `colors.css`, `bike-route.css`, pictos SVG.
- Item de menu, `bikeRouteWindow.html`, instanciation `Globals.bikeRoute`.
- Cas `bikeRoute` dans `nav.js` (open/close, barre d'édition, `backButtonState`) et `state.js`.
- Garde hors ligne ; confirmation « Quitter sans enregistrer ? ».
- ✅ Critère : le module s'ouvre/se ferme depuis le menu et le retour Android, sans impact sur les autres panneaux.

### P2 — Saisie et routage (3 j)  → F-02, F-03, F-04, F-07
- `bike-routing-service.js` (moteur choisi en S0), annulation fetch, throttle.
- `bike-route.js` : ajout/déplacement/insertion/suppression de points,
  historique annuler/refaire, file d'attente des calculs, tronçon « en calcul ».
- Boucler, aller-retour, inverser, recalculer tout ; hors réseau en repli.
- Couches carte C-03/C-04 (sauf `grade`, `km`).
- ✅ Critère : un parcours de 100 km / 8 points se trace sans erreur ; aucune autoroute ni sentier sur les 10 parcours S0.

### P3 — Analyse et fiche (3 j)  → F-05, F-06, F-09, F-12 (partiel)
- `bike-analysis.js` (pur) : rééchantillonnage 25 m, lissage 100 m, D+/D−
  avec hystérésis, classes de pente, montées + catégories, modèle de vitesse, avertissements.
- Tests `node --test` : profils synthétiques (plat, rampe 6 % × 5 km = Cat. 3,
  bruit ±2 m sans D+ parasite, montée avec replat), modèle de vitesse
  (plat = v₀, 8 % < 12 km/h à 26 km/h, plafond descente).
- `services/elevation-line.js` : paramètre `sampling` ; `ElevationLineControl` : option colorée + bandes.
- Panneau : C-06, C-07, C-08, C-09 ; réglages C-13 + persistance ; option tracé coloré.
- ✅ Critère : D+ à ± 10 % de la référence sur 5 parcours tests ; changer le niveau met à jour la durée sans appel réseau.

### P4 — Types de voie et revêtement (1 j)  → F-08  *(dépend de S0)*
- Agrégation des attributs par portion, barres C-10, surbrillance carte.
- ✅ Critère : section masquée proprement si attributs indisponibles.

### P5 — Enregistrement et « Enregistrés » (2 j)  → F-13, F-01 (lecture), F-15, C-17, C-18
- Écran Enregistrer, stockage `transport: "bike"`, picto et sous-titre dans la liste.
- Ouverture lecture / Modifier / Dupliquer / Supprimer ; `my-account.js` route les parcours `bike` vers `Globals.bikeRoute`.
- Import GPX › « Analyser en vélo de route ».
- ✅ Critère : enregistrer → fermer l'app → rouvrir → modifier → réenregistrer, sans perte ; les itinéraires piéton/voiture existants s'ouvrent comme avant.

### P6 — Waypoints et export GPX (2 j)  → F-10, F-14, C-11, C-12, C-16
- Waypoints (création, édition, ancrage curviligne, hors tracé), liste des étapes triable.
- `gpx-writer.js` (pur) : `<trk>`/`<rte>`, `<wpt>` + `<sym>`, `<ele>` interpolé,
  métadonnées, échappement XML, Douglas-Peucker cible.
- Tests : validité XSD GPX 1.1 (validation dans le test via schéma embarqué ou `xmllint` si présent), aller-retour export → import Cartes IGN.
- Feuille Exporter : Partager / Documents, poids estimé, Toasts.
- ✅ Critère : GPX importé avec succès dans Garmin Connect, Wahoo, Strava, Komoot (vérif manuelle par vous sur appareil).

### P7 — Finitions (1,5 j)  → F-17, B-50…B-53
- Accessibilité (aria, ordre de tabulation, annonces), Matomo, perfs (200 km fluides),
  états d'erreur C-19, wording, `npm run build` + ESLint propres.
- Mise à jour de cette doc (écarts éventuels).

**Total V1 : ≈ 15 j** (S0 1 + P1 1,5 + P2 3 + P3 3 + P4 1 + P5 2 + P6 2 + P7 1,5).

### V1.1 (hors V1, à planifier ensuite)
F-11 POI le long du parcours (≈ 1,5 j), F-16 génération de boucle (≈ 3 j),
bornes kilométriques (0,5 j), D-4 altitude dans les GPX existants (0,5 j).

## 4. Méthode de travail

- Développement sur la branche `ccr-4c4136b0-6kad1m`, **un commit par phase**
  (ou sous-étape), message conventionnel `feat(bike-route): …`.
- À chaque phase : `npx eslint src`, `npm run build`, `npm test` (logique pure),
  test manuel navigateur (`npm run serve:dev`) avec captures d'écran Playwright.
- Pas de PR sans votre demande.
- Point de validation avec vous **après S0** (choix du moteur) puis à la fin de P3 (démo fiche + profil).

## 5. Risques

| Risque | Impact | Mitigation |
|---|---|---|
| `bdtopo-pgr` ne supporte pas les contraintes voulues, ou est lent | Tracés non adaptés au vélo | Spike S0 ; repli BRouter (D-1) |
| Quotas / limites du service altimétrique à 25 m sur 200 km (8 000 pts) | D+ faux ou erreurs | Découpage en lots ≤ 5 000, throttle existant, repli 50 m au-delà de 150 km |
| Attributs voies/revêtement indisponibles | F-08 vide | Section masquée, avertissement non revêtu basé sur `nature` seulement |
| Régressions dans `nav.js` (machine à états très couplée) | Panneaux cassés | Ajouts de cas isolés, recette des autres modules à chaque phase |
| Pas d'appareil de test dans cet environnement | Bugs natifs (Share, Filesystem) | Tests navigateur ici ; recette Android/iOS par vous en P5/P6 |
| Réseau Géoplateforme inaccessible depuis l'environnement de dev cloud (constaté lors de l'analyse) | Spike S0 impossible ici | Autoriser `data.geopf.fr` dans la politique réseau de l'environnement, ou réaliser S0 de votre côté avec les requêtes que je fournis |
