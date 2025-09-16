import { T, TILE_SIZE, MAP_W, MAP_H, FLOOR_THEMES } from './data.js';
import { G, useItem, discardItem } from './game.js';
import { getSprite } from './sprites.js';

// --- Canvas Setup ---
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.font = '20px sans-serif';
ctx.imageSmoothingEnabled = false;

const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');

function resizeCanvas() {
  const w = canvas.clientWidth;
  const h = w * 0.75;
  canvas.width = w;
  canvas.height = h;
  minimap.width = w / 6;
  minimap.height = h / 6;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Wall Texture ---
let wallCanvas, wallPattern;
let tileTheme = FLOOR_THEMES[0];

export function randomizeWallTexture() {
  const size = 64;
  wallCanvas = document.createElement('canvas');
  wallCanvas.width = wallCanvas.height = size;
  const c = wallCanvas.getContext('2d');
  const theme = tileTheme || FLOOR_THEMES[0];
  c.fillStyle = theme.wallMortar || theme.wallBase;
  c.fillRect(0, 0, size, size);
  const brickW = 32, brickH = 16;
  const bricks = (theme.wallBricks && theme.wallBricks.length) ? theme.wallBricks : [theme.wallBase || theme.wallMortar];
  for (let y = 0; y < size; y += brickH) {
    const offset = (y / brickH) % 2 ? brickW / 2 : 0;
    for (let x = -offset; x < size; x += brickW) {
      const shade = bricks[(Math.random() * bricks.length) | 0] || theme.wallBase;
      c.fillStyle = shade;
      c.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
    }
  }
  wallPattern = null; // rebuild on next draw
}
randomizeWallTexture();

export function applyFloorTheme(floor) {
  const idx = Math.max(0, Math.min(FLOOR_THEMES.length - 1, (floor | 0) - 1));
  tileTheme = FLOOR_THEMES[idx] || FLOOR_THEMES[0];
  randomizeWallTexture();
}

function rect(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}

function drawSpriteWithOutline(img, x, y) {
  if (!img) return;
  if (!img.complete || !img.naturalWidth) {
    if (!img.__pendingRender) {
      img.__pendingRender = true;
      img.addEventListener('load', () => {
        img.__pendingRender = false;
        render();
      }, { once: true });
      img.addEventListener('error', () => {
        img.__pendingRender = false;
        render();
      }, { once: true });
    }
    return;
  }
  ctx.save();
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE);
  ctx.restore();
}

