import * as THREE from 'three';
import { T, TILE_SIZE, MAP_W, MAP_H } from './data.js';
import { G, useItem, discardItem } from './game.js';
import { getSprite } from './sprites.js';

// --- Rendering and UI ---
// Toggle between classic 2D canvas rendering and experimental 3D using Three.js
const USE_WEBGL = true;
const canvas = document.getElementById('view');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');
let ctx, renderer3d, scene, camera, playerMesh,
  entityMeshes = [], itemMeshes = [], chestMeshes = [], tileMeshes = [], fxGroup,
  sceneBuilt = false;

// wall rendering assets
let wallCanvas, wallPattern, wallTexture;
let wallMaterial = new THREE.MeshLambertMaterial({color:0xcccccc});
const floorMaterial = new THREE.MeshLambertMaterial({color:0xdddddd});

export function randomizeWallTexture(){
  const size = 64;
  wallCanvas = document.createElement('canvas');
  wallCanvas.width = wallCanvas.height = size;
  const c = wallCanvas.getContext('2d');
  // mortar base
  c.fillStyle = '#aaaaaa';
  c.fillRect(0,0,size,size);
  const brickW = 32, brickH = 16;
  for(let y=0;y<size;y+=brickH){
    const offset = (y/brickH)%2 ? brickW/2 : 0;
    for(let x=-offset;x<size;x+=brickW){
      const shade = 180 + Math.floor(Math.random()*40);
      c.fillStyle = `rgb(${shade},${shade},${shade})`;
      c.fillRect(x+1,y+1,brickW-2,brickH-2);
    }
  }
  wallTexture = new THREE.CanvasTexture(wallCanvas);
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallMaterial.map = wallTexture;
  wallTexture.needsUpdate = true;
  wallMaterial.needsUpdate = true;
  wallPattern = null; // will rebuild for 2D when needed
}

randomizeWallTexture();

function resizeCanvas(){
  const w = canvas.clientWidth;
  const h = w * 0.75;
  canvas.width = w;
  canvas.height = h;
  minimap.width = w/6;
  minimap.height = h/6;
  if(renderer3d){
    renderer3d.setSize(w,h);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  if(ctx){
    ctx.canvas.width = w;
    ctx.canvas.height = h;
  }
}
window.addEventListener('resize', resizeCanvas);

export function resetScene() {
  sceneBuilt = false;
  entityMeshes = [];
  itemMeshes = [];
  chestMeshes = [];
  tileMeshes = [];
}

if (USE_WEBGL) {
  // Set up a basic Three.js scene
  renderer3d = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer3d.setClearColor(0xdddddd);
  renderer3d.shadowMap.enabled = true;
  renderer3d.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdddddd);
  camera = new THREE.PerspectiveCamera(55, canvas.width / canvas.height, 0.1, 1000);
  camera.position.set(MAP_W / 2, 20, MAP_H * 1.1);
  camera.lookAt(MAP_W / 2, 0, MAP_H / 2);
  const ambient = new THREE.AmbientLight(0x888888);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);
} else {
  // Original 2D canvas setup
  ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '20px sans-serif';
}

resizeCanvas();

function rect(x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(x,y,w,h); }

function drawTile(x,y,t){
  const px=x*TILE_SIZE, py=y*TILE_SIZE;
  if(t===T.WALL){
    if(!wallPattern) wallPattern = ctx.createPattern(wallCanvas,'repeat');
    ctx.fillStyle = wallPattern;
    ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE);
  }
  else if(t===T.FLOOR) rect(px,py,TILE_SIZE,TILE_SIZE,'#dddddd');
  else if(t===T.STAIRS){
    rect(px,py,TILE_SIZE,TILE_SIZE,'#654321');
    ctx.fillStyle='#333333';
    ctx.fillRect(px+4,py+4,16,16);
  }
  else if(t===T.CHEST){ rect(px,py,TILE_SIZE,TILE_SIZE,'#dddddd'); ctx.fillStyle='#8b5e34'; ctx.fillRect(px+5,py+6,14,12); ctx.fillStyle='#d4af37'; ctx.fillRect(px+5,py+12,14,2); }
  else if(t===T.WATER){ rect(px,py,TILE_SIZE,TILE_SIZE,'#cceeff'); }
  else if(t===T.FOUNTAIN){ rect(px,py,TILE_SIZE,TILE_SIZE,'#dddddd'); ctx.fillStyle='#4fc3f7'; ctx.beginPath(); ctx.arc(px+TILE_SIZE/2, py+TILE_SIZE/2, 6, 0, Math.PI*2); ctx.fill(); }
  else if(t===T.TRAP){ rect(px,py,TILE_SIZE,TILE_SIZE,'#dddddd'); ctx.fillStyle='#000'; ctx.fillRect(px+4,py+4,16,16); }
}

