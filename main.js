import { OrbitControls } from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import * as THREE from 'three';

//GLOBALS------------------------
//Long press
let heldIndex = -1; 

//Vectors for front facing detection
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();


//Pop Out Tap Helper
let holdEngaged = false;

//Create the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

//pointer handler fix
renderer.domElement.addEventListener("pointerdown", e => {
  if (!e.isPrimary) return;
  // ... your hold/drag start logic
});
renderer.domElement.addEventListener("pointermove", e => {
  if (!e.isPrimary) return;
  // ... your move logic
});
renderer.domElement.addEventListener("pointerup", e => {
  if (!e.isPrimary) return;
  // ... your end logic
});
renderer.domElement.addEventListener("pointerleave", e => {
  if (!e.isPrimary) return;
  // ... end logic
});
renderer.domElement.addEventListener("pointercancel", e => {
  if (!e.isPrimary) return;
  // ... end logic
});

//canvas stop triggering gesture
renderer.domElement.style.touchAction = "none"; 

//Monkey-patch the release to be safe (prevents the exception spam)
const el = renderer.domElement;
const nativeRelease = el.releasePointerCapture?.bind(el);
if (nativeRelease && el.hasPointerCapture) {
  el.releasePointerCapture = (id) => {
    // only release if this element actually holds that id
    if (el.hasPointerCapture(id)) nativeRelease(id);
  };
}


//set an opaque clear so you can tell it’s there even before we render anything
renderer.setClearColor(0xfefaef, 1);

//Put the canvas in the page
document.getElementById("app").appendChild(renderer.domElement);


//Keep it sized on resize
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
});



//RAYCASTER FOR HOVER -------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveringPhoto = false;

function setPointerFromEvent(e){
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left)/r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top)/r.height) * 2 + 1;
}

renderer.domElement.addEventListener("pointermove", e => {
  setPointerFromEvent(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(carousel.children, false);
  hoveringPhoto = hits.length > 0;
});

renderer.domElement.addEventListener("pointerleave", () => hoveringPhoto = false);




//TAP & HOLD HOVER HELPER -----------------------
//Global
let holdPaused = false;       // true only while a long-press is active
let holdActive = false;
let holdTimer  = 0;
let holdX = 0, holdY = 0, holdMoved = 0;

const HOLD_MS = 100;          // press duration to count as "hold"
const HOLD_MOVE_TOL = 10;      // pixels of wiggle allowed before it's a drag

//point listener
// helpful on touch
renderer.domElement.style.touchAction = "none";

renderer.domElement.addEventListener("pointerdown", e => {
  holdActive = true;
  holdPaused = false;
  holdX = e.clientX; holdY = e.clientY; holdMoved = 0;

  clearTimeout(holdTimer);
  const startX = e.clientX, startY = e.clientY;

  holdTimer = setTimeout(() => {
    if (!holdActive) return;
    // check we’re still basically on a tile
    const r = renderer.domElement.getBoundingClientRect();
    const px = ((startX - r.left) / r.width) * 2 - 1;
    const py = -((startY - r.top) / r.height) * 2 + 1;
    pointer.set(px, py);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(carousel.children, false)[0];

    if (hit && holdMoved < HOLD_MOVE_TOL) {
      holdPaused = true;      // long-press engaged
      heldIndex = hit.object.userData.index;  // <— remember the tile when held
      holdEngaged = true;
      updateTargets();
    }
  }, HOLD_MS);
});

renderer.domElement.addEventListener("pointermove", e => {
  if (!holdActive) return;
  holdMoved += Math.abs(e.clientX - holdX) + Math.abs(e.clientY - holdY);
  holdX = e.clientX; holdY = e.clientY;

  // if they start dragging, cancel the hold attempt
  if (holdMoved > HOLD_MOVE_TOL) {
    clearTimeout(holdTimer);
    holdPaused = false;
  }
});

function endHold(){
  holdActive = false;
  clearTimeout(holdTimer);
  holdPaused = false;         // resume on release
  heldIndex = -1;
  updateTargets();
  holdEngaged = false;

}
renderer.domElement.addEventListener("pointerup", endHold);
renderer.domElement.addEventListener("pointerleave", endHold);
renderer.domElement.addEventListener("pointercancel", endHold);




//2. SCENE AND CAMERA SETUP -----------------------
// Adding Scene & persepective camera
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 3, 10);

