import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createCanView, grabbable } from './canModel.js';

gsap.registerPlugin(ScrollTrigger);

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

// Caméra CSS (CoffretReveal-scene) : coffret vu de trois quarts haut, comme
// le visuel du brief vu en surplomb. Les produits présentés prennent
// l'inverse pour rester face à l'écran.
const CAMERA = { x: 48, y: 10 };
// Caméra des pots WebGL : de profil quand ils sont couchés (vus d'en haut),
// un peu plongée en sortant, presque de face à la fin.
const PITCH = { lying: 0, rising: 0.2, shown: 0.08 };

// Coffret (u) : extérieur 56 × 58, 9 de haut ; plateau intérieur 52 × 54,
// un peu sous le bord.
const BOX = { d: 58, h: 9, inner: { d: 54, w: 52 }, w: 56 };
const TRAY_Y = -BOX.h / 2 + 1.2;
const LID = { h: 3 };

/**
 * Produits, relevés sur le visuel du brief (Brief UI & front, p. 4).
 * slot : compartiment dans le coffret (centre x, z et taille w × d, en u ;
 *        x vers la droite, z vers l'avant) ; lay : rotation du produit couché
 *        dans son plan (le sel moulu est en travers, bouchon à gauche).
 * size : taille de l'élément (u) ; pour un pot, sa longueur vaut h / 1,28.
 * show : place dans la présentation finale [colonne, rangée, échelle].
 */
const PRODUCTS = {
  moulu: { lay: -90, show: [0, 0, 0.62], size: [13, 31.9], slot: [-9.2, -20, 26.5, 10.5] },
  vanille: { show: [4, 0, 1.35], size: [11, 11], slot: [14.6, -19.6, 12.5, 11.5] },
  legumes: { show: [1, 0, 0.85], size: [10, 22.3], slot: [-18.8, -4.3, 9.4, 18.4] },
  herbes: { show: [2, 0, 0.85], size: [10, 22.3], slot: [-8.8, -4.3, 9.4, 18.4] },
  piment: { show: [3, 0, 0.85], size: [10, 22.3], slot: [1.1, -4.3, 9.4, 18.4] },
  'gros-sel': { show: [3, 1, 0.72], size: [14.4, 21.4], slot: [15.2, -1.1, 15.2, 22.2] },
  creoles: { show: [0, 1, 0.85], size: [10, 22.3], slot: [-18.8, 14.9, 9.4, 18.4] },
  texmex: { show: [1, 1, 0.85], size: [10, 22.3], slot: [-8.8, 14.9, 9.4, 18.4] },
  indiennes: { show: [2, 1, 0.85], size: [10, 22.3], slot: [1.1, 14.9, 9.4, 18.4] },
  'fleur-de-sel': { show: [4, 1, 1.1], size: [12.9, 11], slot: [15, 17.4, 13.6, 11.8] },
};

/**
 * Convertit une position exprimée face à l'écran (x à droite, y en bas, z vers
 * le spectateur) en position dans la scène inclinée. La scène applique
 * rotateY(-y) puis rotateX(-x) : on applique l'inverse, rotateX puis rotateY.
 */
function toScene({ x, y, z }) {
  const ax = (CAMERA.x * Math.PI) / 180;
  const ay = (CAMERA.y * Math.PI) / 180;
  const y1 = Math.cos(ax) * y - Math.sin(ax) * z;
  const z1 = Math.sin(ax) * y + Math.cos(ax) * z;
  return {
    x: Math.cos(ay) * x + Math.sin(ay) * z1,
    y: y1,
    z: -Math.sin(ay) * x + Math.cos(ay) * z1,
  };
}

/**
 * Fabrique les faces d'un pavé CSS 3D. data-cuboid liste les faces voulues
 * (toutes par défaut ; le coffret n'a pas de dessus) ; un enfant
 * [data-face="front"] est déplacé dans la face qu'il nomme.
 */
