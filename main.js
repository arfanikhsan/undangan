

import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";

// 01 - RENDERER -------------------------------------------------------------------------------------------

const app = document.getElementById("app"); //look for the app div
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

app.appendChild(renderer.domElement); // add the renderer canvas to the app div
renderer.outputColorSpace = THREE.SRGBColorSpace; // ensures colors look correct from step 5 onwards





// 02 - SCENE CAMERA ANIMATION LOOP ------------------------------------------------------------------
// SCENE + CAMERA
const scene  = new THREE.Scene(); // create a scene to hold all our 3D objects
const camera = new THREE.PerspectiveCamera(65, canvasWidth/canvasHeight, 0.1, 200); // fov, aspect, near clipping, far clipping
camera.position.set(0, 20, 0); // move the camera Z units back on Z so we can view the scene
window.addEventListener("resize", onResize);
onResize(); 


//Card array
const cardMeshes = []; 

//Create the carousell and put it into the scene
const carousell = new THREE.Group();
scene.add(carousell);


//Finding front card
function getFrontFacingCard(cardMeshes, camera) {
  if (!cardMeshes || cardMeshes.length === 0) return null;

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);      // direction camera is looking (−Z in view space)
  camDir.negate();                       // we want “towards camera” direction

  let bestCard = null;
  let bestDot = -Infinity;

  const normal = new THREE.Vector3(0, 0, 1);   // local +Z is card “front”
  const worldNormal = new THREE.Vector3();

  for (const card of cardMeshes) {
    worldNormal.copy(normal).applyQuaternion(card.quaternion);
    const dot = worldNormal.dot(camDir);       // 1 = perfectly facing camera

    if (dot > bestDot) {
      bestDot = dot;
      bestCard = card;
    }
  }

  // Optional: require a minimum alignment (avoid edge-on)
  const ALIGN_THRESHOLD = 0.9; // cos(25°)≈0.9 – tweak if needed
  if (bestDot < ALIGN_THRESHOLD) return null;

  return bestCard;
}



//ANIMATION LOOP
const controls = new OrbitControls(camera, renderer.domElement);
const clock = new THREE.Clock();

//spinning animation
let spinImpulse = 0;      // will decay to 0
const spinBase   = 0.002; // constant slow spin forever
const damping    = 0.99;

//camera animation
let isCameraAnimating = false;
let camStartTime = 0;
let camStart = new THREE.Vector3();
let camEnd   = new THREE.Vector3(0, 0, 9);
const camDuration = 5000;

//sound setting
//Load sound
const tickSound = document.getElementById('tick-sound');
//Finding facing card
// Keep state so we don't spam sounds
let currentFrontCard = null;
let lastFrontCard = null;
let lastFrontCardWasAligned = false;

function tick(){
  const dt = clock.getDelta();

  // CAMERA ANIMATION
  if (isCameraAnimating) {
  const now = Date.now();
  const elapsed = now - camStartTime;
  const t = Math.min(elapsed / camDuration, 1);

  const easing = 1 - Math.pow(1 - t, 3);

  // interpolate smoothly from camStart → camEnd
  camera.position.lerpVectors(camStart, camEnd, easing);

  if (t === 1) {
    isCameraAnimating = false;
    }
  }

  const spin = spinBase + spinImpulse;
  carousell.rotation.y += spin;
  spinImpulse *= damping;     // decays the impulse

  controls.update(); 
  renderer.render(scene, camera); 

  //Facing Card finder
  const frontCard = getFrontFacingCard(cardMeshes, camera);
  currentFrontCard = frontCard;

  // Simple sanity check: log when we detect a front card
  // (you can comment this out once you're happy)
  if (frontCard && frontCard !== lastFrontCard) {
    console.log('New front card:', frontCard.name || frontCard.id);
  }

  // Decide when to play the tick sound
  if (frontCard) {
    // Only tick when it *becomes* nicely aligned
    if (!lastFrontCardWasAligned || frontCard !== lastFrontCard) {
      // rewind and play quietly
      tickSound.currentTime = 0;
      tickSound.volume = 0.2; // “micro sized” – tweak volume here
      tickSound.play().catch(() => {
        // ignore if browser blocks autoplay; it will start working after user interaction
      });

      lastFrontCardWasAligned = true;
    }
  } else {
    // nothing really facing us
    lastFrontCardWasAligned = false;
  }

  lastFrontCard = frontCard;


  requestAnimationFrame(tick); 
}
tick();

// Setting up the scene lights for step 5 
const amb = new THREE.AmbientLight(0xffffff, 0.7);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(2, 3, 2); // the light position is at (2, 3, 2)
scene.add(amb, dir);





// 04 - ORBIT CONTROLS----------------------------------------------------------------------------------
controls.enablePan = false;      // keeps things centered; we don’t need pan
controls.enableDamping = true;   // smooth motion
controls.dampingFactor = 0.08;   // how smooth the motion is
controls.minDistance = 1;      // zoom limits so you don’t lick the pixels
controls.maxDistance = 20;       // zoom limits so you don’t lick the pixels




// 04 - LOADING MANAGER ------------------------------------------------------------------------
const overlay      = document.getElementById("overlay");
const loaderStatus  = document.getElementById("loader-status");
const openBtn  = document.getElementById("open-btn");
const closeBtn  = document.getElementById("close-btn");
const overlayProgressBar = document.getElementById("overlay-progress-bar");
const loadingManager = new THREE.LoadingManager();




// Called when loading starts
loadingManager.onStart = (url, loaded, total) => {
  loaderStatus.textContent = "LOADING ASSETS . . . 0%";
  overlayProgressBar.style.width = "0%";
};
// Called every time one item is loaded
loadingManager.onProgress = (url, loaded, total) => {
  const progress = Math.round((loaded / total) * 100);
  loaderStatus.textContent = `LOADING ASSETS . . .${progress}%`;
  overlayProgressBar.style.width = `${progress}%`;
};
// Called when ALL items using this manager are done
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








// 05 - SHADERS UPDATE----------------------------------------------------------------------------------
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

//Put images to Array
const imgURLs = [];
for (let i = 1; i <= 24; i++) {
  imgURLs.push(`images/photo${i}.webp`);
}

//create and load a texture through image loop
const loader = new THREE.TextureLoader(loadingManager);


imgURLs.forEach((url, i) => {

  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy());

    //Get image dimensions from THIS texture
    /*
    const img = tex.image;
    const imgAspect = img.width / img.height;
    */

    const height = 1.2;
    const width = 1.8;
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
      roughness: 0
    });

    const matSides = new THREE.MeshStandardMaterial({
      color: 0x951e20,
      metalness: 0,
      roughness: 1
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

    // Add to carousell
    carousell.add(card);
    cardMeshes.push(card);

  });
});






//Overlay open button -----------------------------------------------------------------------------------
//click handler for open button
openBtn.addEventListener("click", () => {
  overlay.classList.toggle('open');
  overlay.classList.remove('close');

  // reset spin when user opens, so it hasn't decayed in the background
  spinImpulse = 0.10;

  // start camera animation
  camStart.copy(camera.position); // start point
  camStartTime = Date.now();
  isCameraAnimating = true;
});

closeBtn.addEventListener("click", () => {
  overlay.classList.toggle('close');
  overlay.classList.remove('open');

  spinImpulse = 0.10;
});






