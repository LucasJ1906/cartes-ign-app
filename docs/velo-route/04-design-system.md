# 04 — Design system du module « Vélo de route »

Principe : **ne pas créer une nouvelle identité**, mais étendre le design
system implicite de Cartes IGN (tokens de `colors.css`, Fira Sans / Open Sans,
panneau bas, ActionSheet, barre d'édition flottante). Les ajouts sont
préfixés `--bike-` (tokens) et `bike-` (classes CSS, ids MapLibre).

---

## 1. Fondations

### 1.1 Couleurs

Tokens existants réutilisés :

| Token | Valeur | Usage vélo |
|---|---|---|
| `--dark-green` | #26A581 | Tracé principal, boutons primaires, état actif |
| `--darker-green` | #1C7B66 | Bordure du tracé (casing), pressed |
| `--light-green` | #E3F5EF | Fond des puces sélectionnées |
| `--dark-grey` / `--black` | #3F4A55 / #091625 | Texte |
| `--mid-grey` | #788089 | Texte secondaire, tronçon en calcul |
| `--light-grey` / `--false-white` | #E9ECEF / #F4F6F8 | Fonds de cartes, séparateurs |

Nouveaux tokens (à ajouter dans `colors.css`) :

**Échelle de pente** — progression de luminance monotone (lisible en
niveaux de gris et par les daltoniens), réutilise les teintes IGN existantes :

| Token | Classe | Couleur | Contraste sur blanc |
|---|---|---|---|
| `--bike-grade-0` | descente / < 3 % | #90C149 (`--vert-clair`) | graphique uniquement |
| `--bike-grade-1` | 3–6 % | #EFC931 (`--jaune`) | graphique uniquement |
| `--bike-grade-2` | 6–9 % | #F18345 (`--orange`) | graphique uniquement |
| `--bike-grade-3` | 9–12 % | #D63C2F | 4,6:1 ✔ |
| `--bike-grade-4` | ≥ 12 % | #7A1F3D | 10:1 ✔ |

> Règle : la couleur de pente n'est **jamais le seul vecteur d'information** ;
> la valeur en % est toujours affichée en texte à côté (liste des montées,
> info-bulle du profil, puces d'avertissement).

**Catégories de montée** (badges) : fond = couleur de pente correspondante,
texte blanc sauf Cat. 4 / Cat. 3 (texte `--black`).

| Catégorie | Fond | Texte |
|---|---|---|
| Côte | `--light-grey` | `--dark-grey` |
| Cat. 4 | `--bike-grade-1` | `--black` |
| Cat. 3 | `--bike-grade-2` | `--black` |
| Cat. 2 | `--bike-grade-3` | #FFF |
| Cat. 1 | `--bike-grade-4` | #FFF |
| HC | `--black` | #FFF |

**Types de voie / revêtement** :

| Token | Catégorie | Couleur |
|---|---|---|
| `--bike-way-cycle` | Piste cyclable | #26A581 |
| `--bike-way-minor` | Petite route | #7EB9F7 (`--bleu-clair`) |
| `--bike-way-secondary` | Route secondaire | #3F7FC1 |
| `--bike-way-main` | Route principale | #A8592E (`--dark-orange`) |
| `--bike-surface-paved` | Revêtu | #3F4A55 |
| `--bike-surface-unpaved` | Non revêtu | #A8592E + hachures |
| `--bike-unknown` | Inconnu | #B8BCC1 (`--grey`) |

**Sémantiques** : `--bike-warning` = `--orange` (fond `--light-orange`),
`--bike-offnetwork` = `--orange` en tirets.

Mode sombre : l'app n'en a pas aujourd'hui → hors périmètre, mais tous les
nouveaux styles passent par des variables pour le permettre.

### 1.2 Typographie (existante)

| Rôle | Police | Taille / interlignage |
|---|---|---|
| Titre de panneau | Fira Sans Semibold | 18 / 24 |
| Chiffre clé (distance, D+, durée) | Fira Sans Bold | 22 / 26, chiffres tabulaires |
| Libellé de chiffre clé | Open Sans | 12 / 16, `--mid-grey` |
| Titre de section | Fira Sans Semibold | 16 / 22 |
| Texte courant | Open Sans | 14 / 20 |
| Puce / badge | Open Sans Semibold | 12 / 16 |

Unités : espace insécable avant l'unité (`72 km`, `980 m`, `6,4 %`),
virgule décimale, durées au format `3 h 05`. Réutiliser `unit-utils`.

### 1.3 Espacements, formes, élévation

- Grille 4 px ; marges internes du panneau 16 px ; écart entre sections 24 px.
- Rayons : cartes 8 px, puces 16 px (pilule), boutons ronds 50 %.
- Cibles tactiles ≥ 44 × 44 px (B-50), y compris les poignées de glisser.
- Ombre des boutons flottants : celle de `.button` existant (map-buttons.css).

### 1.4 Iconographie

SVG monochromes 24 px, trait 2 px, style des pictos `css/assets/route-draw/`.
À créer dans `src/css/assets/bike-route/` :
`velo-route.svg` (menu + picto Enregistrés, variantes `-green`, `-darkgrey`, `-white`),
`loop.svg` (boucler), `out-and-back.svg`, `reverse.svg`, `settings.svg`,
`climb.svg`, `warning-unpaved.svg`, `warning-grade.svg`, `warning-traffic.svg`,
`gpx-export.svg`, et un picto par type de waypoint
(`wpt-food`, `wpt-water`, `wpt-meet`, `wpt-view`, `wpt-danger`, `wpt-other`).

---

## 2. Composants

Chaque composant : anatomie · états · comportement · accessibilité.

### C-01 Item de menu « Planifier une sortie vélo »  → F-01
- Anatomie : identique aux `.navitem` de `nav.html` (picto, titre, sous-titre, flèche).
- Id `bikeRoute`, `tabindex="222"` (les suivants sont décalés).
- Hors ligne : même Toast que « Tracer un itinéraire ».

### C-02 Barre d'édition flottante  → F-02, F-04
Réutilise la structure `#routeDrawEdit` (même position, même style) avec un
conteneur dédié `#bikeRouteEdit` :

```
┌──────────┬──────────┬───────────┬──────────┐
│ ↶ Annuler│ ↷ Refaire│ 🗑 Supprim.│ ⟲ Boucler│
└──────────┴──────────┴───────────┴──────────┘
```
- États : `inactive` (opacité 40 %, non focusable) quand l'action est
  impossible (pas d'historique, < 2 points pour Boucler, déjà bouclé) ;
  `active` pour Supprimer quand le mode suppression est enclenché (fond `--dark-green`, picto blanc).
- Bouton rond « Enregistrer » à droite (réutilise `.routeSaveBtn`).
- `role="button"`, `aria-pressed` pour Supprimer, `aria-disabled` pour les états inactifs.

### C-03 Marqueurs de points  → F-02
Couches MapLibre `bike-route-point` (symbol) :
- Départ : `departure-marker.svg` existant ; arrivée : `destination-marker.svg` ;
  boucle fermée : marqueur départ avec pastille « ⟲ ».
- Intermédiaires : cercle blanc 12 px, bordure `--dark-green` 3 px ;
  en mode suppression : bordure `--orange` + croix.
- Point en cours de glisser : rayon 16 px, halo `--light-green`.
- Zone de tap élargie à 22 px (couche cercle transparente).

### C-04 Tracé sur la carte  → F-02, F-03, F-07, F-08, B-27, B-28
Couches dans l'ordre (bas → haut), source `bike-route-line` :

| Id couche | Rôle | Style |
|---|---|---|
| `bike-route-line-casing` | Contour | `--darker-green`, largeur 9 px (z14), opacité 0,9 |
| `bike-route-line` | Tracé | `--dark-green`, 6 px, `line-join: round` |
| `bike-route-line-grade` | Option « coloré par pente » | `line-gradient` (source `lineMetrics: true`) avec les tokens `--bike-grade-*`, remplace `bike-route-line` |
| `bike-route-line-pending` | Tronçon en calcul | `--mid-grey`, 4 px, `line-dasharray [1,2]` |
| `bike-route-line-offnetwork` | Hors réseau | `--orange`, 5 px, `line-dasharray [2,1.5]` |
| `bike-route-highlight` | Surbrillance (montée, type de voie) | blanc 10 px dessous + couleur de la catégorie 6 px |
| `bike-route-arrows` | Sens de parcours | flèches `symbol-placement: line`, espacement 120 px (pattern `showOrientation` existant) |
| `bike-route-km` | Bornes km (Could) | pastilles blanches, texte `--dark-grey` 11 px, tous les 10 km (z ≥ 11), 5 km (z ≥ 13) |
| `bike-route-climb-top` | Sommets de montée | badge catégorie (C-09) au sommet |
| `bike-route-wpt` | Waypoints | pictos C-11 |

Largeurs interpolées par zoom (`["interpolate", ["linear"], ["zoom"], 8, 3, 14, 6, 18, 10]`).

### C-05 Panneau bas « Fiche parcours »  → F-12
Positions de défilement (pattern `currentScrollIndex`) :
- **Repliée** (édition) : poignée + bandeau chiffres clés (C-06) uniquement →
  la carte reste exploitable.
- **Intermédiaire** : + avertissements + profil.
- **Déployée** : toutes les sections.

Wireframe (déployé) :
```
┌─────────────────────────────────────────────┐
│ ───                                          │ poignée
│ Boucle de Rambouillet          ✎   ⚙   ⋯     │ titre éditable, réglages, outils
│ [Petites routes]                             │ puce préférence
│                                              │
│  72,4 km      980 m        3 h 05            │ C-06
│  Distance     D+           26 km/h moy.      │
│  D− 975 m · Alt. max 182 m                   │
│                                              │
│ [⚠ 1,2 km non revêtus] [⚠ 14 % au km 37]     │ C-08 (défilement horizontal)
│                                              │
│ Profil altimétrique                          │ C-07
│ ▁▂▃▅▇▆▄▂▁▁▂▄▆█▇▅▃▁                          │
│                                              │
│ Montées (3)                                  │ C-09
│ [Cat.3] Côte de Cernay   km 12 · 3,1 km · 6,2 % │
│ …                                            │
│ Types de voie                                │ C-10
│ ████████████░░░░▒▒   Petites routes 68 % …   │
│ Revêtement                                   │
│ █████████████████░   Revêtu 98 %             │
│                                              │
│ Étapes et waypoints                          │ C-12
│ ● Départ — Rambouillet               ≡       │
│ ○ Les Essarts-le-Roi                 ≡       │
│ ◆ Eau — Fontaine de Cernay           ≡       │
│ ● Arrivée — Rambouillet                      │
│                                              │
│ [ Enregistrer ]   [ ⤓ Exporter GPX ]         │ C-14
└─────────────────────────────────────────────┘
```

### C-06 Bandeau chiffres clés  → F-06, B-20, B-21
- 3 colonnes égales ; chiffre (Fira Sans Bold 22) + libellé (Open Sans 12).
- État **vide** (0–1 point) : texte d'aide à la place
  « Touchez la carte pour poser votre point de départ ».
- État **calcul** : le chiffre concerné garde l'ancienne valeur en
  `--mid-grey` + petit loader `loading-green.svg` (pas de saut de mise en page).
- Tap sur Durée → ouvre Réglages (C-13) section Niveau.
- `aria-live="polite"` sur le bandeau, annonce « 72,4 kilomètres, 980 mètres
  de dénivelé positif, 3 heures 5 minutes ».

### C-07 Profil altimétrique coloré  → F-06, F-12, B-22
Extension d'`ElevationLineControl` (option `gradientColors: true`) :
- Chart.js `segment.borderColor` + remplissage sous la courbe avec la couleur de
  la classe de pente de chaque tranche de 100 m ; ligne 2 px `--dark-grey` au-dessus.
- Axe X en km (graduations auto), axe Y en m, min/max arrondis à 50 m.
- Montées : bande de fond `rgba(9,22,37,0.06)` + numéro au sommet.
- Interaction existante conservée : glisser = curseur sur la carte.
  Info-bulle : `km 37,2 · 412 m · 8,5 %`.
- Hauteur 140 px (intermédiaire), 180 px (déployé).
- Légende compacte sous le graphique : 5 pastilles + libellés de classes.
- Accessibilité : `role="img"` + `aria-label` résumé
  (« Profil : altitude de 95 à 182 m, pente maximale 14 % au kilomètre 37 ») ;
  la liste des montées sert d'alternative textuelle détaillée.

### C-08 Puce d'avertissement  → F-09
- Pilule 32 px de haut, fond `--light-orange`, texte `--dark-orange`,
  picto 16 px à gauche (`warning-unpaved` / `warning-grade` / `warning-traffic`).
- Liste horizontale défilante, 8 px d'écart ; masquée si aucune alerte.
- Tap → `fitBounds` sur la zone + surbrillance (C-04 `bike-route-highlight`)
  pendant 3 s ou jusqu'au prochain geste.

### C-09 Carte « Montée » et badge de catégorie  → F-06
```
┌──────────────────────────────────────────┐
│ [Cat.2]  Col de la Croix         ›        │
│ km 37,0 → 44,8 · 7,8 km · +512 m          │
│ moy. 6,6 % · max 11,2 % · sommet 1 049 m  │
└──────────────────────────────────────────┘
```
- Badge : pilule 22 px, couleurs du tableau §1.1, texte `Cat. 2` / `HC` / `Côte`.
- Tap → zoom sur la montée, surbrillance carte + profil ; 2e tap → mini-profil
  par km (barres colorées, pente en texte sur chaque barre) dans un ActionSheet.
- Liste vide : « Aucune montée significative ».

### C-10 Barre de répartition  → F-08
- Barre empilée 12 px, rayon 6 px, segments aux couleurs `--bike-way-*` /
  `--bike-surface-*` (non revêtu hachuré pour ne pas dépendre de la couleur).
- Légende en dessous : pastille + libellé + `68 % · 49 km`, triée par part décroissante.
- Tap sur une ligne de légende → surbrillance carte des portions concernées.

### C-11 Waypoint  → F-10
- Marqueur : goutte 28 px, fond blanc, bordure `--dark-green`, picto de type au centre.
- Feuille d'édition (ActionSheet custom) : grille de 6 types (boutons 64 px,
  picto + libellé, sélection = fond `--light-green` + bordure), champ Nom,
  champ Note, boutons [Supprimer] [Valider].
- Waypoint « hors tracé » : bordure `--orange` + puce d'avertissement.
- Correspondance GPX `<sym>` : Ravitaillement → `Restaurant`, Eau →
  `Drinking Water`, Rendez-vous → `Flag, Blue`, Point de vue → `Scenic Area`,
  Danger → `Danger Area`, Autre → `Flag, Green` (symboles Garmin standard).

### C-12 Liste des étapes  → F-02, F-12
- Reprend le style des étapes de « S'y rendre » (`location-first/step/last.svg`).
- Poignée `≡` à droite (SortableJS, `handle`) ; réordonner = recalcul des
  tronçons impactés + entrée d'historique.
- Glisser à gauche sur un item → bouton Supprimer.
- Champ de recherche « Ajouter une étape » en bas de liste (géocodage existant).

### C-13 Feuille « Réglages »  → F-03, F-05
ActionSheet custom, composants existants :
```
Niveau (vitesse sur le plat)
( ) Détente 22 km/h  (•) Régulier 26 km/h  ( ) Sportif 30 km/h  ( ) Personnalisé [ 28 ] km/h
Préférence de tracé
(•) Petites routes   ( ) Direct
  « S'applique aux prochains tronçons »  [Recalculer tout le parcours]
Vitesse max en descente   ──●────── 50 km/h
Tracé coloré par pente                         [ toggle ]
```
- Radios = `.radio-wrapper` ; interrupteur = `.toggleSwitch` ; curseur
  `input[type=range]` stylé `--dark-green`, pas de 5 km/h.
- Effet immédiat (pas de bouton Valider) ; feuille fermée par glisser vers le bas / retour.

### C-14 Boutons d'action
- Primaire : fond `--dark-green`, texte blanc Fira Sans Semibold 16, hauteur 48, rayon 24.
- Secondaire : contour 2 px `--dark-green`, texte `--dark-green`.
- Désactivé (moins de 2 points) : fond `--light-grey`, texte `--mid-grey`, `aria-disabled`.

### C-15 Menu « ⋯ Outils »  → F-04, F-07, F-15, F-16
ActionSheet style `buttons` existant :
Retour au départ · Aller-retour · Inverser le sens · Recalculer tout le
parcours · Proposer une boucle (V1.1) · Tout effacer (texte `--orange`, confirmation).

### C-16 Feuille « Exporter »  → F-14
```
Exporter « Boucle de Rambouillet »
Format         (•) Trace GPX (recommandé)   ( ) Itinéraire GPX
               ⓘ La trace est lue par tous les compteurs (Garmin, Wahoo, Hammerhead…)
Waypoints      [toggle on]
Simplifier     (•) Non  ( ) 2 000 points  ( ) 500 points (anciens GPS)
[ ⤴ Partager vers une application ]      ← primaire
[ ⤓ Enregistrer dans Documents ]         ← secondaire
```
- Succès Documents : Toast existant « Fichier enregistré dans Documents au format GPX. »
- Échec : Toast + repli sur Partager (comportement `exportData`).
- Poids estimé affiché sous le format (« ≈ 180 Ko · 2 900 points »).

### C-17 Écran Enregistrer  → F-13
Reprend `routeDrawSaveWindow` : résumé (chiffres clés C-06 en version compacte),
champ Nom pré-rempli et sélectionné, champ Description (textarea 3 lignes),
bouton primaire « Enregistrer ».

### C-18 Item « Enregistrés »  → F-13
Ligne existante des itinéraires + picto `velo-route-darkgrey.svg` à la place
du picto transport, sous-titre `72 km · D+ 980 m · 3 h 05`. Menu ⋯ de l'item :
Afficher/Masquer · Modifier · Exporter GPX · Partager · Dupliquer · Supprimer.

### C-19 États système
| État | Traitement |
|---|---|
| Hors ligne à l'ouverture | Toast, module non ouvert |
| Perte réseau pendant l'édition | Bandeau gris en haut du panneau « Hors connexion — modifications impossibles », barre d'édition inactive ; consultation/export restent possibles |
| Échec routage d'un tronçon | Toast + action « Relier en ligne droite » (F-07) |
| Échec altimétrie | Chiffres D+/D− « — », profil remplacé par « Profil indisponible · Réessayer » |
| Calcul long (> 3 s) | Loader dans le bandeau + possibilité de continuer à poser des points |

---

## 3. Correspondance fonctions ↔ composants

| Fonction | Composants | Couches carte |
|---|---|---|
| F-01 Entrée / cycle de vie | C-01, C-18, C-19 | — |
| F-02 Saisie | C-02, C-03, C-12 | `bike-route-point`, `-line`, `-line-pending` |
| F-03 Profil de routage | C-13 (préférence), puce titre C-05 | — |
| F-04 Boucle / A-R / inverser | C-02 (Boucler), C-15 | `bike-route-arrows` |
| F-05 Réglages | C-13 | `bike-route-line-grade` |
| F-06 Indicateurs | C-06, C-07, C-09 | `bike-route-climb-top` |
| F-07 Hors réseau | C-08, C-15 | `bike-route-line-offnetwork` |
| F-08 Voies / revêtement | C-10 | `bike-route-highlight` |
| F-09 Avertissements | C-08 | `bike-route-highlight` |
| F-10 Waypoints | C-11, C-12 | `bike-route-wpt` |
| F-11 POI | interrupteur dans C-13 + popups POI existantes | couche POI filtrée |
| F-12 Fiche | C-05 | — |
| F-13 Enregistrement | C-17, C-18 | — |
| F-14 Export | C-16 | — |
| F-15 Import | C-18 (action « Analyser en vélo ») | — |
| F-16 Boucle auto | C-15 + cartes de propositions (réutilise C-06 compact) | 3 tracés gris, sélection en vert |

## 4. Accessibilité (récapitulatif)

- Contrastes texte ≥ 4,5:1 (vérifiés pour les badges), information jamais portée par la seule couleur (valeurs, hachures).
- Tous les contrôles personnalisés : `role`, `aria-label`, `aria-pressed`/`aria-disabled`, ordre de tabulation cohérent (`tabindex` dans la plage 260–299 libre à vérifier).
- Ajouts de points annoncés : « Point 3 ajouté, Les Essarts-le-Roi, 18,2 km ».
- Respect de `TextZoom` (plugin déjà utilisé) : tailles en `rem`/`em` là où les styles existants le font.

## 5. Wording (extraits)

| Clé | Texte |
|---|---|
| Aide vide | « Touchez la carte pour poser votre point de départ » |
| Aide 1 point | « Touchez la carte pour ajouter un point de passage » |
| Échec routage | « Aucun itinéraire vélo trouvé jusqu'à ce point. » [Relier en ligne droite] |
| Non revêtu | « 1,2 km non revêtus » |
| Pente | « Pente max 14 % au km 37 » |
| Trafic | « 8 km sur route principale » |
| Durée | « Estimation sans arrêt, niveau Régulier (26 km/h sur le plat) » |
| Export OK | « Fichier enregistré dans Documents au format GPX. » |
| Quitter | « Quitter sans enregistrer ? Votre parcours sera perdu. » |
