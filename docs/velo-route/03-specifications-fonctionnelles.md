# 03 — Spécifications fonctionnelles : « Planifier une sortie vélo »

Nom de travail du module : **Vélo de route** (`bike-route`).
Libellé dans le menu : **« Planifier une sortie vélo »** — sous-titre :
*« Tracez un parcours vélo de route sur routes revêtues, visualisez les pentes et exportez-le en GPX »*.

Les identifiants **F-xx** sont référencés dans le design system (doc 04) et le plan (doc 05).
Chaque fonction rappelle les besoins couverts (B-xx, doc 02).

---

## F-01 Point d'entrée et cycle de vie  *(B-43, B-52)*

- Accès : menu **Se déplacer › Planifier une sortie vélo** (nouvel item entre
  « Tracer un itinéraire » et « Enregistrer une trace »).
- Hors ligne : Toast « Fonctionnalité indisponible en mode hors ligne. » (règle existante).
- À l'ouverture : panneau bas en position intermédiaire, carte centrée sur la
  position courante si disponible, réglages = derniers réglages utilisés
  (persistés dans `Preferences`).
- Fermer (retour Android / bouton retour) avec un tracé non enregistré →
  ActionSheet « Quitter sans enregistrer ? » [Enregistrer] [Quitter] [Annuler].
- Un parcours vélo ouvert depuis « Enregistrés » s'ouvre **en lecture**
  (fiche détail) avec actions *Modifier*, *Exporter GPX*, *Partager*,
  *Dupliquer*, *Supprimer*.

## F-02 Saisie du tracé  *(B-01, B-05, B-06)*

| Geste | Résultat |
|---|---|
| Tap sur la carte | Ajoute un point à la fin ; le tronçon depuis le point précédent est calculé avec le profil vélo |
| 1er tap | Pose le départ (marqueur départ) ; nom = géocodage inverse |
| Appui long + glisser un point | Déplace le point ; recalcul des 2 tronçons adjacents |
| Appui long + glisser la ligne | Insère un point intermédiaire à cet endroit |
| Tap sur un point | Popup : *Supprimer* / *Définir comme arrivée* / *Ajouter un waypoint ici* |
| Barre flottante | **Annuler**, **Refaire**, **Supprimer** (mode suppression), **Boucler** |
| Champ « Départ » (panneau) | Recherche d'adresse ou « Ma position » |

