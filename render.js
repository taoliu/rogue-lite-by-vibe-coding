import * as THREE from 'three';
import { T, TILE_SIZE, MAP_W, MAP_H } from './data.js';
import { G, useItem, discardItem } from './game.js';

// --- Rendering and UI ---
// Toggle between classic 2D canvas rendering and experimental 3D using Three.js
const USE_WEBGL = true;
const canvas = document.getElementById('view');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');
let ctx, renderer3d, scene, camera, playerMesh,
  entityMeshes = [], itemMeshes = [], chestMeshes = [], tileMeshes = [], fxGroup,
  sceneBuilt = false;

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
  renderer3d.setSize(canvas.width, canvas.height);
  renderer3d.setClearColor(0xffffff);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
  camera.position.set(MAP_W / 2, 30, MAP_H * 1.3);
  camera.lookAt(MAP_W / 2, 0, MAP_H / 2);
  const ambient = new THREE.AmbientLight(0x888888);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);
} else {
  // Original 2D canvas setup
  ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '20px sans-serif';
}

function rect(x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(x,y,w,h); }

function drawTile(x,y,t){
  const px=x*TILE_SIZE, py=y*TILE_SIZE;
  if(t===T.WALL) rect(px,py,TILE_SIZE,TILE_SIZE,'#000000');
  else if(t===T.FLOOR) rect(px,py,TILE_SIZE,TILE_SIZE,'#ffffff');
  else if(t===T.STAIRS){ rect(px,py,TILE_SIZE,TILE_SIZE,'#ffffff'); ctx.fillStyle='#b8c1ff'; ctx.fillRect(px+8,py+8,8,8); }
  else if(t===T.CHEST){ rect(px,py,TILE_SIZE,TILE_SIZE,'#ffffff'); ctx.fillStyle='#8b5e34'; ctx.fillRect(px+5,py+6,14,12); ctx.fillStyle='#d4af37'; ctx.fillRect(px+5,py+12,14,2); }
  else if(t===T.WATER){ rect(px,py,TILE_SIZE,TILE_SIZE,'#cceeff'); }
  else if(t===T.FOUNTAIN){ rect(px,py,TILE_SIZE,TILE_SIZE,'#ffffff'); ctx.fillStyle='#4fc3f7'; ctx.beginPath(); ctx.arc(px+TILE_SIZE/2, py+TILE_SIZE/2, 6, 0, Math.PI*2); ctx.fill(); }
  else if(t===T.TRAP){ rect(px,py,TILE_SIZE,TILE_SIZE,'#ffffff'); ctx.fillStyle='#000'; ctx.fillRect(px+4,py+4,16,16); }
}

function createCharacterMesh(color){
  const group = new THREE.Group();

  // legs
  const legGeom = new THREE.CylinderGeometry(0.1,0.1,0.5,6);
  const legMat = new THREE.MeshLambertMaterial({color});
  const legL = new THREE.Mesh(legGeom, legMat);
  legL.position.set(-0.15,0.25,0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(legL); group.add(legR);

  // body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3,0.3,0.8,8),
    new THREE.MeshLambertMaterial({color})
  );
  body.position.y = 0.9;
  group.add(body);

  // arms
  const armGeom = new THREE.CylinderGeometry(0.08,0.08,0.5,6);
  const armL = new THREE.Mesh(armGeom, new THREE.MeshLambertMaterial({color}));
  armL.rotation.z = Math.PI/2;
  armL.position.set(-0.35,0.9,0);
  const armR = armL.clone();
  armR.position.x = 0.35;
  group.add(armL); group.add(armR);

  // head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25,8,8),
    new THREE.MeshLambertMaterial({color:0xffe0bd})
  );
  head.position.y = 1.55;
  group.add(head);

  return group;
}

function createDragonMesh(){
  const g = createCharacterMesh(0xff0000);
  const wingGeom = new THREE.BoxGeometry(0.1,0.4,1);
  const mat = new THREE.MeshLambertMaterial({color:0xaa0000});
  const left = new THREE.Mesh(wingGeom,mat);
  left.position.set(-0.5,1.0,0);
  left.rotation.z=Math.PI/4;
  const right = left.clone();
  right.position.x=0.5;
  right.rotation.z=-Math.PI/4;
  g.add(left); g.add(right);
  g.scale.set(1.5,1.5,1.5);
  return g;
}