//Render loop -- Updated to part 7.Gentle Spin
/*function tick(){
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
*/

//Resize handler
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});




//3. Texture Loader (Basic Photo)-----------------------
// Texture
const loader = new THREE.TextureLoader();
const TARGET_ASPECT = 1.8 / 1.2; // plane width / height

//Fixed Aspect Cover Texture Loader
function loadCoverTexture(url, targetAspect = TARGET_ASPECT){
  const tex = loader.load(url, t => {
    const img = t.image;
    if (!img || !img.width) return; // still loading

    const a = img.width / img.height; // image aspect
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    if (a >= targetAspect) {
      // Image is wider than the tile: crop left/right
      t.repeat.set(targetAspect / a, 1);
      t.offset.set((1 - t.repeat.x) * 0.5, 0);
    } else {
      // Image is taller/narrower: crop top/bottom
      t.repeat.set(1, a / targetAspect);
      t.offset.set(0, (1 - t.repeat.y) * 0.5);
    }

    t.needsUpdate = true;
  });
  return tex;
}



//4. CAMERA CONTROLS -----------------------
//Camera Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;      // keeps things centered; we don’t need pan
controls.enableDamping = true;   // smooth motion
controls.dampingFactor = 0.08;   // small but noticeable
controls.minDistance = 3.5;      // zoom limits so you don’t lick the pixels
controls.maxDistance = 12;

//Update controls each frame
controls.target.set(0, 0, 0);
controls.update();



//5. THE CAROUSEL -----------------------
// Ring params
const TILE_W = 1, TILE_H = 1;
const RADIUS  = 3.0;

// Use multiple images if you have them; duplicate the same file if you don't.
const IMAGE_URLS = [
  "assets/photo.png","assets/photo2.png","assets/photo.png","assets/photo.png","assets/photo.png","assets/photo2.png","assets/photo3.png","assets/photo.png","assets/photo.png","assets/photo.png2","assets/photo.png","assets/photo.png","assets/photo2.png","assets/photo2.png","assets/photo3.png","assets/photo2.png","assets/photo3.png","assets/photo.png","assets/photo3.png","assets/photo.png",];

//Group to hold the tiles
const carousel = new THREE.Group();
scene.add(carousel);

//Creating Sub-Group
const GROUPS = 4;                              
const N = IMAGE_URLS.length;                  
const GROUP_SIZE = N / GROUPS;
const CAPTIONS = Array.from({ length: GROUPS }, (_, i) => `Phase ${i+1}`);

//What index is most front-facing?
function frontTileIndex(){
  // Return the index of the tile most front-facing
  let bestIdx = 0, bestScore = -1e9;
  const n = carousel.children.length;
  for (let i = 0; i < n; i++){
    const mesh = carousel.children[i];
    // local angle around the ring + current carousel yaw
    const ang = Math.atan2(mesh.position.x, mesh.position.z) + carousel.rotation.y;
    const facing = Math.cos(ang); // 1 when directly in front
    if (facing > bestScore){ bestScore = facing; bestIdx = i; }
  }
  return bestIdx;
}

let currentCaptionGroup = -1;

function updateCaption(){
  let group;

  // If you're holding a tile, treat *that* group as the active caption.
  if (holdPaused && heldIndex >= 0){
    group = Math.floor(heldIndex / GROUP_SIZE);
  } else {
    const idx = frontTileIndex();
    group = Math.floor(idx / GROUP_SIZE);
  }

  if (group !== currentCaptionGroup){
    currentCaptionGroup = group;
    const el = document.getElementById("groupCaption");
    el.textContent = CAPTIONS[group] ?? `Phase ${group+1}`;
  }
}
updateCaption();




//Shared geometry for all tiles
const tileGeo = new THREE.PlaneGeometry(TILE_W, TILE_H);

//Tiny Shader for desaturation effect
const fx = {
  uniforms: () => ({ map: { value: null }, uSat: { value: 1.0 } }),
  vert: /* glsl */`
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }`,
  frag: /* glsl */`
    uniform sampler2D map;
    uniform float uSat;
    varying vec2 vUv;
    vec3 toGray(vec3 c){ float y = dot(c, vec3(0.2126,0.7152,0.0722)); return vec3(y); }
    void main(){
      vec4 t = texture2D(map, vUv);
      vec3 g = toGray(t.rgb);
      vec3 outc = mix(g, t.rgb, uSat);
      gl_FragColor = vec4(outc, t.a);
    }`
};

