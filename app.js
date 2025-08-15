import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* -------------------- Config -------------------- */
const CONFIG = {
  radius: 42,
  photoWidth: 12,
  photoHeight: 8,
  baseSpin: 0.05,           // idle spin (rad/sec)
  scrollSpinScale: 0.00035, // wheel delta -> velocity when over ring
  dragSpinScale: 0.0025,    // pixels -> angular velocity while dragging
  flingScale: 0.0008,       // px/sec -> extra angular velocity on release
  maxSpinVel: 2.5,          // clamp so it never gets too crazy
  damping: 0.92,
  focusScale: 1.8,
  adjacentFactor: 0.7,
  influenceNeighbors: 10,   // number of neighbors influenced on each side
  scaleLerp: 18,            // per-second lerp speed for smooth scaling
  grayLift: 0.35,           // lift unfocused images toward white
  colorLerp: 28,            // per-second lerp speed for saturation/lift easing
  gapAngle: 0
};

const HOLD_MS = 350; // press & hold to pause on touch

// Replace with your own gallery if you want
const IMAGE_URLS = Array.from({length: 48}, (_, i) => `https://picsum.photos/seed/gamaAsti${i}/1200/800`);

/* -------------------- DOM refs -------------------- */
const app = document.getElementById('app');
const gate = document.getElementById('gate');
const overlay = document.getElementById('fadeOverlay');
const lightbox = document.getElementById('lightbox');
const lightImg = document.getElementById('lightImg');
const lightCaption = document.getElementById('lightCaption');
const phaseTitle = document.getElementById('phaseTitle');
const phaseText = document.getElementById('phaseText');
const phaseBar = document.getElementById('phaseBar');

/* -------------------- Three.js setup -------------------- */
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xffffff, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, 110);
scene.add(camera);

scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 0.25);
dir.position.set(10,20,10);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.target.set(0,0,0);
controls.minDistance = 40;
controls.maxDistance = 180;
controls.minPolarAngle = 0.2*Math.PI;
controls.maxPolarAngle = 0.8*Math.PI;

/* -------------------- Carousel -------------------- */
const carousel = new THREE.Group();
scene.add(carousel);

const loader = new THREE.TextureLoader();
loader.crossOrigin = '';

function makeSaturationMaterial(){
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      // targets (destinations)
      uSaturation: { value: 1.0 },
      uLift: { value: 0.0 },
      // eased, visual values
      uSatCurrent: { value: 1.0 },
      uLiftCurrent: { value: 0.0 },
      opacity: { value: 1.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float uSaturation;
      uniform float uLift;
      uniform float uSatCurrent;
      uniform float uLiftCurrent;
      uniform float opacity;
      varying vec2 vUv;
      void main(){
        vec4 tex = texture2D(map, vUv);
        float gray = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 saturated = mix(vec3(gray), tex.rgb, clamp(uSatCurrent, 0.0, 1.0));
        vec3 lifted = mix(saturated, vec3(1.0), clamp(uLiftCurrent, 0.0, 1.0));
        gl_FragColor = vec4(lifted, tex.a * opacity);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true
  });
}

const planeGeo = new THREE.PlaneGeometry(CONFIG.photoWidth, CONFIG.photoHeight, 1, 1);

const N = IMAGE_URLS.length;
const angleStep = (Math.PI*2 + CONFIG.gapAngle) / N;

for (let i=0; i<N; i++){
  const angle = i * angleStep;
  const x = Math.sin(angle) * CONFIG.radius;
  const z = Math.cos(angle) * CONFIG.radius;

  const mat = makeSaturationMaterial();
  const m = new THREE.Mesh(planeGeo, mat);
  m.position.set(x, 0, z);
  // Align WIDTH (+X) toward the center; plane normal becomes tangential
  m.lookAt(0, 0, 0);      // -Z to center
  m.rotateY(-Math.PI/2);  // +X to center
  m.userData.defaultScale = 1;
  m.userData.angle0 = angle;
  m.userData.idx = i;
  m.userData.targetScale = 1;

  loader.load(IMAGE_URLS[i], tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    mat.uniforms.map.value = tex; mat.needsUpdate = true;
  });

  carousel.add(m);
}