function buildCuboid(element) {
  const wanted = element.dataset.cuboid?.trim() ? element.dataset.cuboid.trim().split(/\s+/) : FACES;
  wanted.forEach((name) => {
    const face = document.createElement('div');
    face.className = `Cuboid-face Cuboid-face--${name}`;
    const content = element.querySelector(`:scope > [data-face="${name}"]`);
    if (content) face.append(content);
    element.append(face);
  });
}

/**
 * Jeu des 40 ans : section épinglée, le scroll pilote le coffret.
 * 1. le couvercle se soulève et va se poser à gauche du coffret (la
 *    composition du visuel du brief) ; sur mobile il sort de l'écran ;
 * 2. les dix produits, couchés dans leurs compartiments, se lèvent et se
 *    tournent vers l'écran ;
 * 3. ils se présentent en deux rangées de cinq, puis lévitent ; au survol un
 *    pot fait un tour sur lui-même, et on peut le tourner à la main.
 *
 * Les positions sont en « u », l'unité de la scène (--u en CSS, qui suit la
 * largeur de la scène), relue en pixels et recalculée à chaque refresh.
 */
export default class CoffretReveal {
  constructor(container) {
    this.container = container;
    this.pin = container.querySelector('[data-coffret="pin"]');
    this.scene = container.querySelector('[data-coffret="scene"]');
    this.box = container.querySelector('[data-coffret="box"]');
    this.lid = container.querySelector('[data-coffret="lid"]');
    this.tray = container.querySelector('[data-coffret="tray"]');
    this.items = Array.from(container.querySelectorAll('[data-coffret="item"]')).map((el) => ({
      conf: PRODUCTS[el.dataset.product],
      el,
      name: el.querySelector('.CoffretReveal-itemName'),
    }));

    container.querySelectorAll('[data-cuboid]').forEach(buildCuboid);
    this.buildTray();
    this.items.forEach((item) => this.prepare(item));

    this.u = () => parseFloat(getComputedStyle(this.scene).fontSize);
    // gsap.matchMedia n'appelle la fonction que si une condition est vraie :
    // « all » garantit qu'elle tourne partout.
    gsap.matchMedia().add(
      {
        all: '(min-width: 0px)',
        compact: '(max-width: 899px)',
        reduce: '(prefers-reduced-motion: reduce)',
      },
      (context) => this.animate(context.conditions),
    );
  }

  /* Compartiments du plateau, d'après les slots des produits. */
  buildTray() {
    const { inner } = BOX;
    Object.values(PRODUCTS).forEach(({ slot: [x, z, w, d] }) => {
      const cell = document.createElement('span');
      cell.className = 'CoffretReveal-slot';
      Object.assign(cell.style, {
        height: `calc(var(--u) * ${d})`,
        left: `calc(var(--u) * ${inner.w / 2 + x - w / 2})`,
        top: `calc(var(--u) * ${inner.d / 2 + z - d / 2})`,
        width: `calc(var(--u) * ${w})`,
      });
      this.tray.append(cell);
    });
  }