function createCrystalGuardianMesh(){
  const group=new THREE.Group();
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(0.6),new THREE.MeshLambertMaterial({color:0x00ffff}));
  core.position.y=0.6;
  group.add(core);
  return group;
}

function createMerchantMesh(){
  const g=createCharacterMesh(0x996633);
  const bag=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),new THREE.MeshLambertMaterial({color:0x8b4513}));
  bag.position.set(-0.4,0.9,0);
  g.add(bag);
  return g;
}

function createStairsMesh(){
  const group=new THREE.Group();
  for(let i=0;i<3;i++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(1,0.15,1-(i*0.3)),new THREE.MeshLambertMaterial({color:0xb8c1ff}));
    step.position.set(0,0.075+i*0.15,-0.35+i*0.15);
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
  return mesh;
}

function createPlayerMesh(cls){
  const colors={warrior:0x880000,mage:0x000088,hunter:0x006600};
  const group=createCharacterMesh(colors[cls]||0xffff00);
  if(cls==='warrior'){
    const sword=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.8),new THREE.MeshLambertMaterial({color:0xcccccc}));
    sword.position.set(0.45,0.9,0); sword.rotation.x=Math.PI/2; group.add(sword);
  } else if(cls==='mage'){
    const hat=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.5,8),new THREE.MeshLambertMaterial({color:0x0000ff}));
    hat.position.y=1.9; group.add(hat);
  } else if(cls==='hunter'){
    const bow=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.02,8,16,Math.PI),new THREE.MeshLambertMaterial({color:0x996633}));
    bow.rotation.y=Math.PI/2; bow.position.set(0.45,0.9,0); group.add(bow);
  }
  return group;
}

function createMonsterMesh(monster){
  const name=monster.name;
  if(name==='Goblin') return createCharacterMesh(0x00aa00);
  if(name==='Skeleton Archer'){
    const m=createCharacterMesh(0xffffff);
    const bow=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.02,8,16,Math.PI),new THREE.MeshLambertMaterial({color:0x996633}));
    bow.rotation.y=Math.PI/2; bow.position.set(0.45,0.9,0); m.add(bow);
    return m;
  }
  if(name==='Orc'){ const m=createCharacterMesh(0x225500); m.scale.set(1.1,1.1,1.1); return m; }
  if(name==='Zombie') return createCharacterMesh(0x99cc00);
  if(name==='Mimic') return createChestMesh();
  if(name==='Ogre'){ const m=createCharacterMesh(0x553300); m.scale.set(1.3,1.3,1.3); return m; }
  if(name==='Young Dragon') return createDragonMesh();
  if(name==='Crystal Guardian') return createCrystalGuardianMesh();
  if(monster.type==='merchant') return createMerchantMesh();
  return createCharacterMesh(0xff0000);
}