/* -------------------- Helpers -------------------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

function ringDistance(a,b){ const diff = Math.abs(a-b); return Math.min(diff, N - diff); }
function angleOfMesh(m){ return m.userData.angle0 + carousel.rotation.y; }
function screenXAtAngle(angle){
  const pos = new THREE.Vector3(Math.sin(angle)*CONFIG.radius, 0, Math.cos(angle)*CONFIG.radius);
  const p = pos.clone().project(camera);
  return (p.x*0.5 + 0.5) * window.innerWidth;
}
function defaultPixelsPerRad(){
  const a = carousel.rotation.y;
  const eps = 0.0005;
  return (screenXAtAngle(a+eps) - screenXAtAngle(a-eps)) / (2*eps) || (window.innerWidth/(Math.PI*2));
}
let pixelsPerRad = 300;
function updatePixelsPerRadForMesh(m){
  const a = angleOfMesh(m);
  const eps = 0.0005;
  let ppr = (screenXAtAngle(a+eps)-screenXAtAngle(a-eps))/(2*eps);
  if(!isFinite(ppr) || Math.abs(ppr)<1e-2) ppr = defaultPixelsPerRad();
  pixelsPerRad = ppr;
  return ppr;
}

/* -------------------- Scale & color fields -------------------- */
function applyScaleFieldSmooth(centerIdx){
  const R = Math.max(1, CONFIG.influenceNeighbors|0);
  const focus = CONFIG.focusScale;
  // Heavy-tailed falloff g(d)=1/(1+(d/k)^p), g(0)=1
  const g1 = Math.max(0, Math.min(1, (focus*CONFIG.adjacentFactor - 1) / (focus - 1)));
  const p = 2.0;
  const k = Math.pow(1 / ((1 / Math.max(1e-6, g1)) - 1), 1/p);
  for(let i=0;i<N;i++){
    const m = carousel.children[i];
    let s = 1;
    if(centerIdx != null){
      const d = ringDistance(i, centerIdx);
      const r = Math.min(d, R);
      const g = 1.0 / (1.0 + Math.pow(r / k, p));
      s = 1 + (focus - 1) * g;
    }
    m.userData.targetScale = s;
  }
}

function applySaturation(centerIdx){
  for(let i=0;i<N;i++){
    const mesh = carousel.children[i];
    const isFocus = (centerIdx != null && i === centerIdx);
    const sat = (centerIdx == null) ? 1.0 : (isFocus ? 1.0 : 0.0);
    const lift = (centerIdx == null) ? 0.0 : (isFocus ? 0.0 : CONFIG.grayLift);
    if(mesh.material && mesh.material.uniforms){
      if(mesh.material.uniforms.uSaturation) mesh.material.uniforms.uSaturation.value = sat;
      if(mesh.material.uniforms.uLift) mesh.material.uniforms.uLift.value = lift;
    }
  }
}
applySaturation(null);

/* -------------------- Interaction -------------------- */
let spinVel = 0;
let isFrozen = false;

let hovered = null;
let pointerOverRing = false;

let draggingSpin = false;
let mayDrag = false;
let lastX = 0;
let dragStartX = 0, dragStartY = 0;
let lastMoveT = 0;
let dragVelocity = 0;
let grabbed = null;

let holdTimer = null;
let holdActive = false;
let holdIndex = null;
let suppressClickOpen = false;

function clearHold(){ if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; } }
function endHold(){ if(holdActive){ holdActive=false; isFrozen=false; } }
function clampSpin(){ const m = CONFIG.maxSpinVel; if(m>0){ spinVel = Math.max(-m, Math.min(m, spinVel)); } }
function applyFling(pxPerSec){ const ppr = defaultPixelsPerRad(); spinVel += (pxPerSec / ppr); clampSpin(); }
function applyFlingRad(radPerSec){ spinVel += radPerSec; clampSpin(); }

function intersectAt(clientX, clientY){
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(carousel.children, false);
}

function setHovered(obj){
  hovered = obj;
  pointerOverRing = !!hovered;

  let centerIdx = null;
  if(draggingSpin && grabbed){ centerIdx = grabbed.userData.idx; }
  else if(holdActive && holdIndex != null){ centerIdx = holdIndex; }
  else if(hovered){ centerIdx = hovered.userData.idx; }

  applyScaleFieldSmooth(centerIdx);
  applySaturation(centerIdx);

  if(!draggingSpin && !holdActive){ isFrozen = !!hovered; }
}

