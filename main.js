import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";

// 01 - RENDERER -------------------------------------------------------------------------------------------

const app = document.getElementById("app"); //look for the app div
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); //Create engine that draws to canvas using webGL, with antialiasing and alpha for transparency
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // set pixel ratio for hi-dpi screens, capped at 2 for performance
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
// Scene + camera
const scene  = new THREE.Scene(); // create a scene to hold all our 3D objects
const camera = new THREE.PerspectiveCamera(55, canvasWidth/canvasHeight, 0.1, 100); // fov, aspect, near clipping, far clipping
camera.position.set(0, 0, 3); // move the camera Z units back on Z so we can view the scene

// Every time the window is resized, update the renderer size and the camera aspect ratio
window.addEventListener("resize", onResize);
onResize(); 

//Create the carousell and put it into the scene
const carousell = new THREE.Group();
scene.add(carousell);

//Animation loop (for now)
let spinV = 0.10;   // velocity (radians per frame-ish)
const damping = 0.98; // 0.90 = heavy brake, 0.99 = floaty

const controls = new OrbitControls(camera, renderer.domElement);

function tick(){
  carousell.rotation.y += spinV;
  spinV *= damping;

  controls.update(); 
  renderer.render(scene, camera); 
  requestAnimationFrame(tick); 
}

tick();

// Setting up the scene lights for step 5 
const amb = new THREE.AmbientLight(0xffffff, 0.7);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(2, 3, 2); // the light position is at (2, 3, 2)
scene.add(amb, dir);





// 04 - LOADING MANAGER ------------------------------------------------------------------------
const overlay      = document.getElementById("overlay");
const loaderStatus  = document.getElementById("loader-status");
const openBtn  = document.getElementById("open-btn");
const closeBtn  = document.getElementById("close-btn");
const overlayProgressBar = document.getElementById("overlay-progress-bar");

const loadingManager = new THREE.LoadingManager();

// Called when loading starts
loadingManager.onStart = (url, loaded, total) => {
  loaderStatus.textContent = "LOADING IMAGES . . . 0%";
  overlayProgressBar.style.width = "0%";
};
// Called every time one item is loaded
loadingManager.onProgress = (url, loaded, total) => {
  const progress = Math.round((loaded / total) * 100);
  loaderStatus.textContent = `LOADING IMAGES . . .${progress}%`;
  overlayProgressBar.style.width = `${progress}%`;
};
// Called when ALL items using this manager are done
loadingManager.onLoad = () => {
  overlayProgressBar.style.width = "100%";
  loaderStatus.textContent = "OPEN INVITATION";
  loaderStatus.classList.remove("loader-base-color");
  loaderStatus.classList.add("loader-update-color");
  openBtn.disabled = false;
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
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    //Get image dimensions from THIS texture
    /*
    const img = tex.image;
    const imgAspect = img.width / img.height;
    */

    const height = 1.5;
    const width = 2;
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

  });
});








//Overlay open button -----------------------------------------------------------------------------------
//click handler for open button
openBtn.addEventListener("click", () => {
  overlay.classList.toggle('open');
  overlay.classList.remove('close');
});
closeBtn.addEventListener("click", () => {
  overlay.classList.toggle('close');
  overlay.classList.remove('open');
});





// 04 - ORBIT CONTROLS----------------------------------------------------------------------------------
controls.enablePan = false;      // keeps things centered; we don’t need pan
controls.enableDamping = true;   // smooth motion
controls.dampingFactor = 0.08;   // how smooth the motion is
controls.minDistance = 1;      // zoom limits so you don’t lick the pixels
controls.maxDistance = 12;       // zoom limits so you don’t lick the pixels