//Create tiles in a circle facing inward
for (let i = 0; i < IMAGE_URLS.length; i++){
  const t = i / IMAGE_URLS.length;
  const angle = t * Math.PI * 2;

  const x = Math.sin(angle) * RADIUS;
  const z = Math.cos(angle) * RADIUS;

  // Material with texture
  const tex = loader.load(IMAGE_URLS[i]);

  //Desaturation shader material
  const mat = new THREE.ShaderMaterial(
    { uniforms: fx.uniforms(),
      vertexShader: fx.vert,
      fragmentShader: fx.frag,
      transparent: true,
      side: THREE.DoubleSide
    }
  );
  mat.uniforms.map.value = tex;

  const amb = new THREE.AmbientLight(0xffffff, 0.2);
  const dir = new THREE.DirectionalLight(0xffffff, 0.1);
  dir.position.set(2, 2, 10);
  scene.add(amb, dir);

  const tile = new THREE.Mesh(tileGeo, mat);
  
  // Position & orient the tile
  tile.position.set(x, 0, z);
  tile.lookAt(0, 0, 0);   // make the tile face the center
  tile.rotateY(Math.PI);  // correct its left-right orientation
  tile.rotateY(Math.PI / 2);  // +90° so each tile is tangent, i.e., edge-on at the front

  carousel.add(tile);

  // Custom data for each tile
  const idx = i;                                 // index around the ring
  const group = Math.floor(idx / GROUP_SIZE);    // 0,1,2
  tile.userData = {
    index: idx,
    group,
    scaleTarget: 1,
    satTarget: 1
  };

}


//INTERACTION -----------------------
//GENTLE SPIN, DAMPING & HOVER STOP
const baseSpin  = 0.0010; // idle
let   extraSpin = 0.050;  // fling kick
const damping   = 0.95;   // decay for the kick

//ease
const SCALE_LERP = 18;   // higher = snappier
const COLOR_LERP = 14;
const clock = new THREE.Clock();

function tick(){
  const dt = Math.min(0.05, clock.getDelta());       // stable, capped delta
  const paused = holdPaused || hoveringPhoto;

  if (!paused){
    carousel.rotation.y += baseSpin + extraSpin;
    extraSpin *= damping;
  } else {
    // Optional: bleed fling while held so it settles sooner
    extraSpin *= 0.90;
  }

  // Smoothly move toward targets
  const kS = 1 - Math.exp(-SCALE_LERP * dt);
  const kC = 1 - Math.exp(-COLOR_LERP * dt);

  for (const mesh of carousel.children){
    const tScale = mesh.userData.scaleTarget;
    const s = mesh.scale.x + (tScale - mesh.scale.x) * kS;
    mesh.scale.setScalar(s);

    const tSat = mesh.userData.satTarget;
    const u = mesh.material.uniforms;
    u.uSat.value += (tSat - u.uSat.value) * kC;
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
updateCaption();



//9. SCALE & SATURATION EFFECTS -----------------------
//Helpers compute targets for scale and saturation
function ringDistance(a, b, n){
  const d = Math.abs(a - b);
  return Math.min(d, n - d);
}

function updateTargets(){
  const active = holdPaused && heldIndex >= 0;

  for (const mesh of carousel.children){
    const data = mesh.userData;

    if (!active){
      data.scaleTarget = 1.0;
      data.satTarget   = 1.0;
      continue;
    }

    const heldGroup  = Math.floor(heldIndex / GROUP_SIZE);

    // 1) Desaturate other groups
    data.satTarget = (data.group === heldGroup) ? 1.0 : 0.0;

    // 2) Scale based on circular distance from the held tile
    const dist       = ringDistance(data.index, heldIndex, N);
    const maxReach   = 3.0;              // how many neighbors get noticeable boost
    const influence  = Math.max(0, 1 - dist / maxReach);
    const peakScale  = 1.5;              // held tile max
    const curvePower = 1.25;             // softness of falloff

    data.scaleTarget = 1 + (peakScale - 1) * Math.pow(influence, curvePower);
  }
}
updateTargets()


let _capT = 0;
function updateCaptionDebounced(){
  const now = performance.now();
  if (now - _capT > 150){ _capT = now; updateCaption(); }
}
updateCaptionDebounced()