renderer.domElement.addEventListener('pointermove', (e)=>{
  const hits = intersectAt(e.clientX, e.clientY);
  setHovered(hits.length ? hits[0].object : null);

  const now = performance.now();
  const movedEnough = (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 6);

  if(mayDrag && !draggingSpin && movedEnough){
    draggingSpin = true; controls.enabled = false; clearHold(); endHold();
    if(grabbed) applyScaleFieldSmooth(grabbed.userData.idx);
    applySaturation(grabbed.userData.idx);
  }

  if(draggingSpin && grabbed){
    const dx = e.clientX - lastX;
    const dt = Math.max(0.001, (now - lastMoveT) / 1000);
    const instV = dx / dt; // px/sec
    dragVelocity = THREE.MathUtils.lerp(dragVelocity, instV, 0.25);

    updatePixelsPerRadForMesh(grabbed);
    const dAngle = dx / pixelsPerRad;
    carousel.rotation.y += dAngle;
    clampSpin();
    lastX = e.clientX;
    lastMoveT = now;
    isFrozen = false;
    applyScaleFieldSmooth(grabbed.userData.idx);
    applySaturation(grabbed.userData.idx);
    e.preventDefault();
  }
}, { passive: false });

renderer.domElement.addEventListener('wheel', (e)=>{
  if(pointerOverRing){
    spinVel += -e.deltaY * CONFIG.scrollSpinScale;
    e.preventDefault();
  }
}, { passive: false });

renderer.domElement.addEventListener('pointerdown', (e)=>{
  const hits = intersectAt(e.clientX, e.clientY);
  mayDrag = hits.length>0;
  grabbed = mayDrag ? hits[0].object : null;
  if(grabbed) updatePixelsPerRadForMesh(grabbed);
  lastX = e.clientX; dragStartX = e.clientX; dragStartY = e.clientY; lastMoveT = performance.now(); dragVelocity = 0;

  if(mayDrag){
    try{ renderer.domElement.setPointerCapture(e.pointerId); }catch{}
    if(e.pointerType === 'touch' || e.pointerType === 'pen'){
      clearHold(); holdIndex = grabbed ? grabbed.userData.idx : (hovered ? hovered.userData.idx : null);
      holdTimer = setTimeout(()=>{ if(!draggingSpin && mayDrag){ isFrozen = true; holdActive = true; applyScaleFieldSmooth(holdIndex); applySaturation(holdIndex); } }, HOLD_MS);
    }
  }
});

function finishPointer(e, doFling){
  if(draggingSpin){
    if(doFling){
      const radPerSec = dragVelocity / (pixelsPerRad || defaultPixelsPerRad());
      applyFlingRad(radPerSec);
    }
    if(e) e.preventDefault();
  }
  controls.enabled = true;
  draggingSpin = false; mayDrag = false; dragVelocity = 0; grabbed = null;
  clearHold(); endHold(); holdIndex = null;
  applyScaleFieldSmooth(hovered ? hovered.userData.idx : null);
  applySaturation(hovered ? hovered.userData.idx : null);
  if(e){ try{ renderer.domElement.releasePointerCapture(e.pointerId); }catch{} }
}
renderer.domElement.addEventListener('pointerup', (e)=>{
  const moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 6;
  suppressClickOpen = draggingSpin || moved;
  finishPointer(e, true);
});
renderer.domElement.addEventListener('pointercancel', (e)=>{ suppressClickOpen = true; finishPointer(e, false); });

/* -------------------- Resize -------------------- */
function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

/* -------------------- Animate -------------------- */
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

  if(!isFrozen){
    carousel.rotation.y += (CONFIG.baseSpin + spinVel) * dt;
  } else {
    spinVel *= 0.85;
  }
  spinVel *= CONFIG.damping; clampSpin();

  // Ease scales
  for(const m of carousel.children){
    const target = (m.userData && m.userData.targetScale) ? m.userData.targetScale : 1;
    const curr = m.scale.x;
    const t = Math.min(1, CONFIG.scaleLerp * dt);
    const next = curr + (target - curr) * t;
    if(Math.abs(next - curr) > 1e-4) m.scale.setScalar(next);
  }

  // Ease saturation/lift
  for(const m of carousel.children){
    const u = m.material?.uniforms;
    if(!u) continue;
    const tC = Math.min(1, CONFIG.colorLerp * dt);
    if(u.uSatCurrent && u.uSaturation){
      const curr = u.uSatCurrent.value, dst = u.uSaturation.value;
      u.uSatCurrent.value = curr + (dst - curr) * tC;
    }
    if(u.uLiftCurrent && u.uLift){
      const curr = u.uLiftCurrent.value, dst = u.uLift.value;
      u.uLiftCurrent.value = curr + (dst - curr) * tC;
    }
  }

  controls.update();
  renderer.render(scene, camera);

  // keep the phase bar placed nicely
  updatePhaseBarPosition(computeFrontIndex());
}
animate();

