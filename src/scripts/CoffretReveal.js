import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import modelUrl from '../assets/models/coffret-40-ans.glb?url';

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
 */

// Présentation finale : [colonne, rangée], échelle, nom affiché et page du
// site Le Guérandais. Le site n'a pas de page par produit (les nœuds produit
// redirigent) : chacun pointe vers la page de sa gamme, où il figure.
const SITE = 'https://www.leguerandais.fr/fr/produits/';
const PRODUCTS = [
  { key: 'moulu', cell: [0, 0], name: 'Sel moulu', page: 'sel-moulu-sel-fin', scale: 1 },
  { key: 'legumes', cell: [1, 0], name: 'Légumes herbes<br>bio', page: 'sel-aromatise', scale: 1 },
  { key: 'herbes', cell: [2, 0], name: 'Herbes<br>bio', page: 'sel-aromatise', scale: 1 },
  { key: 'piment', cell: [3, 0], name: 'Piment d’Espelette<br>bio', page: 'sel-aromatise', scale: 1 },
  { key: 'vanille', cell: [4, 0], name: 'Fleur de sel<br>vanille', page: 'fleur-sel', scale: 1.2 },
  { key: 'creoles', cell: [0, 1], name: 'Créoles', page: 'sel-aromatise-cuisines-monde', scale: 1 },
  { key: 'texmex', cell: [1, 1], name: 'Tex-Mex', page: 'sel-aromatise-cuisines-monde', scale: 1 },
  { key: 'indiennes', cell: [2, 1], name: 'Indiennes', page: 'sel-aromatise-cuisines-monde', scale: 1 },
  { key: 'gros-sel', cell: [3, 1], name: 'Gros sel', page: 'gros-sel', scale: 0.75 },
  { key: 'fleur-de-sel', cell: [4, 1], name: 'Fleur de sel', page: 'fleur-sel', scale: 1.15 },
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
    this.state = { gate: done, lid: done, scroll: done, tease: 0 };
    this.visible = false;

    // bouton d'ouverture : actif tout de suite, l'avancement attend le modèle
    this.toggleButton = container.querySelector('[data-coffret="toggle"]');
    this.open = this.reduce;
    this.updateToggle();
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.toggleButton.addEventListener('pointerenter', () => this.tease(true));
    this.toggleButton.addEventListener('pointerleave', () => this.tease(false));

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
      // le nom est le lien vers la page du produit ; un clic sur le produit
      // lui-même l'ouvre aussi (voir bindPointer)
      const label = document.createElement('a');
      label.className = 'CoffretReveal-name';
      label.href = SITE + conf.page;
      label.target = '_blank';
      label.rel = 'noopener';
      label.tabIndex = -1;
      label.innerHTML = conf.name;
      this.namesLayer.append(label);
      return {
        ...conf,
        // échelle propre du nœud (gltf-transform y range celle de la
        // quantification) : les échelles d'animation la multiplient
        baseScale: node.scale.clone(),
        focus: 0,
        grab: 0,
        half: size.y / 2,
        home: node.position.clone(),
        homeQ: q,
        i,
        label,
        node,
        spin: 0,
      };
    });

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    this.tmp = {
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

  /* Taille du rendu, cadrage de la caméra et place de la grille finale. */
  resize() {
    const { THREE, camera, renderer } = this;
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    this.compact = w < 700;

    // assez loin pour voir coffret + couvercle côte à côte (le coffret seul
    // sur mobile), dans la direction fixe de VIEW
    const vfov = (camera.fov * Math.PI) / 360;
    const hfov = Math.atan(Math.tan(vfov) * camera.aspect);
    // le coffret seul, centré : le couvercle part sur la droite, hors cadre
    const width = BOX.width + 0.34;
    const depth = (BOX.depth + 0.04) * Math.sin((VIEW.elevation * Math.PI) / 180) + 0.12;
    const dist = Math.max(width / 2 / Math.tan(hfov), depth / 2 / Math.tan(vfov));
    const el = (VIEW.elevation * Math.PI) / 180;
    const yaw = (VIEW.yaw * Math.PI) / 180;
    const target = new THREE.Vector3(0, 0.02, 0);
    camera.position.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist).add(target);
    camera.lookAt(target);
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
      node.position.addScaledVector(tmp.toCam, FOCUS * prod.focus * ready);
      node.scale.copy(prod.baseScale).multiplyScalar(1 + (prod.scale - 1) * travel);

      // couché → debout face à la caméra, avec un tour en sortant, puis les
      // rotations au survol et à la main
      // (redressement vers une orientation fixe, puis tour autour de l'axe
      // propre du produit : interpoler vers une cible qui tourne fait
      // basculer l'interpolation au demi-tour, d'où une saute)
      node.quaternion.slerpQuaternions(prod.homeQ, camQ, rise);
      tmp.spin.setFromAxisAngle(tmp.y, Math.PI * 2 * rise + prod.spin + prod.grab);
      node.quaternion.multiply(tmp.spin);

      // nom sous le produit, en pixels dans la scène
      const fade = clamp((p - 0.86) / 0.08);
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
     page dans un nouvel onglet ; glisser : rotation à la main avec élan. */
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
    const hover = (prod) => {
      if (prod === hovered) return;
      if (prod && !prod.spinTween?.isActive()) {
        prod.spinTween = gsap.to(prod, { duration: 1.6, ease: 'power3.inOut', spin: prod.spin + Math.PI * 2 });
      }
      setHovered(prod);
    };

    // survoler ou atteindre au clavier le nom fait le même effet que le produit
    this.products.forEach((prod) => {
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

    const pick = (e) => {
      if (this.p < ARRIVED) return null;
      aim(e);
      const hit = ray.intersectObjects(this.products.map((prod) => prod.node), true)[0];
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
      // presque pas bougé : c'est un clic, on ouvre la page du produit
      if (e.type === 'pointerup' && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) {
        window.open(prod.label.href, '_blank', 'noopener');
        return;
      }
      // élan : le produit continue sur sa lancée puis ralentit
      gsap.to(prod, { duration: 1.4, ease: 'power3.out', grab: prod.grab + gsap.utils.clamp(-6, 6, vel * 0.08) });
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
}
