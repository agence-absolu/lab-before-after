import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createCanView, grabbable } from './canModel.js';

gsap.registerPlugin(ScrollTrigger);

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

// Angles de la caméra CSS (CoffretReveal-scene) : les pots, des plans
// dessinés en 3D par canModel.js, prennent l'inverse pour rester face à
// l'écran (rotationY puis rotationX dans l'ordre de GSAP).
const CAMERA = { x: 24, y: 28 };
// Caméra des pots : couchés dans le coffret, un peu plongés en sortant,
// presque de face à la fin.
const PITCH = { inside: 0.1, rising: 0.22, shown: 0.08 };
// Pots couchés dans le coffret : rotation dans le plan du pot (degrés) qui
// aligne son axe sur la longueur du coffret, inclinée d'environ 12° à
// l'écran par la caméra (projection de l'axe x de la scène).
const LAY = -78;

/**
 * Convertit une position exprimée face à l'écran (x à droite, y en bas, z vers
 * le spectateur) en position dans la scène inclinée, pour qu'une rangée de
 * pots soit droite à l'écran. La scène applique rotateY(-y) puis rotateX(-x) :
 * on applique l'inverse, rotateX(+x) puis rotateY(+y).
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
 * Coffret des 40 ans : section épinglée, le scroll pilote l'ouverture.
 * 1. le couvercle se soulève et s'envole vers l'arrière ;
 * 2. les pots montent un à un hors du coffret en pivotant ;
 * 3. ils grandissent et se présentent face à l'écran (en ligne, ou en 2 × 2
 *    sur mobile), puis lévitent ; au survol ils font un tour sur eux-mêmes,
 *    et on peut les faire tourner à la main (comme dans landing-texmex).
 *
 * Les positions sont exprimées en « u », l'unité de la scène (--u en CSS,
 * lue en pixels), et recalculées à chaque refresh de ScrollTrigger.
 */
export default class CoffretReveal {
  constructor(container) {
    this.container = container;
    this.pin = container.querySelector('[data-coffret="pin"]');
    this.stage = container.querySelector('[data-coffret="stage"]');
    this.base = container.querySelector('[data-coffret="base"]');
    this.lid = container.querySelector('[data-coffret="lid"]');
    this.pots = Array.from(container.querySelectorAll('[data-coffret="pot"]'));
    this.names = this.pots.map((pot) => pot.querySelector('.CoffretReveal-potName'));

    container.querySelectorAll('[data-cuboid]').forEach(buildCuboid);
    this.views = this.pots.map((pot) => this.createPot(pot));

    this.u = () => parseFloat(getComputedStyle(this.stage).fontSize);
    // gsap.matchMedia n'appelle la fonction que si une condition est vraie :
    // « all » garantit qu'elle tourne partout.
    gsap.matchMedia().add(
      {
        all: '(min-width: 0px)',
        compact: '(max-width: 700px)',
        reduce: '(prefers-reduced-motion: reduce)',
      },
      (context) => this.animate(context.conditions),
    );
  }

  /* Un pot : canevas 3D, état de la vue (rotation, caméra), manipulation. */
  createPot(pot) {
    const canvas = document.createElement('canvas');
    canvas.className = 'CoffretReveal-can3d';
    // lay : couche le pot dans son plan (enfant d'un plan déjà tourné face à
    // l'écran, sa rotation reste dans ce plan)
    const lay = document.createElement('div');
    lay.className = 'CoffretReveal-potLay';
    lay.append(canvas);
    pot.querySelector('[data-coffret="float"]').append(lay);
    const view = createCanView(canvas, { label: pot.dataset.label, pitch: PITCH.inside });
    // yaw : rotation pilotée par le scroll ; spin : tour au survol
    const st = { pitch: PITCH.inside, spin: 0, yaw: 0 };
    const sync = () => {
      view.pitch = st.pitch;
      view.yaw = st.yaw + st.spin;
      view.invalidate();
    };
    const grab = grabbable(pot, view);
    pot.addEventListener('pointerenter', () => {
      if (grab.dragging || gsap.isTweening(st, 'spin')) return;
      gsap.to(st, { duration: 1.6, ease: 'power3.inOut', onUpdate: sync, spin: st.spin + Math.PI * 2 });
    });
    return { lay, st, sync };
  }

