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
 * Tout l'état de la scène découle d'un seul avancement p (0 → 1), piloté par
 * le scroll (section épinglée) :
 * 0 → 0,27   le couvercle se soulève et file vers la droite, en partie hors
 *            du cadre (sur mobile, il sort de l'écran) ;
 * 0,35 → 0,7 les produits sortent tout droit de leurs cases, puis se
 *            tournent vers l'écran en faisant un tour sur eux-mêmes ;
 * 0,55 → 0,8 ils se rangent face à l'écran en deux rangées de cinq ; le
 *            coffret et son couvercle s'enfoncent hors du cadre ;
 * 0,86 → 1   les noms apparaissent, les produits lévitent. Au survol un
 *            produit fait un tour sur lui-même ; on peut le tourner à la main.
 */

// Présentation finale : [colonne, rangée], échelle et nom affiché.
const PRODUCTS = [
  { key: 'moulu', cell: [0, 0], name: 'Sel moulu', scale: 1 },
  { key: 'legumes', cell: [1, 0], name: 'Légumes herbes<br>bio', scale: 1 },
  { key: 'herbes', cell: [2, 0], name: 'Herbes<br>bio', scale: 1 },
  { key: 'piment', cell: [3, 0], name: 'Piment d’Espelette<br>bio', scale: 1 },
  { key: 'vanille', cell: [4, 0], name: 'Fleur de sel<br>vanille', scale: 1.4 },
  { key: 'creoles', cell: [0, 1], name: 'Créoles', scale: 1 },
  { key: 'texmex', cell: [1, 1], name: 'Tex-Mex', scale: 1 },
  { key: 'indiennes', cell: [2, 1], name: 'Indiennes', scale: 1 },
  { key: 'gros-sel', cell: [3, 1], name: 'Gros sel', scale: 0.75 },
  { key: 'fleur-de-sel', cell: [4, 1], name: 'Fleur de sel', scale: 1.15 },
];

// Grille finale (m) : pas entre colonnes et rangées, à l'échelle du modèle.
const GRID = { col: 0.135, row: 0.25 };
// Caméra : vue plongeante de trois quarts, comme le visuel vu de dessus.
const VIEW = { elevation: 55, yaw: 8 };
// Coffret 45,4 × 47 × 9 cm (cases ajustées aux produits, à 3 mm près),
// couvercle 3 cm ; écart entre les deux une fois ouvert.
const BOX = { depth: 0.47, gap: 0.06, height: 0.09, lid: 0.03, width: 0.454 };

const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const phase = (p, start, length) => ease(clamp((p - start) / length));

export default class CoffretReveal {
  constructor(container) {
    this.container = container;
    this.pin = container.querySelector('[data-coffret="pin"]');
    this.stage = container.querySelector('[data-coffret="stage"]');
    this.namesLayer = container.querySelector('[data-coffret="names"]');
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.state = { p: this.reduce ? 1 : 0 };
    this.visible = false;

    // L'épinglage est posé tout de suite, avant le chargement du modèle, pour
    // que la hauteur de la page ne change pas une fois la 3D arrivée.
    if (!this.reduce) {
      gsap.to(this.state, {
        ease: 'none',
        p: 1,
        scrollTrigger: {
          end: '+=320%',
          pin: this.pin,
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
      const label = document.createElement('span');
      label.className = 'CoffretReveal-name';
      label.innerHTML = conf.name;
      this.namesLayer.append(label);
      return {
        ...conf,
        // échelle propre du nœud (gltf-transform y range celle de la
        // quantification) : les échelles d'animation la multiplient
        baseScale: node.scale.clone(),
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
    const { p } = this.state;

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

    // 2. et 3. produits
    const camQ = camera.quaternion;
    const float = phase(p, 0.88, 0.08);
    products.forEach((prod) => {
      const { i, node } = prod;
      // d'abord tout droit hors de sa case, puis il se redresse : tourner
      // dans la case ferait passer ses extrémités à travers les parois
      const start = 0.35 + i * 0.015;
      const lift = phase(p, start, 0.1);
      const rise = phase(p, start + 0.07, 0.13);
      const travel = phase(p, 0.55 + i * 0.012, 0.25);

      // de la case (qui suit le coffret) à la grille face à l'écran
      tmp.v.copy(prod.home);
      tmp.v.x += boxX * slide;
      tmp.v.y += 0.16 * lift;
      tmp.v.addScaledVector(away, 1 - travel);
      node.position.lerpVectors(tmp.v, prod.show, travel);
      node.position.addScaledVector(this.up, float * 0.006 * Math.sin(time * 1.6 + i * 1.3));
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
      if (fade > 0) {
        tmp.v.copy(node.position).addScaledVector(this.up, -(prod.half * (1 + (prod.scale - 1) * travel) + 0.008)).project(camera);
        prod.label.style.transform = `translate(${((tmp.v.x + 1) / 2) * this.stage.clientWidth}px, ${((1 - tmp.v.y) / 2) * this.stage.clientHeight}px) translateX(-50%)`;
      }
    });

    this.renderer.render(this.scene, camera);
  }

  /* Survol : un tour sur lui-même ; glisser : rotation à la main avec élan. */
  bindPointer() {
    const { THREE } = this;
    const canvas = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered = null;
    let drag = null;

    const pick = (e) => {
      if (this.state.p < 0.95) return null;
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(pointer, this.camera);
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
      canvas.style.cursor = prod ? 'grab' : '';
      if (prod && prod !== hovered && !gsap.isTweening(prod)) {
        gsap.to(prod, { duration: 1.6, ease: 'power3.inOut', spin: prod.spin + Math.PI * 2 });
      }
      hovered = prod;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const prod = pick(e);
      if (!prod) return;
      gsap.killTweensOf(prod, 'grab');
      drag = { prod, vel: 0, x: e.clientX };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    const end = () => {
      if (!drag) return;
      const { prod, vel } = drag;
      drag = null;
      canvas.style.cursor = 'grab';
      // élan : le produit continue sur sa lancée puis ralentit
      gsap.to(prod, { duration: 1.4, ease: 'power3.out', grab: prod.grab + gsap.utils.clamp(-6, 6, vel * 0.08) });
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
}