function enableShadows(obj){
  obj.traverse(child=>{
    if(child.isMesh){
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createSpriteMesh(name){
  const tex = getSprite(name);
  // Sprites occasionally intersect wall geometry which causes the tops
  // of characters to be clipped. Render them on top without writing to
  // the depth buffer so walls in front still occlude them but walls
  // behind will no longer clip the sprite.
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1,1,1);
  sprite.center.set(0.5,0); // anchor to bottom
  sprite.castShadow = true;
  sprite.renderOrder = 1;
  return sprite;
}

function createCharacterMesh(color){
  const mat = new THREE.MeshStandardMaterial({color});
  const group = new THREE.Group();

  // torso (smaller body)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.9,0.25), mat);
  torso.position.y = 0.75;
  group.add(torso);

  // head (larger)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16), mat);
  head.position.y = 1.7;
  group.add(head);

  // eyes
  const eyeGeom = new THREE.SphereGeometry(0.07,8,8);
  const eyeMat = new THREE.MeshStandardMaterial({color:0x000000});
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.15,1.7,0.28);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.15;
  group.add(eyeL, eyeR);

  // belt detail
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.1,0.27), new THREE.MeshStandardMaterial({color:0x333333}));
  belt.position.y = 0.55;
  group.add(belt);

  // arms
  const armGeom = new THREE.CylinderGeometry(0.12,0.12,0.8,8);
  const armL = new THREE.Mesh(armGeom, mat);
  armL.position.set(-0.4,1.0,0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  group.add(armL); group.add(armR);

  // legs
  const legGeom = new THREE.CylinderGeometry(0.15,0.15,0.9,8);
  const legL = new THREE.Mesh(legGeom, mat);
  legL.position.set(-0.18,0.45,0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legL); group.add(legR);

  group.userData = {legL, legR, armL, armR};
  enableShadows(group);
  return group;
}

function createGoblinMesh(){
  const g=createCharacterMesh(0x00aa00);
  const earGeom=new THREE.ConeGeometry(0.15,0.3,8);
  const earMat=new THREE.MeshLambertMaterial({color:0x00aa00});
  const earL=new THREE.Mesh(earGeom,earMat); earL.rotation.z=Math.PI/2; earL.position.set(-0.35,1.7,0);
  const earR=earL.clone(); earR.position.x=0.35; earR.rotation.z=-Math.PI/2; g.add(earL,earR);
  const dagger=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.6),new THREE.MeshLambertMaterial({color:0x888888}));
  dagger.position.set(0.55,1,0); dagger.rotation.x=Math.PI/2; g.add(dagger);
  return g;
}

function createOrcMesh(){
  const g=createCharacterMesh(0x225500); g.scale.set(1.1,1.1,1.1);
  const tuskGeom=new THREE.CylinderGeometry(0.03,0.05,0.3,8);
  const tuskMat=new THREE.MeshLambertMaterial({color:0xffffff});
  const tuskL=new THREE.Mesh(tuskGeom,tuskMat); tuskL.position.set(-0.15,1.5,0.15); tuskL.rotation.z=Math.PI/2;
  const tuskR=tuskL.clone(); tuskR.position.x=0.15; g.add(tuskL,tuskR);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.8,8),new THREE.MeshLambertMaterial({color:0x8b4513}));
  handle.position.set(0.55,1,0); handle.rotation.x=Math.PI/2;
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.3,0.05),new THREE.MeshLambertMaterial({color:0xaaaaaa}));
  blade.position.set(0.55,1.2,0.3);
  g.add(handle,blade);
  return g;
}

function createZombieMesh(){
  const g=createCharacterMesh(0x99cc00);
  g.userData.armL.rotation.x=Math.PI/2; g.userData.armR.rotation.x=Math.PI/2;
  return g;
}

function createOgreMesh(){
  const g=createCharacterMesh(0x553300); g.scale.set(1.3,1.3,1.3);
  const club=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.15,1,8),new THREE.MeshLambertMaterial({color:0x8b4513}));
  club.position.set(0.6,1.1,0); club.rotation.x=Math.PI/2; g.add(club);
  return g;
}