function buildScene3D(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  const ambient = new THREE.AmbientLight(0x888888);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);
  tileMeshes = Array.from({length:MAP_H},()=>Array(MAP_W));
  chestMeshes = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = G.map[y][x];
    const group = new THREE.Group();
    group.position.set(x,0,y);
    scene.add(group);
    tileMeshes[y][x] = group;
    let color = 0xffffff;
    let h = 0.1;
    if (t === T.WALL){ color = 0x000000; h = 1; }
    else if (t === T.WATER){ color = 0x113355; h = 0.05; }
    const base = new THREE.Mesh(new THREE.BoxGeometry(1,h,1), new THREE.MeshLambertMaterial({color}));
    base.position.y = h/2;
    group.add(base);
    if (t === T.STAIRS) {
      group.add(createStairsMesh());
    } else if (t === T.FOUNTAIN) {
      group.add(createFountainMesh());
    }
    if (t === T.CHEST) {
      const chest = createChestMesh();
      chest.position.set(x, 0, y);
      scene.add(chest);
      chestMeshes.push({ mesh: chest, x, y });
    }
  }
  playerMesh = createPlayerMesh(G.player.cls);
  scene.add(playerMesh);
  entityMeshes = [];
  for (const e of G.entities) {
    const mesh = createMonsterMesh(e);
    mesh.position.set(e.x, 0, e.y);
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // tiles
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const seen = G.seen[y][x];
      if (!seen) { rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, '#ffffff'); continue; }
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
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - p;
        for(let i=0;i<4;i++){
          const ang = p * Math.PI * 2 + (Math.PI/2)*i;
          ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ang) * fx.r, cy + Math.sin(ang) * fx.r);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (fx.type === 'fireball') {
        const ex = fx.x * TILE_SIZE + TILE_SIZE / 2, ey = fx.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.strokeStyle = fx.color || 'rgba(255,80,0,0.5)'; ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath(); ctx.arc(ex, ey, fx.r * p, 0, Math.PI * 2); ctx.stroke();
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
      } else if (fx.type === 'circle') {
        const ex = fx.x * TILE_SIZE + TILE_SIZE / 2, ey = fx.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ex, ey, fx.r, 0, Math.PI * 2); ctx.stroke();
      } else if (fx.type === 'line') {
        const x1 = fx.x * TILE_SIZE + TILE_SIZE / 2, y1 = fx.y * TILE_SIZE + TILE_SIZE / 2;
        const x2 = fx.x2 * TILE_SIZE + TILE_SIZE / 2, y2 = fx.y2 * TILE_SIZE + TILE_SIZE / 2;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      } else if (fx.type === 'firework') {
        const ex = fx.x * TILE_SIZE + TILE_SIZE / 2, ey = fx.y * TILE_SIZE + TILE_SIZE / 2;
        const p2 = fx.elapsed / fx.duration;
        ctx.strokeStyle = fx.color;
        ctx.globalAlpha = 1 - p2;
        for (let i = 0; i < 12; i++) {
          const ang = (Math.PI * 2 / 12) * i;
          const x2 = ex + Math.cos(ang) * fx.r * p2;
          const y2 = ey + Math.sin(ang) * fx.r * p2;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  } else {
    if (!sceneBuilt || entityMeshes.length !== G.entities.length || itemMeshes.length !== G.items.length) buildScene3D();
    playerMesh.position.set(G.player.x, 0, G.player.y);
    for (const obj of entityMeshes) {
      obj.mesh.position.set(obj.e.x, 0, obj.e.y);
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
    camera.position.set(G.player.x, 20, G.player.y + 20);
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
      } else if (fx.type === 'fireball') {
        const s = (fx.r / TILE_SIZE) * p;
        const m = new THREE.Mesh(new THREE.SphereGeometry(s,8,8), new THREE.MeshBasicMaterial({color: fx.color || 0xff5000, transparent:true, opacity:1-p}));
        m.position.set(fx.x,0.5,fx.y);
        fxGroup.add(m);
      } else if (fx.type === 'whirlwind') {
        const blades = 8;
        for(let i=0;i<blades;i++){
          const ang = p * Math.PI * 2 + (Math.PI*2/blades)*i;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,6), new THREE.MeshBasicMaterial({color: fx.color || 0xffff00, transparent:true, opacity:1-p}));
          m.position.set(fx.x + Math.cos(ang)*(fx.r/TILE_SIZE),0.25, fx.y + Math.sin(ang)*(fx.r/TILE_SIZE));
          fxGroup.add(m);
        }
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
    let col='#eee';
    if(t===T.WALL) col='#000';
    else if(t===T.WATER) col='#55f';
    else if(t===T.STAIRS) col='#b8c1ff';
    else if(t===T.FOUNTAIN) col='#4fc3f7';
    mctx.fillStyle=col;
    mctx.fillRect(x*sx,y*sy,sx,sy);
  }
  mctx.fillStyle='red';
  for(const e of G.entities){ if(!G.seen[e.y][e.x]) continue; mctx.fillRect(e.x*sx,e.y*sy,sx,sy); }
  mctx.fillStyle='#ffa500';
  mctx.fillRect(G.player.x*sx,G.player.y*sy,sx,sy);
}
