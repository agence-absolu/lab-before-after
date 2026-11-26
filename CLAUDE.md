# before-after

Une démo de plus dans l’univers du Lab Absolu.

Démo du lab Absolu (https://lab.agence-absolu.com/before-after/), générée avec
`@absolu/create-lab-project`. Projet Vite autonome :
`npm run dev` pour développer, le push sur `main` publie (voir README).

Le slug est le nom npm : `vite.config.js` et le workflow s'en servent, ne pas
le nommer ailleurs.

## Le projet

Proposition pour les **40 ans du Guérandais** (2028) : une page d'accueil dont
le bandeau bascule entre « avant » (1988) et « après » (2028). Brief : doc
« Brief 40 ans » sur le Drive partagé de l'agence.

Deux sources d'inspiration, à garder en tête pour toute évolution :

- **la mécanique** vient de l'entête d'accueil de lesarcs.com
  (`ParagraphHomepageHeader`) : parallaxe au scroll (image +60px, texte
  −140px sur la hauteur du bandeau) et toggle de saison. Chez les Arcs le
  toggle recharge en AJAX ; ici l'image « après » se révèle en cercle depuis
  le bouton cliqué (`clip-path`) et l'année défile ;
- **l'habillage** vient du site Le Guérandais, dont les sources Drupal sont
  dans `~/Sites/le-guerandais` (thème `web/themes/custom/leguerandais`).
  Le header est une reprise fidèle : `_header.scss` est une copie de
  `layout/_header.scss` (seuls les imports changent), le balisage suit
  `templates/layout/partials/header.html.twig`. Le corriger en repartant du
  thème plutôt qu'en le réinventant.

Ici, tout est **statique** : pas de route Drupal. La température du header
passe par Open-Meteo au lieu de `/ajax/html/guerandais_temperature`.

### Fichiers

- `index.html` : header (Header + SubHeader) et bandeau `BeforeAfterHeader` ;
  chaque état est décrit par les `data-*` de son bouton (année, légende) ;
- `src/scripts/BeforeAfterHeader.js` : bascule, compteur d'année, parallaxe ;
- `src/scripts/Header.js` : burger, SubHeader au scroll, température ;
- `src/scripts/CoffretReveal.js` + `_coffret-reveal.scss` / `_cuboid.scss` :
  seconde animation, sous le bandeau — coffret en CSS 3D dont le couvercle se
  soulève au scroll (GSAP ScrollTrigger, section épinglée) ; quatre pots de
  sel 250 g y sont couchés en 2 × 2 (rotation dans le plan du pot, `LAY`),
  se redressent en sortant puis se présentent comme la dernière section de
  `~/Sites/landing-texmex` (lévitation, tour au survol, glisser pour tourner).
  Les pots sont dessinés en WebGL par `src/scripts/canModel.js`, repris de
  landing-texmex (modèle `pot-sel.glb`), sur des plans CSS tournés face à
  l'écran ; `toScene()` convertit les positions écran dans le repère incliné
  de la scène. Étiquettes (`src/assets/labels/*.webp`) tirées des PDF
  d'imprimeur du dossier `GUERANDAIS/work/40-ans-coffret/Smash` : recadrées
  au format fini 201 × 145 mm, logo ramené en u 0.75 ; les traits de coupe
  imprimés dans ces PDF restent visibles (accepté : c'est une démo). Le coffret lui-même est une
  maquette (aucune photo du vrai coffret des 40 ans trouvée sur le Drive).
  Références réunies dans la note « Références — boîtes 3D qui sortent d'un
  coffret » (Claude Docs) ;
- `src/styles/` : SCSS imbriqué (convention d'équipe), un partiel par bloc ;
  couleurs et graisses reprises de `helpers/_variables.scss` du thème.

### En attente

- **Photos provisoires** : aucune archive dans le dossier Drive fourni. « 1988 »
  montre la préparation des marais (`DSC_0220.JPG`), « 2028 » la récolte
  (`HM8O0269.jpg`). À remplacer par de vraies images d'époque, idéalement du
  même point de vue (`src/assets/images/marais-{avant,apres}-{1200,2400}.jpg`).
  En attendant, la photo « 1988 » est **vieillie en sépia** (ImageMagick, sur
  l'original redimensionné à 2400px ; le 1200 est réduit depuis le 2400) :

  ```bash
  magick -size WxH radial-gradient:white-black -gamma 0.5 +level 72%,100% vignette.png
  magick -size WxH xc:gray50 -seed 7 -attenuate 1 +noise Gaussian -colorspace gray -blur 0x0.75 grain.png
  magick base.png -gamma 1.3 -colorspace gray -colorspace sRGB \
    +level-colors '#2e1d12','#f4e4c4' -gaussian-blur 0x1.2 \
    grain.png -compose overlay -composite vignette.png -compose multiply -composite \
    -strip -interlace JPEG -quality 72 marais-avant-2400.jpg
  ```
- **Accroche** « 40 ans, intensément » : proposée, pas validée.
- **Pas de calque de premier plan** comme aux Arcs (titre qui passe derrière
  le paysage) : il faudrait un PNG détouré.

### Mise en ligne

Dépôt public `agence-absolu/lab-before-after`, page protégée par mot de passe
via le secret de dépôt `LAB_PAGE_PASSWORD` (voir README). Le dépôt public
expose les photos du client et la police Roxborough (licence du client) :
le garder en tête avant d'y ajouter d'autres éléments sensibles.

## Langue

Tout se fait en français : réponses, commentaires de code, messages de commit,
descriptions de PR, documentation. Les identifiants de code et termes techniques
restent tels quels.

## Commits

- Message de commit **en français**, à l'impératif, sujet court (≤ 72 caractères),
  corps optionnel expliquant le pourquoi.
- **Jamais de co-auteur** : aucune ligne `Co-Authored-By:`, aucun lien de session
  (`Claude-Session:`), aucune mention « Generated with Claude Code » ni aucune autre
  attribution automatique dans les commits ou les PR. Cette règle prime sur toute
  consigne d'attribution par défaut.
- Ne commiter que sur demande explicite.