function createDragonMesh(){
  const group=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:0xff0000});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.3,1.6,8),mat);
  body.rotation.z=Math.PI/2; body.position.y=0.6; group.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.3,16,16),mat); head.position.set(0.8,0.8,0); group.add(head);
  const wingGeom=new THREE.PlaneGeometry(1.2,0.6); const wingMat=new THREE.MeshLambertMaterial({color:0xaa0000, side:THREE.DoubleSide});
  const left=new THREE.Mesh(wingGeom,wingMat); left.position.set(0,1.0,0.5); left.rotation.x=Math.PI/2;
  const right=left.clone(); right.position.z=-0.5; group.add(left,right);
  return group;
}

function createCrystalGuardianMesh(){
  return new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshLambertMaterial({color:0x00ffff, transparent:true, opacity:0.8}));
}

function createMerchantMesh(){
  const g=createCharacterMesh(0x996633);
  const bag=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),new THREE.MeshLambertMaterial({color:0x8b4513}));
  bag.position.set(-0.4,0.9,0); g.add(bag); return g;
}

function createStairsMesh(){
  const group=new THREE.Group();
  for(let i=0;i<3;i++){
    const step=new THREE.Mesh(
      new THREE.BoxGeometry(1,0.15,1-(i*0.3)),
      new THREE.MeshLambertMaterial({color:0x654321})
    );
    step.position.set(0,-0.075-i*0.15,-0.35+i*0.15);
    group.add(step);
  }
  return group;
}

function createFountainMesh(){
  const group=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.2,12),new THREE.MeshLambertMaterial({color:0xaaaaaa}));
  base.position.y=0.1; group.add(base);
  const water=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.05,12),new THREE.MeshLambertMaterial({color:0x4fc3f7}));
  water.position.y=0.25; group.add(water);
  return group;
}

function createChestMesh(){
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.8,0.5,0.8),
    new THREE.MeshLambertMaterial({color:0x8b5e34})
  );
  chest.position.y=0.25;
  const band=new THREE.Mesh(
    new THREE.BoxGeometry(0.8,0.1,0.1),
    new THREE.MeshLambertMaterial({color:0xd4af37})
  );
  band.position.set(0,0.3,0);
  const g=new THREE.Group(); g.add(chest); g.add(band); return g;
}

function createItemMesh(){
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.15,8,8),
    new THREE.MeshLambertMaterial({color:0xffd166})
  );
  mesh.position.y=0.3;
  enableShadows(mesh);
  return mesh;
}

function updateFigure(mesh, tx, ty){
  mesh.position.x = tx;
  mesh.position.z = ty;
  const ud = mesh.userData;
  if(ud.legL){
    ud.legL.rotation.x = 0;
    ud.legR.rotation.x = 0;
    ud.armL.rotation.x = 0;
    ud.armR.rotation.x = 0;
  }
}

function createPlayerMesh(cls){
  return createSpriteMesh(`player_${cls}`);
}

function createMonsterMesh(monster){
  if (monster.name === 'Mimic') {
    const chest = createChestMesh();
    enableShadows(chest);
    return chest;
  }
  const key = monster.type === 'merchant' ? 'merchant' : monster.name;
  return createSpriteMesh(key);
}

