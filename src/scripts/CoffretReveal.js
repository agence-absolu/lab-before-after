import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import modelUrl from '../assets/models/coffret-40-ans.glb?url';
import { DETAILS, SITE } from './coffretProducts.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Jeu des 40 ans : le coffret du visuel du brief, en Three.js.
 *
 * Le modèle (coffret-40-ans.glb) est fait dans Blender :
 * work/40-ans-coffret/blender/coffret-40-ans.blend (hors dépôt). Il contient
 * « Coffret », « Couvercle » et un nœud par produit, nommé par sa clé
 * (PRODUCTS). Chaque produit est modélisé debout, face avant vers +Z, et
 * couché dans sa case par la seule rotation de son nœud. Unités : mètres.
 *
 * Tout l'état de la scène découle d'un seul avancement p (0 → 1), fait de
 * deux parts (getter p) :
 * - le couvercle (state.lid), joué au clic sur le bouton « Ouvrir le
 *   coffret » ou sur la boîte, rejoué à l'envers pour la refermer ; fermée,
 *   la boîte entrouvre son couvercle au survol (et à celui du bouton) ;
 * - la suite (state.scroll), pilotée par le scroll, section épinglée. Si
 *   l'on scrolle la boîte fermée, le couvercle s'ouvre de lui-même, sauf si
 *   le visiteur l'a refermée : refermer, produits sortis, rembobine tout.
 * 0 → 0,27   le couvercle se soulève et file vers la droite, en partie hors
 *            du cadre (sur mobile, il sort de l'écran) — part du clic ;
 * 0,35 → 0,7 les produits sortent tout droit de leurs cases, puis se
 *            tournent vers l'écran en faisant un tour sur eux-mêmes ;
 * 0,55 → 0,8 ils se rangent face à l'écran en deux rangées de cinq ; le
 *            coffret et son couvercle sortent par le bas du cadre ;
 * 0,86 → 1   les noms apparaissent ; dès l'arrivée (ARRIVED ≈ 0,87), les
 *            produits lévitent et se balancent. Au survol un produit avance
 *            et fait un tour sur lui-même ; on peut le tourner à la main.
 *
 * Fiche produit (clic sur un produit ou son nom) : les autres reculent et
 * disparaissent, le produit vient en grand à gauche et tourne lentement, un
 * volet arrive par la droite (contenu : coffretProducts.js). Flèches pour
 * passer au voisin, Échap ou clic à côté pour fermer ; scroll bloqué.
 * Sur grand écran, la scène couvre toute la section (le produit a la place
 * de la colonne de texte, qui s'efface) : un décalage de vue garde le cadrage
 * du coffret dans la colonne de droite.
 */

// Présentation finale : [colonne, rangée], échelle et nom affiché. Fiche
// (textes, page sur le site) : coffretProducts.js, même clé.
const PRODUCTS = [
  { key: 'moulu', cell: [0, 0], name: 'Sel moulu', scale: 1 },
  { key: 'legumes', cell: [1, 0], name: 'Légumes herbes<br>bio', scale: 1 },
  { key: 'herbes', cell: [2, 0], name: 'Herbes<br>bio', scale: 1 },
  { key: 'piment', cell: [3, 0], name: 'Piment d’Espelette<br>bio', scale: 1 },
  { key: 'vanille', cell: [4, 0], name: 'Fleur de sel<br>vanille', scale: 1.2 },
  { key: 'creoles', cell: [0, 1], name: 'Créoles', scale: 1 },
  { key: 'texmex', cell: [1, 1], name: 'Tex-Mex', scale: 1 },
  { key: 'indiennes', cell: [2, 1], name: 'Indiennes', scale: 1 },
  { key: 'gros-sel', cell: [3, 1], name: 'Gros sel', scale: 0.75 },
  { key: 'fleur-de-sel', cell: [4, 1], name: 'Fleur de sel', scale: 1.15 },
];

// Part du couvercle dans p, et durées (s) de son ouverture et de sa
// fermeture au clic. La suite occupe le reste de p, au scroll, sur `pin` de
// hauteur d'écran épinglée. Au clic en plein scroll, elle se rejoue (play)
// ou se rembobine (rewind) avant ou après le couvercle : durées pour un
// trajet complet, au prorata de la position du scroll. Les phases ont leur
// propre easing, les avancements sont donc linéaires.
const LID = { close: 1.2, open: 1.5, share: 0.3 };
const SCENE = { play: 3.2, rewind: 1.5 };
const SCROLL = { pin: '+=220%' };

// Grille finale (m) : pas entre colonnes et rangées, à l'échelle du modèle.
const GRID = { col: 0.135, row: 0.25 };
// Caméra : vue plongeante de trois quarts, comme le visuel vu de dessus.
const VIEW = { elevation: 55, yaw: 8 };
// Coffret 45,4 × 47 × 9 cm (cases ajustées aux produits, à 3 mm près),
// couvercle 3 cm ; écart entre les deux une fois ouvert.
const BOX = { depth: 0.47, gap: 0.06, height: 0.09, lid: 0.03, width: 0.454 };

// Rangement final : chaque produit part en décalé et voyage `length`. Le
// survol s'active dès que le dernier est arrivé à l'œil : avec l'easing, il
// a fait 98 % du trajet aux 83 % de sa durée.
const TRAVEL = { length: 0.25, start: 0.55, step: 0.012 };
const ARRIVED = TRAVEL.start + (PRODUCTS.length - 1) * TRAVEL.step + 0.83 * TRAVEL.length;
// Lévitation (m) : montée-descente et balancement gauche-droite, à des
// rythmes différents ; mise en avant au survol, vers la caméra (m).
const FLOAT = { bob: 0.006, sway: 0.006 };
const FOCUS = 0.1;
// Fiche produit : durée (s) d'ouverture, hauteur du produit en part de
// l'écran (grand écran / mobile), distance en part de celle de la grille,
// rotation lente (rad/s) et recul des autres produits (m).
// Le produit est borné en hauteur (part de l'écran) et en largeur (part de
// la zone libre à gauche du volet) : les boîtes larges ne débordent pas.
const DETAIL = { depth: 0.8, duration: 0.9, height: 0.62, heightCompact: 0.6, recede: 0.25, spin: 0.35, width: 0.45 };

const SCROLL_KEYS = [' ', 'ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp'];

const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const phase = (p, start, length) => ease(clamp((p - start) / length));

export default class CoffretReveal {
  constructor(container) {
    this.container = container;
    this.stage = container.querySelector('[data-coffret="stage"]');
    this.namesLayer = container.querySelector('[data-coffret="names"]');
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // lid, scroll : les deux parts de p (voir le getter) ; tease : couvercle
    // entrouvert au survol de la boîte fermée
    // gate : part du scroll réellement jouée (0 boîte fermée, 1 ouverte)
    const done = this.reduce ? 1 : 0;
    // detail : fiche produit ouverte (les autres produits s'effacent)
    this.state = { detail: 0, gate: done, lid: done, scroll: done, tease: 0 };
    this.visible = false;

    // bouton d'ouverture : actif tout de suite, l'avancement attend le modèle
    this.toggleButton = container.querySelector('[data-coffret="toggle"]');
    this.open = this.reduce;
    this.updateToggle();
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.toggleButton.addEventListener('pointerenter', () => this.tease(true));
    this.toggleButton.addEventListener('pointerleave', () => this.tease(false));

    // fiche produit : volet, flèches, fermeture
    this.text = container.querySelector('.CoffretReveal-text');
    this.panel = container.querySelector('[data-coffret="panel"]');
    this.panelBody = container.querySelector('[data-coffret="panel-body"]');
    this.current = null;
    container.querySelector('[data-coffret="close"]').addEventListener('click', () => this.closeDetail());
    container.querySelector('[data-coffret="prev"]').addEventListener('click', () => this.stepDetail(-1));
    container.querySelector('[data-coffret="next"]').addEventListener('click', () => this.stepDetail(1));
    this.panel.addEventListener('keydown', (e) => this.panelKeys(e));
    // scroll bloqué pendant la fiche (la section épinglée bougerait derrière),
    // sauf dans le volet lui-même s'il défile
    const block = (e) => {
      if (!this.current) return;
      if (e.type !== 'keydown' && this.panelBody.contains(e.target)) return;
      if (e.type === 'keydown' && (this.panel.contains(e.target) || !SCROLL_KEYS.includes(e.key))) return;
      e.preventDefault();
    };
    ['wheel', 'touchmove', 'keydown'].forEach((type) => window.addEventListener(type, block, { passive: false }));
    // Échap et flèches au niveau de la fenêtre : après un clic dans la scène,
    // le focus n'est plus dans le volet
    window.addEventListener('keydown', (e) => {
      if (!this.current) return;
      if (e.key === 'Escape') this.closeDetail();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepDetail(e.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    // annonce du produit affiché quand on passe au voisin
    this.live = document.createElement('p');
    this.live.className = 'visually-hidden';
    this.live.setAttribute('aria-live', 'polite');
    this.panel.append(this.live);

    // La suite au scroll. L'épinglage est posé tout de suite, avant le
    // chargement du modèle, pour que la hauteur de la page ne change pas une
    // fois la 3D arrivée.
    if (!this.reduce) {
      gsap.to(this.state, {
        ease: 'none',
        scroll: 1,
        scrollTrigger: {
          end: SCROLL.pin,
          onUpdate: ({ progress }) => {
            // scroller la boîte fermée l'ouvre, sauf si le visiteur l'a
            // refermée lui-même : elle attend alors son clic
            if (progress > 0 && !this.open && !this.closedByUser) this.toggle({ auto: true });
          },
          pin: container.querySelector('[data-coffret="pin"]'),
          scrub: 0.8,
          start: 'top top',
          trigger: container,
        },
      });
    }

    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
    }).observe(container);

    this.init().catch((error) => console.error('Coffret 3D :', error));
  }

  async init() {
    const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ]);
    this.THREE = THREE;

    // ── Rendu ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'CoffretReveal-canvas';
    this.stage.prepend(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-0.5, 1.4, 0.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0005;
    Object.assign(sun.shadow.camera, { bottom: -0.9, far: 4, left: -0.9, right: 0.9, top: 0.9 });
    scene.add(sun);

    // sol invisible qui ne garde que les ombres, sur le fond lilas de la page
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.floor = floor;

    // ── Modèle ────────────────────────────────────────────────────────────
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelUrl);
    const root = gltf.scene;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const map = o.material.map;
      if (map) map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    scene.add(root);
    this.scene = scene;
    this.box = root.getObjectByName('Coffret');
    this.lid = root.getObjectByName('Couvercle');
    // carton mat : reflets et environnement y posent un voile gris qui
    // délave le violet (#3F1856 sur le visuel). Sur le coffret seul (les
    // étiquettes gardent leur éclairage) : matériau physique presque sans
    // reflet spéculaire, environnement réduit. Three n'applique
    // envMapIntensity que si le matériau a son propre envMap.
    [this.box, this.lid].forEach((node) =>
      node.traverse((o) => {
        if (!o.isMesh) return;
        const { color, map, name, roughness } = o.material;
        // la texture du coffret est son ombrage précalculé (occlusion des
        // parois, sans les produits qui quittent leurs cases), multiplié au
        // violet : une donnée brute, pas une couleur sRGB
        if (node === this.box && map) map.colorSpace = THREE.NoColorSpace;
        o.material.dispose();
        o.material = new THREE.MeshPhysicalMaterial({
          color,
          envMap: scene.environment,
          envMapIntensity: 0.35,
          map,
          name,
          roughness,
          specularIntensity: 0.15,
        });
      }),
    );
    this.boxY = this.box.position.y;

    this.products = PRODUCTS.map((conf, i) => {
      const node = root.getObjectByName(conf.key);
      // hauteur du produit debout (repère du nœud, sans sa rotation)
      const q = node.quaternion.clone();
      node.quaternion.identity();
      node.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
      node.quaternion.copy(q);
      // le nom ouvre la fiche du produit ; un clic sur le produit aussi
      // (voir bindPointer)
      const label = document.createElement('button');
      label.className = 'CoffretReveal-name';
      label.type = 'button';
      label.tabIndex = -1;
      label.innerHTML = conf.name;
      label.setAttribute('aria-haspopup', 'dialog');
      label.setAttribute('aria-controls', this.panel.id);
      this.namesLayer.append(label);
      return {
        ...conf,
        // échelle propre du nœud (gltf-transform y range celle de la
        // quantification) : les échelles d'animation la multiplient
        baseScale: node.scale.clone(),
        // detail : 0 dans la grille, 1 en grand dans la fiche ; turn : rotation
        // lente accumulée pendant la fiche
        detail: 0,
        focus: 0,
        grab: 0,
        half: size.y / 2,
        halfWidth: size.x / 2,
        home: node.position.clone(),
        homeQ: q,
        i,
        label,
        node,
        spin: 0,
        turn: 0,
      };
    });
    renderer.domElement.setAttribute('aria-hidden', 'true');

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    this.tmp = {
      detailPos: new THREE.Vector3(),
      spin: new THREE.Quaternion(),
      toCam: new THREE.Vector3(),
      v: new THREE.Vector3(),
      away: new THREE.Vector3(),
      y: new THREE.Vector3(0, 1, 0),
    };

    new ResizeObserver(() => this.resize()).observe(this.stage);
    this.resize();
    this.bindPointer();

    const loop = (t) => {
      requestAnimationFrame(loop);
      if (this.visible) this.render(t / 1000);
    };
    requestAnimationFrame(loop);
  }

  /* Avancement de la scène : le couvercle, puis la suite au scroll. La suite
     attend le couvercle (scroll rapide pendant qu'il s'ouvre : les produits
     sortiraient à travers). */
  get p() {
    const { gate, lid, scroll } = this.state;
    return LID.share * lid + (1 - LID.share) * scroll * gate;
  }

  /* Ouvre ou referme le couvercle (sans animation si mouvements réduits).
     Les produits sortis, refermer rembobine tout : ils regagnent leurs
     cases, la boîte revient, puis le couvercle se pose ; rouvrir fait
     l'inverse. La suite au scroll attend le couvercle (gate, getter p). */
  toggle({ auto = false } = {}) {
    this.open = !this.open;
    if (!auto) this.closedByUser = !this.open;
    this.updateToggle();
    this.tease(false);
    // le couvercle puis la suite, ou l'inverse, chacun à sa vitesse (au
    // prorata de ce qui reste à jouer, si l'on reclique en cours de route)
    const { gate, lid, scroll } = this.state;
    const speed = this.reduce ? 0 : 1;
    const lidStep = { duration: speed * (this.open ? LID.open * (1 - lid) : LID.close * lid), ease: 'none', lid: +this.open };
    const gateStep = {
      duration: speed * scroll * (this.open ? SCENE.play * (1 - gate) : SCENE.rewind * gate),
      ease: 'none',
      gate: +this.open,
    };
    this.timeline?.kill();
    this.timeline = gsap
      .timeline()
      .to(this.state, this.open ? lidStep : gateStep)
      .to(this.state, this.open ? gateStep : lidStep);
  }

  updateToggle() {
    // le libellé change (deux libellés superposés, le CSS montre le bon),
    // pas d'aria-pressed qui suppose un libellé fixe
    this.toggleButton.classList.toggle('is-open', this.open);
  }

  /* Couvercle entrouvert : seulement sur la boîte fermée. */
  tease(on) {
    gsap.to(this.state, { duration: 0.5, ease: 'power2.out', tease: on && !this.open ? 1 : 0 });
  }

  /* Fiche produit : le produit vient en grand, les autres s'effacent, le
     volet entre par la droite. Seulement une fois les produits rangés. */
  openDetail(prod) {
    if (this.current || this.p < ARRIVED) return;
    this.clearHover?.();
    this.current = prod;
    this.fillPanel(prod);
    this.panel.hidden = false;
    // le volet part de hors champ : une image pour que la transition joue
    requestAnimationFrame(() => this.panel.classList.add('is-open'));
    this.container.classList.add('is-detail');
    // derrière la fiche, rien d'atteignable au clavier
    this.text.inert = this.namesLayer.inert = true;
    gsap.to(this.state, this.detailTween({ detail: 1 }));
    gsap.to(prod, this.detailTween({ detail: 1 }));
    this.panel.querySelector('.CoffretReveal-panelTitle').focus({ preventScroll: true });
  }

  /* Flèches : le produit affiché regagne la grille, le voisin le remplace. */
  stepDetail(step) {
    if (!this.current) return;
    const n = this.products.length;
    const next = this.products[(this.current.i + step + n) % n];
    gsap.to(this.current, this.detailTween({ detail: 0 }));
    this.settle(this.current);
    gsap.to(next, this.detailTween({ detail: 1 }));
    this.current = next;
    this.fillPanel(next);
    this.live.textContent = DETAILS[next.key].title;
    // le focus était sur l'ancien titre, remplacé : il passe au nouveau
    if (!this.panel.contains(document.activeElement)) {
      this.panel.querySelector('.CoffretReveal-panelTitle').focus({ preventScroll: true });
    }
  }

  closeDetail() {
    const prod = this.current;
    if (!prod) return;
    this.current = null;
    gsap.to(prod, this.detailTween({ detail: 0 }));
    this.settle(prod);
    gsap.to(this.state, this.detailTween({ detail: 0 }));
    this.panel.classList.remove('is-open');
    this.container.classList.remove('is-detail');
    this.text.inert = this.namesLayer.inert = false;
    // masqué une fois sorti (durée de la transition CSS du volet)
    gsap.delayedCall(this.reduce ? 0 : 0.6, () => {
      if (!this.current) this.panel.hidden = true;
    });
    // le focus revient au nom du produit qu'on quitte
    prod.label.focus({ preventScroll: true });
  }

  detailTween(vars) {
    return { duration: this.reduce ? 0 : DETAIL.duration, ease: 'power3.inOut', overwrite: 'auto', ...vars };
  }

  /* De retour dans la grille, le produit se remet face à l'écran : tour
     complet le plus proche (rotation lente et rotation à la main comprises). */
  settle(prod) {
    const full = Math.PI * 2;
    const turn = Math.round((prod.turn + prod.grab) / full) * full - prod.grab;
    gsap.to(prod, { duration: this.reduce ? 0 : DETAIL.duration, ease: 'power2.inOut', turn });
  }

  /* Contenu du volet (textes de coffretProducts.js, fichier du projet). */
  fillPanel(prod) {
    const d = DETAILS[prod.key];
    const n = this.products.length;
    const plain = (html) => html.replace(/<br>/g, ' ');
    [
      ['prev', this.products[(prod.i - 1 + n) % n], 'précédent'],
      ['next', this.products[(prod.i + 1) % n], 'suivant'],
    ].forEach(([dir, other, word]) => {
      this.panel.querySelector(`[data-coffret="${dir}-label"]`).textContent = plain(other.name);
      this.panel.querySelector(`[data-coffret="${dir}"]`).setAttribute('aria-label', `Produit ${word} : ${plain(other.name)}`);
    });
    const list = (items) => items.map((item) => `<li>${item}</li>`).join('');
    this.panelBody.innerHTML = `
      <p class="CoffretReveal-panelRange">${d.range}</p>
      <h3 class="CoffretReveal-panelTitle" id="CoffretReveal-panelTitle" tabindex="-1">${d.title}</h3>
      ${d.labels.length ? `<ul class="CoffretReveal-panelLabels">${list(d.labels)}</ul>` : ''}
      <p class="CoffretReveal-panelText">${d.description}</p>
      ${d.usage ? `<h4 class="CoffretReveal-panelHeading">Conseils d’utilisation</h4><p class="CoffretReveal-panelText">${d.usage}</p>` : ''}
      <h4 class="CoffretReveal-panelHeading">Ingrédients</h4>
      <p class="CoffretReveal-panelText CoffretReveal-panelText--small">${d.ingredients}</p>
      ${d.formats.length ? `<h4 class="CoffretReveal-panelHeading">Formats</h4><ul class="CoffretReveal-panelFormats">${list(d.formats)}</ul>` : ''}
      <a class="CoffretReveal-panelCta" href="${SITE + d.page}" target="_blank" rel="noopener">Voir la page produit<span class="visually-hidden"> (nouvel onglet)</span></a>
    `;
    this.panelBody.scrollTop = 0;
  }

  /* Clavier dans la fiche : Échap ferme, flèches gauche/droite passent au
     voisin, Tab reste dans le volet. */
  panelKeys(e) {
    if (e.key === 'Tab') {
      const items = [...this.panel.querySelectorAll('button, a[href]')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* Taille du rendu, cadrage de la caméra et place de la grille finale. */
  resize() {
    const { THREE, camera, renderer } = this;
    const W = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    if (!W || !h) return;
    renderer.setSize(W, h, false);
    // grand écran : la scène couvre toute la section, mais le coffret et la
    // grille se cadrent dans la colonne de droite (largeur w), à droite de
    // la colonne de texte (L)
    const wide = getComputedStyle(this.stage).position === 'absolute';
    const L = wide ? Math.max(0, this.text.getBoundingClientRect().right - this.stage.getBoundingClientRect().left) : 0;
    const w = W - L;
    this.compact = w < 700;
    this.wide = wide;

    // assez loin pour voir coffret + couvercle côte à côte (le coffret seul
    // sur mobile), dans la direction fixe de VIEW
    const vfov = (camera.fov * Math.PI) / 360;
    const hfov = Math.atan((Math.tan(vfov) * w) / h);
    this.vfov = vfov;
    // le coffret seul, centré : le couvercle part sur la droite, hors cadre
    const width = BOX.width + 0.34;
    const depth = (BOX.depth + 0.04) * Math.sin((VIEW.elevation * Math.PI) / 180) + 0.12;
    const dist = Math.max(width / 2 / Math.tan(hfov), depth / 2 / Math.tan(vfov));
    const el = (VIEW.elevation * Math.PI) / 180;
    const yaw = (VIEW.yaw * Math.PI) / 180;
    const target = new THREE.Vector3(0, 0.02, 0);
    camera.position.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist).add(target);
    camera.lookAt(target);
    // image virtuelle de largeur w + 2L centrée sur le cadrage de la colonne
    // de droite ; on en rend la partie [0, W] : la colonne de droite y garde
    // exactement son cadrage, la colonne de texte prolonge la vue à gauche
    camera.aspect = (w + 2 * L) / h;
    if (L) camera.setViewOffset(w + 2 * L, h, 0, 0, W, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // grille finale : un plan face à la caméra, à la distance où elle remplit
    // le cadre (marges comprises)
    const gw = 5 * GRID.col + 0.02;
    const gh = 2 * GRID.row + 0.04;
    const gd = Math.max(gw / 2 / Math.tan(hfov), gh / 2 / Math.tan(vfov)) * 1.08;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const center = camera.position.clone().addScaledVector(forward, gd);
    this.gridDistance = gd;
    this.up = up;
    this.right = right;
    this.products.forEach((prod) => {
      const [col, row] = prod.cell;
      prod.show = center
        .clone()
        .addScaledVector(right, (col - 2) * GRID.col)
        // le produit est calé en haut de sa case, le nom en dessous
        .addScaledVector(up, (row ? -GRID.row / 2 : GRID.row / 2) + 0.025);
    });
    this.render(0);
  }

  /* État de la scène pour l'avancement courant. */
  render(time) {
    const { box, camera, lid, products, tmp } = this;
    if (!products) return;
    const { p } = this;

    // 1. couvercle : il se soulève, puis se pose à côté du coffret
    const lift = phase(p, 0, 0.12);
    const slide = phase(p, 0.1, 0.17);
    const boxX = 0;
    const lidX = this.compact ? 1.6 : BOX.width + BOX.gap + 0.12;
    const closedY = BOX.height + BOX.lid / 2;
    // pendant la présentation, coffret et couvercle sortent par le bas de
    // l'écran (le long du « bas » de la caméra), sous les produits
    const leave = phase(p, 0.55, 0.25);
    const away = tmp.away.copy(this.up).multiplyScalar(-1.4 * leave);
    // les produits debout ne doivent pas projeter d'ombre sur un sol devenu vide
    this.floor.material.opacity = 0.18 * (1 - leave);

    box.position.set(boxX * slide, this.boxY, 0).add(away);
    lid.position
      .set(
        lidX * slide,
        closedY + (BOX.lid / 2 - closedY) * slide + 0.25 * lift * (1 - slide) + (this.compact ? 0.4 * slide : 0),
        0,
      )
      .add(away);
    lid.rotation.z = 0.18 * Math.sin(Math.PI * slide);
    // entrouvert au survol : le bord gauche se soulève
    const tease = this.state.tease * (1 - lift);
    lid.position.y += 0.012 * tease;
    lid.rotation.z -= 0.05 * tease;

    // 2. et 3. produits
    const camQ = camera.quaternion;
    // lévitation dès l'arrivée, comme le survol
    const float = phase(p, ARRIVED, 0.05);
    // la mise en avant retombe si l'on remonte avant la fin du rangement
    const ready = clamp((p - ARRIVED + 0.03) / 0.03);
    // fiche produit : place du produit en grand, à gauche du volet (au
    // centre de la scène sur mobile, sous le volet qui couvre le texte)
    const { detail } = this.state;
    // pas de temps borné : après une pause (scène hors écran), pas de saut
    const dt = Math.min(0.1, Math.max(0, time - (this.lastTime ?? time)));
    this.lastTime = time;
    if (detail > 0) {
      const W = this.stage.clientWidth;
      const free = W - (this.wide ? this.panel.offsetWidth : 0);
      const dist = this.gridDistance * DETAIL.depth;
      tmp.detailPos
        .set(this.wide ? free / W - 1 : 0, 0, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize()
        .multiplyScalar(dist)
        .add(camera.position);
      // demi-hauteur et demi-largeur disponibles, en mètres à cette distance
      const perPixel = (2 * dist * Math.tan(this.vfov)) / this.stage.clientHeight;
      this.detailHalf = ((this.wide ? DETAIL.height : DETAIL.heightCompact) * this.stage.clientHeight * perPixel) / 2;
      this.detailHalfWidth = (DETAIL.width * free * perPixel) / 2;
    }
    products.forEach((prod) => {
      const { i, node } = prod;
      // d'abord tout droit hors de sa case, puis il se redresse : tourner
      // dans la case ferait passer ses extrémités à travers les parois
      const start = 0.35 + i * 0.015;
      const lift = phase(p, start, 0.1);
      const rise = phase(p, start + 0.07, 0.13);
      const travel = phase(p, TRAVEL.start + i * TRAVEL.step, TRAVEL.length);

      // de la case (qui suit le coffret) à la grille face à l'écran
      tmp.v.copy(prod.home);
      tmp.v.x += boxX * slide;
      tmp.v.y += 0.16 * lift;
      tmp.v.addScaledVector(away, 1 - travel);
      node.position.lerpVectors(tmp.v, prod.show, travel);
      node.position.addScaledVector(this.up, float * FLOAT.bob * Math.sin(time * 1.6 + i * 1.3));
      node.position.addScaledVector(this.right, float * FLOAT.sway * Math.sin(time * 1.1 + i * 0.9));
      // mise en avant le long de la ligne de visée : le produit grossit sans
      // glisser à l'écran (vers l'avant de la caméra, il s'écarterait du centre)
      tmp.toCam.subVectors(camera.position, node.position).normalize();
      node.position.addScaledVector(tmp.toCam, FOCUS * prod.focus * ready * (1 - detail));

      // fiche : celui-ci vient en grand et tourne lentement, les autres
      // reculent et rapetissent jusqu'à disparaître
      const hide = detail * (1 - prod.detail);
      const gridScale = 1 + (prod.scale - 1) * travel;
      let size = gridScale;
      if (prod.detail > 0) {
        node.position.lerp(tmp.detailPos, prod.detail);
        const fit = Math.min(this.detailHalf / prod.half, this.detailHalfWidth / prod.halfWidth);
        size += (fit - gridScale) * prod.detail;
        prod.turn += dt * DETAIL.spin * prod.detail;
      }
      node.position.addScaledVector(tmp.toCam, -DETAIL.recede * hide);
      node.scale.copy(prod.baseScale).multiplyScalar(size * (1 - hide));
      node.visible = hide < 0.999;

      // couché → debout face à la caméra, avec un tour en sortant, puis les
      // rotations au survol et à la main
      // (redressement vers une orientation fixe, puis tour autour de l'axe
      // propre du produit : interpoler vers une cible qui tourne fait
      // basculer l'interpolation au demi-tour, d'où une saute)
      node.quaternion.slerpQuaternions(prod.homeQ, camQ, rise);
      tmp.spin.setFromAxisAngle(tmp.y, Math.PI * 2 * rise + prod.spin + prod.grab + prod.turn);
      node.quaternion.multiply(tmp.spin);

      // nom sous le produit, en pixels dans la scène
      const fade = clamp((p - 0.86) / 0.08) * (1 - detail);
      prod.label.style.opacity = fade;
      // lien actif (clic, clavier) seulement une fois le nom lisible
      const linkOn = fade > 0.5;
      if (linkOn !== prod.linkOn) {
        prod.linkOn = linkOn;
        prod.label.classList.toggle('is-active', linkOn);
        prod.label.tabIndex = linkOn ? 0 : -1;
      }
      if (fade > 0) {
        tmp.v.copy(node.position).addScaledVector(this.up, -(prod.half * (1 + (prod.scale - 1) * travel) + 0.008)).project(camera);
        prod.label.style.transform = `translate(${((tmp.v.x + 1) / 2) * this.stage.clientWidth}px, ${((1 - tmp.v.y) / 2) * this.stage.clientHeight}px) translateX(-50%)`;
      }
    });

    this.renderer.render(this.scene, camera);
  }

  /* Survol : le produit avance et fait un tour sur lui-même ; clic : sa
     fiche ; glisser : rotation à la main avec élan (aussi dans la fiche). */
  bindPointer() {
    const { THREE } = this;
    const canvas = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let drag = null;

    // mise en avant : le produit survolé avance, le précédent recule
    const setHovered = (prod) => {
      if (hovered) gsap.to(hovered, { duration: 0.7, ease: 'power3.out', focus: 0 });
      if (prod) gsap.to(prod, { duration: 0.7, ease: 'power3.out', focus: 1 });
      hovered = prod;
    };
    this.clearHover = () => setHovered(null);
    const hover = (prod) => {
      if (this.current) prod = null;
      if (prod === hovered) return;
      if (prod && !prod.spinTween?.isActive()) {
        prod.spinTween = gsap.to(prod, { duration: 1.6, ease: 'power3.inOut', spin: prod.spin + Math.PI * 2 });
      }
      setHovered(prod);
    };

    // survoler ou atteindre au clavier le nom fait le même effet que le
    // produit ; le cliquer ouvre la fiche
    this.products.forEach((prod) => {
      prod.label.addEventListener('click', () => this.openDetail(prod));
      prod.label.addEventListener('pointerenter', () => hover(prod));
      prod.label.addEventListener('focus', () => hover(prod));
      prod.label.addEventListener('pointerleave', () => setHovered(null));
      prod.label.addEventListener('blur', () => setHovered(null));
    });

    const aim = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(pointer, this.camera);
    };
    // la boîte encore fermée (et immobile) : un clic l'ouvre
    const pickBox = (e) => {
      if (this.open || this.state.lid > 0) return false;
      aim(e);
      return ray.intersectObjects([this.box, this.lid], true).length > 0;
    };
    let onBox = false;

    // dans la grille, tous les produits ; dans la fiche, le seul affiché
    const pick = (e) => {
      if (this.p < ARRIVED) return null;
      aim(e);
      const candidates = this.current ? [this.current] : this.products;
      const hit = ray.intersectObjects(candidates.map((prod) => prod.node), true)[0];
      if (!hit) return null;
      return this.products.find((prod) => {
        let o = hit.object;
        while (o && o !== prod.node) o = o.parent;
        return o === prod.node;
      });
    };

    canvas.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x;
        drag.vel = drag.vel * 0.6 + dx * 0.4;
        drag.prod.grab += dx * 0.012;
        drag.x = e.clientX;
        return;
      }
      const prod = pick(e);
      const box = pickBox(e);
      canvas.style.cursor = prod || box ? 'pointer' : '';
      hover(prod);
      if (box !== onBox) this.tease((onBox = box));
    });
    canvas.addEventListener('pointerleave', () => {
      if (!drag) setHovered(null);
      if (onBox) this.tease((onBox = false));
    });
    canvas.addEventListener('click', (e) => {
      if (pickBox(e)) {
        onBox = false;
        canvas.style.cursor = '';
        this.toggle();
      }
      // fiche ouverte : un clic à côté du produit la ferme
      else if (this.current && !pick(e)) this.closeDetail();
    });
    canvas.addEventListener('pointerdown', (e) => {
      const prod = pick(e);
      if (!prod) return;
      gsap.killTweensOf(prod, 'grab');
      drag = { prod, startX: e.clientX, startY: e.clientY, vel: 0, x: e.clientX };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    const end = (e) => {
      if (!drag) return;
      const { prod, startX, startY, vel } = drag;
      drag = null;
      canvas.style.cursor = 'pointer';
      // presque pas bougé : c'est un clic, on ouvre la fiche du produit
      if (e.type === 'pointerup' && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) {
        if (!this.current) this.openDetail(prod);
        return;
      }
      // élan : le produit continue sur sa lancée puis ralentit
      gsap.to(prod, { duration: 1.4, ease: 'power3.out', grab: prod.grab + gsap.utils.clamp(-6, 6, vel * 0.08) });
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
}