  /* Un produit : taille, et pour un pot sa vue 3D et sa manipulation. */
  prepare(item) {
    const { conf, el } = item;
    el.style.setProperty('--w', conf.size[0]);
    el.style.setProperty('--h', conf.size[1]);
    // le nom garde la même taille quelle que soit l'échelle du produit présenté
    el.style.setProperty('--name-scale', 1 / conf.show[2]);
    // lay : couche le produit dans son plan (le plan de l'élément, lui, est
    // couché à plat dans le coffret ou tourné vers l'écran)
    const float = el.querySelector('[data-coffret="float"]');
    const lay = document.createElement('div');
    lay.className = 'CoffretReveal-itemLay';
    lay.append(...float.childNodes);
    float.append(lay);
    Object.assign(item, { float, lay });
    if (el.dataset.kind !== 'pot') return;

    const canvas = document.createElement('canvas');
    canvas.className = 'CoffretReveal-can3d';
    lay.append(canvas);
    // res : canevas dessiné plus grand, le pot étant agrandi en CSS à la fin
    const view = createCanView(canvas, { label: el.dataset.label, pitch: PITCH.lying, res: 1.6 });
    // yaw : rotation pilotée par le scroll ; spin : tour au survol
    const st = { pitch: PITCH.lying, spin: 0, yaw: 0 };
    const sync = () => {
      view.pitch = st.pitch;
      view.yaw = st.yaw + st.spin;
      view.invalidate();
    };
    const grab = grabbable(el, view);
    el.addEventListener('pointerenter', () => {
      if (grab.dragging || gsap.isTweening(st, 'spin')) return;
      gsap.to(st, { duration: 1.6, ease: 'power3.inOut', onUpdate: sync, spin: st.spin + Math.PI * 2 });
    });
    Object.assign(item, { st, sync });
  }

  get pots() {
    return this.items.filter((item) => item.st);
  }

  /* Positions de départ : coffret fermé, produits couchés dans leurs cases. */
  closed() {
    const u = this.u();
    gsap.set(this.box, { x: 0, y: 0, z: 0 });
    gsap.set(this.lid, { rotationX: 0, x: 0, y: (-BOX.h / 2 - LID.h / 2) * u, z: 0 });
    gsap.set(this.tray, { rotationX: 90, xPercent: -50, y: TRAY_Y * u, yPercent: -50 });
    this.items.forEach(({ conf, el, lay, name }) => {
      gsap.set(el, {
        rotationX: 90,
        rotationY: 0,
        scale: 1,
        x: conf.slot[0] * u,
        xPercent: -50,
        y: (TRAY_Y - 0.15) * u,
        yPercent: -50,
        z: conf.slot[1] * u,
      });
      gsap.set(lay, { rotation: conf.lay ?? 0 });
      gsap.set(name, { autoAlpha: 0, y: 10 });
    });
    this.pots.forEach(({ st, sync }) => {
      Object.assign(st, { pitch: PITCH.lying, yaw: 0 });
      sync();
    });
  }

  /* Couvercle posé à gauche du coffret (le coffret glisse d'autant à droite),
     ou sorti de l'écran sur mobile. */
  opened(compact) {
    const u = this.u();
    if (compact) return { box: { x: 0 }, lid: { x: -130 * u, y: -12 * u } };
    const shift = (BOX.w + 6) / 2;
    return { box: { x: shift * u }, lid: { x: -shift * u, y: (BOX.h / 2 - LID.h / 2) * u } };
  }

  /* Coffret et couvercle s'effacent vers le bas pendant la présentation. */
  away() {
    const u = this.u();
    // assez bas pour sortir du cadre : rien ne passe sous les noms
    return {
      box: toScene({ x: 0, y: 125 * u, z: -30 * u }),
      lid: toScene({ x: -60 * u, y: 110 * u, z: -40 * u }),
    };
  }

  /* Place finale d'un produit, face à l'écran, dans le repère du coffret. */
  shown(conf, compact) {
    const u = this.u();
    const [col, row, scale] = conf.show;
    // desktop : produits agrandis, deux rangées remontées dans le cadre
    const step = compact ? 13 : 20;
    const zoom = compact ? 1 : 1.45;
    const target = toScene({ x: (col - 2) * step * u, y: (row ? 11 : -27) * u, z: 8 * u });
    const { box } = this.away();
    return {
      rotationX: CAMERA.x,
      rotationY: CAMERA.y,
      scale: scale * zoom,
      x: target.x - box.x,
      y: target.y - box.y,
      z: target.z - box.z,
    };
  }