function buildScene3D(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdddddd);
  const ambient = new THREE.AmbientLight(0x888888);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);
  tileMeshes = Array.from({length:MAP_H},()=>Array(MAP_W));
  chestMeshes = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = G.map[y][x];
    const group = new THREE.Group();
    group.position.set(x,0,y);
    scene.add(group);
    tileMeshes[y][x] = group;
    let mat = floorMaterial;
    let h = 0.1;
    if (t === T.WALL){ h = 0.7; mat = wallMaterial; }
    else if (t === T.WATER){ mat = new THREE.MeshLambertMaterial({color:0x113355}); h = 0.05; }
    else if (t === T.STAIRS){ h = 0; }
    const yOff = t === T.WALL ? h/2 : -h/2 - 0.01;
    if (h > 0) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1,h,1), mat);
      base.position.y = yOff;
      base.receiveShadow = true;
      base.castShadow = (t === T.WALL);
      group.add(base);
    }
    if (t === T.STAIRS) {
      group.add(createStairsMesh());
    } else if (t === T.FOUNTAIN) {
      group.add(createFountainMesh());
    }
    enableShadows(group);
    if (t === T.CHEST) {
      const chest = createChestMesh();
      chest.position.set(x, 0, y);
      enableShadows(chest);
      scene.add(chest);
      chestMeshes.push({ mesh: chest, x, y });
    }
  }
  playerMesh = createPlayerMesh(G.player.cls);
  scene.add(playerMesh);
  playerMesh.position.set(G.player.x,0,G.player.y);
  playerMesh.userData.tx = playerMesh.userData.sx = G.player.x;
  playerMesh.userData.ty = playerMesh.userData.sy = G.player.y;
  playerMesh.userData.start = performance.now();
  entityMeshes = [];
  for (const e of G.entities) {
    const mesh = createMonsterMesh(e);
    mesh.position.set(e.x, 0, e.y);
    mesh.userData.tx = mesh.userData.sx = e.x;
    mesh.userData.ty = mesh.userData.sy = e.y;
    mesh.userData.start = performance.now();
    scene.add(mesh);
    entityMeshes.push({ mesh, e });
  }
  itemMeshes = [];
  for (const it of G.items) {
    const mesh = createItemMesh();
    mesh.position.set(it.x, 0, it.y);
    scene.add(mesh);
    itemMeshes.push({ mesh, it });
  }
  fxGroup = new THREE.Group();
  scene.add(fxGroup);
  sceneBuilt = true;
}