function drawTile(mx, my, t, startX, startY) {
  const px = (mx - startX) * TILE_SIZE;
  const py = (my - startY) * TILE_SIZE;
  const theme = tileTheme || FLOOR_THEMES[0];
  if (t === T.WALL) {
    if (!wallPattern) wallPattern = ctx.createPattern(wallCanvas, 'repeat');
    ctx.fillStyle = wallPattern;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  } else if (t === T.FLOOR) {
    rect(px, py, TILE_SIZE, TILE_SIZE, theme.floor || '#dddddd');
  } else if (t === T.STAIRS) {
    rect(px, py, TILE_SIZE, TILE_SIZE, theme.stairs || '#654321');
    ctx.fillStyle = theme.stairsInset || '#333333';
    ctx.fillRect(px + 4, py + 4, 16, 16);
  } else if (t === T.CHEST) {
    rect(px, py, TILE_SIZE, TILE_SIZE, theme.floor || '#dddddd');
    ctx.fillStyle = theme.chest || '#8b5e34';
    ctx.fillRect(px + 5, py + 6, 14, 12);
    ctx.fillStyle = theme.chestBand || '#d4af37';
    ctx.fillRect(px + 5, py + 12, 14, 2);
  } else if (t === T.WATER) {
    rect(px, py, TILE_SIZE, TILE_SIZE, theme.water || '#cceeff');
  } else if (t === T.FOUNTAIN) {
    rect(px, py, TILE_SIZE, TILE_SIZE, theme.floor || '#dddddd');
    ctx.fillStyle = theme.fountain || '#4fc3f7';
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function resetScene() {
  // no-op for 2D renderer
}

// --- Main Render ---
export function render() {
  if (!G.player) return;

  const viewTilesX = Math.floor(canvas.width / TILE_SIZE);
  const viewTilesY = Math.floor(canvas.height / TILE_SIZE);
  const halfX = Math.floor(viewTilesX / 2);
  const halfY = Math.floor(viewTilesY / 2);
  let startX = G.player.x - halfX;
  let startY = G.player.y - halfY;
  startX = Math.max(0, Math.min(MAP_W - viewTilesX, startX));
  startY = Math.max(0, Math.min(MAP_H - viewTilesY, startY));

  // Reposition minimap if player overlaps with it in the top corners
  const pScreenX = (G.player.x - startX) * TILE_SIZE;
  const pScreenY = (G.player.y - startY) * TILE_SIZE;
  const margin = 10;
  if (pScreenY < minimap.height + margin) {
    if (pScreenX < minimap.width + margin) {
      // player near top-left, move minimap to top-right
      minimap.style.left = 'auto';
      minimap.style.right = margin + 'px';
    } else if (pScreenX > canvas.width - minimap.width - margin) {
      // player near top-right, move minimap to top-left
      minimap.style.right = 'auto';
      minimap.style.left = margin + 'px';
    } else {
      // default position when player is centered at top
      minimap.style.right = 'auto';
      minimap.style.left = margin + 'px';
    }
  } else {
    minimap.style.right = 'auto';
    minimap.style.left = margin + 'px';
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // tiles
  for (let sy = 0; sy < viewTilesY; sy++) {
    const my = startY + sy;
    if (my < 0 || my >= MAP_H) continue;
    for (let sx = 0; sx < viewTilesX; sx++) {
      const mx = startX + sx;
      if (mx < 0 || mx >= MAP_W) continue;
      if (!G.seen[my][mx]) continue;
      drawTile(mx, my, G.map[my][mx], startX, startY);
      if (!G.visible[my][mx]) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect((mx - startX) * TILE_SIZE, (my - startY) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // items
  for (const it of G.items) {
    if (!G.visible[it.y][it.x]) continue;
    if (it.x < startX || it.x >= startX + viewTilesX || it.y < startY || it.y >= startY + viewTilesY) continue;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect((it.x - startX) * TILE_SIZE + 10, (it.y - startY) * TILE_SIZE + 10, 4, 4);
  }

  // entities
  for (const e of G.entities) {
    if (!G.visible[e.y][e.x]) continue;
    if (e.x < startX || e.x >= startX + viewTilesX || e.y < startY || e.y >= startY + viewTilesY) continue;
    const img = getSprite(e.sprite || e.name);
    const sx = (e.x - startX) * TILE_SIZE;
    const sy = (e.y - startY) * TILE_SIZE;
    drawSpriteWithOutline(img, sx, sy);
  }

  // player
  const pImg = getSprite('player_' + G.player.cls);
  drawSpriteWithOutline(pImg, pScreenX, pScreenY);

  // effects
  for (const fx of G.effects) {
    const p = fx.duration ? fx.elapsed / fx.duration : 0;
    if (fx.type === 'whirlwind') {
      const cx = (fx.x - startX) * TILE_SIZE + TILE_SIZE / 2;
      const cy = (fx.y - startY) * TILE_SIZE + TILE_SIZE / 2;
      ctx.strokeStyle = fx.color || 'rgba(255,255,0,0.8)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - p;
      const arms = 6;
      for (let i = 0; i < arms; i++) {
        const ang = p * Math.PI * 2 + (Math.PI * 2 / arms) * i;
        ctx.beginPath();
        ctx.arc(cx, cy, fx.r * (i / arms), ang, ang + Math.PI / 3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (fx.type === 'fireball') {
      const ex = (fx.x - startX) * TILE_SIZE + TILE_SIZE / 2;
      const ey = (fx.y - startY) * TILE_SIZE + TILE_SIZE / 2;
      const r = fx.r * p;
      const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
      grd.addColorStop(0, fx.color || 'rgba(255,120,0,0.9)');
      grd.addColorStop(1, 'rgba(255,255,0,0)');
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (fx.type === 'arrow') {
      const x1 = (fx.x1 - startX) * TILE_SIZE + TILE_SIZE / 2;
      const y1 = (fx.y1 - startY) * TILE_SIZE + TILE_SIZE / 2;
      const x2 = (fx.x2 - startX) * TILE_SIZE + TILE_SIZE / 2;
      const y2 = (fx.y2 - startY) * TILE_SIZE + TILE_SIZE / 2;
      const cx = x1 + (x2 - x1) * p;
      const cy = y1 + (y2 - y1) * p;
      ctx.strokeStyle = fx.color || '#fff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.fillStyle = fx.color || '#fff';
      if (fx.icon) ctx.fillText(fx.icon, cx, cy);
      else ctx.fillRect(cx - 2, cy - 2, 4, 4);
      ctx.globalAlpha = 1;
    } else if (fx.type === 'slash') {
      const cx = (fx.x2 - startX) * TILE_SIZE + TILE_SIZE / 2;
      const cy = (fx.y2 - startY) * TILE_SIZE + TILE_SIZE / 2;
      const d = TILE_SIZE / 2;
      ctx.strokeStyle = fx.color || 'red';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.moveTo(cx - d, cy - d);
      ctx.lineTo(cx + d, cy + d);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (fx.type === 'dust') {
      const cx = (fx.x - startX) * TILE_SIZE + TILE_SIZE / 2;
      const cy = (fx.y - startY) * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillStyle = fx.color || 'rgba(200,200,200,0.8)';
      ctx.globalAlpha = 1 - p;
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 / 8) * i;
        const dist = fx.r * p;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (fx.type === 'firework') {
      const cx = (fx.x - startX) * TILE_SIZE + TILE_SIZE / 2;
      const cy = (fx.y - startY) * TILE_SIZE + TILE_SIZE / 2;
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
      const cx = (fx.x - startX) * TILE_SIZE + TILE_SIZE / 2;
      const cy = (fx.y - startY) * TILE_SIZE + TILE_SIZE / 2;
      ctx.strokeStyle = fx.color || 'rgba(0,255,0,0.8)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(cx, cy, fx.r * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  renderMinimap();
}

// --- Inventory and UI ---
export function renderInv() {
  const inv = document.getElementById('uiInv');
  inv.innerHTML = '';
  G.player.inv.forEach((it, idx) => {
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<b>${it.name}</b><br><span class="muted">[${idx + 1}] use / shift+${idx + 1} drop</span>`;
    div.addEventListener('click', () => useItem(idx));
    div.addEventListener('contextmenu', e => { e.preventDefault(); discardItem(idx); });
    inv.appendChild(div);
  });
  for (let i = G.player.inv.length; i < 6; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = '—';
    inv.appendChild(d);
  }
}

export function updateUI() {
  if (!G.player) return;
  document.getElementById('uiClass').textContent = G.player.cls;
  document.getElementById('uiLvl').textContent = G.player.lvl;
  document.getElementById('uiXP').textContent = `${G.player.xp}/${G.player.nextXp}`;
  document.getElementById('uiAtk').textContent = G.player.atk;
  document.getElementById('uiDef').textContent = G.player.def;
  document.getElementById('uiHP').textContent = `${G.player.hp}/${G.player.hpMax}`;
  document.getElementById('uiMP').textContent = `${G.player.mp}/${G.player.mpMax}`;
  document.getElementById('uiAmmo').textContent = G.player.cls === 'hunter' ? G.player.ammo : '—';
  document.getElementById('uiGold').textContent = G.gold;
  document.getElementById('uiFloor').textContent = G.floor;
  document.getElementById('uiWeapon').textContent = G.player.weapon ? G.player.weapon.name : 'None';
  document.getElementById('uiArmor').textContent = G.player.armor ? G.player.armor.name : 'None';
  document.getElementById('barHP').style.width = `${Math.max(0, (G.player.hp / G.player.hpMax) * 100)}%`;
  document.getElementById('barMP').style.width = `${G.player.mpMax ? (G.player.mp / G.player.mpMax) * 100 : 0}%`;
  renderInv();
}

function renderMinimap() {
  mctx.clearRect(0, 0, minimap.width, minimap.height);
  const sx = minimap.width / MAP_W, sy = minimap.height / MAP_H;
  const theme = tileTheme || FLOOR_THEMES[0];
  const mTheme = theme.minimap || {};
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!G.seen[y][x]) continue;
    const t = G.map[y][x];
    let col = mTheme.floor || theme.floor || '#ddd';
    if (t === T.WALL) col = mTheme.wall || theme.wallBase || '#888';
    else if (t === T.WATER) col = mTheme.water || theme.water || '#55f';
    else if (t === T.STAIRS) col = mTheme.stairs || theme.stairs || '#654321';
    else if (t === T.FOUNTAIN) col = mTheme.fountain || theme.fountain || '#4fc3f7';
    mctx.fillStyle = col;
    mctx.fillRect(x * sx, y * sy, sx, sy);
  }
  mctx.fillStyle = 'red';
  for (const e of G.entities) {
    if (!G.visible[e.y][e.x]) continue;
    mctx.fillRect(e.x * sx, e.y * sy, sx, sy);
    mctx.strokeStyle = '#000';
    mctx.strokeRect(e.x * sx, e.y * sy, sx, sy);
  }
  mctx.fillStyle = '#ffa500';
  mctx.fillRect(G.player.x * sx, G.player.y * sy, sx, sy);
  mctx.strokeStyle = '#000';
  mctx.strokeRect(G.player.x * sx, G.player.y * sy, sx, sy);
}
