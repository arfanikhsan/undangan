import * as THREE from "three";

export function createRing({ urls, radius, tileW, tileH }, renderer){
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();

  urls.forEach((url, i) => {
    const angle = i / urls.length * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;

    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(tileW, tileH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    mesh.position.set(x, 0, z);
    mesh.lookAt(0, 0, 0);
    mesh.rotateY(Math.PI);
    group.add(mesh);
  });

  return group;
}
