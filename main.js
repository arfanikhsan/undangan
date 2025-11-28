// ===== [SECTION] IMPORTS =====
import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";


// ===== [SECTION] RENDERER & DOM =====
const app = document.getElementById("app"); 
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;


let canvasWidth  = app.clientWidth;
let canvasHeight = app.clientHeight;
renderer.setSize(canvasWidth, canvasHeight);
app.appendChild(renderer.domElement); 

/**
 * [RESPONSIVE] Handle window resize: update renderer & camera aspect.
 */
function onResize() {
  canvasWidth  = app.clientWidth;
  canvasHeight = app.clientHeight;

  renderer.setSize(canvasWidth, canvasHeight);
  camera.aspect = canvasWidth / canvasHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);






// SCENE + CAMERA +LIGHT =========================================================================================================
// ===== [SECTION] SCENE & CAMERA =====
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  65, //FOV
  canvasWidth/canvasHeight,  //Scene aspect
  0.1, //Near clipping
  200); //Far clipping
camera.position.set(0, 20, 0);
onResize(); 

// ===== [SECTION] LIGHTING =====
const amb = new THREE.AmbientLight(0xffffff, 0.7);
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(2, 3, 2);
scene.add(amb, dir);




// GLOBAL STATE =========================================================================================================
// ===== [SECTION] STATE & HELPERS =====
//# Region Orbit Helper
const clock = new THREE.Clock();
const controls = new OrbitControls(camera, renderer.domElement);


//#region Carousel group
const carousel = new THREE.Group();
scene.add(carousel);

//#region Spin state
let spinImpulse = 0;      
let spinBase   = 0.001; 
const damping    = 0.99;

//#region  camera animaion helper
let isCameraAnimating = false;
let camStartTime = 0;
const camDuration = 3000;
let camStart = new THREE.Vector3();
let camEnd   = new THREE.Vector3(0, 0, 9);

//#region Raycaster
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

//#region Spin freeze flag
let isSpinFrozen = false;

//#region cards
let focusedCard = null;
const cards = [];

//Fade state
let fadeActive = false;
let fadeStartTime = 0;
const fadeDuration = 100; // ms
let fadeDirection = null





// ===== [SECTION] ANIMATION LOOP =====
/**
 * [LOOP] Main render loop:
 * 1) Update camera animation
 * 2) Apply spin damping & base spin (unless frozen)
 * 3) Update card transforms (spin / focus)
 * 4) Update orbit controls
 * 5) Render scene
 */
function tick(){
  const dt = clock.getDelta();

  // [CAMERA ANIM]
  if (isCameraAnimating) {
    const now = Date.now();
    const elapsed = now - camStartTime;
    const t = Math.min(elapsed / camDuration, 1); 

    const easing = 1 - (1 - t) * (1 - t); //ease

    camera.position.lerpVectors(camStart, camEnd, easing);

    if (t === 1) {
      isCameraAnimating = false;
    }
  }

  /*Spinning Animation
  const spin = spinBase + spinImpulse;
  carousel.rotation.y += spin;
  spinImpulse *= damping;     */

  // [SPIN] Update spinImpulse + apply to carousel
  if (!isSpinFrozen) {
    const spin = spinBase + spinImpulse;
    carousel.rotation.y += spin;
    spinImpulse *= damping;
  } 

  // [CARD RAYCAST] Fade when getting clicked
  if (fadeActive) {
    const now = performance.now();
    const elapsed = now - fadeStartTime;
    const t = Math.min(elapsed / fadeDuration, 1);

    if (fadeDirection === "out" && focusedCard) {
      cards.forEach(mesh => {
        if (mesh === focusedCard) {
          setCardOpacity(mesh, 1);
        } else {
          setCardOpacity(mesh, 1 - t);
        }
      });

    } else if (fadeDirection === "in") {
      cards.forEach(mesh => {
        setCardOpacity(mesh, t);
      });
    }

    if (t === 1) {
      fadeActive = false;
      fadeDirection = null;
    }
  }


  // [CONTROLS + RENDER]
  controls.update(); 
  renderer.render(scene, camera); 
  requestAnimationFrame(tick); 
}
tick();




// ORBIT CONTROL =========================================================================================================
// ===== [SECTION] CONTROLS =====
controls.enablePan = false;      
controls.enableDamping = true;   
controls.dampingFactor = 0.08;   
controls.minDistance = 1;      
controls.maxDistance = 20;      





// RAYCASTING =========================================================================================================
// ===== [SECTION] RAYCASTING =====
/**
 * [FOCUS] Set opacity of a single card.
 */
function setCardOpacity(card, value) {
  const mats = Array.isArray(card.material) ? card.material : [card.material];
  mats.forEach(mat => {
    mat.transparent = true;
    mat.opacity = value;
  });
}


/**
 * [FOCUS] Focus a card:
 * - Freeze spin
 * - Remember focusedCard
 * - Fade out all others
 */
function focusCard(card) {
  focusedCard = card;
  isSpinFrozen = true;
  spinImpulse = 0; // or spinImpulse / spinBase = 0 if you use that pattern

  fadeActive = true;
  fadeDirection = "out"
  fadeStartTime = performance.now();

  // reset all cards to fully visible before fading
  cards.forEach(mesh => {
    setCardOpacity(mesh, 1);
  });
}