/* -------------------- Phase logic -------------------- */
function phaseShortCaption(){
  const s = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    'Nulla porttitor accumsan tincidunt.'
  ];
  const n = 1 + Math.floor(Math.random()*2);
  let out = [];
  for(let i=0;i<n;i++) out.push(s[Math.floor(Math.random()*s.length)]);
  return out.join(' ');
}
function loremPara(){ return phaseShortCaption(); }

let phaseIndex = 1, lastFrontIdx = -1;
function updatePhase(frontIdx){
  if(frontIdx === lastFrontIdx) return;
  lastFrontIdx = frontIdx;
  phaseIndex = (phaseIndex % 6) + 1;
  phaseTitle.textContent = `Phase ${phaseIndex}`;
  phaseText.textContent = loremPara();
}

// Which image is front-most (max world Z)
function computeFrontIndex(){
  let best = 0, bestZ = -Infinity;
  for(let i=0;i<N;i++){
    const a = carousel.children[i].userData.angle0 + carousel.rotation.y;
    const z = Math.cos(a) * CONFIG.radius; // camera looks from +Z
    if(z > bestZ){ bestZ = z; best = i; }
  }
  return best;
}

// Place phase bar midway between ring bottom and footer top
function updatePhaseBarPosition(frontIdx){
  if(frontIdx == null) frontIdx = computeFrontIndex();
  const m = carousel.children[frontIdx]; if(!m) return;

  const bottomLocal = new THREE.Vector3(0, -CONFIG.photoHeight*0.5*m.scale.y, 0);
  const worldBottom = m.localToWorld(bottomLocal.clone());
  const ndc = worldBottom.clone().project(camera);
  const ringBottomY = (-ndc.y * 0.5 + 0.5) * window.innerHeight;

  const hintEl = document.getElementById('hint');
  const copyEl = document.getElementById('copyright');
  const footTop = Math.min(hintEl.getBoundingClientRect().top, copyEl.getBoundingClientRect().top);

  const mid = Math.round(ringBottomY + (footTop - ringBottomY) * 0.5);
  phaseBar.style.top = mid + 'px';
  phaseBar.style.bottom = 'auto';
}

// init once and also poll (lightly)
updatePhase(computeFrontIndex());
setInterval(()=>{ const idx = computeFrontIndex(); updatePhase(idx); }, 200);

/* -------------------- Lightbox -------------------- */
function randomCaption(){
  const sentences = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Curabitur non nulla sit amet nisl tempus convallis quis ac lectus.',
    'Praesent sapien massa, convallis a pellentesque nec, egestas non nisi.',
    'Nulla porttitor accumsan tincidunt.'
  ];
  const n = 4 + Math.floor(Math.random()*3);
  const picks = [sentences[0]];
  for(let i=1;i<n;i++) picks.push(sentences[1 + Math.floor(Math.random()*(sentences.length-1))]);
  return picks.join(' ');
}

let lightOpen = false;
function openLightboxForMesh(mesh){
  if(!mesh || lightOpen) return;
  let src = null;
  let cap = randomCaption();

  const tex = mesh.material?.uniforms?.map?.value;
  if(tex?.image?.src) src = tex.image.src;
  if(!src && typeof mesh.userData.idx === 'number') src = IMAGE_URLS[mesh.userData.idx];
  if(!src) return;

  lightImg.src = src;
  lightCaption.textContent = cap;
  overlay.classList.add('visible');
  lightbox.classList.add('visible');
  lightOpen = true;
  isFrozen = true;
}
function closeLightbox(){
  if(!lightOpen) return;
  overlay.classList.remove('visible'); lightbox.classList.remove('visible');
  try{ lightImg.removeAttribute('src'); }catch{}
  lightOpen = false; isFrozen = false;
}
overlay.addEventListener('click', closeLightbox);
window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeLightbox(); });

// Open only on real click (not drag/hold)
renderer.domElement.addEventListener('click', (e)=>{
  if(suppressClickOpen || draggingSpin || holdActive){ suppressClickOpen = false; return; }
  const hits = intersectAt(e.clientX, e.clientY);
  if(hits.length) openLightboxForMesh(hits[0].object);
});

/* -------------------- Gate -------------------- */
gate.addEventListener('click', ()=>{ gate.classList.add('hidden'); });

/* -------------------- Console self-checks (no UI) -------------------- */
(function selfChecks(){
  try{
    console.assert(typeof THREE !== 'undefined', 'THREE present');
    console.assert(carousel.children.length === IMAGE_URLS.length, 'all images added');
    console.assert(document.fonts, 'font loading API present');
  }catch(_){}
})();
