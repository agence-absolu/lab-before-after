/**
 * Fiches des produits du coffret (volet de détail de CoffretReveal.js).
 *
 * Sources :
 * - titre, description, labels et formats : site Drupal Le Guérandais
 *   (~/Sites/le-guerandais, type de contenu « product » ; nid en commentaire) ;
 * - ingrédients et conseils d'utilisation : étiquettes des PDF d'imprimeur
 *   (GUERANDAIS/work/40-ans-coffret/Smash/), le site n'ayant pas ce champ ;
 * - Créoles, Tex-Mex et Fleur de sel vanille n'existent pas sur le site :
 *   tout vient de leur étiquette. La description de la vanille est un texte
 *   de démo, à faire valider.
 *
 * `page` : page de la gamme sur leguerandais.fr (pas de page par produit).
 */
export const SITE = 'https://www.leguerandais.fr/fr/produits/';

export const DETAILS = {
  // nid 14909
  moulu: {
    range: 'Sel moulu, sel fin',
    title: 'Sel moulu Tradition',
    description:
      'Selon une méthode traditionnelle millénaire, notre sel moulu Tradition de Guérande est récolté à la main par les paludiers. Le sel fin Tradition Le Guérandais est non raffiné et ne contient aucun additif. Il est juste séché et broyé. Il convient à tous les usages sur la table comme en cuisine.',
    ingredients: '100 % sel de Guérande.',
    labels: ['Indication Géographique Protégée', 'Produit en Bretagne'],
    formats: ['Boîte verseuse : 125 g, 250 g, 350 g', 'Sac : 500 g'],
    page: 'sel-moulu-sel-fin',
  },
  // nid 14915
  legumes: {
    range: 'Sel aromatisé',
    title: 'Sel aromatisé aux légumes et herbes bio',
    description:
      'Le sel aromatisé aux légumes et herbes bio Le Guérandais est idéal sur les légumes cuits, les crudités, dans les soupes et tout particulièrement dans les jus de tomate et les gaspachos.',
    ingredients:
      'Sel de Guérande IGP* 95 %, herbes 3,55 % (livèche*, ciboulette*, basilic*, marjolaine*, persil*, romarin*, thym*), légumes 1,40 % (céleri*, ail*, oignon*, poireau*), algue* 0,05 % (Ascophyllum nodosum). *Produits issus de l’agriculture biologique. Peut contenir des traces de gluten et soja.',
    labels: ['Agriculture biologique', 'Produit en Bretagne'],
    formats: ['Boîte verseuse : 250 g'],
    page: 'sel-aromatise',
  },
  // nid 14914
  herbes: {
    range: 'Sel aromatisé',
    title: 'Sel aromatisé aux herbes bio',
    description:
      'La saveur herbacée des plantes aromatiques du sel aromatisé bio Le Guérandais assaisonnera très bien les plats, les vinaigrettes, les légumes et les grillades pour le plus grand bonheur des gastronomes.',
    ingredients:
      'Sel de Guérande IGP* 95 %, herbes 5 % (romarin*, thym*, persil*, laurier*, basilic*, estragon*). *Produits issus de l’agriculture biologique. Peut contenir des traces de céleri, gluten et soja.',
    labels: ['Agriculture biologique', 'Produit en Bretagne'],
    formats: ['Boîte verseuse : 250 g'],
    page: 'sel-aromatise',
  },
  // nid 14916
  piment: {
    range: 'Sel aromatisé',
    title: 'Sel aromatisé au piment d’Espelette bio',
    description:
      'Finement relevé et épicé, le sel aromatisé au piment d’Espelette bio Le Guérandais se marie très bien avec des œufs, des pommes de terre ou des viandes mijotées et grillées.',
    ingredients:
      'Sel de Guérande IGP* 96 %, piment d’Espelette AOP* 4 %. *Produits issus de l’agriculture biologique. Peut contenir des traces de céleri.',
    labels: ['Agriculture biologique', 'Produit en Bretagne'],
    formats: ['Boîte verseuse : 250 g'],
    page: 'sel-aromatise',
  },
  // étiquette seule (pas de fiche sur le site)
  vanille: {
    range: 'Fleur de sel',
    title: 'Fleur de sel vanille de Madagascar',
    description:
      'La fleur de sel de Guérande, récoltée à la main par les paludiers, associée à la vanille de Madagascar, dans son pot à bouchon de liège.',
    ingredients: 'Fleur de sel de Guérande et vanille de Madagascar.',
    labels: ['Produit en Bretagne'],
    formats: [],
    page: 'fleur-sel',
  },
  // étiquette seule (pas de fiche sur le site)
  creoles: {
    range: 'Sel aromatisé Cuisines du monde',
    title: 'Sel fin de Guérande saveurs créoles',
    description: 'Préparation à base de sel marin gris de table et de légumes, épices et herbe biologiques.',
    usage: 'Volailles, poissons & crevettes, légumes rôtis, œufs, riz & plats du quotidien.',
    ingredients:
      'Sel de Guérande IGP* 92 %, tomate déshydratée* 2,8 %, gingembre* 1,8 %, poudre de combava* 1,3 %, ail déshydraté* 1 %, thym* 0,8 %, piment fort* 0,3 %. *Issus de l’agriculture biologique. Peut contenir des traces de céleri, fruits à coques, gluten, moutarde et sulfites.',
    labels: ['Agriculture biologique'],
    formats: ['Boîte verseuse : 125 g'],
    page: 'sel-aromatise-cuisines-monde',
  },
  // étiquette seule (pas de fiche sur le site)
  texmex: {
    range: 'Sel aromatisé Cuisines du monde',
    title: 'Sel fin de Guérande saveurs Tex-Mex',
    description: 'Préparation à base de sel marin gris de table et d’épices, légumes et herbes biologiques.',
    usage: 'Tacos & fajitas, viandes et légumes grillés, plats du quotidien.',
    ingredients:
      'Sel de Guérande IGP* 90 %, paprika* 4,2 %, oignon déshydraté* 1,9 %, origan* 1,5 %, piment fort* 0,7 %, ail déshydraté* 0,7 %, thym* 0,5 %, cumin* 0,5 %. *Issus de l’agriculture biologique. Peut contenir des traces de céleri, fruits à coques, gluten, moutarde et sulfites.',
    labels: ['Agriculture biologique'],
    formats: ['Boîte verseuse : 125 g'],
    page: 'sel-aromatise-cuisines-monde',
  },
  // nid 15113 ; ingrédients : étiquette
  indiennes: {
    range: 'Sel aromatisé Cuisines du monde',
    title: 'Sel aromatisé saveurs indiennes',
    description:
      'Cette création associe la richesse du sel de Guérande aux épices chaudes et parfumées de l’Inde pour apporter une touche de caractère à vos plats de poulet tandoori, tikka massala, marinades pour poisson, curry de légumes…',
    ingredients:
      'Sel de Guérande IGP* 88 %, cumin* 4,35 %, curcuma* 2,2 %, oignon* 2,1 %, coriandre* 2 %, romarin* 1,35 %. *Issus de l’agriculture biologique. Peut contenir des traces de céleri, gluten, moutarde.',
    labels: ['Agriculture biologique'],
    formats: ['Boîte verseuse : 220 g'],
    page: 'sel-aromatise-cuisines-monde',
  },
  // nid 14919 ; ingrédients : sachet (« 100 % naturel »)
  'gros-sel': {
    range: 'Gros sel',
    title: 'Gros sel de Guérande Tradition',
    description:
      'Le gros sel Tradition Le Guérandais puise sa force dans les marais de Guérande, un territoire façonné par les embruns marins de la côte Atlantique. Essentiel de toutes les cuisines, le gros sel est un sel riche en oligo-éléments parfaitement adapté à vos eaux de cuisson ainsi que pour les cuissons en croûte de sel.',
    ingredients: 'Gros sel de Guérande, 100 % naturel.',
    labels: ['Indication Géographique Protégée', 'Produit en Bretagne'],
    formats: ['Sac : 800 g, 3 kg', 'Sac en toile : 750 g'],
    page: 'gros-sel',
  },
  // nid 14924 ; ingrédients : étiquette de la boîte
  'fleur-de-sel': {
    range: 'Fleur de sel',
    title: 'Fleur de sel de Guérande Tradition',
    description:
      'Délicatement cueillie à la surface de l’eau par les paludiers selon une méthode traditionnelle millénaire, la fleur de sel Tradition, naturellement blanche, donnera une saveur incomparable à tous vos plats.',
    ingredients: '100 % fleur de sel de Guérande.',
    labels: ['Indication Géographique Protégée', 'Produit en Bretagne'],
    formats: ['Boîte : 125 g', 'Sac : 250 g, 500 g', 'Sac en toile : 250 g'],
    page: 'fleur-sel',
  },
};