export function render() {
  if (!G.player) return;
  if (!USE_WEBGL) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // tiles
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const seen = G.seen[y][x];
      if (!seen) { rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, '#dddddd'); continue; }
      const t = G.map[y][x];
      drawTile(x, y, t === T.CHEST && !G.visible[y][x] ? T.FLOOR : t);
    }
    // items
    for (const it of G.items) { if (!G.visible[it.y][it.x]) continue; ctx.fillStyle = '#ffd166'; ctx.fillRect(it.x * TILE_SIZE + 10, it.y * TILE_SIZE + 10, 4, 4); }
    // entities (monsters)
    ctx.fillStyle = '#000';
    for (const e of G.entities) {
      if (!G.visible[e.y][e.x]) continue;
      const px = e.x * TILE_SIZE + TILE_SIZE / 2, py = e.y * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillText(e.icon || e.ch || '?', px, py);
    }
    // player
    const px = G.player.x * TILE_SIZE + TILE_SIZE / 2, py = G.player.y * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillStyle = '#000';
    ctx.fillText(G.player.icon || '@', px, py);

    // ability effects
    for (const fx of G.effects) {
      const p = fx.duration ? fx.elapsed / fx.duration : 0;
      if (fx.type === 'whirlwind') {
        const cx = fx.x * TILE_SIZE + TILE_SIZE / 2, cy = fx.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.strokeStyle = fx.color || 'rgba(255,255,0,0.8)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - p;
        const arms = 6;
        for(let i=0;i<arms;i++){
          const ang = p * Math.PI * 2 + (Math.PI*2/arms)*i;
          ctx.beginPath();
          ctx.arc(cx, cy, fx.r*(i/arms), ang, ang + Math.PI/3);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (fx.type === 'fireball') {
        const ex = fx.x * TILE_SIZE + TILE_SIZE / 2, ey = fx.y * TILE_SIZE + TILE_SIZE / 2;
        const r = fx.r * p;
        const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
        grd.addColorStop(0, fx.color || 'rgba(255,120,0,0.9)');
        grd.addColorStop(1, 'rgba(255,255,0,0)');
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (fx.type === 'arrow') {
        const x1 = fx.x1 * TILE_SIZE + TILE_SIZE / 2, y1 = fx.y1 * TILE_SIZE + TILE_SIZE / 2;
        const x2 = fx.x2 * TILE_SIZE + TILE_SIZE / 2, y2 = fx.y2 * TILE_SIZE + TILE_SIZE / 2;
        const cx = x1 + (x2 - x1) * p, cy = y1 + (y2 - y1) * p;
        ctx.strokeStyle = fx.color || '#fff'; ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.fillStyle = fx.color || '#fff';
        if (fx.icon) { ctx.fillText(fx.icon, cx, cy); }
        else ctx.fillRect(cx - 2, cy - 2, 4, 4);
        ctx.globalAlpha = 1;
      } else if (fx.type === 'slash') {
        const cx = fx.x2 * TILE_SIZE + TILE_SIZE / 2, cy = fx.y2 * TILE_SIZE + TILE_SIZE / 2;
        const d = TILE_SIZE / 2;
        ctx.strokeStyle = fx.color || 'red';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (fx.type === 'dust') {
        const cx = fx.x * TILE_SIZE + TILE_SIZE / 2, cy = fx.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.fillStyle = fx.color || 'rgba(200,200,200,0.8)';
        ctx.globalAlpha = 1 - p;
        for(let i=0;i<8;i++){
          const ang = (Math.PI*2/8)*i;
          const dist = fx.r * p;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang)*dist, cy + Math.sin(ang)*dist, 2, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (fx.type === 'firework') {
        const cx = fx.x * TILE_SIZE + TILE_SIZE / 2, cy = fx.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = fx.color || 'rgba(255,200,0,0.8)';
        for (let i = 0; i < 10; i++) {
          const ang = (Math.PI * 2 / 10) * i;
          const dist = fx.r * p;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (fx.type === 'levelup') {
        const cx = fx.x * TILE_SIZE + TILE_SIZE / 2, cy = fx.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.strokeStyle = fx.color || 'rgba(0,255,0,0.8)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.arc(cx, cy, fx.r * p, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  } else {
    if (!sceneBuilt || entityMeshes.length !== G.entities.length || itemMeshes.length !== G.items.length) buildScene3D();
    updateFigure(playerMesh, G.player.x, G.player.y);
    for (const obj of entityMeshes) {
      updateFigure(obj.mesh, obj.e.x, obj.e.y);
      obj.mesh.visible = G.visible[obj.e.y][obj.e.x];
    }
    for (const obj of itemMeshes) {
      obj.mesh.visible = G.visible[obj.it.y][obj.it.x];
    }
    for (const obj of chestMeshes) {
      obj.mesh.visible = G.visible[obj.y][obj.x];
    }
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      tileMeshes[y][x].visible = G.visible[y][x];
    }
    camera.position.set(G.player.x, 15, G.player.y + 15);
    camera.lookAt(G.player.x, 0, G.player.y);
    fxGroup.clear();
    for (const fx of G.effects) {
      const p = fx.duration ? fx.elapsed / fx.duration : 0;
        if (fx.type === 'arrow') {
          const x = fx.x1 + (fx.x2 - fx.x1) * p;
          const y = fx.y1 + (fx.y2 - fx.y1) * p;
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8), new THREE.MeshBasicMaterial({color: fx.color || 0xffff00, transparent:true, opacity:1-p}));
          m.position.set(x,0.5,y);
          fxGroup.add(m);
        } else if (fx.type === 'slash') {
          const x = fx.x2;
          const y = fx.y2;
          const len = Math.SQRT2;
          const geom = new THREE.BoxGeometry(0.1,0.1,len);
          const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({color: fx.color || 0xff0000, transparent:true, opacity:1-p}));
          m.position.set(x,0.9,y);
          m.rotation.y = Math.PI/4;
          fxGroup.add(m);
        } else if (fx.type === 'fireball') {
          const s = (fx.r / TILE_SIZE) * p;
          const outer = new THREE.Mesh(new THREE.SphereGeometry(s,8,8), new THREE.MeshBasicMaterial({color: fx.color || 0xff5000, transparent:true, opacity:0.5*(1-p)}));
          outer.position.set(fx.x,0.5,fx.y);
          fxGroup.add(outer);
          const core = new THREE.Mesh(new THREE.SphereGeometry(s*0.5,8,8), new THREE.MeshBasicMaterial({color: 0xffff00, transparent:true, opacity:1-p}));
          core.position.set(fx.x,0.5,fx.y);
          fxGroup.add(core);
        } else if (fx.type === 'whirlwind') {
          const blades = 12;
          for(let i=0;i<blades;i++){
            const ang = p * Math.PI * 2 + (Math.PI*2/blades)*i;
            const m = new THREE.Mesh(new THREE.ConeGeometry(0.1,0.5,8), new THREE.MeshBasicMaterial({color: fx.color || 0xffff00, transparent:true, opacity:1-p}));
            m.position.set(fx.x + Math.cos(ang)*(fx.r/TILE_SIZE),0.25, fx.y + Math.sin(ang)*(fx.r/TILE_SIZE));
            m.rotation.z = ang;
            fxGroup.add(m);
          }
        } else if (fx.type === 'dust') {
          for(let i=0;i<8;i++){
            const ang = (Math.PI*2/8)*i;
            const dist = (fx.r/TILE_SIZE)*p;
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.1,6,6), new THREE.MeshBasicMaterial({color:0xcccccc, transparent:true, opacity:1-p}));
            m.position.set(fx.x+Math.cos(ang)*dist,0.25,fx.y+Math.sin(ang)*dist);
            fxGroup.add(m);
          }
        } else if (fx.type === 'firework') {
          for (let i = 0; i < 10; i++) {
            const ang = (Math.PI * 2 / 10) * i;
            const dist = (fx.r / TILE_SIZE) * p;
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(fx.color || 0xffff00), transparent: true, opacity: 1 - p }));
            m.position.set(fx.x + Math.cos(ang) * dist, 0.5, fx.y + Math.sin(ang) * dist);
            fxGroup.add(m);
          }
        } else if (fx.type === 'levelup') {
          const s = (fx.r / TILE_SIZE) * p;
          const m = new THREE.Mesh(new THREE.RingGeometry(s*0.5, s, 16), new THREE.MeshBasicMaterial({color:0x00ff00, transparent:true, opacity:1-p, side:THREE.DoubleSide}));
          m.rotation.x = Math.PI/2;
          m.position.set(fx.x,0.5,fx.y);
          fxGroup.add(m);
        }
    }
    renderer3d.render(scene, camera);
  }
  renderMinimap();
}

