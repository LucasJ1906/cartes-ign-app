# 01 — Analyse de l'existant (Cartes IGN 3.5.16)

> Objectif : comprendre la structure de l'application pour y greffer un module
> « Planifier une sortie vélo de route » avec export GPX, en réutilisant au
> maximum ce qui existe.

## 1. Stack technique

| Couche | Technologie | Remarques |
|---|---|---|
| Shell mobile | Capacitor 8 (Android / iOS) | Plugins : Filesystem, Share, Preferences, Geolocation, Toast, Network, FilePicker… |
| Build | Webpack 5 + Babel, Sass, html-loader | `npm run serve:dev` pour tester dans le navigateur |
| Cartographie | MapLibre GL JS 5.24, PMTiles | Fonds Géoplateforme (Plan IGN, ortho…) |
| UI | **JavaScript natif, sans framework** | Classes ES + mixins DOM, HTML injecté par `html-loader` |
| Géo-traitements | Turf (length, line-slice, buffer, nearest-point-on-line, clean-coords…) | Déjà en dépendances |
| Graphiques | Chart.js 4 (chargé paresseusement) | Profil altimétrique |
| Formats | `@tmcw/togeojson` (import GPX/KML), `@dwayneparton/geojson-to-gpx` (export) | |
| Qualité | ESLint 10 + plugin `license-header` | **Aucun test automatisé** dans le dépôt |

## 2. Organisation du code

```
src/
├── html/                 index.html (+ tabs/*.html injectés), nav.html, mapButtons.html
├── css/                  1 fichier par module + colors.css (tokens) + assets/ (SVG)
└── js/
    ├── index.js          bootstrap carte, Globals.map, LayerManager, MenuNavigation
    ├── controls.js       instanciation des modules → Globals.directions, Globals.routeDraw…
    ├── globals.js        état global partagé (map, menu, backButtonState, online…)
    ├── nav.js            MenuNavigation : open(id)/close(id) = grosse machine à états (switch/case)
    ├── state.js          gestion du bouton retour Android selon Globals.backButtonState
    ├── dom.js            cache des éléments DOM ($routeDrawEdit, $routeDrawSaveBtn…)
    ├── event-listeners.js accessibilité clavier/enter + fullscreen
    ├── route-draw/       ← module « Tracer un itinéraire » (le plus proche du besoin)
    ├── directions/       ← module « S'y rendre » (calcul A→B, Valhalla)
    ├── elevation-line-control/  ← profil altimétrique Chart.js + curseur carte
    ├── my-account/       ← « Enregistrés » : stockage, import, export, partage
    ├── services/         elevation, elevation-line, reverse, geocode, location
    ├── track-record/     enregistrement GPS d'une trace
    ├── offline-maps.js   cartes hors ligne
    └── utils/            gis-utils, unit-utils, file-storage, js-utils…
```

### Convention de module (à reproduire)

Chaque fonctionnalité suit le même découpage :

| Fichier | Rôle |
|---|---|
| `feature.js` | Classe contrôleur (état, logique, appels API, écouteurs carte) |
| `feature-dom.js` | Mixin `{ dom: {...}, __addXxxDOMElement() }` assigné au prototype (`Object.assign`) |
| `feature-styles.js` | Définitions des couches MapLibre (sources/layers, ids) |
| `src/html/tabs/featureWindow.html` | Conteneur vide injecté dans le panneau |
| `src/css/feature.css` | Styles, importés depuis `app.scss` |
| `controls.js` | `Globals.feature = new Feature(map, {})` |
| `nav.js` / `state.js` | Cas `open("feature")`, `close("feature")`, retour Android |

En-tête de licence IGN obligatoire en tête de chaque fichier JS (lint).

## 3. Le module « Tracer un itinéraire » (`src/js/route-draw/`)

C'est la brique la plus réutilisable. Fonctionnement actuel :

- **Modèle de données** (`this.data`) :
  ```js
  {
    distance, duration,                 // m, s
    points: [Feature<Point>{name, id, order}],
    steps:  [Feature<LineString>{start_name, end_name, distance, duration, id, mode}],
    elevationData: { elevationData:[{x,y}], coordinates, dplus, dminus, unit, profileLngLats }
  }
  ```
