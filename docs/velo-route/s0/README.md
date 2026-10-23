# Spike S0 — choix du moteur de routage vélo (décision D-1)

## But

Vérifier si le service d'itinéraire de la Géoplateforme peut produire des
tracés « vélo de route » (routes revêtues, sans autoroute ni chemin, sens
uniques respectés, petites routes privilégiées), et le comparer à BRouter
(profil `fastbike`, OpenStreetMap). Vérifier aussi les limites du service
altimétrique pour un échantillonnage fin.

## Lancer le test

Depuis la racine du dépôt, avec Node ≥ 18 (l'app demande déjà Node 24) :

```bash
node docs/velo-route/s0/s0-routage.mjs
```

Durée : environ 2 min (une soixantaine de requêtes, espacées volontairement).
Options : `--diagnostic` (capacités + diagnostic des requêtes, ~1 min), `--no-brouter`.

Derrière un proxy d'entreprise (erreur `ENOTFOUND` ou `fetch failed`), avec Node ≥ 24 :
`NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://proxy:port node docs/velo-route/s0/s0-routage.mjs`

Ce que fait le script :
1. Il récupère `getcapabilities` et en extrait, pour chaque ressource
   (`bdtopo-osrm`, `bdtopo-pgr`, `bdtopo-valhalla`), les profils, les clés de
   contraintes acceptées et les `waysAttributes` disponibles.
2. Il construit les contraintes **à partir de ces capacités réelles** :
   bannir `autoroute` et les natures chemin / sentier / escalier / route
   empierrée / bac / type autoroutier, éviter l'importance 1–2, préférer 4–5.
3. Il calcule 11 parcours tests (Chevreuse, boucle, Vexin, Paris, Évry–Fontainebleau,
   Alpe d'Huez, Galibier, Ventoux, Bretagne, Lyon, Nice–Monaco) avec 5 variantes
   IGN et BRouter :

   | Variante | Description |
   |---|---|
   | `osrm-car` | Comportement actuel de l'app (référence) |
   | `pgr-car` | pgRouting voiture, sans contrainte |
   | `pgr-car-ban` | + contraintes bannies |
   | `pgr-car-calme` | + éviter grands axes / préférer petites routes |
   | `valhalla-car-ban` | Valhalla voiture + contraintes bannies |
   | `brouter-fastbike` | BRouter vélo de route (comparaison) |

4. Il mesure les temps de réponse, repère les mètres « suspects » (autoroute,
   chemin, sentier, non revêtu…) dans les attributs renvoyés, et teste
   `elevationLine` avec un échantillonnage de 200 à 5 000 points.

## Résultats à me renvoyer

Dans `docs/velo-route/s0/out/` (dossier ignoré par git) :

- **`S0-resultats.md`** ← à m'envoyer (copier-coller dans la conversation suffit).
  Si possible, complétez à la main le dernier tableau « Observations visuelles ».
- `geojson/<parcours>__toutes-variantes.geojson` : à glisser sur
  https://geojson.io pour comparer les tracés visuellement. Les fichiers
  par variante peuvent aussi être importés dans Cartes IGN (Enregistrés › Importer).
- `capabilities.json` : réponse brute, utile si le rapport montre des erreurs de contraintes.

## Grille de décision

| Résultat | Décision D-1 |
|---|---|
| `pgr-car-ban` / `pgr-car-calme` répondent (HTTP 200), 0 m suspect, < 3 s par tronçon, tracés jugés bons | **Géoplateforme `bdtopo-pgr`** |
| Contraintes acceptées mais tracés passant par de grands axes, ou temps > 3 s | Hybride : pgr par défaut, BRouter en option « Petites routes » |
| Contraintes refusées (HTTP 400) ou autoroutes/chemins persistants | **BRouter** (puis évaluer l'auto-hébergement) |

Altimétrie : on retient le plus grand `sampling` qui répond en HTTP 200 en
moins de 3 s pour fixer le pas d'échantillonnage de F-06.