Règles :
- Le point posé est **recalé sur la route** retournée par le service (comme aujourd'hui).
- Pendant un calcul, la ligne du tronçon est affichée en pointillés gris
  (état *calcul*) ; les taps suivants sont mis en file (throttle existant 4 req/1,2 s).
- Erreur de routage (aucune route praticable) → Toast « Aucun itinéraire vélo
  trouvé jusqu'à ce point » + proposition « Relier en ligne droite » (F-07).
- Historique annuler/refaire : 50 états max.
- Limite : 100 points, 400 km (au-delà : Toast d'information, ajout bloqué).

## F-03 Profil de routage « vélo de route »  *(B-01, B-02, B-03, B-04)*

Le tracé doit :
1. n'emprunter **que des voies revêtues** ouvertes aux cycles ;
2. **exclure** : autoroutes et voies de type autoroutier, bretelles d'accès
   aux voies rapides, chemins, sentiers, escaliers, routes empierrées, bacs ;
3. **respecter les sens de circulation** ;
4. selon la préférence :
   - **Direct** : plus court chemin sur ce réseau ;
   - **Petites routes** (par défaut) : pénalise les routes d'importance 1–2
     (nationales, grands axes), favorise importance 3–5 et les pistes
     cyclables revêtues.

Implémentation cible (à confirmer par le spike S0, doc 05) : service
Géoplateforme `bdtopo-pgr`, `profile=car`, `constraints` (bannir/éviter/préférer)
et `waysAttributes` pour récupérer `nature` / `importance` par portion.
Repli : moteur open source BRouter (OSM, profil `fastbike`) — décision à
valider (voir D-1 dans le plan).

La préférence se change à tout moment ; elle s'applique aux **tronçons
suivants**, avec un bouton « Recalculer tout le parcours ».

## F-04 Boucle, aller-retour, inverser  *(B-07, B-08, B-09)*

Menu « ⋯ Outils » du panneau :
- **Retour au départ** : ajoute un dernier point = départ ; calcul du tronçon.
  L'icône *Boucler* de la barre flottante fait la même chose.
- **Aller-retour** : ajoute les points dans l'ordre inverse (le tracé retour
  est recalculé, car les sens uniques peuvent différer).
- **Inverser le sens** : inverse l'ordre des points et recalcule (sens uniques).
- Ces actions sont annulables comme les autres.

## F-05 Réglages cycliste  *(B-21)*

Feuille « Réglages » (icône engrenage du panneau) :

| Réglage | Valeurs | Défaut |
|---|---|---|
| Niveau (vitesse sur le plat) | Détente 22 km/h · Régulier 26 km/h · Sportif 30 km/h · Personnalisé (15–45) | Régulier |
| Préférence de tracé | Petites routes · Direct | Petites routes |
| Vitesse max en descente | 30–70 km/h | 50 km/h |
| Afficher le tracé coloré par pente | oui/non | non |

Persistés dans `Preferences` (`bikeRouteSettings`). Modifier le niveau
recalcule instantanément la durée (pas d'appel réseau).

## F-06 Calcul des indicateurs  *(B-20, B-21, B-22, B-23)*

### Altimétrie
- Échantillonnage du tracé tous les **25 m** (≤ 5 000 pts / requête, requêtes
  découpées si besoin), service `elevationLine` RGE ALTI.
- Lissage : moyenne glissante sur 100 m pour le calcul des pentes.
- **D+ / D−** : cumul avec hystérésis de 3 m (évite la sur-estimation du bruit).
- Altitudes min / max.

### Pente
- Pente par tranche de 100 m (affichage profil) et par km (détails).
- Classes : `< 3 %`, `3–6 %`, `6–9 %`, `9–12 %`, `≥ 12 %` (descentes : une classe unique « descente »).

### Durée
Modèle physique simplifié à puissance constante, calibré sur la vitesse à plat
choisie :
- `P = v₀·(m·g·Crr + ½·ρ·CdA·v₀²)` avec m = 85 kg, Crr = 0,005, CdA = 0,32 m², ρ = 1,2.
- Sur chaque tranche de 100 m de pente `s`, on résout
  `P = v·(m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v²)` (bissection) ;
  plancher 6 km/h, plafond = vitesse max descente.
- Durée = Σ distance / vitesse ; arrondie à 5 min ; + aucun arrêt (indiqué).
- Vitesse moyenne estimée affichée.

### Montées (cols / côtes)
Algorithme sur le profil lissé :
1. Repérer les séquences montantes, en tolérant des replats/descentes de
   < 10 m de dénivelé et < 500 m de long.
2. Conserver si longueur ≥ 500 m **et** pente moyenne ≥ 3 % **et** D+ ≥ 30 m.
3. Score = longueur (m) × pente moyenne (%) → catégorie :
   **Cat. 4** ≥ 8 000 · **Cat. 3** ≥ 16 000 · **Cat. 2** ≥ 32 000 ·
   **Cat. 1** ≥ 48 000 · **HC** ≥ 64 000 ; en dessous : « côte ».
4. Pour chaque montée : km de début, longueur, D+, pente moy., pente max
   (sur 100 m), altitude sommet, nom (sommet/col BD TOPO ou OSM à moins de 200 m
   du sommet si disponible — Could, sinon « Montée n°k »).

## F-07 Section hors réseau  *(B-10)*

Après un échec de routage, ou via le popup d'un point : « Relier en ligne
droite ». Le tronçon est tracé en tirets orange, compté dans la distance et
signalé dans les avertissements (« 1 section hors réseau routier, 350 m »).

## F-08 Analyse des voies et revêtements  *(B-24, B-25)*

À partir des attributs par portion renvoyés par le routage :

| Catégorie affichée | Règle (BD TOPO) |
|---|---|
| Piste cyclable | nature = piste cyclable |
| Petite route | importance 4–6 |
| Route secondaire | importance 3 |
| Route principale | importance 1–2 |
| Non revêtu | nature ∈ {chemin, route empierrée} |
| Inconnu | attribut absent |

Restitution : barres empilées « Types de voie » et « Revêtement » avec
pourcentages et km ; tap sur une catégorie → surbrillance sur la carte.
Si le moteur retenu ne fournit pas ces attributs, la section est masquée (pas d'écran vide).

## F-09 Avertissements  *(B-26)*

Bandeau de « puces » au-dessus des indicateurs, tap = zoom sur la zone :
- « x km non revêtus » (si > 0) ;
- « Pente max 14 % au km 37 » (si ≥ 12 %) ;
- « x km sur route principale » (si > 10 % du parcours) ;
- « Section hors réseau » (F-07) ;
- « Parcours long : > 200 km ».

## F-10 Waypoints  *(B-31)*

- Ajout via popup d'un point du tracé ou appui long sur la ligne › *Ajouter un waypoint*.
- Types : Ravitaillement, Eau, Rendez-vous, Point de vue, Danger, Autre.
- Nom (pré-rempli par type + commune), note facultative.
- Les waypoints sont **attachés à la position sur le tracé** (abscisse
  curviligne) : ils suivent si le tracé est modifié autour, sinon ils restent à
  leur position et passent en « hors tracé » (avertissement).
- Exportés en `<wpt>` GPX (nom, `<sym>`, `<type>`).

## F-11 Points d'intérêt le long du parcours  *(B-32 — Could)*

Interrupteur « Afficher les services à proximité (500 m) » : eau potable,
toilettes, magasins/réparation vélo, cafés-boulangeries (couche POI OSM
existante, filtrée par tampon Turf autour du tracé). Tap → « Ajouter comme waypoint ».

## F-12 Fiche parcours et profil  *(B-20, B-22, B-23, B-27, B-28)*

Panneau bas, de haut en bas :
1. **Titre** (éditable) + puce préférence (« Petites routes »).
2. **Indicateurs clés** : Distance · D+ · Durée (vitesse moy.) ; ligne
   secondaire : D− · Alt. max.
3. **Avertissements** (F-09).
4. **Profil altimétrique coloré par pente** ; glisser le doigt = curseur
   sur la carte (comportement existant) ; montées surlignées.
5. **Montées** : liste (F-06), tap = zoom + surbrillance profil.
6. **Types de voie** / **Revêtement** (F-08).
7. **Étapes** : liste des points (départ, intermédiaires, arrivée) et
   waypoints, réordonnables par glisser (SortableJS).
8. Boutons : **Enregistrer** · **Exporter GPX**.

## F-13 Enregistrement  *(B-30, B-43)*

- Écran enregistrement (réutilise le pattern `RouteDrawSave`) : nom (défaut :
  « Boucle de <commune départ> — 72 km » ou « De A à B — 72 km »), description.
- Stocké dans « Enregistrés » avec `transport: "bike"` ; la liste affiche le
  picto vélo, distance, D+ et durée.
- Ouvrir depuis Enregistrés → fiche lecture (F-01) ; *Modifier* → mode édition.
- *Dupliquer* → copie « (copie) » ouverte en édition.

## F-14 Export GPX  *(B-40, B-41, B-42)*

Feuille « Exporter » :

| Option | Valeurs | Défaut |
|---|---|---|
| Format | GPX trace (`<trk>`) · GPX itinéraire (`<rte>`) | trace |
| Inclure les waypoints | oui/non | oui |
| Simplifier (anciens GPS) | non · ≤ 2 000 pts · ≤ 500 pts | non |
| Action | **Partager** (feuille native → Garmin Connect, Wahoo, Strava, Komoot, mail…) · **Enregistrer dans Documents/Fichiers** | Partager |

Contenu GPX 1.1 (validable XSD) :
```xml
<gpx version="1.1" creator="Cartes IGN" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>…</name><desc>72 km · D+ 980 m · Cartes IGN</desc>
    <link href="https://cartes-ign.ign.fr"><text>Cartes IGN</text></link><time>…</time></metadata>
  <wpt lat lon><ele/><name/><sym>Water Source</sym><type>Eau</type></wpt>
  <trk><name>…</name><type>cycling</type>
    <trkseg><trkpt lat lon><ele>…</ele></trkpt>…</trkseg></trk>
</gpx>
```
- Coordonnées à 6 décimales, altitude à 0,1 m (interpolée depuis l'échantillonnage F-06).
- Mode `<rte>` : `<rtept>` = points de passage densifiés (≥ 1 tous les 500 m),
  pour les GPS qui recalculent.
- Simplification : Douglas-Peucker itératif jusqu'au nombre cible.
- Nom de fichier : nom nettoyé + `.gpx`, suffixe `_n` si existant (logique `exportData` existante).
- Le **GPX généré pour les itinéraires piéton/voiture existants inclut aussi désormais l'altitude** quand elle est connue (bénéfice collatéral, optionnel — D-4).

## F-15 Import d'un GPX en mode vélo  *(B-44)*

Dans « Enregistrés › Importer », un GPX importé peut être ouvert dans le
module vélo (« Analyser en vélo de route ») : le tracé est conservé tel quel
(mode libre), les indicateurs F-06 sont calculés ; *Modifier* ne recale que les
tronçons touchés.

## F-16 Génération de boucle  *(B-11 — Could, V1.1)*

Depuis le départ : « Proposer une boucle » + distance cible (30–200 km) +
direction (N/E/S/O/aléatoire). Algorithme : 3–4 points virtuels sur un
polygone de périmètre ≈ distance/1,25, routage, ajustement itératif du rayon
(2 itérations max), 3 propositions affichées en cartes à faire défiler.

## F-17 Mesure d'usage  *(B-54)*

Événements Matomo (catégorie « Vélo de route ») : ouverture, 1er point posé,
enregistrement, export (format, action), génération de boucle. Aucune
coordonnée envoyée.

## Critères d'acceptation globaux

- Un parcours de 100 km en 8 points se trace en < 2 min, chaque tronçon < 1,5 s.
- Aucun tronçon sur autoroute, sentier ou escalier sur un jeu de 10 parcours tests.
- D+ à ± 10 % d'une référence (trace GPS baromètre ou Komoot) sur 5 parcours tests.
- Le GPX passe la validation XSD GPX 1.1 et s'importe dans Garmin Connect,
  Wahoo, Strava, Komoot, et dans Cartes IGN lui-même.
- Aucune régression sur « Tracer un itinéraire », « S'y rendre », « Enregistrés ».
