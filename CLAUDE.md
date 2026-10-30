# Photobook — Spécifications du projet (backend + frontend)

Application web de création d'albums photo / catalogues de souvenirs.
L'utilisateur envoie ses photos, le système les place automatiquement dans des gabarits
professionnels, l'utilisateur ajuste, puis exporte un PDF fidèle et imprimable.
Les albums sont sauvegardés (historique des versions) et peuvent être imprimés par nous-mêmes.

> Le projet n'est pas encore initialisé. Les commandes sont des commandes cibles :
> les ajuster dès que le squelette existe.

---

# PARTIE 1 — GÉNÉRAL

## Objectifs

- Résultat visuel professionnel, sans IA obligatoire (règles + gabarits dessinés).
- Interface simple : une décision par écran, pas de chargement visuel.
- Ce que l'on voit à l'écran est exactement ce qui s'imprime (même rendu HTML/CSS).
- Cible : 100 à 1000 utilisateurs sur un seul VPS.

## Périmètre MVP

Inclus :
- Compte utilisateur, historique des albums, versions restaurables.
- Upload de photos (miniatures, EXIF, alerte de qualité).
- 4 formats, 2 thèmes, 14 gabarits.
- Placement automatique + édition (changer de gabarit, échanger/remplacer/recadrer une photo, texte).
- Aperçu feuilletable, export PDF avec fond perdu.

Hors MVP (ne pas implémenter sans demande explicite) :
- Autocollants, dessins, filtres photo, mise en page libre au pixel, calques.
- Collaboration à plusieurs, tri/recadrage par IA, CMJN/PDF-X, paiement, commandes.

## Architecture

```
photobook/
├── backend/            Django + DRF + Celery
├── frontend/           Next.js + TypeScript + Tailwind
├── shared/
│   └── layouts/        Gabarits, thèmes et formats en JSON : SOURCE UNIQUE
├── docker-compose.yml
└── .env.example
```

Services Docker : `web`, `worker`, `pdf-worker` (Chromium), `postgres`, `redis`, `storage` (RustFS, dev uniquement), `caddy`, `frontend`.

## Principes non négociables

1. **Le JSON d'album est la source de vérité.** Toute modification passe par lui.
   Le front l'affiche, le backend le stocke (JSONB) et le rend en PDF.
2. **Un seul rendu.** Le composant/CSS de rendu de page est utilisé par l'éditeur ET par le worker PDF.
   Ne jamais écrire deux implémentations de mise en page.
3. **Gabarits en pourcentages de la page**, jamais en pixels ou millimètres fixes,
   pour fonctionner sur tous les formats.
4. **Les originaux sont conservés**, l'éditeur travaille sur des miniatures,
   le PDF final utilise les originaux.
5. **Upload direct vers le stockage** via URL présignée : les photos ne passent jamais par Django.
6. **Le PDF est généré en tâche de fond** (Celery), jamais dans une requête HTTP.
7. **L'utilisateur ne voit jamais de terme technique** (bleed, dpi, EXIF, CMJN).
   Ces notions sont gérées par le système.

## Spécifications d'impression

| Format | Page finale | Avec fond perdu (3 mm) |
|---|---|---|
| `A4_portrait` | 210 × 297 mm | 216 × 303 mm |
| `A5_portrait` | 148 × 210 mm | 154 × 216 mm |
| `square_21` | 210 × 210 mm | 216 × 216 mm |
| `A4_landscape` | 297 × 210 mm | 303 × 216 mm |

- Fond perdu : 3 mm de chaque côté. Une double page fait 2 × largeur + 6 mm de large.
- Marge de sécurité : 8 mm minimum du bord de coupe pour tout texte ou élément important.
- Zone de reliure : 10 mm de part et d'autre du centre d'une double page, pas de texte.
- Résolution cible : 300 dpi. Seuils d'alerte par photo selon sa taille d'impression :
  vert ≥ 250 dpi, orange 150–249 dpi (« peut être légèrement floue »), rouge < 150 dpi.
- Espace colorimétrique : sRVB. Le CMJN / PDF-X est une évolution ultérieure.
- Polices : Google Fonts **auto-hébergées** et intégrées au PDF. Jamais de CDN dans le rendu PDF.