  animate({ compact, reduce }) {
    this.closed();
    const u = () => this.u();
    const syncAll = () => this.pots.forEach((p) => p.sync());
    const els = this.items.map((i) => i.el);
    const lays = this.items.map((i) => i.lay);
    const names = this.items.map((i) => i.name);
    const shown = (i) => this.shown(this.items[i].conf, compact);

    // Mouvement réduit : pas d'épinglage ni de lévitation, on montre
    // directement les produits présentés.
    if (reduce) {
      const away = this.away();
      gsap.set(this.box, away.box);
      gsap.set(this.lid, away.lid);
      els.forEach((el, i) => gsap.set(el, shown(i)));
      gsap.set(lays, { rotation: 0 });
      gsap.set(names, { autoAlpha: 1, y: 0 });
      this.pots.forEach(({ st }) => Object.assign(st, { pitch: PITCH.shown, yaw: 0 }));
      syncAll();
      return undefined;
    }

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        end: '+=320%',
        invalidateOnRefresh: true,
        onRefreshInit: () => this.closed(),
        // la lévitation ne démarre qu'une fois les produits présentés
        onUpdate: (self) => this.floats?.forEach((t) => (self.progress > 0.9 ? t.play() : t.pause(0))),
        pin: this.pin,
        scrub: 0.8,
        start: 'top top',
        trigger: this.container,
      },
    });

    tl
      // 1. le couvercle se soulève, puis se pose à côté du coffret
      .to(this.lid, { duration: 0.8, y: () => -26 * u() })
      .to(this.lid, {
        duration: 1,
        x: () => this.opened(compact).lid.x,
        y: () => this.opened(compact).lid.y,
      }, 0.8)
      .to(this.box, { duration: 1, x: () => this.opened(compact).box.x }, 0.8)
      // (de 1.8 à 2.2 : pause sur le coffret ouvert, comme sur le visuel)
      // 2. les produits se lèvent de leurs cases et se tournent vers l'écran
      .to(els, {
        duration: 1,
        ease: 'power2.out',
        rotationX: CAMERA.x,
        rotationY: CAMERA.y,
        stagger: 0.05,
        y: () => (TRAY_Y - 18) * u(),
      }, 2.2)
      .to(lays, { duration: 1, rotation: 0, stagger: 0.05 }, 2.2)
      .to(this.pots.map((p) => p.st), {
        duration: 1.2,
        onUpdate: syncAll,
        pitch: PITCH.rising,
        stagger: 0.05,
        yaw: Math.PI * 2,
      }, 2.2)
      // 3. ils se présentent en deux rangées ; coffret et couvercle s'effacent
      .to(this.box, {
        duration: 1.2,
        x: () => this.away().box.x,
        y: () => this.away().box.y,
        z: () => this.away().box.z,
      }, 3.2)
      .to(this.lid, {
        duration: 1.2,
        x: () => this.away().lid.x,
        y: () => this.away().lid.y,
        z: () => this.away().lid.z,
      }, 3.2)
      .to(els, {
        duration: 1.2,
        scale: (i) => shown(i).scale,
        stagger: 0.04,
        x: (i) => shown(i).x,
        y: (i) => shown(i).y,
        z: (i) => shown(i).z,
      }, 3.2)
      .to(this.pots.map((p) => p.st), { duration: 1.2, onUpdate: syncAll, pitch: PITCH.shown }, 3.2)
      .to(names, { autoAlpha: 1, duration: 0.5, stagger: 0.04, y: 0 }, 4.2);

    // lévitation, sur un élément intérieur pour ne pas gêner le scroll
    this.floats = this.items.map(({ float }, i) =>
      gsap.to(float, {
        delay: (i % 5) * 0.3,
        duration: 2.4 + (i % 3) * 0.4,
        ease: 'sine.inOut',
        paused: true,
        repeat: -1,
        rotation: i % 2 ? -2 : 2,
        y: -10,
        yoyo: true,
      }),
    );

    return () => this.floats.forEach((t) => t.kill());
  }
}
