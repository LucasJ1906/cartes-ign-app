# 02 — Vecteur de besoins : planification vélo de route

## 1. Personas

| Persona | Profil | Usage type | Attente principale |
|---|---|---|---|
| **Claire, cyclo du dimanche** | 2 sorties/sem., 50–90 km, club local | Prépare la sortie la veille sur son téléphone, l'envoie sur son Garmin | Une boucle sur petites routes, D+ et durée fiables, GPX en 2 clics |
| **Marc, sportif / cyclosportive** | 8–12 h/sem., prépare l'Étape du Tour | Reconnaît des cols, enchaîne des montées | Profil précis, pentes par km, liste des cols, catégorisation |
| **Inès, cyclotouriste** | Itinérance 3–5 jours | Découpe un parcours en étapes, cherche eau/ravitaillement | Points d'eau, villages, étapes, export par jour |
| **Paul, débutant** | Vélo de route récent | Veut éviter le trafic et les murs à 15 % | Avertissements clairs, itinéraire « calme », peu de jargon |

## 2. Vecteur de besoins

Chaque besoin est noté **B-xx**, avec sa priorité MoSCoW
(**M**ust / **S**hould / **C**ould / **W**on't pour cette version).

### A. Tracer
| Id | Besoin | Prio |
|---|---|---|
| B-01 | Tracer un parcours point par point sur la carte, le tracé suivant les routes **revêtues** praticables à vélo | M |
| B-02 | Éviter automatiquement autoroutes, voies rapides, chemins non revêtus, sentiers, escaliers | M |
| B-03 | Respecter les sens uniques (un vélo de route circule sur la chaussée) | M |
| B-04 | Choisir une préférence de tracé : *le plus direct* / *petites routes (calme)* | S |
| B-05 | Déplacer, insérer, supprimer un point ; annuler/refaire | M |
| B-06 | Saisir départ/étapes par recherche d'adresse ou « ma position » | S |
| B-07 | Fermer la boucle (retour au départ) en un geste | M |
| B-08 | Aller-retour (dupliquer le tracé en sens inverse) | S |
| B-09 | Inverser le sens du parcours | S |
| B-10 | Section « hors réseau » ponctuelle (ligne droite) quand le routage échoue | C |
| B-11 | Générer automatiquement une boucle depuis un point pour une distance cible | C |

### B. Évaluer
| Id | Besoin | Prio |
|---|---|---|
| B-20 | Distance, D+, D−, altitude min/max en temps réel | M |
| B-21 | Durée estimée selon **mon niveau** (vitesse sur le plat) et la pente | M |
| B-22 | Profil altimétrique **coloré par pente**, synchronisé avec la carte | M |
| B-23 | Liste des **montées** détectées (longueur, D+, pente moy./max, catégorie) | S |
| B-24 | Répartition des **types de voie** (route principale, secondaire, petite route, piste cyclable…) | S |
| B-25 | Répartition du **revêtement** (revêtu / non revêtu / inconnu) | S |
| B-26 | **Avertissements** : section non revêtue, pente > 12 %, route à fort trafic, segment hors réseau | S |
| B-27 | Option d'affichage du tracé coloré par pente sur la carte | C |
| B-28 | Bornes kilométriques sur le tracé | C |

### C. Enrichir
| Id | Besoin | Prio |
|---|---|---|
| B-30 | Nommer le parcours, ajouter une description | M |
| B-31 | Ajouter des waypoints nommés (ravito, point de rendez-vous, photo) exportés dans le GPX | S |
| B-32 | Voir les points d'eau, cafés, magasins vélo, toilettes à proximité du parcours | C |
| B-33 | Découper en étapes (itinérance) | W (V2) |
| B-34 | Météo / vent sur le parcours | W (V2) |

### D. Exporter, partager, retrouver
| Id | Besoin | Prio |
|---|---|---|
| B-40 | Export **GPX 1.1 valide** avec altitude par point, nom, type `cycling` | M |
| B-41 | Envoi direct vers les applis compteurs (Garmin Connect, Wahoo, Hammerhead, Strava, Komoot) via la feuille de partage native | M |
| B-42 | Choix *trace* (`<trk>`) / *itinéraire* (`<rte>`) et simplification pour vieux GPS | S |
| B-43 | Enregistrer dans « Enregistrés », rouvrir, modifier, dupliquer, supprimer | M |
| B-44 | Import d'un GPX existant pour l'analyser/le modifier en mode vélo | S |
| B-45 | Export TCX/FIT « course » avec indications | W (V2) |

### E. Transverse
| Id | Besoin | Prio |
|---|---|---|
| B-50 | Utilisable d'une main, en extérieur (contraste, cibles ≥ 44 px) | M |
| B-51 | Accessibilité (lecteur d'écran, navigation clavier, couleurs + motifs) | M |
| B-52 | Comportement clair hors ligne (consultation OK, calcul indisponible) | M |
| B-53 | Performance : ajout de point < 1,5 s, parcours de 200 km fluide | M |
| B-54 | Mesure d'usage Matomo (création, export, type d'export) | S |
| B-55 | Rester dans l'esprit Cartes IGN : données publiques IGN, souveraineté, gratuité | M |

## 3. Benchmark : ce que font les références

| Fonction | Strava Route Builder | Komoot | Ride with GPS | Garmin Connect | **Cartes IGN (cible)** |
|---|---|---|---|---|---|
| Profil « vélo de route » | ✅ (sport « Vélo ») | ✅ « Vélo de route » | ✅ | ✅ | ✅ profil dédié |
| Routage par popularité (heatmap) | ✅ cœur du produit | ✅ (« highlights ») | ✅ | ✅ | ❌ pas de données → compensé par la **qualité BD TOPO** (importance, nature des voies) |
| Préférence petites routes | « Minimiser le dénivelé » | Implicite | Options d'évitement | Options | ✅ *Direct* / *Petites routes* |
| Boucle auto par distance | ✅ « Générer » | ✅ (Premium) | ❌ | ✅ « Round trip » | Could (V1.1) |
| Retour au départ / aller-retour / inverser | ✅ | ✅ | ✅ | ✅ | ✅ |
| Profil coloré par pente | ✅ | ✅ | ✅ | ✅ | ✅ |
| Détection et catégorisation des montées | ✅ (segments) | ❌ | ✅ | ✅ ClimbPro | ✅ formule Strava |
| Types de voie / revêtement | ✅ revêtement | ✅ très détaillé | ✅ | partiel | ✅ (BD TOPO) |
| Avertissements (non revêtu, trafic) | ❌ | ✅ | ❌ | ❌ | ✅ |
| Estimation durée selon niveau | ✅ vitesse moyenne | ✅ niveau de forme | ✅ | ✅ | ✅ modèle physique simple |
| Waypoints / POI | ❌ | ✅ highlights | ✅ cue sheet | ✅ | ✅ waypoints + POI OSM (Could) |
| Export GPX | ✅ | ✅ | ✅ (+TCX, FIT) | FIT | ✅ GPX 1.1 complet |
| Envoi compteur | Sync | Sync | Sync | Sync natif | Feuille de partage native |
| Gratuit | Partiel (abonnement) | Partiel | Partiel | ✅ | ✅ |
| Fonds IGN (Scan 25, Plan IGN) | ❌ | ❌ | ❌ | ❌ | ✅ **différenciant** |

**Positionnement** : on ne copie pas la heatmap (pas de données), on capitalise
sur ce que seul l'IGN a : la BD TOPO (importance et nature des voies, très
fiable en France), le RGE ALTI (altimétrie précise → pentes et cols justes) et
les fonds de carte IGN. Le tout gratuit, sans compte, avec un GPX propre.

## 4. Hors périmètre V1

Navigation guidée vocale, suivi en temps réel du parcours planifié (le module
« Enregistrer une trace » existe déjà), synchronisation cloud, social,
segments chronométrés, météo, étapes multi-jours, FIT/TCX.
