// --- Rendering and UI ---
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

function rect(x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(x,y,w,h); }

function drawTile(x,y,t){
  const px=x*TILE_SIZE, py=y*TILE_SIZE;
  if(t===T.WALL) rect(px,py,TILE_SIZE,TILE_SIZE,'#1a2336');
  else if(t===T.FLOOR) rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522');
  else if(t===T.STAIRS){ rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522'); ctx.fillStyle='#b8c1ff'; ctx.fillRect(px+8,py+8,8,8); }
  else if(t===T.CHEST){ rect(px,py,TILE_SIZE,TILE_SIZE,'#0f1522'); ctx.fillStyle='#8b5e34'; ctx.fillRect(px+5,py+6,14,12); ctx.fillStyle='#d4af37'; ctx.fillRect(px+5,py+12,14,2); }
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // tiles
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
    const seen = G.seen[y][x];
    if(!seen){ rect(x*TILE_SIZE,y*TILE_SIZE,TILE_SIZE,TILE_SIZE,'#07090f'); continue; }
    drawTile(x,y,G.map[y][x]);
  }
  // items
  for(const it of G.items){ if(!G.seen[it.y][it.x]) continue; ctx.fillStyle = '#ffd166'; ctx.fillRect(it.x*TILE_SIZE+10, it.y*TILE_SIZE+10, 4,4); }
  // entities (monsters)
  for(const e of G.entities){
    if(!G.seen[e.y][e.x]) continue;
    const px=e.x*TILE_SIZE+TILE_SIZE/2, py=e.y*TILE_SIZE+TILE_SIZE/2;
    ctx.fillStyle=e.color||'#76e6ff';
    ctx.beginPath(); ctx.arc(px,py,TILE_SIZE/2-3,0,Math.PI*2); ctx.fill();
  }
  // player
  const px=G.player.x*TILE_SIZE+TILE_SIZE/2, py=G.player.y*TILE_SIZE+TILE_SIZE/2;
  ctx.fillStyle = '#2dd4bf';
  ctx.beginPath(); ctx.arc(px,py,TILE_SIZE/2-3,0,Math.PI*2); ctx.fill();

  // attack effects
  ctx.lineWidth=2;
  for(const fx of G.effects){
    const ex=fx.x*TILE_SIZE, ey=fx.y*TILE_SIZE;
    ctx.strokeStyle=fx.color;
    ctx.beginPath();
    ctx.moveTo(ex,ey); ctx.lineTo(ex+TILE_SIZE,ey+TILE_SIZE);
    ctx.moveTo(ex+TILE_SIZE,ey); ctx.lineTo(ex,ey+TILE_SIZE);
    ctx.stroke();
  }
  ctx.lineWidth=1;
}

function renderInv(){
  const inv = document.getElementById('uiInv');
  inv.innerHTML = '';
  G.player.inv.forEach((it, idx)=>{
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `<b>${it.name}</b><br><span class="muted">[${idx+1}] use</span>`;
    div.addEventListener('click', ()=>useItem(idx));
    inv.appendChild(div);
  });
  // pad to 6 slots
  for(let i=G.player.inv.length;i<6;i++){ const d=document.createElement('div'); d.className='slot'; d.innerHTML='—'; inv.appendChild(d); }
}

function updateUI(){
  document.getElementById('uiClass').textContent = G.player.cls;
  document.getElementById('uiLvl').textContent = G.player.lvl;
  document.getElementById('uiXP').textContent = `${G.player.xp}/${G.player.nextXp}`;
  document.getElementById('uiAtk').textContent = G.player.atk;
  document.getElementById('uiDef').textContent = G.player.def;
  document.getElementById('uiHP').textContent = `${G.player.hp}/${G.player.hpMax}`;
  document.getElementById('uiMP').textContent = `${G.player.mp}/${G.player.mpMax}`;
  document.getElementById('uiGold').textContent = G.gold;
  document.getElementById('uiFloor').textContent = G.floor;
  document.getElementById('uiWeapon').textContent = G.player.weapon? G.player.weapon.name : 'None';
  document.getElementById('uiArmor').textContent = G.player.armor? G.player.armor.name : 'None';
  document.getElementById('barHP').style.width = `${Math.max(0, (G.player.hp/G.player.hpMax)*100)}%`;
  document.getElementById('barMP').style.width = `${G.player.mpMax? (G.player.mp/G.player.mpMax)*100 : 0}%`;
  renderInv();
}
