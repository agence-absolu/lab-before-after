import { gsap } from 'gsap';

// Boîte de sel en 3D, partagée par toute la page.
//
// Repris de landing-texmex (~/Sites/landing-texmex/src/js/canModel.js) ;
// seules changent les étiquettes (pots 250 g, voir plus bas) et l'allongement
// du corps qui leur correspond.
//
// Modèle du motion designer (export Cinema 4D), converti et compressé par :
//   npx @gltf-transform/cli copy paludiers-du-monde.gltf raw.glb
//   npx @gltf-transform/cli weld raw.glb weld.glb
//   npx @gltf-transform/cli meshopt weld.glb src/assets/models/pot-sel.glb
import modelUrl from '../assets/models/pot-sel.glb?url';
// Étiquettes des pots 250 g, tirées des PDF d'imprimeur (201 × 145 mm, traits
// de coupe compris), aux UV du cylindre C4D : paroi en v 0.175 → 0.825, centre
// du logo ramené en u 0.75 (face avant).
import herbesUrl from '../assets/labels/herbes.webp?url';
import legumesUrl from '../assets/labels/legumes.webp?url';
import mouluUrl from '../assets/labels/moulu.webp?url';
import pimentUrl from '../assets/labels/piment.webp?url';

export const LABELS = { herbes: herbesUrl, legumes: legumesUrl, moulu: mouluUrl, piment: pimentUrl };

// L'export C4D n'a aucun matériau (tout est blanc métallique). Le corps est le
// mesh « Cylindre », le reste forme le couvercle (groupe « Chapeau »).
const BODY_MESH = 'Cylindre';
const LID_GROUP = 'Chapeau';
// Clapet du couvercle. Celui du modèle C4D (« Clips ») est noyé dans le dôme,
// exporté sans sa découpe (« Extrusion », le cutter, exporté plein) : on les
// masque et on reconstruit le clapet et le tamis d'après la photo IMG_7723.
// Mesures en rayons R du couvercle, depuis son centre vers l'avant (+z).
const C4D_FLAP = 'Clips';
const C4D_SLOT = 'Extrusion';
const FLAP = { back: 0.84, front: 0.98, hinge: 0.26, tip: 0.98, thick: 0.035 };
// ouverture : le clapet bascule vers l'arrière et s'arrête un peu au-dessus
// de l'horizontale (replié à plat, il passerait dans le dôme)
const FLAP_LIFT = 0.45; // radians au-dessus de l'horizontale, ouvert
// trous du tamis : rangées de 2, 3 et 5 du centre vers le bord ; z : part de
// la longueur du clapet depuis la charnière ; step et r en rayons R
const HOLE_ROWS = [
  { n: 2, r: 0.075, step: 0.28, z: 0.22 },
  { n: 3, r: 0.06, step: 0.24, z: 0.47 },
  { n: 5, r: 0.06, step: 0.2, z: 0.72 },
];
// Le cylindre C4D est plus trapu que la vraie boîte : on l'allonge pour que
// la paroi ait les proportions de l'étiquette 250 g (tour / hauteur :
// 201 / 145 mm), sinon elle paraîtrait étirée en largeur.
const BODY_STRETCH = 1.685 / (201 / 145);

async function loadThree() {
  const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  return { GLTFLoader, MeshoptDecoder, RoomEnvironment, THREE };
}

