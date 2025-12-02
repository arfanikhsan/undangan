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
dir.position.set(1, 4, 4);
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
const damping    = 0.98;

//CAMERA ANIMATION
let isCameraAnimating = false;
let camStartTime = 0;
const camDuration = 1000;
let camStart = new THREE.Vector3();
let camEnd   = new THREE.Vector3(0, 0, 8);

//#region Raycaster
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

//#region Spin freeze flag
let isSpinFrozen = false;

//#region cards
let focusedCard = null;
const cards = [];

//FADE STATE
let fadeActive = false;
let fadeStartTime = 0;
const fadeDuration = 500; // ms
let fadeDirection = null

//HTML ELEMENT FADE
const containerOne = document.getElementById('container-1');
const containerTwo = document.getElementById('container-2');

//CARD FLIP STATE
let rotateActive = false;
let rotateStartTime = 0;
const rotateDuration = 500; // ms
let rotateDirection = null; // "open" or "close"
let rotatedCard = null;     // card currently being animated

//CAROUSEL SPIN TO FRONT
let isAutoSpinningToCard = false;
let autoSpinStartTime = 0;
const autoSpinDuration = 300; // ms – tweak for how long the spin takes
let autoSpinStartAngle = 0;
let autoSpinEndAngle = 0;
let autoSpinTargetCard = null;
//HELPER
function startSpinToCard(card) {
  autoSpinTargetCard = card;
  isAutoSpinningToCard = true;
  autoSpinStartTime = performance.now();

  autoSpinStartAngle = carousel.rotation.y;

  const p = card.position; // local position inside carousel
  const localAngle = Math.atan2(p.x, p.z); // angle around Y

  let targetAngle = -localAngle;

  const twoPi = Math.PI * 2;
  let delta = targetAngle - autoSpinStartAngle;
  delta = ((delta + Math.PI) % twoPi + twoPi) - Math.PI;

  autoSpinEndAngle = autoSpinStartAngle + delta;

  isSpinFrozen = true;
  spinImpulse = 0;  
}

const frontLabelEl = document.getElementById("front-label");

const tmpWorldPos = new THREE.Vector3();
const tmpWorldDir = new THREE.Vector3();
const tmpToCam    = new THREE.Vector3();