## Thèmes (MVP)

- `galerie_claire` : fond blanc cassé, texte sombre, un seul bloc d'accent. Titre vertical et fine ligne.
- `bloc_couleur` : bandeaux de couleur forte, grands titres, texte clair sur fond sombre.

Chaque thème expose une couleur d'accent modifiable et trois options :
`verticalTitle`, `line`, `captions` (booléens).

## Gabarits (MVP, 14)

Pages simples : couverture sur bloc de couleur, plein cadre, photo cadrée centrée,
photo + légende, photo paysage + légende décalée, photo sur bloc de couleur décalé,
photo + bandeau de couleur, 2 photos côte à côte, 2 photos empilées,
page de texte, page de titre de chapitre.

Doubles pages : double page pleine, double page cadrée, mosaïque 3–4 photos.

Après le MVP : grille de 4 à 6 photos, collage de 3 photos (souvenirs de vacances).

Briques d'un gabarit : cadre photo, bloc de texte (titre, légende, paragraphe), bloc de couleur
(bandeau, rectangle décalé), titre vertical et fine ligne, micro-textes (numéro de page, titre courant).

Format d'un gabarit (`shared/layouts/*.json`), positions en % de la page :

```json
{
  "id": "photo_caption",
  "photos": 1,
  "accepts": ["portrait", "landscape"],
  "slots": {
    "photo1":  { "x": 12, "y": 8,  "w": 76, "h": 62 },
    "title":   { "x": 12, "y": 74, "w": 76, "h": 6 },
    "caption": { "x": 12, "y": 80, "w": 76, "h": 10 }
  }
}
```

Les textes sont toujours **optionnels** : un champ vide ne laisse aucun trou.
Les gabarits sont dessinés par nous, inspirés des templates du marché mais jamais copiés (licences).

## Format du JSON d'album

```json
{
  "schemaVersion": 1,
  "format": "A4_portrait",
  "theme": "galerie_claire",
  "accent": "#3b3b3b",
  "options": { "verticalTitle": true, "line": true, "captions": true },
  "pages": [
    {
      "id": "p1",
      "layout": "cover_block",
      "slots": [
        { "slot": "photo1", "photoId": 12, "focus": [0.5, 0.3] },
        { "slot": "title", "text": "Bénin 2026" }
      ]
    },
    { "id": "p2", "spread": true, "layout": "spread_full",
      "slots": [{ "slot": "photo1", "photoId": 14 }] }
  ]
}
```

`focus` est le point de focalisation du recadrage (0–1), utilisé avec `object-fit: cover`.
Toute évolution du schéma est versionnée (`schemaVersion`) et migrable.

## Parcours utilisateur

1. Assistant en 4 étapes : format → photos → thème → éditeur.
2. Le livre arrive déjà rempli (jamais de page blanche).
3. L'éditeur propose, l'utilisateur ajuste. Mode simple par défaut,
   mode « Personnaliser » (couleur libre, police, marges) caché derrière un bouton.
4. Sauvegarde automatique = nouvelle `AlbumVersion`.
5. Export : « génération en cours » puis téléchargement du PDF.

## Conventions

- Langue de l'interface : français (i18n prévu, clés de traduction dès le départ).
- Langue du code, des commits et des identifiants : anglais.
- Commits : Conventional Commits (`feat:`, `fix:`, `chore:`...).
- Branches : `main` protégée, travail en `feat/...`, `fix/...`.
- Aucun secret dans le dépôt : tout passe par `.env` (modèle dans `.env.example`).
- Chaque fonctionnalité livre ses tests. Pas de PR sans lint ni tests verts.

## Ordre de construction

1. Docker, Django, modèles, auth, upload présigné, miniatures.
2. `shared/layouts` (5 gabarits), composant `page-render`, premier export PDF avec fond perdu.
   **Valider le rendu imprimé avant d'aller plus loin.**
3. Autoplacement, assistant en 4 étapes, éditeur de base.
4. Annuler/rétablir, versions, 14 gabarits, aperçu, alertes de qualité.
5. Ensuite : commandes, paiement, CMJN, IA optionnelle.

## Avant de coder

- Ne pas ajouter de fonctionnalité hors MVP ni de dépendance lourde sans en discuter.
- En cas de doute entre simple et complet, choisir simple.

