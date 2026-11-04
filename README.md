# Forest Fire Intelligence

Tableau de bord responsive de surveillance et d’exploration des détections thermiques NASA FIRMS (MODIS et VIIRS). L’application sépare les observations réelles servies par une API configurable et un jeu synthétique de démonstration, toujours signalé comme tel.

## Démarrage

Prérequis : Node.js 20+ et npm.

```sh
npm install
npm run dev
```

Vite affiche l’adresse locale (habituellement `http://localhost:5173`). Générer le site statique avec `npm run build`, puis le prévisualiser avec `npm run preview`.

## Architecture

- `src/main.js` : interface, carte Leaflet/OSM, filtres, visualisations Chart.js et cycle de chargement API.
- `src/data.js` : normalisation des détections, parseur CSV et export CSV.
- `data/demo/fires_demo.csv` : 50 observations entièrement fictives en Afrique centrale, intégrées au bundle Vite pour fonctionner en démo sans endpoint de données.
- `src/style.css` : thème scientifique sombre, thème clair et mise en page responsive.
- `index.html` : point d’entrée Vite.

## Fonctionnalités

- Carte OSM navigable avec détections MODIS/VIIRS, popup de coordonnées, date, confiance et FRP quand disponibles.
- Filtrage par dates, capteur et confiance, zone d’intérêt tracée au rectangle et zoom automatique natif.
- Calendrier d’activité quotidienne sélectionnable et comparaison temporelle par capteur.
- Indicateurs, tableau des observations récentes et export CSV des données filtrées (latitude, longitude, date, heure UTC, capteur, confiance, FRP et zone).
- États de chargement, erreurs API explicites et états vides. Le CSV de démo alimente la carte, les indicateurs, le calendrier, le graphique et le tableau; l’export filtré conserve aussi la provenance `FICTIONAL_SYNTHETIC_DEMO_NOT_NASA`. Les détections thermiques sont indicatives et ne confirment pas un feu au sol.

## Données de démonstration

Le fichier `data/demo/fires_demo.csv` contient 50 lignes synthétiques pour des zones du Cameroun, Gabon, Congo, République centrafricaine, RDC, Guinée équatoriale et Tchad. Les champs FIRMS (`latitude`, `longitude`, `acq_date`, `acq_time`, `satellite`, `confidence`, `frp`, `daynight`) gardent des noms adaptés au transfert vers les données nettoyées du rôle 1. `source` vaut systématiquement `FICTIONAL_SYNTHETIC_DEMO_NOT_NASA`; la colonne additionnelle `zone` fournit un libellé de regroupement pour l’interface. Les lignes ne sont pas des observations NASA.

En mode démo, Vite importe ce CSV comme texte et le parse dans le frontend. Pour intégrer les données nettoyées, le responsable du rôle 1 peut remplacer le fichier en conservant les en-têtes requis, ou configurer le mode API ci-dessous; le chemin API réel reste indépendant du CSV.

## API et configuration

Copier `.env.example` vers `.env.local` et adapter :

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:8000
```

Redémarrer Vite après toute modification de configuration. En mode réel, l’application appelle `GET /fires`, `GET /calendar`, `GET /statistics` et `GET /anomalies`, en transmettant les filtres `date_from`, `date_to`, `sensor`, `zone`, `confidence_min` et les limites de coordonnées `bbox`, `min_lon`, `min_lat`, `max_lon`, `max_lat` lorsqu’elles sont définies. Le serveur API doit autoriser le CORS pour l’origine du frontend.

Contrat d’adaptation côté frontend :

- `/fires` : tableau JSON ou objet `{ "fires": [...] }` (également `{ "results": [...] }` ou `{ "data": [...] }`). Une détection comporte `latitude`/`lat`, `longitude`/`lon`/`lng`, une date (`date`, `datetime`, `acq_datetime` ou paire `acq_date` + `acq_time`) et des champs optionnels `sensor`/`instrument`/`satellite`, `confidence`, `frp` et `zone`/`region`/`country`.
- `/calendar` : `{ "days": [{ "date": "YYYY-MM-DD", "count": 12 }] }` (aliases `calendar`, `data`; `day`, `detections`, `fires` acceptés).
- `/statistics` : objet optionnel `{ "timeseries": [{ "date": "YYYY-MM-DD", "viirs": 8, "modis": 3 }] }`. En l’absence de série normalisée, le graphique est agrégé à partir des détections API filtrées. Les statistiques visibles sont également calculées depuis les observations réelles disponibles.
- `/anomalies` : objet optionnel `{ "anomalies": [...] }` (aliases `results`, `data`). Leur nombre est présenté comme signalé par le backend; aucune anomalie n’est fabriquée par le frontend.

L’API backend n’étant pas présente dans ce dépôt initial, ces routes constituent le contrat d’intégration frontend et ne sont pas implémentées ici. Si l’API n’est pas configurée, le mode démo local présente des points entièrement synthétiques et un bandeau visible. Le mode API ne bascule jamais silencieusement vers ces points en cas de panne.

## Données cartographiques

Le fond de carte utilise les tuiles standard OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) avec l’attribution « © OpenStreetMap contributors ». La carte est initialement centrée sur l’Afrique centrale (4.5, 15.5). Si toutes les tuiles OSM visibles échouent, CARTO (fond basé sur OpenStreetMap) prend le relais avec un message explicite; le bouton permet de retenter OSM. Si les deux fonds échouent, un message de connexion et un bouton de réessai s’affichent. Respecter la politique d’utilisation du serveur de tuiles OpenStreetMap.

Le scénario de démo par défaut affiche l’Afrique centrale; le secteur du **Dixie Fire** (nord de la Californie, 2021) reste disponible dans le sélecteur, à partir des repères géographiques documentés par [NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/extensive-plumes-from-the-dixie-fire-148626/) et le [National Park Service](https://home.nps.gov/lavo/learn/nature/dixie-fire-qa.htm). Seuls le contexte géographique et les noms de localités s’inspirent de l’événement : les points de détection, dates, confiance et FRP sont générés et signalés comme simulation. Le scénario Afrique centrale reste disponible dans le sélecteur. Aucune donnée simulée ne doit servir à l’analyse d’un événement réel.