let currentFrontIndex = -1;








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
  const now = performance.now();

  

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


  // [FADE CARDS]
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

    } else if (fadeDirection === "in" && focusedCard) {
        cards.forEach(mesh => {
          if (mesh === focusedCard) {
            setCardOpacity(mesh, 1);      // never disappears
          } else {
            setCardOpacity(mesh, t);      // 0 → 1
          }
        });
      }

    if (t === 1) {
      fadeActive = false;

      // when fade IN is finished, we really reset focus
      if (fadeDirection === "in") {
        fadeDirection = null;
        focusedCard = null;
      }
    }
  }


  //[CARD FLIP]
  if (rotateActive && rotatedCard) {
    const now = performance.now();
    const elapsed = now - rotateStartTime;
    const t = Math.min(elapsed / rotateDuration, 1);
    // Smooth easing
    const ease = 1 - Math.pow(1 - t, 3);
    if (rotateDirection === "open") {
      const start = rotatedCard.userData.originalRotationY;
      const end = start + Math.PI * 0.5; // rotate +90°
      rotatedCard.rotation.y = start + (end - start) * ease;
    }
    if (rotateDirection === "close") {
      const end = rotatedCard.userData.originalRotationY;
      const start = end + Math.PI * 0.5;
      rotatedCard.rotation.y = start + (end - start) * ease;
    }
    if (t === 1) {
      rotateActive = false;
      // if fully closed, drop reference
      if (rotateDirection === "close") {
        rotatedCard = null;
      }
    }
  }


  // CAROUSEL SPIN
  if (isAutoSpinningToCard && autoSpinTargetCard) {
    const elapsed = now - autoSpinStartTime;
    const t = Math.min(elapsed / autoSpinDuration, 1);

    const ease = t < 0.5
      ? 2 * t * t                 // accelerate
      : 1 - Math.pow(-2 * t + 2, 2) / 2; // decelerate

    carousel.rotation.y =
      autoSpinStartAngle + (autoSpinEndAngle - autoSpinStartAngle) * ease;

    if (t === 1) {
      isAutoSpinningToCard = false;

      focusCard(autoSpinTargetCard);
    }
  }


  // [NORMAL SPIN]
  if (!isSpinFrozen && !isAutoSpinningToCard) {
    const spin = spinBase + spinImpulse; 
    carousel.rotation.y += spin;
    spinImpulse *= damping;
  }


    // ===== [SECTION] FRONT-MOST CARD LABEL =====
    if (cards.length > 0 && frontLabelEl) {
      let bestCard = null;
      let bestScore = -Infinity;

      cards.forEach(card => {
        // get card position in world space
        card.getWorldPosition(tmpWorldPos);

        // direction from card -> camera
        tmpToCam.subVectors(camera.position, tmpWorldPos).normalize();

        // card's facing direction in world space
        card.getWorldDirection(tmpWorldDir); // forward (-Z in local)
        tmpWorldDir.negate(); // flip so it's "front" of the card

        // alignment: 1 = looking straight at camera, 0 = sideways, -1 = away
        const alignment = tmpToCam.dot(tmpWorldDir);

        if (alignment > bestScore) {
          bestScore = alignment;
          bestCard = card;
        }
      });

      if (bestCard) {
        const idx = bestCard.userData.index;

        // only update text when the front card actually changes
        if (idx !== currentFrontIndex) {
          currentFrontIndex = idx;
          frontLabelEl.textContent = bestCard.userData.label;
        }
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


// [FOCUS] Focus a card:
function focusCard(card) {
  focusedCard = card;
  isSpinFrozen = true;
  spinImpulse = 0;

  //SHOW CAPTION
  const captionEl = document.getElementById("card-caption");
  captionEl.textContent = card.userData.caption || `Card ${card.userData.index}`;
  captionEl.style.opacity = 1;

  //CARD FLIP
  // remember which card we are rotating
  rotatedCard = card;
  rotateActive = true;
  rotateDirection = "open";
  rotateStartTime = performance.now();

  //FADING
  fadeActive = true;
  fadeDirection = "out"
  fadeStartTime = performance.now();
  // reset all cards to fully visible before fading
  cards.forEach(mesh => {
    setCardOpacity(mesh, 1);
  });

  //CAMERA: move in to (0, 0, 4.5)
  camStart.copy(camera.position);
  camEnd.set(0, 0, 6);
  camStartTime = Date.now();
  isCameraAnimating = true;
}


/*
  * [RESET FOCUS] Get back to the previous state
*/
function resetFocus() {
  if (!focusedCard) return;
  //focusedCard = null;
  isSpinFrozen = false;

  //FADING BACK IN
  fadeActive = true;
  fadeDirection = "in";
  fadeStartTime = performance.now();
  
  //CARD FLIP BACK
  rotatedCard = focusedCard;
  rotateActive = true;
  rotateDirection = "close";
  rotateStartTime = performance.now();

  // CAMERA: move out to (0, 0, 10)
  camStart.copy(camera.position);
  camEnd.set(0, 0, 8);
  camStartTime = Date.now();
  isCameraAnimating = true;

  //HIDE CAPTION
  document.getElementById("card-caption").style.opacity = 0
  if (t === 1) {
  fadeActive = false;
  fadeDirection = null;
  focusedCard = null;
}

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

    if (!obj) return;

    if (focusedCard) {
      // If we click the already focused card → reset
      if (focusedCard === obj) {
        resetFocus();
      }
      return
    }
    startSpinToCard(obj);

  } else {
    if (focusedCard) resetFocus();
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

const mainPage = document.getElementById('main-page');
const openInvitation = document.getElementById('open-invitation');
const landingOn = document.getElementById('page-two-wrapper');
const goUpBtn = document.getElementById('go-up');

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
  //Opening the landing page on load
  landingOn.disabled =true;

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
    card.userData.angle = angle;
    card.userData.isCard = true;
    card.userData.originalRotationY = card.rotation.y;
    card.userData.index = i;
    card.userData.label = `photo${i + 1}`; 
    
    const caption =[





   







"When we first began, we were figuring things out with uncertainty, yet with so much joy",
"When we first began, we were figuring things out with uncertainty, yet with so much joy",
"When we first began, we were figuring things out with uncertainty, yet with so much joy",
"When we first began, we were figuring things out with uncertainty, yet with so much joy",
"Where his journey started, shaped by the years that carried him here",
"Where his journey started, shaped by the years that carried him here",
"Where his journey started, shaped by the years that carried him here",
"Where his journey started, shaped by the years that carried him here",
"Where her story began, the pieces of time that shaped who she is today",
"Where her story began, the pieces of time that shaped who she is today",
"Where her story began, the pieces of time that shaped who she is today",
"Where her story began, the pieces of time that shaped who she is today",
"After all the seasons we lived through, this is where time has brought us",
"After all the seasons we lived through, this is where time has brought us",
"After all the seasons we lived through, this is where time has brought us",
"After all the seasons we lived through, this is where time has brought us",

"Ahead lies time we will walk into, a time when we will keep growing and changing",
      
"Time moved, and so did we, learning, changing, growing in our own ways, even miles apart",
"Time moved, and so did we, learning, changing, growing in our own ways, even miles apart",      
"Time moved, and so did we, learning, changing, growing in our own ways, even miles apart",      
"Time moved, and so did we, learning, changing, growing in our own ways, even miles apart",

    ]
    card.userData.caption = caption[i];
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

/*
closeBtn.addEventListener("click", () => {
  overlay.classList.toggle('close');
  overlay.classList.remove('open');

  spinImpulse = 0.05;

});*/




/*
openInvitation.addEventListener("click", openPageTwo);
goUpBtn.addEventListener("click", lockAndReturnToPageOne);
*/

openInvitation.addEventListener("click",() => {
  mainPage.style.transform = 'translateY(-100%)';
  landingOn.classList.toggle('show');
  spinImpulse = 0.05;
})

goUpBtn.addEventListener("click",() => {
  window.scrollTo({
    top:  0,
    behavior: 'smooth' // Makes the scroll animated rather than an instant jump
  });
  mainPage.style.transform = 'translateY(0%)'
  setTimeout(() => {
  landingOn.classList.toggle('show');
  }, 2000);
  spinImpulse = 0.1;
})


/**

function lockAndReturnToPageOne() {
    // 1. Scroll Page 2's content back to the top (smoothly)
    pageTwoWrapper.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    // 2. Wait for the scroll to finish, then switch views
    setTimeout(() => {
        // Hide Page 2 and disable its scrolling
        pageTwoWrapper.classList.remove('page-two-active');
        
        // Show Page 1
        pageOne.style.opacity = '1';
        pageOne.style.transform = 'translateY(0)';
    }, 500); // Matching the smooth scroll duration
}

window.onload = () => {
      pageOne.style.opacity = '1';
      pageOne.style.transform = 'translateY(0)';
      pageTwoWrapper.classList.remove('page-two-active');
};
*/
/*
function openPageTwo() {
    // Hide Page 1
    pageOne.style.opacity = '0';
    pageOne.style.transform = 'translateY(100%)';
    
    // Show and enable scrolling for Page 2
    pageTwoWrapper.classList.add('page-two-active');
}

/**
 * Scrolls Page 2 to the top, then switches the view back to Page 1.
 */
/*
function lockAndReturnToPageOne() {
    // 1. Scroll Page 2's content back to the top (smoothly)
    pageTwoWrapper.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    // 2. Wait for the scroll to finish, then switch views
    setTimeout(() => {
        // Hide Page 2 and disable its scrolling
        pageTwoWrapper.classList.remove('page-two-active');
        
        // Show Page 1
        pageOne.style.opacity = '1';
        pageOne.style.transform = 'translateY(0)';
    }, 500); // Matching the smooth scroll duration
}

// Initial setup on load to ensure Page 1 is visible and Page 2 is hidden
window.onload = () => {
      pageOne.style.opacity = '1';
      pageOne.style.transform = 'translateY(0)';
      pageTwoWrapper.classList.remove('page-two-active');
};

*/





//link query
  const headingId = 'output';
  
  // Define the key name you'll use in the URL (e.g., '?q=Hello')
  const urlKey = 'q'; 

  //Get the value of the 'q' parameter from the URL query string
  const textFromURL = new URLSearchParams(window.location.search).get(urlKey);

  // Update the H1's content if the parameter exists
  if (textFromURL) {
      document.getElementById(headingId).textContent = textFromURL;
  }
