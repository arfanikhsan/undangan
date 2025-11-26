

import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";

// RENDERER -------------------------------------------------------------------------------------------
const app = document.getElementById("app"); 
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); 

// Set the size of the renderer to match the app div
let canvasWidth  = app.clientWidth;
let canvasHeight = app.clientHeight;
renderer.setSize(canvasWidth, canvasHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

function onResize() {
  canvasWidth  = app.clientWidth;
  canvasHeight = app.clientHeight;

  renderer.setSize(canvasWidth, canvasHeight);
  camera.aspect = canvasWidth / canvasHeight;
  camera.updateProjectionMatrix();
}
app.appendChild(renderer.domElement); 

//Color handler
renderer.outputColorSpace = THREE.SRGBColorSpace;






// SCENE + CAMERA --------------------------------------------------------------------------------
// Setting up scene and camera
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, canvasWidth/canvasHeight, 0.1, 200); // fov, aspect, near clipping, far clipping
camera.position.set(0, 20, 0);
window.addEventListener("resize", onResize);
onResize(); 

// Setting up the scene lights 
const amb = new THREE.AmbientLight(0xffffff, 0.7);
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(2, 3, 2); // the light position is at (2, 3, 2)
scene.add(amb, dir);





//SET UP AND HELPER --------------------------------------------------------------------------------
//Orbit Helper
const controls = new OrbitControls(camera, renderer.domElement);
const clock = new THREE.Clock();

//Carousel
const carousel = new THREE.Group();
scene.add(carousel);

//Spinning Helper
let spinImpulse = 0;      // will decay to 0
let spinBase   = 0.001; // constant slow spin forever
const damping    = 0.99;


//Camera Animation Helper
let isCameraAnimating = false;
let camStartTime = 0;
const camDuration = 3000;
let camStart = new THREE.Vector3();
let camEnd   = new THREE.Vector3(0, 0, 9);

//Raycaster
//Setup
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

//Froze spin
let isSpinFrozen = false;
let focusedCard = null;
//Fade state
let fadeActive = false;
let fadeStartTime = 0;
const fadeDuration = 500; // ms

//Picking a card
const cards = [];

function setCardOpacity(card, value) {
  const mats = Array.isArray(card.material) ? card.material : [card.material];
  mats.forEach(mat => {
    mat.transparent = true;
    mat.opacity = value;
  });
}

function focusCard(card) {
  focusedCard = card;
  isSpinFrozen = true;
  spinImpulse = 0; // or spinImpulse / spinBase = 0 if you use that pattern

  fadeActive = true;
  fadeStartTime = performance.now();

  // reset all cards to fully visible before fading
  cards.forEach(mesh => {
    setCardOpacity(mesh, 1);
  });

  isCardRotating = true;
  cardRotStartTime = performance.now();

  // start from current Y rotation
  cardRotStartY = card.rotation.y;

  // rotate an extra 90° (π/2) so total becomes like Math.PI
  cardRotEndY = card.rotation.y + Math.PI * 0.5;
  
}


//card rotate
let isCardRotating = false;
let cardRotStartTime = 0;
const cardRotDuration = 600; // ms, adjust for faster/slower flip

let cardRotStartY = 0;
let cardRotEndY = 0;





//ANIMATION LOOP --------------------------------------------------------------------------------
function tick(){
  const dt = clock.getDelta();

  //Camera Animation
  if (isCameraAnimating) {
    const now = Date.now();
    const elapsed = now - camStartTime;
    const t = Math.min(elapsed / camDuration, 1); // 0 → 1

    const easing = 1 - (1 - t) * (1 - t); //ease

    camera.position.lerpVectors(camStart, camEnd, easing);

    if (t === 1) {
      isCameraAnimating = false;
    }
  }


  /*Spinning Animation
  const spin = spinBase + spinImpulse;
  carousel.rotation.y += spin;
  spinImpulse *= damping;     // decays the impulse*/

  if (!isSpinFrozen) {
    const spin = spinBase + spinImpulse;
    carousel.rotation.y += spin;
    spinImpulse *= damping;
  } 


  const now = performance.now();
  if (fadeActive && focusedCard) {
    const now = performance.now();
    const elapsed = now - fadeStartTime;
    const t = Math.min(elapsed / fadeDuration, 1);

    cards.forEach(mesh => {
      if (mesh === focusedCard) {
        setCardOpacity(mesh, 1);         // clicked card stays visible
      } else {
        setCardOpacity(mesh, 1 - t);     // others fade to 0
      }
    });

    if (t === 1) fadeActive = false;
  }


  // 3. 🔹 rotate the focused card with ease
  if (isCardRotating && focusedCard) {
    const elapsed = now - cardRotStartTime;
    const t = Math.min(elapsed / cardRotDuration, 1); // 0 → 1

    // cubic ease-out
    const ease = 1 - Math.pow(1 - t, 3);

    const y = cardRotStartY + (cardRotEndY - cardRotStartY) * ease;
    focusedCard.rotation.y = y;

    if (t === 1) {
      isCardRotating = false;
    }
  }
  

  //Execute
  controls.update(); 
  renderer.render(scene, camera); 
  requestAnimationFrame(tick); 

  //-----------------qwdqwd
  console.log(isSpinFrozen)

}
tick();








// ORBIT CONTROLS----------------------------------------------------------------------------------
controls.enablePan = false;      // keeps things centered; we don’t need pan
controls.enableDamping = true;   // smooth motion
controls.dampingFactor = 0.08;   // how smooth the motion is
controls.minDistance = 1;      // zoom limits so you don’t lick the pixels
controls.maxDistance = 20;       // zoom limits so you don’t lick the pixels




//RAYCASTER----------------------------------------------------------------------------------
//Pointer/click handler
function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(cards);

  if (intersects.length > 0) {
    const clickedCard = intersects[0].object;
    focusCard(clickedCard);
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);






// LOADING MANAGER ------------------------------------------------------------------------
const overlay      = document.getElementById("overlay");
const loaderStatus  = document.getElementById("loader-status");
const openBtn  = document.getElementById("open-btn");
const closeBtn  = document.getElementById("close-btn");
const overlayProgressBar = document.getElementById("overlay-progress-bar");
const loadingManager = new THREE.LoadingManager();

// Start
loadingManager.onStart = (url, loaded, total) => {
  loaderStatus.textContent = "LOADING ASSETS . . . 0%";
  overlayProgressBar.style.width = "0%";
};
// Progress
loadingManager.onProgress = (url, loaded, total) => {
  const progress = Math.round((loaded / total) * 100);
  loaderStatus.textContent = `LOADING ASSETS . . .${progress}%`;
  overlayProgressBar.style.width = `${progress}%`;
};
// Load
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





// GEOMETRY & SHADERS UPDATE----------------------------------------------------------------------------------
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

//Puting images to Array
const imgURLs = [];
for (let i = 1; i <= 24; i++) {
  imgURLs.push(`images/photo${i}.webp`);
}

//create and load a texture through image loop
const loader = new THREE.TextureLoader(loadingManager);
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
    

    //Create the extruded card shape
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

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);


    // Remap UVs so the texture appears correctly
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
      color: 0x951e20,
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

    card.position.set(x, 0, z);
    card.lookAt(0, 0, 0);
    card.rotateY(Math.PI * 0.5);

    // Add to carousel
    carousel.add(card);

    //Marking card and push it to cards array
    card.userData.isCard = true;
    cards.push(card)

  });
});





//BUTTON-----------------------------------------------------------------------------------
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