/*
  * [RESET FOCUS] Get back to the previous state
*/
function resetFocus() {
  focusedCard = null;
  isSpinFrozen = false;

  fadeActive = true;
  fadeDirection = "in";
  fadeStartTime = performance.now();

  cards.forEach(mesh => {
    setCardOpacity(mesh, 0);
  });

  // OPTIONAL: give the spin a little kick again
  // If you use a single spinV:
  //spinImpulse = 0.01 // adjust to taste

  // If you use spinBase/spinImpulse:
  // spinBase = 0.003;
  // spinImpulse = 0.0;
}



/**
 * [INPUT] Pointer down handler: raycast to cards and focus if hit.
 */
function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  
  const intersects = raycaster.intersectObjects(cards);//Returns a sorted array with closest hit firs

  if (intersects.length > 0) {
    let obj = intersects[0].object;

    while (obj && !cards.includes(obj)) {
      obj = obj.parent;
    }
    if (obj) {
      focusCard(obj);
    }
  } else {
    resetFocus();
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);





// LOADING MANAGER =========================================================================================================
// ===== [SECTION] LOADER =====
const loadingManager = new THREE.LoadingManager();
const overlay      = document.getElementById("overlay");
const loaderStatus  = document.getElementById("loader-status");
const openBtn  = document.getElementById("open-btn");
const closeBtn  = document.getElementById("close-btn");
const overlayProgressBar = document.getElementById("overlay-progress-bar");

/** [LOADER] Start */
loadingManager.onStart = (url, loaded, total) => {
  loaderStatus.textContent = "LOADING ASSETS . . . 0%";
  overlayProgressBar.style.width = "0%";
};
/** [LOADER] Progress */
loadingManager.onProgress = (url, loaded, total) => {
  const progress = Math.round((loaded / total) * 100);
  loaderStatus.textContent = `LOADING ASSETS . . .${progress}%`;
  overlayProgressBar.style.width = `${progress}%`;
};
/** [LOADER] Finished */
loadingManager.onLoad = () => {
  loaderStatus.textContent = "OPEN INVITATION";
  openBtn.disabled = false;

  // PRE-WARM: compile shaders & textures once
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  // wait 5 seconds before showing an active OPEN button
  setTimeout(() => {
    loaderStatus.textContent = "OPEN INVITATION";
    openBtn.disabled = false;          // button becomes clickable
    // optional visual cues:
    // openBtn.style.opacity = "1";
    // openBtn.style.pointerEvents = "auto";
  }, 5000);
};

const loader = new THREE.TextureLoader(loadingManager);




// GEO =========================================================================================================
// ===== [SECTION] GEOMETRY & CARDS =====
// [IMAGES] Put images to array
const imgURLs = [];
for (let i = 1; i <= 24; i++) {
  imgURLs.push(`images/photo${i}.webp`);
}

//UV REMPAP
function remapUVsToXY(geometry) { 
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);

  const pos = geometry.attributes.position;
  const uv  = geometry.attributes.uv;

  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    uv.setXY(
      i,
      (x - bbox.min.x) / size.x,
      (y - bbox.min.y) / size.y
    );
  }
  uv.needsUpdate = true;
}


// [TEXTURES] Load all textures into array
imgURLs.forEach((url, i) => {

  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(7, renderer.capabilities.getMaxAnisotropy());

    //Get image dimensions from THIS texture
    /*
    const img = tex.image;
    const imgAspect = img.width / img.height;
    */

    const height = 1.2;
    const width = 1.2;
    const radius = 4.0; // radius of carousel
    

    //Create extruded card shape
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo( width / 2, -height / 2);
    shape.lineTo( width / 2,  height / 2);
    shape.lineTo(-width / 2,  height / 2);
    shape.lineTo(-width / 2, -height / 2);

    const extrudeSettings = {
      depth: 0.05,
      bevelEnabled: false
    };
    //Create the geoometry
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Remap UVs
    remapUVsToXY(geo);

    // Materials
    const matFrontBack = new THREE.MeshStandardMaterial({
      map: tex,
      metalness: 0,
      roughness: 0,
      transparent: true,
      opacity: 1,
    });
    const matSides = new THREE.MeshStandardMaterial({
      color: 0x8d8b4f,
      metalness: 0,
      roughness: 1,
      transparent: true,
      opacity: 1,
    });

    const card = new THREE.Mesh(geo, [matFrontBack, matSides]);

    //Position this card in the circle
    const t = i / imgURLs.length;
    const angle = t * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;

    //Setup the orientation
    card.position.set(x, 0, z);
    card.lookAt(0, 0, 0);
    card.rotateY(Math.PI * 0.5);

    //Add to carousel
    carousel.add(card);

    //Store cards
    cards.push(card);
    card.userData.isCard = true;
  });
});




// UI AND BUTTONS =========================================================================================================
// ===== [SECTION] CLICK,TAP, TOUCH =====
openBtn.addEventListener("click", () => {
  overlay.classList.toggle('open');
  overlay.classList.remove('close');

  //Reset spin when it's getting clicked
  spinImpulse = 0.05;

  //Start camera animation
  camStart.copy(camera.position);

  camStartTime = Date.now();
  isCameraAnimating = true;
});

closeBtn.addEventListener("click", () => {
  overlay.classList.toggle('close');
  overlay.classList.remove('open');

  spinImpulse = 0.05;

});
