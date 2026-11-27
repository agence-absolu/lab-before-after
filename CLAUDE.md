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
- `src/scripts/CoffretReveal.js` + `_coffret-reveal.scss` : seconde section,
  sous le bandeau — le jeu « 40 ans de sel à gagner », d'après le visuel du
  brief (`GUERANDAIS/work/40-ans-coffret/Smash/Brief UI & front - Terre de
  sel.pdf`, p. 4) : texte et CTA fictif à gauche, coffret violet à droite.
  Scène **Three.js**, un seul modèle `src/assets/models/coffret-40-ans.glb`.
  Tout l'état découle d'un avancement `p` piloté par le scroll (section
  épinglée) : le couvercle file vers la droite, hors cadre ; les dix produits couchés
  dans leurs cases se lèvent puis se rangent face à la caméra en deux rangées
  (lévitation, tour au survol, glisser pour tourner) ; noms en HTML projetés.
  Nom et clic sur le produit ouvrent, dans un nouvel onglet, la page de sa
  gamme sur leguerandais.fr (`page` dans `PRODUCTS`) : le site n'a pas de
  page par produit, ses nœuds produit redirigent.
- **Modèle Blender** (hors dépôt) : `GUERANDAIS/work/40-ans-coffret/blender/
  coffret-40-ans.blend`, textures dans `blender/textures/` (étiquettes des pots
  dans `textures/labels/`). Nœuds : `Coffret`,
  `Couvercle`, et un par produit nommé par sa clé (`PRODUCTS` dans le JS) ;
  chaque produit est modélisé debout, face avant vers -Y (Blender) et couché
  par la seule rotation de son objet. Les cases sont des booléens taillés sur
  l'emprise de chaque produit + 3 mm, parois de 8 mm, comme sur le visuel ;
  c'est ce qui fixe la taille du coffret (45,4 × 47 cm, `BOX` dans le JS),
  rebord de 6 mm. Référence : visuel HD sur Figma (Slides « LE GUERANDAIS 40
  ANS », nœud 2002:1148), dont viennent aussi les violets (`#3F1856` dessus,
  `#2C0E3E` cases). Texture du couvercle (`textures/lid-top.png`) : logo
  horizontal recomposé depuis le SVG du thème, sans badge
  (`textures/logo-horizontal.svg`), et « Coffret N°1/40 ». La
  boîte de fleur de sel (10,8 cm couchée) dépasse des 9 cm : sa case descend
  presque au fond, et elle mord de 2 mm dans le couvercle fermé, invisible. Pots : modèle de landing-texmex,
  étiquettes tirées des PDF d'imprimeur (traits de coupe visibles, accepté :
  c'est une démo). Sel moulu : tube à part (carton, couvercle plastique
  blanc), étiquette `textures/labels/moulu-tube.png` tirée du PDF de 2018
  (`Smash/9-Sel Fin Moulu-Boîte 250g.pdf`, sans le Label Rouge de la photo).
  Toute la scène est à environ 1,2 × l'échelle réelle (pots modélisés à
  64 mm de diamètre pour 53 mm réels) : les nouveaux produits suivent ce
  rapport. Ombrage des cases : occlusion précalculée dans Cycles sur les UV
  `AO` du coffret, produits et couvercle masqués (sinon leur trace reste
  au fond des cases vides), éclaircie à 30 % mini (`textures/coffret-ao.png`,
  sur le matériau des cases). Les surfaces planes (matériau violet : dessus,
  rebord, faces extérieures) n'en gardent qu'un tiers
  (`coffret-ao-plat.png` = `+level 65%,100%` de la précédente). Images
  empaquetées dans le .blend : l'export glTF ne les lit pas sinon. Elles
  sont multipliées au violet dans la couleur de base ; le JS les lit en
  `NoColorSpace`. À refaire si les cases bougent. Pot liège et boîte de fleur de sel : photos projetées sur
  la demi-face avant ; sachet de gros sel : image du visuel du brief recadrée
  au ras (`textures/gros-sel.png`), en basse définition faute de packshot HD. Pour régénérer le modèle :
  export glTF depuis Blender (sélection : Coffret, Couvercle, collection
  Produits ; textures WebP) vers `blender/coffret-40-ans-raw.glb`, puis

  ```bash
  npx @gltf-transform/cli@4 optimize coffret-40-ans-raw.glb src/assets/models/coffret-40-ans.glb \
    --compress meshopt --texture-compress webp --texture-size 2048 \
    --simplify false --join false --flatten false --instance false --palette false
  ```

  Sans `--join/--flatten/--instance false`, les nœuds sont fusionnés et le JS
  ne retrouve plus les produits. La quantification range un facteur d'échelle
  dans certains nœuds : le JS multiplie cette échelle, ne l'écrase pas.
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