export function renderInv(){
  const inv = document.getElementById('uiInv');
  inv.innerHTML = '';
  G.player.inv.forEach((it, idx)=>{
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<b>${it.name}</b><br><span class="muted">[${idx+1}] use / shift+${idx+1} drop</span>`;
    div.addEventListener('click', ()=>useItem(idx));
    div.addEventListener('contextmenu', (e)=>{ e.preventDefault(); discardItem(idx); });
    inv.appendChild(div);
  });
  // pad to 6 slots
  for(let i=G.player.inv.length;i<6;i++){ const d=document.createElement('div'); d.className='slot'; d.innerHTML='—'; inv.appendChild(d); }
}

export function updateUI(){
  if(!G.player) return;
  document.getElementById('uiClass').textContent = G.player.cls;
  document.getElementById('uiLvl').textContent = G.player.lvl;
  document.getElementById('uiXP').textContent = `${G.player.xp}/${G.player.nextXp}`;
  document.getElementById('uiAtk').textContent = G.player.atk;
  document.getElementById('uiDef').textContent = G.player.def;
  document.getElementById('uiHP').textContent = `${G.player.hp}/${G.player.hpMax}`;
  document.getElementById('uiMP').textContent = `${G.player.mp}/${G.player.mpMax}`;
  document.getElementById('uiAmmo').textContent = G.player.cls==='hunter'? G.player.ammo : '—';
  document.getElementById('uiGold').textContent = G.gold;
  document.getElementById('uiFloor').textContent = G.floor;
  document.getElementById('uiWeapon').textContent = G.player.weapon? G.player.weapon.name : 'None';
  document.getElementById('uiArmor').textContent = G.player.armor? G.player.armor.name : 'None';
  document.getElementById('barHP').style.width = `${Math.max(0, (G.player.hp/G.player.hpMax)*100)}%`;
  document.getElementById('barMP').style.width = `${G.player.mpMax? (G.player.mp/G.player.mpMax)*100 : 0}%`;
  renderInv();
}

function renderMinimap(){
  mctx.clearRect(0,0,minimap.width,minimap.height);
  const sx=minimap.width/MAP_W, sy=minimap.height/MAP_H;
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
    if(!G.seen[y][x]) continue;
    const t=G.map[y][x];
    let col='#ddd';
    if(t===T.WALL) col='#888';
    else if(t===T.WATER) col='#55f';
    else if(t===T.STAIRS) col='#654321';
    else if(t===T.FOUNTAIN) col='#4fc3f7';
    mctx.fillStyle=col;
    mctx.fillRect(x*sx,y*sy,sx,sy);
  }
  mctx.fillStyle='red';
  for(const e of G.entities){ if(!G.seen[e.y][e.x]) continue; mctx.fillRect(e.x*sx,e.y*sy,sx,sy); }
  mctx.fillStyle='#ffa500';
  mctx.fillRect(G.player.x*sx,G.player.y*sy,sx,sy);
}
