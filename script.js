// === Orb highlight follows drag (mobile friendly) ===
function attachDrag(svg, gradSelector){
  const grad = svg.querySelector(gradSelector);
  if (!grad) return;
  const viewSize = 300, cX = 150, cY = 150, radius = 120, max = radius * 0.8;
  const follow = (e)=>{
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * viewSize;
    const py = (e.clientY - rect.top) / rect.height * viewSize;
    let dx = px - cX, dy = py - cY;
    const d = Math.hypot(dx, dy);
    if (d > max){ dx *= max/d; dy *= max/d; }
    const gx = (cX + dx) / viewSize * 100;
    const gy = (cY + dy) / viewSize * 100;
    grad.setAttribute('cx', gx + '%');
    grad.setAttribute('cy', gy + '%');
  };
  let dragging = false;
  svg.addEventListener('pointerdown', (e)=>{ dragging = true; svg.setPointerCapture(e.pointerId); follow(e); });
  svg.addEventListener('pointermove', (e)=>{ if (dragging) follow(e); });
  ['pointerup','pointercancel','pointerleave'].forEach(ev=> svg.addEventListener(ev, ()=> dragging=false));
}

const leftSVG  = document.querySelector('.orbs .orb:nth-child(1)');
const rightSVG = document.querySelector('.orbs .orb:nth-child(2)');
if (leftSVG)  attachDrag(leftSVG,  '#warmOrb');
if (rightSVG) attachDrag(rightSVG, '#coolOrb');

// Make both orbs behave like hyperlinks with a pulse on tap
const home = document.getElementById('home');


addTapNav(leftSVG,  'witness');
addTapNav(rightSVG, 'witness');