- **Saisie** : clic carte = ajout d'un point ; glisser un point ou la ligne
  (création d'un point intermédiaire) ; mode suppression ; annuler/refaire
  (historique `dataHistory`) ; « Recaler » (re-snap de tous les tronçons via
  `intermediates`).
- **Modes** : guidé (1, suit le réseau) / libre (0, ligne droite).
- **Transports** : `pedestrian` | `car` uniquement.
- **Routage** : `https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&optimization=shortest&profile=…`,
  un appel par tronçon, throttle 4 req / 1,2 s, `AbortController`.
- **Noms de points** : géocodage inverse (`services/reverse.js`).
- **Altimétrie** : `ElevationLineControl` → service `elevationLine` (RGE ALTI),
  **`sampling: 200` points pour tout le parcours**.
- **Durée** : piéton = règle de Scarf (`GisUtils.getHikeTimeScarfsRule`), voiture = durée OSRM.
- **Sauvegarde** : `RouteDrawSave` → `Globals.myaccount.addRoute({name, transport, data, visible})`.
- Fichier contrôleur de 1 377 lignes, méthodes **privées `#`** → impossible à
  sur-classer proprement (les méthodes privées ne sont pas surchargeables).

## 4. « Enregistrés » (`src/js/my-account/`)

- Stockage des itinéraires en fichiers locaux (`utils/file-storage.js`, clé `route-<id>`),
  ordre dans `Preferences`.
- **Import** GPX/KML/GeoJSON (`@tmcw/togeojson`), y compris via intent Android.
- **Export** (`exportData`) : ActionSheet JSON/GPX → `Directory.Documents`
  (téléchargement navigateur en dev) ; **Partage** (`shareRoute`) : fichier en
  cache + `Share.share`.
- `#routeToGeojson(route, "gpx")` fusionne les tronçons en une seule
  LineString… **dont l'altitude a été supprimée** (nettoyage à l'import, les
  coordonnées sont 2D) → **le GPX exporté n'a pas de `<ele>`**, pas de
  `<type>`, pas de waypoints nommés exploitables par un compteur GPS.
- Ouverture d'un itinéraire : `Globals.routeDraw.setTransport(route.transport)`
  n'accepte que `car`/`pedestrian`.

## 5. Services Géoplateforme utilisés

| Service | Usage actuel | Intérêt vélo |
|---|---|---|
| Itinéraire `bdtopo-osrm` | Tracé guidé, shortest | Rapide mais peu paramétrable |
| Itinéraire `bdtopo-valhalla` | « S'y rendre » | Contraintes limitées |
| Itinéraire `bdtopo-pgr` | non utilisé | **Contraintes riches** (bannir/éviter/préférer selon attributs BD TOPO : type de voie, importance, nature…) → candidat n°1 pour un profil « vélo de route » simulé. **À vérifier par un spike** (l'accès réseau était bloqué depuis l'environnement d'analyse). |
| Altimétrie `elevationLine` (RGE ALTI) | Profil 200 pts | Doit être échantillonné finement (≈ 25–50 m) pour calculer pentes et cols |
| Géocodage / inverse | Recherche, noms de points | Départ/arrivée, noms de waypoints |

## 6. Design existant (tokens et composants)

- **Couleurs** (`src/css/colors.css`) : `--dark-green #26A581` (couleur
  d'action/tracé), `--darker-green #1C7B66`, `--light-green #E3F5EF`,
  gris `--light-grey … --black`, `--vert-clair #90C149`, `--jaune #EFC931`,
  `--orange #F18345`, `--dark-orange #A8592E`, `--bleu-clair #7EB9F7`.
- **Typo** : Fira Sans (titres, Semibold/Bold/Medium), Open Sans (texte).
- **Composants** : panneau bas défilant (`tabContainer`, positions de scroll
  `currentScrollIndex`), `ActionSheet` (boutons ou contenu custom),
  `toggleSwitch`, `radio-wrapper`, barre d'édition flottante
  (Annuler / Refaire / Supprimer / Recaler), bouton rond « Enregistrer »,
  `Toast` Capacitor, listes triables (SortableJS), pictos SVG dans `css/assets`.

## 7. Écarts entre l'existant et le besoin vélo de route

| Besoin vélo de route | Existant | Écart |
|---|---|---|
| Routage sur routes revêtues, calmes, sans autoroute ni chemin | `pedestrian` (prend sentiers, escaliers, ignore les sens uniques) ou `car` (peut emprunter voies rapides) | **Profil à créer** (contraintes pgr ou moteur tiers) |
| Pentes, cols, profil coloré | Profil monochrome 200 pts | Échantillonnage fin + analyse de pente + détection de montées |
| Durée réaliste à vélo | Scarf (piéton) / OSRM (voiture) | Modèle de vitesse vélo dépendant de la pente |
| Boucle / aller-retour / inverser | Absent | À créer |
| Type de voie / revêtement | Absent | `waysAttributes` du service ou ré-interrogation |
| GPX exploitable par Garmin/Wahoo/Hammerhead | GPX sans altitude, sans type ni waypoints | Sérialiseur GPX 1.1 dédié |
| Retrouver / modifier / partager | « Enregistrés » | Ajouter `transport: "bike"` et l'ouverture dans le nouveau module |
| Hors ligne | Cartes hors ligne | Consultation OK, calcul impossible (déjà la règle actuelle) |

## 8. Ce qu'on réutilise tel quel

`services/reverse.js`, `services/geocode.js`, `services/elevation-line.js`
(paramétré), `ElevationLineControl` (étendu), `ActionSheet`, `Toast`,
`file-storage`, `MyAccount.addRoute / exportData / shareRoute` (étendus),
`GisUtils`, `unit-utils`, Turf, SortableJS, styles de marqueurs départ/étape/arrivée.