// Charge le modèle, l'habille et le ramène à une hauteur de 2 unités, centré.
// Renvoie le pivot (à ajouter à la scène) et le matériau du corps, dont on
// change la `map` pour passer d'une étiquette à l'autre.
async function buildCan({ GLTFLoader, MeshoptDecoder, THREE }, label) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelUrl);
  const model = gltf.scene;

  const bodyMat = new THREE.MeshStandardMaterial({ map: label, metalness: 0, roughness: 0.42 });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, metalness: 0, roughness: 0.3 });
  model.traverse((obj) => {
    if (obj.isMesh) obj.material = obj.name === BODY_MESH ? bodyMat : lidMat;
  });

  // corps allongé aux proportions réelles, base fixe ; le couvercle remonte
  // d'autant (positions converties dans le repère de chaque parent)
  const body = model.getObjectByName(BODY_MESH);
  const lid = model.getObjectByName(LID_GROUP);
  if (body && lid) {
    model.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(body);
    body.scale.y *= BODY_STRETCH;
    model.updateMatrixWorld(true);
    const after = new THREE.Box3().setFromObject(body);
    const scaleY = (obj) => obj.parent.getWorldScale(new THREE.Vector3()).y;
    body.position.y += (before.min.y - after.min.y) / scaleY(body);
    lid.position.y += (after.max.y - after.min.y - (before.max.y - before.min.y)) / scaleY(lid);
    model.updateMatrixWorld(true);
  }

  // l'objet est décalé dans la scène C4D : on le recentre et on le ramène
  // à une hauteur de 2 unités
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  model.position.sub(center);
  pivot.add(model);
  pivot.scale.setScalar(2 / size.y);
  pivot.updateMatrixWorld(true);

  // ── Clapet et tamis reconstruits, dans le repère du pivot (à l'échelle
  // du monde par compensation de son échelle) ──────────────────────────
  model.traverse((o) => o.isMesh && (o.name.startsWith(C4D_SLOT) || o.name.startsWith(C4D_FLAP)) && (o.visible = false));
  const c4dFlap = model.getObjectByName(C4D_FLAP);
  c4dFlap?.traverse((o) => (o.visible = false));
  let hinge = null;
  let flapRest = 0;
  const slots = [];
  const mouth = new THREE.Vector3();
  if (lid) {
    const lb = new THREE.Box3().setFromObject(lid);
    const R = (lb.max.x - lb.min.x) / 2;
    const cx = (lb.min.x + lb.max.x) / 2;
    const cz = lb.min.z + R;
    const surfaces = [];
    lid.traverse((o) => o.isMesh && o.visible && surfaces.push(o));
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const hitAt = (x, z) => {
      ray.set(new THREE.Vector3(x, lb.max.y + 1, z), down);
      return ray.intersectObjects(surfaces, false)[0];
    };
    const inv = 1 / pivot.scale.x;
    const toPivot = (v) => pivot.worldToLocal(v.clone());

    // charnière sur le dôme, plaque inclinée jusqu'au bord avant
    const h = hitAt(cx, cz + FLAP.hinge * R);
    const f = hitAt(cx, cz + FLAP.tip * R);
    if (h && f) {
      const L = Math.hypot(f.point.z - h.point.z, f.point.y - h.point.y);
      const slope = Math.atan2(h.point.y - f.point.y, f.point.z - h.point.z);
      const t = FLAP.thick * R;
      const wb = (FLAP.back * R) / 2;
      const wf = (FLAP.front * R) / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-wb, 0);
      shape.lineTo(wb, 0);
      shape.lineTo(wf, L * 0.8);
      shape.quadraticCurveTo(wf * 0.55, L * 1.02, 0, L * 1.02);
      shape.quadraticCurveTo(-wf * 0.55, L * 1.02, -wf, L * 0.8);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: t * 0.35,
        bevelThickness: t * 0.35,
        curveSegments: 16,
        depth: t,
      });
      geo.rotateX(Math.PI / 2); // forme dans le plan xz, longueur vers +z
      geo.translate(0, t * 1.1, 0); // posée sur la surface, pas dedans
      // un ton à peine plus soutenu que le couvercle (0xf4f1ea), un peu plus
      // mat : le clapet se détache légèrement, ouvert comme fermé
      const flapMat = new THREE.MeshStandardMaterial({ color: 0xe5dfd3, metalness: 0, roughness: 0.55 });
      hinge = new THREE.Group();
      hinge.position.copy(toPivot(h.point));
      hinge.scale.setScalar(inv);
      flapRest = slope; // fermé : épouse la pente du dôme
      hinge.rotation.x = flapRest;
      hinge.add(new THREE.Mesh(geo, flapMat));
      pivot.add(hinge);

      // trous, posés sur le dôme sous le clapet
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x140906 });
      HOLE_ROWS.forEach((row) => {
        for (let i = 0; i < row.n; i++) {
          const x = cx + (i - (row.n - 1) / 2) * row.step * R;
          const hit = hitAt(x, h.point.z + row.z * (f.point.z - h.point.z));
          if (!hit) continue;
          const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
          const disc = new THREE.Mesh(new THREE.CircleGeometry(row.r * R * inv, 20), holeMat);
          disc.position.copy(toPivot(hit.point.clone().addScaledVector(n, 0.002)));
          disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
          disc.visible = false;
          pivot.add(disc);
          slots.push(disc);
          mouth.add(hit.point);
        }
      });
      if (slots.length) mouth.divideScalar(slots.length);
      pivot.worldToLocal(mouth);
    }
  }
  // ouverture totale : de la pente du dôme à FLAP_LIFT au-dessus de l'horizontale côté arrière
  const flapOpen = Math.PI - FLAP_LIFT + flapRest;
  return { bodyMat, flapOpen, flapRest, hinge, mouth, pivot, slots };
}

