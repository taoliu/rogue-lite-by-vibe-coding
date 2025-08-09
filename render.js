// import * as THREE from './node_modules/three/build/three.module.js';
import { T, TILE_SIZE, MAP_W, MAP_H } from './data.js';
import { G, useItem, discardItem } from './game.js';

// --- Rendering and UI ---
// Toggle between classic 2D canvas rendering and experimental 3D using Three.js
const USE_WEBGL = true;
const canvas = document.getElementById('view');
let ctx, renderer3d, scene, camera, playerMesh, entityMeshes = [], sceneBuilt = false;

if (USE_WEBGL) {
  // Set up a basic Three.js scene
  renderer3d = new THREE.WebGLRenderer({ canvas });
  renderer3d.setSize(canvas.width, canvas.height);
  scene = new THREE.Scene();
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
  if(t===T.WALL) rect(px,py,TILE_SIZE,TILE_SIZE,'#1a2336');
  else if(t===T.FLOOR) rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522');
  else if(t===T.STAIRS){ rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522'); ctx.fillStyle='#b8c1ff'; ctx.fillRect(px+8,py+8,8,8); }
  else if(t===T.CHEST){ rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522'); ctx.fillStyle='#8b5e34'; ctx.fillRect(px+5,py+6,14,12); ctx.fillStyle='#d4af37'; ctx.fillRect(px+5,py+12,14,2); }
  else if(t===T.WATER){ rect(px,py,TILE_SIZE,TILE_SIZE,'#113355'); }
  else if(t===T.FOUNTAIN){ rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522'); ctx.fillStyle='#4fc3f7'; ctx.beginPath(); ctx.arc(px+TILE_SIZE/2, py+TILE_SIZE/2, 6, 0, Math.PI*2); ctx.fill(); }
  else if(t===T.TRAP){ rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522'); ctx.fillStyle='#000'; ctx.fillRect(px+4,py+4,16,16); }
}

function buildScene3D(){
  scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0x888888);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = G.map[y][x];
    let color = 0x0f1522;
    if (t === T.WALL) color = 0x1a2336;
    else if (t === T.STAIRS) color = 0xb8c1ff;
    else if (t === T.WATER) color = 0x113355;
    const cube = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    cube.position.set(x, 0, y);
    scene.add(cube);
  }
  playerMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffff00 }));
  scene.add(playerMesh);
  entityMeshes = [];
  for (const e of G.entities) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    mesh.position.set(e.x, 0, e.y);
    scene.add(mesh);
    entityMeshes.push({ mesh, e });
  }
  sceneBuilt = true;
}

export function render() {
  if (!G.player) return;
  if (!USE_WEBGL) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // tiles
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const seen = G.seen[y][x];
      if (!seen) { rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, '#07090f'); continue; }
      drawTile(x, y, G.map[y][x]);
    }
    // items
    for (const it of G.items) { if (!G.seen[it.y][it.x]) continue; ctx.fillStyle = '#ffd166'; ctx.fillRect(it.x * TILE_SIZE + 10, it.y * TILE_SIZE + 10, 4, 4); }
    // entities (monsters)
    ctx.fillStyle = '#fff';
    for (const e of G.entities) {
      if (!G.seen[e.y][e.x]) continue;
      const px = e.x * TILE_SIZE + TILE_SIZE / 2, py = e.y * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillText(e.icon || e.ch || '?', px, py);
    }
    // player
    const px = G.player.x * TILE_SIZE + TILE_SIZE / 2, py = G.player.y * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText(G.player.icon || '@', px, py);

    // ability effects
    for (const fx of G.effects) {
      const p = fx.duration ? fx.elapsed / fx.duration : 0;
      if (fx.type === 'whirlwind') {
        const cx = fx.x * TILE_SIZE + TILE_SIZE / 2, cy = fx.y * TILE_SIZE + TILE_SIZE / 2;
        const ang = p * Math.PI * 2;
        ctx.strokeStyle = fx.color || 'rgba(255,255,0,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * fx.r, cy + Math.sin(ang) * fx.r);
        ctx.stroke();
      } else if (fx.type === 'fireball') {
        const ex = fx.x * TILE_SIZE + TILE_SIZE / 2, ey = fx.y * TILE_SIZE + TILE_SIZE / 2;
        ctx.strokeStyle = fx.color || 'rgba(255,80,0,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ex, ey, fx.r * p, 0, Math.PI * 2); ctx.stroke();
      } else if (fx.type === 'arrow') {
        const x1 = fx.x1 * TILE_SIZE + TILE_SIZE / 2, y1 = fx.y1 * TILE_SIZE + TILE_SIZE / 2;
        const x2 = fx.x2 * TILE_SIZE + TILE_SIZE / 2, y2 = fx.y2 * TILE_SIZE + TILE_SIZE / 2;
        const cx = x1 + (x2 - x1) * p, cy = y1 + (y2 - y1) * p;
        ctx.strokeStyle = fx.color || '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.fillStyle = fx.color || '#fff';
        if (fx.icon) { ctx.fillText(fx.icon, cx, cy); }
        else ctx.fillRect(cx - 2, cy - 2, 4, 4);
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
    if (!sceneBuilt || entityMeshes.length !== G.entities.length) buildScene3D();
    playerMesh.position.set(G.player.x, 0, G.player.y);
    for (const obj of entityMeshes) obj.mesh.position.set(obj.e.x, 0, obj.e.y);
    renderer3d.render(scene, camera);
  }
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
