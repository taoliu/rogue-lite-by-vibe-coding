// --- Rendering and UI ---
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.font = '20px sans-serif';

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
  ctx.fillStyle = '#fff';
  for(const e of G.entities){
    if(!G.seen[e.y][e.x]) continue;
    const px=e.x*TILE_SIZE+TILE_SIZE/2, py=e.y*TILE_SIZE+TILE_SIZE/2;
    ctx.fillText(e.icon || e.ch || '?', px, py);
  }
  // player
  const px=G.player.x*TILE_SIZE+TILE_SIZE/2, py=G.player.y*TILE_SIZE+TILE_SIZE/2;
  ctx.fillText(G.player.icon || '@', px, py);

  // ability effects
  for(const fx of G.effects){
    const p = fx.duration ? fx.elapsed/fx.duration : 0;
    if(fx.type==='whirlwind'){
      const cx=fx.x*TILE_SIZE+TILE_SIZE/2, cy=fx.y*TILE_SIZE+TILE_SIZE/2;
      const ang=p*Math.PI*2;
      ctx.strokeStyle=fx.color||'rgba(255,255,0,0.7)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.lineTo(cx+Math.cos(ang)*fx.r, cy+Math.sin(ang)*fx.r);
      ctx.stroke();
    } else if(fx.type==='fireball'){
      const ex=fx.x*TILE_SIZE+TILE_SIZE/2, ey=fx.y*TILE_SIZE+TILE_SIZE/2;
      ctx.strokeStyle=fx.color||'rgba(255,80,0,0.5)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(ex,ey,fx.r*p,0,Math.PI*2); ctx.stroke();
    } else if(fx.type==='arrow'){
      const x1=fx.x1*TILE_SIZE+TILE_SIZE/2, y1=fx.y1*TILE_SIZE+TILE_SIZE/2;
      const x2=fx.x2*TILE_SIZE+TILE_SIZE/2, y2=fx.y2*TILE_SIZE+TILE_SIZE/2;
      const cx=x1+(x2-x1)*p, cy=y1+(y2-y1)*p;
      ctx.strokeStyle=fx.color||'#fff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(cx,cy); ctx.stroke();
      ctx.fillStyle=fx.color||'#fff';
      if(fx.icon){ ctx.fillText(fx.icon,cx,cy); }
      else ctx.fillRect(cx-2,cy-2,4,4);
    } else if(fx.type==='circle'){
      const ex=fx.x*TILE_SIZE+TILE_SIZE/2, ey=fx.y*TILE_SIZE+TILE_SIZE/2;
      ctx.strokeStyle=fx.color; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(ex,ey,fx.r,0,Math.PI*2); ctx.stroke();
    } else if(fx.type==='line'){
      const x1=fx.x*TILE_SIZE+TILE_SIZE/2, y1=fx.y*TILE_SIZE+TILE_SIZE/2;
      const x2=fx.x2*TILE_SIZE+TILE_SIZE/2, y2=fx.y2*TILE_SIZE+TILE_SIZE/2;
      ctx.strokeStyle=fx.color; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    } else if(fx.type==='firework'){
      const ex=fx.x*TILE_SIZE+TILE_SIZE/2, ey=fx.y*TILE_SIZE+TILE_SIZE/2;
      const p=fx.elapsed/fx.duration;
      ctx.strokeStyle=fx.color;
      ctx.globalAlpha = 1-p;
      for(let i=0;i<12;i++){
        const ang=(Math.PI*2/12)*i;
        const x2=ex+Math.cos(ang)*fx.r*p;
        const y2=ey+Math.sin(ang)*fx.r*p;
        ctx.beginPath();
        ctx.moveTo(ex,ey);
        ctx.lineTo(x2,y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}

function renderInv(){
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

function updateUI(){
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