---

# PARTIE 2 — BACKEND (Django / DRF / Celery)

## Stack

- Python 3.12, Django 5, Django REST Framework
- PostgreSQL 16 (JSONB), Redis 7
- Celery (files `images`, `pdf`, `maintenance`)
- pyvips (traitement d'images), exifread ou Pillow (EXIF)
- django-storages + boto3 (stockage compatible S3 : Cloudflare R2 / Backblaze B2 / RustFS en local)
- Playwright (Chromium) dans le worker PDF, pikepdf pour assembler/ajuster
- Auth : django-allauth (email, Google) + djangorestframework-simplejwt
- Tests : pytest, pytest-django, factory-boy. Lint : ruff + black. Types : mypy (progressif).
- Erreurs : Sentry

## Structure

```
backend/
├── config/                  settings (base, dev, prod), urls, celery.py
├── apps/
│   ├── accounts/            User, auth, quotas
│   ├── albums/              Album, AlbumVersion
│   ├── photos/              Photo, presign, confirm, traitement
│   ├── layouts/             chargement de shared/layouts (formats, thèmes, gabarits)
│   ├── exports/             ExportJob, génération PDF
│   └── orders/              commandes d'impression (phase 2, ne pas implémenter)
├── services/
│   ├── autolayout.py        placement automatique
│   ├── imaging.py           miniatures, couleurs dominantes, qualité
│   ├── pdf_renderer.py      HTML → PDF avec Playwright
│   └── storage.py           URLs présignées
├── render/templates/        page HTML d'impression
├── Dockerfile
└── Dockerfile.pdf           image avec Chromium
```

Règle : la logique métier vit dans `services/`, pas dans les vues ni les serializers.
Les vues valident, appellent un service, renvoient une réponse.

## Modèles

| Modèle | Champs principaux |
|---|---|
| `User` | email (unique), quota_photos, plan, created_at |
| `Photo` | owner, original_key, thumb_key, preview_key, width, height, orientation, taken_at, gps (nullable), dominant_colors (JSON), quality (`ok`/`low`/`bad`), status (`pending`/`ready`/`failed`) |
| `Album` | owner, title, format, theme, accent_color, status, current_version (FK), created_at, updated_at |
| `AlbumVersion` | album, number (incrémental), content (JSONB), schema_version, created_at |
| `ExportJob` | album_version, status (`queued`/`running`/`done`/`failed`), pdf_key, error, created_at, finished_at |

Contraintes :
- `AlbumVersion` est **immuable** : chaque sauvegarde crée une ligne, on ne modifie jamais.
- Index sur `(album, number)` unique, `(owner, created_at)` sur Album, `(owner)` sur Photo.
- Suppression d'un album : suppression logique (`deleted_at`), purge différée des fichiers.
- Conserver au maximum 50 versions par album (les plus anciennes sont élaguées, la dernière est toujours gardée).

## API REST (préfixe `/api/`)

```
POST   auth/register | login | refresh

POST   photos/presign          → { upload_url, photo_id }
POST   photos/confirm          → lance process_photo
GET    photos?album=ID

POST   albums                  → crée l'album et lance l'autolayout
GET    albums                  → liste paginée (historique)
GET    albums/{id}             → dernière version
PUT    albums/{id}             → sauvegarde = nouvelle AlbumVersion
GET    albums/{id}/versions
POST   albums/{id}/versions/{n}/restore
POST   albums/{id}/autolayout  → régénère la disposition

POST   albums/{id}/export      → crée un ExportJob (202)
GET    exports/{id}            → statut + URL de téléchargement signée

GET    catalog                 → formats, thèmes, gabarits (depuis shared/layouts)
```

- Réponses JSON, erreurs au format `{ "code": "...", "detail": "...", "fields": {...} }`.
- Pagination par curseur sur les listes. Throttling DRF sur auth et export.
- Le `PUT albums/{id}` valide le JSON contre le schéma (formats, gabarits, photoId appartenant à l'utilisateur).
- Un utilisateur n'accède qu'à ses propres albums/photos (permission par queryset, testée).

## Upload de photos

1. `presign` : vérifie quota, type MIME (`image/jpeg`, `image/png`, `image/webp`, `image/heic`) et taille max (30 Mo),
   crée la `Photo` en `pending`, renvoie une URL présignée PUT.
2. Le client envoie directement au stockage.
3. `confirm` : vérifie l'existence de l'objet, lance `process_photo` (file `images`).
4. `process_photo` : lire EXIF (orientation, date, GPS), appliquer l'orientation, générer
   `thumb` (400 px) et `preview` (1600 px) en JPEG sRVB qualité 85, calculer 3 couleurs dominantes,
   calculer `quality`, passer `status` à `ready`.
5. L'original n'est jamais modifié ni recompressé. Convertir HEIC en JPEG uniquement pour les dérivés.

Calcul de `quality` : DPI effectif = pixels du côté long / taille d'impression du plus grand usage (pleine page ou double).
Seuils : voir « Spécifications d'impression ».

## Autoplacement (`services/autolayout.py`)

Entrée : photos triées (par `taken_at`, puis nom), format, thème. Sortie : liste de pages (JSON d'album).
Règles déterministes, sans IA :
- Couverture : meilleure photo (plus grande, qualité ok, portrait de préférence).
- Choisir le gabarit selon le nombre et l'orientation des photos restantes :
  1 portrait → cadrée ou légende ; 1 paysage → paysage + légende ou double page ;
  2 portraits → côte à côte ; 2 paysages → empilées ; 3–4 photos → mosaïque.
- Alterner pages « fortes » (plein cadre, double page) et pages calmes ; jamais deux pleins cadres de suite.
- Une photo de qualité `bad` n'est jamais en plein cadre ni en double page.
- Variété contrôlée : graine pseudo-aléatoire stockée dans l'album pour des résultats reproductibles.
- Le nombre de pages est pair (couverture et dernière page comprises) ; ajouter une page de fin si besoin.
- Ne jamais lever d'exception sur un cas limite : toujours retourner une mise en page valide.

## Export PDF (`services/pdf_renderer.py`)

- Exécuté dans le worker `pdf-worker` (file `pdf`), concurrence 1 par conteneur.
- Génère une page HTML par page/double page à partir de la **même** définition de gabarit que le front,
  avec `@page { size: <largeur+6mm> <hauteur+6mm>; margin: 0 }` et fond perdu inclus.
- Les images utilisées sont les **originaux** (ou une version redimensionnée à 300 dpi pour limiter le poids).
- Attendre `document.fonts.ready` et le chargement de toutes les images avant `page.pdf()`.
- `print_background: true`, `prefer_css_page_size: true`.
- Stocker le PDF, mettre à jour `ExportJob`, supprimer les PDF de plus de 30 jours (`cleanup_exports`).
- Timeout 5 minutes, 2 tentatives maximum, erreur lisible enregistrée dans `ExportJob.error`.
- Même `AlbumVersion` + mêmes réglages = même PDF (rendu déterministe).
- CMJN / PDF-X (Ghostscript + profil ICC) : hors MVP.

## Quotas et limites (valeurs par défaut, configurables)

- 30 Mo par photo, 300 photos par album, 5 Go de stockage par utilisateur (plan gratuit).
- 3 exports simultanés par utilisateur, 20 exports par jour.

## Sécurité

- Valider le contenu réel des fichiers (magic bytes via pyvips), pas seulement l'extension.
- URLs de téléchargement signées et à durée courte (15 min). Buckets privés.
- CORS restreint au domaine du front. CSRF actif si sessions cookies. HTTPS uniquement en prod.
- Aucune donnée personnelle (GPS) exposée dans les réponses publiques ; supprimer le GPS des dérivés.
- Rendu PDF : le HTML d'impression ne charge que des ressources locales ou signées (pas d'URL arbitraire),
  textes utilisateur échappés.

## Tests backend

- Chaque service a des tests unitaires (autolayout : cas limites 0, 1, 2, 7 photos ; mélange portrait/paysage).
- Tests d'API : permissions (accès à l'album d'un autre = 404), quotas, versions.
- Test d'intégration du PDF : un album d'exemple produit un PDF dont le nombre de pages et les dimensions
  (taille + fond perdu) sont corrects.
- Fixtures d'images minuscules dans `tests/fixtures/`. Aucun appel réseau réel (stockage mocké / RustFS).

## Commandes backend

```bash
docker compose up -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
docker compose exec web pytest -q
docker compose exec web ruff check . && docker compose exec web black --check .
docker compose logs -f worker pdf-worker
```

## Définition de « terminé » (backend)

Migration créée et appliquée, tests verts, lint propre, endpoint documenté (drf-spectacular),
permissions testées, aucune requête N+1 sur les listes (`select_related`/`prefetch_related`).

---

# PARTIE 3 — FRONTEND (Next.js / TypeScript / Tailwind)

## Stack

- Next.js (App Router) + React + TypeScript strict
- Tailwind CSS (+ variables CSS pour les thèmes)
- Zustand (état de l'éditeur), TanStack Query (appels API)
- dnd-kit (glisser-déposer), react-easy-crop ou équivalent (recadrage / point de focalisation)
- Upload : fetch vers URL présignée avec progression (XHR) ou Uppy
- Zod (validation du JSON d'album et des réponses API)
- Tests : Vitest + Testing Library, Playwright pour quelques parcours de bout en bout
- Lint : ESLint + Prettier

## Structure

```
frontend/
├── app/
│   ├── (marketing)/page.tsx
│   ├── (auth)/login | register
│   ├── dashboard/page.tsx            liste des albums (historique)
│   └── albums/
│       ├── new/page.tsx              assistant en 4 étapes
│       └── [id]/
│           ├── edit/page.tsx         éditeur
│           ├── preview/page.tsx      aperçu feuilletable
│           └── export/page.tsx       téléchargement PDF
├── components/
│   ├── wizard/                       FormatPicker, PhotoUploader, ThemePicker
│   ├── editor/
│   │   ├── PageStrip.tsx             miniatures des pages
│   │   ├── Canvas.tsx                page ou double page en cours
│   │   ├── LayoutPanel.tsx           icônes de dispositions
│   │   ├── PhotoTray.tsx             photos non utilisées
│   │   ├── SlotPhoto.tsx             cadre photo (glisser, recadrer)
│   │   ├── SlotText.tsx              texte éditable
│   │   └── Toolbar.tsx               annuler, rétablir, aperçu, exporter
│   ├── page-render/                  rendu d'UNE page à partir du JSON + gabarit
│   └── ui/                           boutons, modales, toasts
├── lib/
│   ├── api.ts                        client API + hooks TanStack Query
│   ├── upload.ts                     upload présigné + progression
│   ├── layouts.ts                    lecture de ../shared/layouts
│   └── autosave.ts                   sauvegarde automatique avec délai
├── store/editorStore.ts              album, page active, historique annuler/rétablir
├── styles/
│   ├── print.css                     fond perdu, @page, tailles
│   └── themes.css                    variables CSS des thèmes
└── types/                            types TypeScript + schémas Zod du JSON d'album
```

## Règle centrale : `page-render`

`components/page-render/` prend `(page JSON, gabarit, thème, format)` et produit le HTML/CSS d'une page.
- Il est utilisé par l'éditeur, l'aperçu **et** par le worker PDF du backend (même CSS compilé).
- Il ne dépend ni de Zustand ni de TanStack Query : composant pur, testable seul.
- Positions des cadres en `%` de la page (jamais en px). Taille de police en unités relatives à la page
  (`cqw` / container queries) pour que le rendu reste identique à toute échelle.
- Photos : `object-fit: cover` + `object-position` calculé depuis `focus`.
- Mode `print` : ajoute le fond perdu de 3 mm. Mode `screen` : affiche en plus les repères de marge de sécurité,
  désactivables.
- Un texte vide ne rend rien et ne réserve pas d'espace.

## État de l'éditeur (Zustand)

- Contient le JSON d'album, la page active, la sélection, l'historique (pile annuler/rétablir, 100 actions).
- Les actions modifient le JSON de façon immuable : `setLayout`, `swapPhotos`, `replacePhoto`,
  `setFocus`, `setText`, `addPage`, `removePage`, `movePage`, `setTheme`, `setAccent`, `setOption`.
- Toute action est annulable. Aucune modification directe du JSON hors du store.
- `autosave.ts` envoie `PUT /api/albums/{id}` après 2 s d'inactivité (anti-rebond) et à la fermeture de l'onglet ;
  affiche l'état « Enregistré / Enregistrement… / Erreur, nouvelle tentative ».
- Gérer les conflits : si le serveur renvoie une version plus récente, proposer de recharger plutôt qu'écraser.

## Écrans

**Assistant (`/albums/new`)** : une décision par écran.
1. Format : 4 cartes visuelles avec silhouette, le carré présélectionné. Aucun terme technique.
2. Photos : zone de glisser-déposer, progression par photo, pastille orange/rouge sur les photos trop petites
   (« trop petite pour une pleine page »), tri par date modifiable.
3. Thème : cartes de thèmes avec aperçu réel de pages ; option « couleur dominante de mes photos » ;
   un seul sélecteur de couleur d'accent ; réglages avancés dans « Personnaliser ».
4. Validation : crée l'album (`POST /api/albums`) puis ouvre l'éditeur sur un livre déjà rempli.

**Éditeur (`/albums/[id]/edit`)**
- Gauche : bande de pages en double pages. Centre : canvas. Droite (bas sur mobile) : 6 à 8 icônes de dispositions
  qui s'adaptent au nombre de photos de la page. Cliquer une icône change la page instantanément.
- Clic sur une photo : mini-menu Recadrer / Remplacer / Supprimer. Double-clic sur un texte : édition directe.
  Glisser une photo sur un autre cadre : échange. Annuler / Rétablir toujours visibles.
- Raccourcis : Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, flèches pour changer de page, Suppr pour retirer la photo sélectionnée.

**Aperçu** : livre feuilletable, double pages, plein écran.

**Export** : bouton « Générer le PDF », état « en cours » (interrogation du statut toutes les 2 s, arrêt à `done`/`failed`),
puis bouton de téléchargement. Message d'erreur lisible avec « Réessayer ».

## Règles d'interface

- Mode simple par défaut. Les réglages avancés vivent derrière « Personnaliser ». Jamais plus de 8 icônes visibles dans le panneau de dispositions.
- Aucun jargon : pas de « bleed », « dpi », « EXIF », « CMJN » dans l'interface.
- Textes d'exemple (« Titre de la photo ») en placeholder, jamais enregistrés comme contenu.
- États toujours gérés : chargement (squelettes), vide, erreur, succès. Pas d'écran blanc.
- Optimiste : les modifications du store s'affichent immédiatement, la sauvegarde est asynchrone.
- Accessibilité : navigation clavier, focus visible, contrastes AA, `alt` sur les images, libellés sur les icônes.
- Responsive : l'assistant et l'aperçu fonctionnent sur mobile ; l'éditeur complet vise tablette et ordinateur
  (sur mobile : édition réduite, panneau de dispositions en bas).
- Thème de l'application : clair uniquement dans le MVP. Les thèmes d'album sont indépendants de l'interface.

## Performances

- L'éditeur n'affiche que les miniatures (`thumb`, `preview`), jamais les originaux.
- `next/image` pour les images de l'interface ; `loading="lazy"` et `decoding="async"` pour les miniatures.
- Virtualiser la bande de pages au-delà de 40 pages.
- Mémoïser `page-render` par `(page, thème, format)` ; ne re-rendre que la page modifiée.
- Upload : 3 envois en parallèle maximum, reprise en cas d'échec réseau.

## Types et validation

- Les types du JSON d'album viennent d'un schéma Zod unique (`types/album.ts`) ; les types TypeScript en sont dérivés.
- Valider avec Zod toute réponse API sur les albums et le catalogue. Rejeter plutôt que deviner.
- Gérer `schemaVersion` : migrer les anciens albums à l'ouverture.

## Tests frontend

- `page-render` : tests visuels/instantanés par gabarit × thème × format (au moins A4 portrait et carré).
- Store : tests unitaires de chaque action et de l'annulation/rétablissement.
- Playwright : parcours « nouvel album → upload → édition → export » avec backend mocké.

## Variables d'environnement

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Commandes frontend

```bash
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## Définition de « terminé » (frontend)

Types stricts sans `any`, lint et tests verts, états de chargement/erreur gérés,
rendu vérifié en mode `print` pour tout changement dans `page-render` ou les gabarits,
aucun texte technique visible par l'utilisateur.