function loadLabel(THREE, renderer, key) {
  return new THREE.TextureLoader().loadAsync(LABELS[key]).then((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; // convention des UV glTF
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  });
}

// ── Vues « packshot » ─────────────────────────────────────────────────────
// Un seul moteur WebGL hors écran dessine toutes les boîtes de la page : chaque
// vue est un <canvas> 2D posé à la place d'une image, dans lequel on recopie le
// rendu. Cadrage d'un packshot : de face, la boîte occupe la hauteur du cadre.
let kit;
function getKit() {
  kit ??= (async () => {
    const libs = await loadThree();
    const { RoomEnvironment, THREE } = libs;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(1); // les vues gèrent elles-mêmes la densité
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setScissorTest(true);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-2, 4, 5);
    scene.add(key);
    // focale longue, comme un packshot : peu de perspective
    const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 100);
    const textures = {};
    const label = (k) => (textures[k] ??= loadLabel(THREE, renderer, k));
    const can = await buildCan(libs, await label('moulu'));
    scene.add(can.pivot);
    return { THREE, ...can, camera, label, renderer, scene, size: { h: 0, w: 0 } };
  })();
  return kit;
}

const views = new Set();
let raf = 0;
function schedule() {
  if (!raf) raf = requestAnimationFrame(flush);
}
async function flush() {
  raf = 0;
  const k = await getKit();
  views.forEach((v) => v.dirty && draw(k, v));
}

function draw(k, v) {
  const { canvas } = v;
  const dpr = Math.min(devicePixelRatio, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return;
  const key = v.label;
  if (!v.textures[key]) {
    // étiquette pas encore chargée : on redessinera à son arrivée (rangée sous
    // la clé demandée, l'étiquette de la vue ayant pu changer entre-temps)
    k.label(key).then((t) => {
      v.textures[key] = t;
      v.invalidate();
    });
    return;
  }
  v.dirty = false;
  if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { height: h, width: w });
  // tampon WebGL agrandi au besoin, puis rendu dans son coin bas gauche
  if (k.size.w < w || k.size.h < h) {
    k.size = { h: Math.max(h, k.size.h), w: Math.max(w, k.size.w) };
    k.renderer.setSize(k.size.w, k.size.h, false);
  }
  k.renderer.setViewport(0, 0, w, h);
  k.renderer.setScissor(0, 0, w, h);
  k.camera.aspect = w / h;
  // boîte (2 unités de haut) à 94 % de la hauteur de l'emplacement d'origine ;
  // le canevas déborde de `pad` en haut et en bas pour qu'une boîte inclinée
  // ne soit pas coupée
  const dist = (1.06 * (1 + 2 * v.pad)) / Math.tan((k.camera.fov / 2) * (Math.PI / 180));
  k.camera.position.set(0, dist * Math.sin(v.pitch), dist * Math.cos(v.pitch));
  k.camera.lookAt(0, 0, 0);
  k.camera.updateProjectionMatrix();
  k.bodyMat.map = v.textures[key];
  // inclinaison appliquée après le pivotement : autour de l'horizontale de l'écran
  k.pivot.rotation.set(v.tilt, v.yaw + v.grab, 0);
  // clapet (0 fermé → 1 ouvert) ; fente visible dès qu'il se lève
  if (k.hinge) k.hinge.rotation.x = k.flapRest - k.flapOpen * v.lid;
  k.slots.forEach((m) => (m.visible = v.lid > 0.02));
  k.renderer.clear();
  k.renderer.render(k.scene, k.camera);
  const ctx = (v.ctx ??= canvas.getContext('2d'));
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(k.renderer.domElement, 0, k.size.h - h, w, h, 0, 0, w, h);
  // position de l'ouverture à l'écran, en px CSS dans le canevas
  k.pivot.updateMatrixWorld(true);
  const m = k.mouth.clone().applyMatrix4(k.pivot.matrixWorld).project(k.camera);
  v.mouth = { x: ((m.x + 1) / 2) * canvas.clientWidth, y: ((1 - m.y) / 2) * canvas.clientHeight };
  v.onDraw?.();
}