  /* Positions de départ : couvercle fermé, pots couchés en 2 × 2 dans le
     coffret, étiquette vers le haut. */
  closed() {
    const u = this.u();
    gsap.set(this.base, { x: 0, y: 0, z: 0 });
    gsap.set(this.lid, { x: 0, y: -8 * u, z: 0, rotationX: 0 }); // posé sur le coffret (12u de haut)
    this.pots.forEach((pot, i) => {
      gsap.set(pot, {
        rotationX: CAMERA.x,
        rotationY: CAMERA.y,
        scale: 0.8,
        x: (i % 2 ? 1 : -1) * 14 * u,
        xPercent: -50,
        y: 1.4 * u, // couchés au fond du coffret
        yPercent: -50,
        z: (i < 2 ? -9 : 9) * u,
      });
    });
    gsap.set(this.views.map((v) => v.lay), { rotation: LAY });
    gsap.set(this.names, { autoAlpha: 0, y: 10 });
    this.views.forEach(({ st, sync }) => {
      Object.assign(st, { pitch: PITCH.inside, yaw: 0 });
      sync();
    });
  }

  /* Position finale des pots : une rangée droite à l'écran (2 × 2 sur mobile). */
  shown(i, compact) {
    const u = this.u();
    const screen = compact
      ? { x: (i % 2 ? 1 : -1) * 11 * u, y: (i < 2 ? -30 : 6) * u, z: 10 * u }
      : { x: (i - 1.5) * 22 * u, y: -10 * u, z: 10 * u };
    return { scale: compact ? 0.95 : 1, ...toScene(screen) };
  }

  /* Le coffret s'efface vers le bas de l'écran, sous les pots. */
  baseAway() {
    const u = this.u();
    return toScene({ x: 0, y: 34 * u, z: -20 * u });
  }

  animate({ compact, reduce }) {
    this.closed();
    const u = () => this.u();
    const syncAll = () => this.views.forEach((v) => v.sync());

    // Mouvement réduit : pas d'épinglage ni de lévitation, on montre
    // directement les pots sortis du coffret.
    if (reduce) {
      gsap.set(this.lid, { y: -70 * u(), z: -40 * u(), rotationX: 40 });
      gsap.set(this.base, this.baseAway());
      this.pots.forEach((pot, i) => gsap.set(pot, this.shown(i, compact)));
      gsap.set(this.names, { autoAlpha: 1, y: 0 });
      gsap.set(this.views.map((v) => v.lay), { rotation: 0 });
      this.views.forEach(({ st }) => Object.assign(st, { pitch: PITCH.shown, yaw: 0 }));
      syncAll();
      return undefined;
    }

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: this.container,
        pin: this.pin,
        start: 'top top',
        end: '+=280%',
        // la lévitation ne démarre qu'une fois les pots présentés
        onUpdate: (self) => this.floats?.forEach((t) => (self.progress > 0.88 ? t.play() : t.pause(0))),
        scrub: 0.8,
        invalidateOnRefresh: true,
        onRefreshInit: () => this.closed(),
      },
    });

    tl
      // 1. le couvercle se soulève, bascule, puis s'envole
      .to(this.lid, { y: () => -34 * u(), z: () => -14 * u(), rotationX: 28, duration: 1 })
      // 2. couchés dans le coffret ouvert, les pots se redressent un à un en
      //    sortant, et font un tour sur eux-mêmes
      .to(this.pots, { y: () => -22 * u(), duration: 1.1, stagger: 0.15, ease: 'power2.out' }, 0.9)
      .to(this.views.map((v) => v.lay), { rotation: 0, duration: 1.1, stagger: 0.15 }, 0.9)
      .to(
        this.views.map((v) => v.st),
        { yaw: Math.PI * 2, pitch: PITCH.rising, duration: 1.4, stagger: 0.15, onUpdate: syncAll },
        0.9,
      )
      // 3. ils se présentent face à l'écran, le coffret s'efface vers le bas
      .to(this.pots, {
        scale: (i) => this.shown(i, compact).scale,
        x: (i) => this.shown(i, compact).x,
        y: (i) => this.shown(i, compact).y,
        z: (i) => this.shown(i, compact).z,
        duration: 1.3,
        stagger: 0.08,
      }, 2.2)
      .to(this.views.map((v) => v.st), { pitch: PITCH.shown, duration: 1.3, onUpdate: syncAll }, 2.2)
      .to(this.base, {
        x: () => this.baseAway().x,
        y: () => this.baseAway().y,
        z: () => this.baseAway().z,
        duration: 1.3,
      }, 2.2)
      .to(this.lid, { y: () => -120 * u(), z: () => -50 * u(), rotationX: 50, duration: 1.3 }, 2.2)
      .to(this.names, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, 3.2);

    // lévitation, sur un élément intérieur pour ne pas gêner le scroll
    this.floats = this.pots.map((pot, i) =>
      gsap.to(pot.querySelector('[data-coffret="float"]'), {
        delay: i * 0.35,
        duration: 2.4 + i * 0.4,
        ease: 'sine.inOut',
        repeat: -1,
        rotation: i % 2 ? -2 : 2,
        y: -12,
        paused: true,
        yoyo: true,
      }),
    );

    return () => this.floats.forEach((t) => t.kill());
  }
}
