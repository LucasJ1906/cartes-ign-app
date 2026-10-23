/**
 * Copyright (c) Institut national de l'information géographique et forestière
 *
 * This program and the accompanying materials are made available under the terms of the GPL License, Version 3.0.
 */

/**
 * Spike S0 — moteur de routage vélo de route
 *
 * Usage (Node >= 18, aucune dépendance) :
 *   node docs/velo-route/s0/s0-routage.mjs                 # test complet
 *   node docs/velo-route/s0/s0-routage.mjs --diagnostic    # capacités + diagnostic des requêtes
 *   node docs/velo-route/s0/s0-routage.mjs --no-brouter    # sans comparaison BRouter
 *
 * Sorties dans docs/velo-route/s0/out/ :
 *   capabilities.json            réponse brute getcapabilities
 *   capabilities-extract.json    paramètres utiles (contraintes, waysAttributes) par ressource
 *   S0-resultats.md              rapport à renvoyer
 *   results.json                 résultats bruts
 *   geojson/*.geojson            tracés (à ouvrir dans geojson.io ou à importer dans Cartes IGN)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
const GEOPF = "https://data.geopf.fr/navigation";
const ALTI = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevationLine.json";
const BROUTER = "https://brouter.de/brouter";
const args = process.argv.slice(2);

// Parcours tests : [lon, lat], intermédiaires optionnels
const ROUTES = [
  { id: "01-chevreuse", name: "Rambouillet → Chevreuse (petites routes)", pts: [[1.8346, 48.6436], [2.0423, 48.7065]] },
  { id: "02-boucle-cernay", name: "Boucle Rambouillet – Cernay-la-Ville", pts: [[1.8346, 48.6436], [1.9733, 48.6731], [1.8960, 48.6020], [1.8346, 48.6436]] },
  { id: "03-vexin", name: "Pontoise → Magny-en-Vexin", pts: [[2.0950, 49.0507], [1.7861, 49.1554]] },
  { id: "04-paris", name: "Paris Bastille → Porte Maillot (sens uniques)", pts: [[2.3692, 48.8532], [2.2826, 48.8781]] },
  { id: "05-evry-fontainebleau", name: "Évry → Fontainebleau (A6/N7 à éviter)", pts: [[2.4417, 48.6239], [2.6997, 48.4047]] },
  { id: "06-alpe-huez", name: "Bourg-d'Oisans → Alpe d'Huez", pts: [[6.0303, 45.0553], [6.0700, 45.0917]] },
  { id: "07-galibier", name: "Valloire → Col du Galibier", pts: [[6.4290, 45.1650], [6.4078, 45.0640]] },
  { id: "08-ventoux", name: "Bédoin → Mont Ventoux", pts: [[5.1789, 44.1245], [5.2786, 44.1741]] },
  { id: "09-bretagne", name: "Quimper → Concarneau", pts: [[-4.1024, 47.9960], [-3.9136, 47.8753]] },
  { id: "10-lyon", name: "Lyon Part-Dieu → Villefranche-sur-Saône", pts: [[4.8590, 45.7606], [4.7186, 45.9894]] },
  { id: "11-nice-monaco", name: "Nice → Monaco (corniches, voies rapides)", pts: [[7.2620, 43.6961], [7.4246, 43.7384]] },
];

// Valeurs d'attributs révélant un tronçon interdit à un vélo de route
const SUSPECT = /autorout|sentier|escalier|chemin|empierr|bac|motorway|trunk|path|track|steps|unpaved|gravel|dirt/i;
// Natures BD TOPO à bannir (la piste cyclable est volontairement conservée)
const NATURE_BAN = /^(chemin|sentier|escalier|route empierr|bac|type autoroutier)/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (msg) => process.stdout.write(`${msg}\n`);

async function getJson(url, options = {}) {
  const t0 = Date.now();
  let status = 0;
  let body = null;
  let text = "";
  try {
    const response = await fetch(url, options);
    status = response.status;
    text = await response.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  } catch (err) {
    text = String(err && err.cause ? err.cause : err);
  }
  return { status, body, text, ms: Date.now() - t0, url: String(url) };
}

// Recherche récursive des objets décrivant une clé de contrainte
function findConstraintKeys(node, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findConstraintKeys(child, acc));
  } else if (node && typeof node === "object") {
    if (typeof node.key === "string") {
      acc.push(node);
    }
    Object.values(node).forEach((child) => findConstraintKeys(child, acc));
  }
  return acc;
}

function extractCapabilities(caps) {
  const extract = {};
  for (const resource of caps.resources || []) {
    const route = (resource.availableOperations || []).find((op) => op.id === "route");
    if (!route) {
      continue;
    }
    const params = {};
    for (const param of route.availableParameters || []) {
      params[param.id] = param.values ?? param.defaultValue ?? null;
    }
    const constraintsParam = (route.availableParameters || []).find((p) => p.id === "constraints");
    extract[resource.id] = {
      routeUrl: route.url || route.href || route.path || null,
      operationKeys: Object.keys(route),
      parameterIds: (route.availableParameters || []).map((p) => p.id),
      profiles: params.profile,
      optimizations: params.optimization,
      waysAttributes: params.waysAttributes,
      constraintKeys: constraintsParam ? findConstraintKeys(constraintsParam).map((k) => ({
        key: k.key,
        constraintTypes: k.availableConstraintType || k.constraintType || k.availableConstraintTypes,
        operators: k.availableOperators || k.operators,
        values: k.values || k.availableValues,
      })) : [],
    };
  }
  return extract;
}

function listValues(keyDef) {
  return (keyDef.values || []).map((v) => (v && typeof v === "object" ? (v.value ?? v.id ?? v.name) : v));
}

function supports(keyDef, type) {
  const types = [].concat(keyDef.constraintTypes || []);
  return types.length === 0 || types.includes(type);
}

function constraint(type, key, operator, value) {
  return JSON.stringify({ constraintType: type, key, operator, value });
}

// Construit les contraintes « vélo de route » à partir des capacités réelles
function buildConstraints(resourceCaps, withCalm) {
  const out = [];
  const keys = (resourceCaps && resourceCaps.constraintKeys) || [];
  const wayType = keys.find((k) => /waytype/i.test(k.key));
  if (wayType && supports(wayType, "banned")) {
    const values = listValues(wayType);
    const autoroute = values.find((v) => /autorout/i.test(String(v))) || "autoroute";
    out.push(constraint("banned", wayType.key, "=", autoroute));
  }
  const nature = keys.find((k) => /^nature$/i.test(k.key));
  if (nature && supports(nature, "banned")) {
    listValues(nature).filter((v) => NATURE_BAN.test(String(v))).forEach((v) => {
      out.push(constraint("banned", nature.key, "=", v));
    });
  }
  if (withCalm) {
    const importance = keys.find((k) => /importance/i.test(k.key));
    if (importance) {
      const values = listValues(importance);
      const pick = (n) => values.find((v) => String(v) === String(n)) ?? String(n);
      if (supports(importance, "avoid")) {
        [1, 2].forEach((n) => out.push(constraint("avoid", importance.key, "=", pick(n))));
      }
      if (supports(importance, "prefer")) {
        [4, 5].forEach((n) => out.push(constraint("prefer", importance.key, "=", pick(n))));
      }
    }
    const classement = keys.find((k) => /classement_administratif/i.test(k.key));
    if (classement && supports(classement, "avoid")) {
      listValues(classement).filter((v) => /nationale/i.test(String(v))).forEach((v) => {
        out.push(constraint("avoid", classement.key, "=", v));
      });
    }
  }
  return out;
}

let CAPS = {};
let ROUTE_URL = null;

// Attributs utiles au vélo (évite des URL trop longues)
const USEFUL_ATTRS = ["nature", "importance", "itineraire_vert", "sens_de_circulation", "cpx_classement_administratif", "cpx_numero", "urbain"];

// Cherche l'URL de l'opération « route » au niveau racine des capacités (format Road2)
function findRouteUrl(body) {
  const base = (body.info && body.info.url) || "https://data.geopf.fr/navigation/";
  const ops = [].concat(body.operations || []);
  const op = ops.find((o) => o && o.id === "route");
  if (op && op.url) {
    return String(new URL(op.url.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`));
  }
  return null;
}

// URL de l'opération route : celle annoncée par getcapabilities, sinon celle utilisée par l'app
function routeBase(resource) {
  const announced = (CAPS[resource] && CAPS[resource].routeUrl) || ROUTE_URL;
  return announced ? new URL(announced, "https://data.geopf.fr/") : new URL(`${GEOPF}/itineraire`);
}

function firstValue(values, fallback) {
  const list = [].concat(values || []).map((v) => (v && typeof v === "object" ? (v.id ?? v.value ?? v.name) : v));
  return list.includes(fallback) || list.length === 0 ? fallback : list[0];
}

function geopfUrl(resource, profile, pts, constraints, attributes, optimization = "shortest") {
  const url = routeBase(resource);
  const fmt = (p) => `${p[0]},${p[1]}`;
  url.searchParams.set("resource", resource);
  url.searchParams.set("profile", profile);
  url.searchParams.set("optimization", optimization);
  url.searchParams.set("start", fmt(pts[0]));
  url.searchParams.set("end", fmt(pts[pts.length - 1]));
  if (pts.length > 2) {
    url.searchParams.set("intermediates", pts.slice(1, -1).map(fmt).join("|"));
  }
  url.searchParams.set("geometryFormat", "geojson");
  url.searchParams.set("getSteps", "true");
  url.searchParams.set("distanceUnit", "meter");
  url.searchParams.set("timeUnit", "second");
  if (constraints.length) {
    url.searchParams.set("constraints", constraints.join("|"));
  }
  if (attributes.length) {
    url.searchParams.set("waysAttributes", attributes.join("|"));
  }
  return url;
}

// Agrège les attributs des steps pondérés par la distance
function aggregateGeopf(body) {
  const agg = {};
  for (const portion of body.portions || []) {
    for (const step of portion.steps || []) {
      const attrs = step.attributes || {};
      const flat = {};
      Object.entries(attrs).forEach(([k, v]) => {
        if (v && typeof v === "object") {
          Object.entries(v).forEach(([k2, v2]) => { flat[`${k}.${k2}`] = v2; });
        } else {
          flat[k] = v;
        }
      });
      Object.entries(flat).forEach(([k, v]) => {
        agg[k] = agg[k] || {};
        agg[k][String(v)] = (agg[k][String(v)] || 0) + (Number(step.distance) || 0);
      });
    }
  }
  return agg;
}

function aggregateBrouter(feature) {
  const agg = { highway: {}, surface: {} };
  const messages = (feature.properties && feature.properties.messages) || [];
  if (messages.length < 2) {
    return agg;
  }
  const iDist = messages[0].indexOf("Distance");
  const iTags = messages[0].indexOf("WayTags");
  messages.slice(1).forEach((row) => {
    const dist = Number(row[iDist]) || 0;
    const tags = Object.fromEntries(String(row[iTags] || "").split(" ").map((t) => t.split("=")));
    ["highway", "surface"].forEach((k) => {
      const v = tags[k] || "(absent)";
      agg[k][v] = (agg[k][v] || 0) + dist;
    });
  });
  return agg;
}

function suspectMeters(agg) {
  let total = 0;
  const hits = [];
  Object.entries(agg).forEach(([k, values]) => {
    Object.entries(values).forEach(([v, d]) => {
      if (SUSPECT.test(v) && d > 0) {
        total += d;
        hits.push(`${k}=${v} (${Math.round(d)} m)`);
      }
    });
  });
  return { total, hits };
}

function summarizeAgg(agg) {
  return Object.entries(agg).map(([k, values]) => {
    const sum = Object.values(values).reduce((a, b) => a + b, 0) || 1;
    const top = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([v, d]) => `${v} ${Math.round((100 * d) / sum)}%`).join(", ");
    return `${k}: ${top}`;
  }).join(" ; ");
}

function naiveAscent(z) {
  let up = 0;
  for (let i = 1; i < z.length; i++) {
    if (z[i] > z[i - 1]) {
      up += z[i] - z[i - 1];
    }
  }
  return Math.round(up);
}

async function testElevation(coords) {
  const results = [];
  const lon = coords.map((c) => c[0]).join("|");
  const lat = coords.map((c) => c[1]).join("|");
  for (const sampling of [200, 1000, 2000, 5000]) {
    const r = await getJson(ALTI, {
      method: "POST",
      headers: { "accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ lon, lat, sampling, indent: "false", resource: "ign_rge_alti_wld" }),
    });
    const elevations = (r.body && r.body.elevations) || [];
    results.push({
      sampling,
      inputPoints: coords.length,
      status: r.status,
      ms: r.ms,
      returned: elevations.length,
      dplusNaive: naiveAscent(elevations.map((e) => e.z).filter((z) => z > -100)),
      error: r.status === 200 ? "" : r.text.slice(0, 200),
    });
    await sleep(500);
  }
  return results;
}

// Ajoute les paramètres un à un pour isoler celui qui fait échouer la requête
async function runDiagnostic(caps) {
  log("→ diagnostic (parcours 01, paramètres ajoutés un par un)");
  const pts = ROUTES[0].pts;
  const fmt = (p) => `${p[0]},${p[1]}`;
  const out = [];
  const resources = ["bdtopo-osrm", "bdtopo-pgr", "bdtopo-valhalla", "graphe_routier_r100_IGN", Object.keys(caps).filter((k) => /magellium/.test(k)).sort().pop()]
    .filter(Boolean);
  for (const resource of resources) {
    const c = caps[resource] || {};
    const profile = firstValue(c.profiles, "car");
    const optimization = firstValue(c.optimizations, "shortest");
    const attributes = [].concat(c.waysAttributes || []).map((a) => (a && typeof a === "object" ? (a.id ?? a.name) : a)).filter((a) => USEFUL_ATTRS.includes(a));
    const firstConstraint = buildConstraints(c, false).slice(0, 1);
    const steps = [
      ["url-app-exacte", () => `${GEOPF}/itineraire?resource=${resource}&getSteps=false&timeUnit=second&optimization=${optimization}&start=${fmt(pts[0])}&end=${fmt(pts[1])}&profile=${profile}`],
      ["url-capabilities", () => { const u = routeBase(resource); [["resource", resource], ["profile", profile], ["optimization", optimization], ["start", fmt(pts[0])], ["end", fmt(pts[1])]].forEach(([k, v]) => u.searchParams.set(k, v)); return u; }],
      ["+geometryFormat", (u) => { u.searchParams.set("geometryFormat", "geojson"); return u; }],
      ["+getSteps", (u) => { u.searchParams.set("getSteps", "true"); return u; }],
      ["+unités", (u) => { u.searchParams.set("distanceUnit", "meter"); u.searchParams.set("timeUnit", "second"); return u; }],
      ["+waysAttributes", (u) => { if (attributes.length) { u.searchParams.set("waysAttributes", attributes.join("|")); } return u; }],
      ["+1 contrainte", (u) => { if (firstConstraint.length) { u.searchParams.set("constraints", firstConstraint[0]); } return u; }],
    ];
    let current = null;
    for (const [step, build] of steps) {
      current = step === "url-app-exacte" ? build() : step === "url-capabilities" ? build() : build(new URL(current));
      const r = await getJson(current);
      out.push({ resource, step, status: r.status, ms: r.ms, text: r.text.slice(0, 300), url: String(current) });
      log(`   ${resource.padEnd(40)} ${step.padEnd(17)} HTTP ${r.status} ${r.status === 200 ? "" : r.text.slice(0, 100)}`);
      if (step === "url-app-exacte" || step === "url-capabilities") {
        log(`      ${current}`);
      }
      if (step === "url-app-exacte") {
        current = null;
      }
      await sleep(300);
    }
  }
  return out;
}

async function main() {
  await mkdir(join(OUT, "geojson"), { recursive: true });

  log("→ getcapabilities");
  const capsResp = await getJson(`${GEOPF}/getcapabilities`);
  if (capsResp.status !== 200 || !capsResp.body) {
    log(`Échec getcapabilities (HTTP ${capsResp.status}) : ${capsResp.text.slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  await writeFile(join(OUT, "capabilities.json"), JSON.stringify(capsResp.body, null, 2));
  const caps = extractCapabilities(capsResp.body);
  await writeFile(join(OUT, "capabilities-extract.json"), JSON.stringify(caps, null, 2));
  CAPS = caps;
  ROUTE_URL = findRouteUrl(capsResp.body);
  log(`  clés racine des capacités : ${Object.keys(capsResp.body).join(", ")}`);
  log(`  info : ${JSON.stringify(capsResp.body.info || null).slice(0, 300)}`);
  log(`  opérations : ${JSON.stringify([].concat(capsResp.body.operations || []).map((o) => ({ id: o.id, url: o.url, methods: o.methods }))).slice(0, 600)}`);
  log(`  URL route retenue : ${ROUTE_URL || `(défaut) ${GEOPF}/itineraire`}`);
  Object.entries(caps).forEach(([id, c]) => {
    log(`  ${id}`);
    log(`     url=${c.routeUrl} profils=${JSON.stringify(c.profiles)} optim=${JSON.stringify(c.optimizations)}`);
    log(`     contraintes=${c.constraintKeys.map((k) => k.key).join(",") || "aucune"} attributs=${JSON.stringify(c.waysAttributes)}`);
  });
  const diagnostic = await runDiagnostic(caps);
  if (args.includes("--capabilities") || args.includes("--diagnostic")) {
    await writeFile(join(OUT, "diagnostic.json"), JSON.stringify(diagnostic, null, 2));
    return;
  }

  const attrsOf = (res) => [].concat((caps[res] && caps[res].waysAttributes) || [])
    .map((a) => (a && typeof a === "object" ? (a.id ?? a.name) : a)).filter((a) => USEFUL_ATTRS.includes(a));

  const bikeVariants = Object.entries(caps).flatMap(([id, c]) => [].concat(c.profiles || [])
    .map((p) => (p && typeof p === "object" ? (p.id ?? p.value ?? p.name) : p))
    .filter((p) => /bike|velo|vélo|cycl/i.test(String(p)))
    .map((p) => ({ id: `${id}-${p}`, label: `${id} profil ${p}`, resource: id, profile: p, constraints: () => buildConstraints(c, false) })));

  const variants = [
    ...bikeVariants,
    { id: "osrm-car", label: "Actuel app (osrm car)", resource: "bdtopo-osrm", profile: "car", constraints: () => [] },
    { id: "pgr-car", label: "pgr car brut", resource: "bdtopo-pgr", profile: "car", constraints: () => [] },
    { id: "pgr-car-ban", label: "pgr car + bannis", resource: "bdtopo-pgr", profile: "car", constraints: () => buildConstraints(caps["bdtopo-pgr"], false) },
    { id: "pgr-car-calme", label: "pgr car + bannis + petites routes", resource: "bdtopo-pgr", profile: "car", constraints: () => buildConstraints(caps["bdtopo-pgr"], true) },
    { id: "r100-car-calme", label: "graphe_routier_r100_IGN car + bannis + petites routes", resource: "graphe_routier_r100_IGN", profile: "car", constraints: () => buildConstraints(caps["graphe_routier_r100_IGN"], true) },
    { id: "valhalla-car-ban", label: "valhalla car + bannis", resource: "bdtopo-valhalla", profile: "car", constraints: () => buildConstraints(caps["bdtopo-valhalla"], false) },
  ].filter((v) => caps[v.resource]);

  const results = [];
  let ventouxCoords = null;

  for (const route of ROUTES) {
    log(`→ ${route.name}`);
    const collection = { type: "FeatureCollection", features: [] };

    for (const variant of variants) {
      const constraints = variant.constraints();
      let r = await getJson(geopfUrl(variant.resource, variant.profile, route.pts, constraints, attrsOf(variant.resource)));
      let attributesDropped = false;
      if (r.status !== 200 && attrsOf(variant.resource).length) {
        // certains attributs peuvent être refusés : on réessaie sans waysAttributes
        await sleep(400);
        r = await getJson(geopfUrl(variant.resource, variant.profile, route.pts, constraints, []));
        attributesDropped = true;
      }
      const ok = r.status === 200 && r.body && r.body.geometry;
      const agg = ok ? aggregateGeopf(r.body) : {};
      const suspect = suspectMeters(agg);
      results.push({
        route: route.id, variant: variant.id, status: r.status, ms: r.ms,
        distanceKm: ok ? Math.round(Number(r.body.distance) / 100) / 10 : null,
        durationMin: ok ? Math.round(Number(r.body.duration) / 60) : null,
        constraints, attributesDropped,
        suspectM: Math.round(suspect.total), suspectHits: suspect.hits,
        attributes: summarizeAgg(agg),
        error: ok ? "" : r.text.slice(0, 300),
        url: r.url,
      });
      log(`   ${variant.id.padEnd(18)} HTTP ${r.status} ${String(r.ms).padStart(5)} ms ${ok ? `${(r.body.distance / 1000).toFixed(1)} km` : r.text.slice(0, 120)}`);
      if (ok) {
        const feature = { type: "Feature", properties: { route: route.id, variant: variant.id }, geometry: r.body.geometry };
        collection.features.push(feature);
        await writeFile(join(OUT, "geojson", `${route.id}__${variant.id}.geojson`), JSON.stringify({ type: "FeatureCollection", features: [feature] }));
        if (route.id === "08-ventoux" && !ventouxCoords) {
          ventouxCoords = r.body.geometry.coordinates;
        }
      }
      await sleep(400);
    }

    if (!args.includes("--no-brouter")) {
      const url = `${BROUTER}?lonlats=${route.pts.map((p) => `${p[0]},${p[1]}`).join("|")}&profile=fastbike&alternativeidx=0&format=geojson`;
      const r = await getJson(url);
      const feature = r.body && r.body.features && r.body.features[0];
      const agg = feature ? aggregateBrouter(feature) : {};
      const suspect = suspectMeters(agg);
      results.push({
        route: route.id, variant: "brouter-fastbike", status: r.status, ms: r.ms,
        distanceKm: feature ? Math.round(Number(feature.properties["track-length"]) / 100) / 10 : null,
        durationMin: feature ? Math.round(Number(feature.properties["total-time"]) / 60) : null,
        dplus: feature ? Number(feature.properties["filtered ascend"]) : null,
        constraints: [], suspectM: Math.round(suspect.total), suspectHits: suspect.hits,
        attributes: summarizeAgg(agg), error: feature ? "" : r.text.slice(0, 300), url,
      });
      log(`   ${"brouter-fastbike".padEnd(18)} HTTP ${r.status} ${String(r.ms).padStart(5)} ms`);
      if (feature) {
        const f = { type: "Feature", properties: { route: route.id, variant: "brouter-fastbike" }, geometry: feature.geometry };
        f.geometry.coordinates = f.geometry.coordinates.map((c) => c.slice(0, 2));
        if (route.id === "08-ventoux" && !ventouxCoords) {
          ventouxCoords = f.geometry.coordinates;
        }
        collection.features.push(f);
        await writeFile(join(OUT, "geojson", `${route.id}__brouter-fastbike.geojson`), JSON.stringify({ type: "FeatureCollection", features: [f] }));
      }
      await sleep(1000);
    }
    await writeFile(join(OUT, "geojson", `${route.id}__toutes-variantes.geojson`), JSON.stringify(collection));
  }

  log("→ test altimétrie (Ventoux)");
  const elevation = ventouxCoords ? await testElevation(ventouxCoords) : [];

  await writeFile(join(OUT, "results.json"), JSON.stringify({ date: new Date().toISOString(), caps, diagnostic, results, elevation }, null, 2));

  // Rapport markdown
  const lines = [];
  lines.push("# S0 — Résultats du spike routage vélo", "", `Date : ${new Date().toISOString()}`, `Node : ${process.version}`, "");
  lines.push("## Capacités (extrait)", "", "```json", JSON.stringify(caps, null, 2).slice(0, 20000), "```", "");
  lines.push("## Diagnostic des requêtes (parcours 01)", "", "| Ressource | Étape | HTTP | ms | Réponse | URL |", "|---|---|---|---|---|---|");
  diagnostic.forEach((d) => lines.push(`| ${d.resource} | ${d.step} | ${d.status} | ${d.ms} | ${d.text.replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 150)} | \`${d.url}\` |`));
  lines.push("");
  lines.push("## Contraintes envoyées", "");
  variants.forEach((v) => lines.push(`- **${v.id}** : \`${v.constraints().join(" | ") || "aucune"}\``));
  lines.push("", "## Résultats par parcours", "");
  lines.push("| Parcours | Variante | HTTP | ms | km | min | m suspects | Erreur |", "|---|---|---|---|---|---|---|---|");
  results.forEach((r) => {
    lines.push(`| ${r.route} | ${r.variant} | ${r.status} | ${r.ms} | ${r.distanceKm ?? ""} | ${r.durationMin ?? ""} | ${r.suspectM || ""} | ${(r.error || "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 120)} |`);
  });
  lines.push("", "## Attributs des voies (répartition par distance)", "");
  results.filter((r) => r.attributes).forEach((r) => {
    lines.push(`- **${r.route} / ${r.variant}**${r.attributesDropped ? " (waysAttributes refusés)" : ""} : ${r.attributes}`);
    if (r.suspectHits && r.suspectHits.length) {
      lines.push(`  - ⚠ ${r.suspectHits.join(", ")}`);
    }
  });
  lines.push("", "## Altimétrie (elevationLine sur le tracé du Ventoux)", "");
  lines.push("| sampling | pts en entrée | HTTP | ms | pts renvoyés | D+ brut | Erreur |", "|---|---|---|---|---|---|---|");
  elevation.forEach((e) => lines.push(`| ${e.sampling} | ${e.inputPoints} | ${e.status} | ${e.ms} | ${e.returned} | ${e.dplusNaive} | ${e.error.replace(/\|/g, "/")} |`));
  lines.push("", "## Observations visuelles (à compléter à la main)", "",
    "Ouvrir `out/geojson/*__toutes-variantes.geojson` dans https://geojson.io et noter pour chaque parcours la variante la plus « vélo de route » :", "",
    "| Parcours | Meilleure variante | Remarques (autoroute, chemin, détour, sens interdit…) |", "|---|---|---|",
    ...ROUTES.map((r) => `| ${r.id} | | |`), "");
  await writeFile(join(OUT, "S0-resultats.md"), lines.join("\n"));
  log(`\nTerminé. Rapport : ${join(OUT, "S0-resultats.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