// Crée une vue dans `canvas`. Modifier label / yaw / pitch puis appeler
// invalidate() pour redessiner (au prochain rafraîchissement). `grab` est la
// rotation ajoutée à la main (voir grabbable), qui s'additionne à `yaw` ;
// `tilt` incline la boîte vers l'avant (couvercle) ou l'arrière (dessous) ;
// `pitch` élève la caméra (≈ 1,2 : vue du dessus) ; `lid` ouvre le clapet
// (0 → 1). Après chaque rendu, `mouth` donne la position de l'ouverture.
// `pad` : débord vertical du canevas autour de l'emplacement (part de sa
// hauteur, de chaque côté), à accorder avec le CSS (inset).
export function createCanView(canvas, { label = 'moulu', onDraw, pad = 0.14, pitch = 0.06, yaw = 0 } = {}) {
  const v = {
    canvas,
    dirty: true,
    grab: 0,
    lid: 0,
    mouth: null,
    tilt: 0,
    invalidate() {
      v.dirty = true;
      schedule();
    },
    label,
    onDraw,
    pad,
    pitch,
    textures: {},
    yaw,
  };
  views.add(v);
  new ResizeObserver(() => v.invalidate()).observe(canvas);
  v.invalidate();
  return v;
}

// Précharge three.js, le modèle et les étiquettes demandées.
export function preloadCans(keys = []) {
  return getKit().then((k) => Promise.all(keys.map((key) => k.label(key))));
}

// Fait tourner la boîte de `view` en l'attrapant dans `el` : glisser
// horizontal = rotation, avec un élan au lâcher ; glisser vertical =
// inclinaison (couvercle ou dessous), limitée, qui revient d'aplomb au lâcher.
// Sur écran tactile, le défilement vertical reste à la page (touch-action:
// pan-y) : seule la rotation y est possible. Renvoie un état
// { dragging, moved } que l'appelant peut consulter (ex. annuler un clic).
const TILT = [-0.5, 0.55]; // radians : dessous / couvercle
export function grabbable(el, view) {
  const state = { dragging: false, moved: false };
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let vel = 0; // radians par ms
  el.style.touchAction = 'pan-y';
  el.style.cursor = 'grab';
  el.style.userSelect = 'none'; // pas de sélection de texte en tirant
  el.addEventListener('dragstart', (e) => e.preventDefault());
  const perPx = () => Math.PI / Math.max(el.clientWidth, 1); // une largeur = un demi-tour
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // ni sélection ni glisser natif du lien
    getSelection()?.removeAllRanges();
    gsap.killTweensOf(view, 'grab,tilt');
    Object.assign(state, { dragging: true, moved: false });
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = e.timeStamp;
    vel = 0;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    state.moved ||= Math.abs(dx) > 2 || Math.abs(dy) > 2;
    const dt = Math.max(e.timeStamp - lastT, 1);
    view.grab += dx * perPx();
    // vers le bas : le haut de la boîte vient vers nous (couvercle visible)
    view.tilt = gsap.utils.clamp(TILT[0], TILT[1], view.tilt + dy * perPx() * 0.7);
    lastY = e.clientY;
    vel = vel * 0.6 + ((dx * perPx()) / dt) * 0.4;
    lastX = e.clientX;
    lastT = e.timeStamp;
    view.invalidate();
  });
  const end = () => {
    if (!state.dragging) return;
    state.dragging = false;
    el.style.cursor = 'grab';
    // élan : la boîte continue sur sa lancée puis ralentit
    gsap.to(view, {
      duration: 1.4,
      ease: 'power3.out',
      grab: view.grab + gsap.utils.clamp(-6, 6, vel * 450),
      onUpdate: () => view.invalidate(),
    });
    // retour d'aplomb, avec un léger rebond
    gsap.to(view, { duration: 1.2, ease: 'elastic.out(1, 0.55)', onUpdate: () => view.invalidate(), tilt: 0 });
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return state;
}

