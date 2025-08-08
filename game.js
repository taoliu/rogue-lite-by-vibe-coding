// --- Game State and Logic ---
const G = {
  rng: rngFromSeed(),
  map: [],
  seen: [], // fog of war
  entities: [], // monsters
  items: [], // loose items on ground
  player: null,
  floor: 1,
  turn: 0,
  cooldown: 0,
  gold: 0,
  messages: [],
  effects: [],
  animating: 0
};

function log(msg){
  G.messages.unshift(msg);
  const el = document.getElementById('uiLog');
  el.innerHTML = G.messages.slice(0,10).map(x=>`▶ ${x}`).join('<br>');
  el.scrollTop = 0;
}

function between(v,min,max){return v>=min && v<=max}

function addEffect(fx){ G.effects.push(fx); }

// play an animated effect and resolve when finished
function playEffect(fx, duration=300){
  fx.duration = duration;
  fx.elapsed = 0;
  G.effects.push(fx);
  G.animating++;
  return new Promise(resolve=>{
    function step(ts){
      if(!fx.start) fx.start = ts;
      fx.elapsed = ts - fx.start;
      render();
      if(fx.elapsed >= fx.duration){
        G.effects = G.effects.filter(e=>e!==fx);
        G.animating--;
        render();
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  });
}

// --- Map generation: depth-first maze with rooms ---
function genMap() {
  const {rand} = G.rng;
  const w=MAP_W,h=MAP_H;
  const map = Array.from({length:h},()=>Array(w).fill(T.WALL));
  const seen= Array.from({length:h},()=>Array(w).fill(false));

  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(rand()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

  // carve maze using depth-first search (recursive backtracker)
  const stack=[[1,1]]; map[1][1]=T.FLOOR;
  while(stack.length){
    const [cx,cy]=stack[stack.length-1];
    const neigh=[];
    for(const [dx,dy] of dirs){
      const nx=cx+dx*2, ny=cy+dy*2;
      if(nx>0&&ny>0&&nx<w-1&&ny<h-1 && map[ny][nx]===T.WALL){ neigh.push([dx,dy]); }
    }
    if(neigh.length){
      const [dx,dy]=shuffle(neigh)[0];
      map[cy+dy][cx+dx]=T.FLOOR;
      map[cy+dy*2][cx+dx*2]=T.FLOOR;
      stack.push([cx+dx*2, cy+dy*2]);
    } else {
      stack.pop();
    }
  }

  // add random rectangular rooms for variety
  const roomAttempts = 4 + G.floor;
  for(let i=0;i<roomAttempts;i++){
    const rw=3+((rand()*6)|0); const rh=3+((rand()*6)|0);
    const rx=1+((rand()*(w-rw-2))|0); const ry=1+((rand()*(h-rh-2))|0);
    for(let y=ry;y<ry+rh;y++) for(let x=rx;x<rx+rw;x++) map[y][x]=T.FLOOR;
  }

  // place stairs far from start corner
  let sx=0, sy=0, tries=0;
  do { sx=(rand()*w)|0; sy=(rand()*h)|0; tries++; } while((map[sy][sx]!==T.FLOOR || Math.hypot(sx-1, sy-1)<Math.min(w,h)/3) && tries<5e3);
  map[sy][sx]=T.STAIRS;

  // sprinkle chests, more on deeper floors
  for(let i=0;i<8+G.floor;i++){
    const cx=(rand()*w)|0, cy=(rand()*h)|0; if(map[cy][cx]===T.FLOOR) map[cy][cx]=T.CHEST;
  }

  // add special terrain
  for(let i=0;i<3;i++){ // water ponds
    const px=(rand()*w)|0, py=(rand()*h)|0;
    if(map[py][px]===T.FLOOR && !(px===1&&py===1)){
      map[py][px]=T.WATER;
      if(px+1<w && map[py][px+1]===T.FLOOR) map[py][px+1]=T.WATER;
      if(py+1<h && map[py+1][px]===T.FLOOR) map[py+1][px]=T.WATER;
    }
  }
  for(let i=0;i<2;i++){ // fountains
    const fx=(rand()*w)|0, fy=(rand()*h)|0;
    if(map[fy][fx]===T.FLOOR && !(fx===1&&fy===1)) map[fy][fx]=T.FOUNTAIN;
  }
  for(let i=0;i<2;i++){ // trap doors
    const tx=(rand()*w)|0, ty=(rand()*h)|0;
    if(map[ty][tx]===T.FLOOR && !(tx===1&&ty===1)) map[ty][tx]=T.TRAP;
  }

  G.map = map; G.seen = seen; G.effects=[];

  // place monsters with scaling difficulty
  G.entities=[];
  const monsCount = 8 + (G.floor*3);
  let placed=0; let safety=0;
  while(placed<monsCount && safety<5000){
    safety++;
    const mx=(rand()*w)|0, my=(rand()*h)|0; if(map[my][mx]!==T.FLOOR) continue;
    if(mx===1 && my===1) continue; // don't spawn on player
    const tier = Math.min(MONSTERS.length-1, 2 + ((rand()*G.floor)|0));
    const base = MONSTERS[(rand()*(tier+1))|0];
    const scale = 1 + (G.floor-1)*0.15;
    const mHp = Math.round(base.hp * scale);
    const mAtk = Math.max(1, Math.round((base.atk||2) * scale));
    const mMp = base.mp || 0;
    G.entities.push({type:'monster', x:mx, y:my, ...JSON.parse(JSON.stringify(base)), hp: mHp, hpMax: mHp, mp: mMp, mpMax: mMp, atk: mAtk});
    placed++;
  }

  // scatter ground items
  G.items=[];
  for(let i=0;i<6;i++) placeGroundItem();

  // position player at maze start
  G.player.x=1; G.player.y=1;
  fov();
}

function placeGroundItem(){
  const {rand}=G.rng, w=MAP_W, h=MAP_H;
  let ix=0, iy=0, tries=0;
  do{ ix=(rand()*w)|0; iy=(rand()*h)|0; tries++; } while(G.map[iy][ix]!==T.FLOOR && tries<1000);
  const isRare = Math.random()<0.25;
  const pool = isRare? LOOT.rare : LOOT.common;
  const item = JSON.parse(JSON.stringify(pool[(Math.random()*pool.length)|0]));
  G.items.push({x:ix, y:iy, item});
}

// --- Player setup and inventory ---
function newPlayer(cls){
  const base = CLASSES[cls];
  return {
    type:'player', cls, x:0, y:0,
    hp: base.hp, hpMax: base.hp,
    mp: base.mp, mpMax: base.mp,
    atk: base.atk, def: base.def,
    lvl: 1, xp: 0, nextXp: 20,
    abilityCd: 0, abilityMaxCd: base.abilityCd,
    inv: [],
    weapon: null, armor: null,
    ammo: base.ammo||0, ammoMax: base.ammoMax||0,
    icon: base.icon || '@'
  }
}

function gainXP(x){
  G.player.xp += x; log(`You gain ${x} XP.`);
  while(G.player.xp >= G.player.nextXp){
    G.player.xp -= G.player.nextXp; G.player.lvl++; G.player.nextXp = Math.floor(G.player.nextXp*1.5);
    G.player.hpMax += 5; G.player.atk += 1; G.player.hp = G.player.hpMax;
    log(`== Level up! You are now level ${G.player.lvl}.`);
  }
}

function openChest(){
  if(G.map[G.player.y][G.player.x]!==T.CHEST){ log('No chest here.'); return; }
  G.map[G.player.y][G.player.x]=T.FLOOR;
  const isRare = Math.random()<0.5;
  const pool = isRare? LOOT.rare : LOOT.common;
  const item = JSON.parse(JSON.stringify(pool[(Math.random()*pool.length)|0]));
  const gold = (Math.random()*20+10)|0;
  G.gold += gold;
  if(G.player.inv.length >= 9){
    log(`You open the chest and find ${item.name} and ${gold} gold, but your inventory is full!`);
  } else {
    G.player.inv.push(item);
    log(`You open the chest and find ${item.name} and ${gold} gold!`);
  }
  renderInv(); updateUI(); render();
}

function pickup(){
  if(G.map[G.player.y][G.player.x]===T.CHEST){ openChest(); return; }
  const here = G.items.findIndex(it=>it.x===G.player.x && it.y===G.player.y);
  if(here===-1){ log('Nothing to pick up.'); return; }
  if(G.player.inv.length >= 9){ log('Inventory full.'); return; }
  const obj = G.items.splice(here,1)[0].item;
  G.player.inv.push(obj);
  log(`Picked up ${obj.name}.`);
  renderInv();
}

function applyEquipStats(it, sign){
  if(it.hp){ G.player.hpMax += sign*it.hp; if(sign>0) G.player.hp += it.hp; }
  if(it.mp){ G.player.mpMax += sign*it.mp; if(sign>0) G.player.mp += it.mp; }
  if(it.atk) G.player.atk += sign*it.atk;
  if(it.def) G.player.def += sign*it.def;
  G.player.hp = Math.min(G.player.hp, G.player.hpMax);
  G.player.mp = Math.min(G.player.mp, G.player.mpMax);
}

async function useItem(i){
  const it = G.player.inv[i]; if(!it) return;
  if(it.type==='potion'){ G.player.hp = Math.min(G.player.hpMax, G.player.hp + it.heal); log(`You drink a potion (+${it.heal} HP).`); G.player.inv.splice(i,1); }
  else if(it.type==='mana'){ G.player.mp = Math.min(G.player.mpMax, G.player.mp + (it.mana||5)); log(`Mana restored.`); G.player.inv.splice(i,1); }
  else if(it.type==='bomb'){ log('You throw a bomb!'); aoe(G.player.x, G.player.y, 1, it.dmg); G.player.inv.splice(i,1); await tick(); }
  else if(it.type==='throw'){ log('You throw a dagger!'); await shootLine(it.dmg, 4); G.player.inv.splice(i,1); await tick(); }
  else if(it.type==='ammo'){ G.player.ammo = Math.min(G.player.ammoMax, G.player.ammo + (it.ammo||0)); log('You replenish arrows.'); G.player.inv.splice(i,1); }
  else if(it.type==='equip'){
    if(it.atk){ if(G.player.weapon) applyEquipStats(G.player.weapon, -1); G.player.weapon = it; }
    else { if(G.player.armor) applyEquipStats(G.player.armor, -1); G.player.armor = it; }
    applyEquipStats(it, 1);
    log(`Equipped ${it.name}.`); G.player.inv.splice(i,1);
  }
  updateUI();
}

function discardItem(i){
  const it = G.player.inv[i]; if(!it) return;
  G.player.inv.splice(i,1);
  G.items.push({x:G.player.x, y:G.player.y, item:it});
  log(`Dropped ${it.name}.`);
  updateUI();
}

// --- Field of View (simple LOS radius) ---
function fov(){
  const r=8; const {x:px,y:py}=G.player;
  for(let y=py-r;y<=py+r;y++) for(let x=px-r;x<=px+r;x++){
    if(!between(x,0,MAP_W-1)||!between(y,0,MAP_H-1)) continue;
    if(Math.hypot(x-px,y-py)<=r){ G.seen[y][x]=true; }
  }
}

// --- Movement & Combat ---
function isWalkable(x,y){
  return between(x,0,MAP_W-1) && between(y,0,MAP_H-1) && G.map[y][x]!==T.WALL;
}
function hasLineOfSight(x1,y1,x2,y2){
  let dx = x2-x1, dy = y2-y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for(let i=1;i<steps;i++){
    const t = i/steps;
    const x = Math.round(x1 + dx*t);
    const y = Math.round(y1 + dy*t);
    if(!isWalkable(x,y)) return false;
  }
  return true;
}
function entityAt(x,y){ return G.entities.find(e=>e.x===x&&e.y===y); }
function move(dx,dy){
  const nx=G.player.x+dx, ny=G.player.y+dy;
  if(!isWalkable(nx,ny)){ log('You bump into a wall.'); return; }
  const m = entityAt(nx,ny);
  if(m){
    // attack melee
    const dmg = Math.max(1, G.player.atk - (m.def||0));
    m.hp -= dmg; log(`You hit the ${m.name} for ${dmg}.`);
    if(m.hp<=0){
      log(`The ${m.name} dies.`);
      gainXP(m.xp);
      maybeDrop(m);
      G.entities = G.entities.filter(e=>e!==m);
    }
    tick();
    return;
  }
  G.player.x=nx; G.player.y=ny;
  const tile = G.map[ny][nx];
  if(tile===T.FOUNTAIN){
    G.player.hp = Math.min(G.player.hpMax, G.player.hp+5);
    G.player.mp = Math.min(G.player.mpMax, G.player.mp+5);
    log('You feel refreshed by the fountain.');
  } else if(tile===T.TRAP){
    log('You fall through a trap door!');
    descend();
    return;
  }
  if(G.player.cls==='mage'){
    G.player.mp = Math.min(G.player.mpMax, G.player.mp + 1);
  }
  tick();
}

function wait(){ log('You wait.'); tick(); }

function maybeDrop(mon){
  // gold or item
  if(Math.random()<0.7){ const g = (Math.random()*8+2)|0; G.gold+=g; log(`You loot ${g} gold.`); }
  if(Math.random()<0.35){ G.items.push({x:mon.x, y:mon.y, item: JSON.parse(JSON.stringify(LOOT.common[(Math.random()*LOOT.common.length)|0]))}); }
  if(Math.random()<0.12){ G.items.push({x:mon.x, y:mon.y, item: JSON.parse(JSON.stringify(LOOT.rare[(Math.random()*LOOT.rare.length)|0]))}); }
  updateUI();
}

// Ability handlers
async function ability(){
  if(G.player.cls==='warrior'){
    if(G.player.abilityCd>0){ log(`Ability on cooldown (${G.player.abilityCd}).`); return; }
    log('Whirlwind!');
    await playEffect({type:'whirlwind', x:G.player.x, y:G.player.y, r:TILE_SIZE});
    const tiles=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for(const [dx,dy] of tiles){
      const m=entityAt(G.player.x+dx, G.player.y+dy);
      if(m){
        const dmg = Math.max(1, G.player.atk+1-(m.def||0));
        m.hp-=dmg; log(`Whirlwind hits ${m.name} for ${dmg}.`);
        if(m.hp<=0){ gainXP(m.xp); maybeDrop(m); G.entities=G.entities.filter(e=>e!==m);} }
    }
    G.player.abilityCd = G.player.abilityMaxCd;
    await tick();
  } else if(G.player.cls==='mage'){
    if(G.player.mp<6){ log('Not enough mana.'); return; }
    log('Fireball!');
    G.player.mp-=6; updateUI();
    const dir = G.lastDir || [0,-1];
    const tx = G.player.x + dir[0];
    const ty = G.player.y + dir[1];
    if(!isWalkable(tx,ty)){ log('No clear path.'); return; }
    await playEffect({type:'arrow', x1:G.player.x, y1:G.player.y, x2:tx, y2:ty, color:'orange', icon:'🔥'});
    await playEffect({type:'fireball', x:tx, y:ty, r:TILE_SIZE*1.5, color:'rgba(255,80,0,0.5)'});
    const dmg = 10 + G.player.lvl;
    aoe(tx, ty, 1, dmg);
    await tick();
  } else if(G.player.cls==='hunter'){
    if(G.player.ammo<=0){ log('Out of arrows.'); return; }
    G.player.ammo--; updateUI();
    log('You shoot an arrow.');
    await shootLine(G.player.atk+2, 5);
    await tick();
  }
}

function aoe(cx,cy,r,dmg){
  for(const e of [...G.entities]){
    if(Math.hypot(e.x-cx,e.y-cy)<=r){
      e.hp-=dmg; log(`${e.name} takes ${dmg} damage.`);
      if(e.hp<=0){ gainXP(e.xp); maybeDrop(e); G.entities=G.entities.filter(x=>x!==e); }
    }
  }
}

async function shootLine(dmg, range){
  // shoot in the direction of last input; store lastDir
  const dir = G.lastDir || [0,-1];
  let [x,y]=[G.player.x, G.player.y];
  let endX=x, endY=y;
  let target=null;
  for(let i=0;i<range;i++){
    x+=dir[0]; y+=dir[1];
    if(!isWalkable(x,y)) break;
    endX=x; endY=y;
    const m=entityAt(x,y);
    if(m){ target=m; break; }
  }
  await playEffect({type:'arrow', x1:G.player.x, y1:G.player.y, x2:endX, y2:endY, color:'rgba(255,255,255,0.6)'});
  if(target){
    target.hp-=dmg; log(`Arrow hits ${target.name} for ${dmg}.`);
    if(target.hp<=0){ gainXP(target.xp); maybeDrop(target); G.entities=G.entities.filter(e=>e!==target); }
  }
}

function descend(){
  if(G.map[G.player.y][G.player.x]!==T.STAIRS){ log('No stairs here.'); return; }
  G.floor++; log(`You descend to floor ${G.floor}.`);
  genMap(); updateUI();
}

async function enemyTurn(){
  for(const m of G.entities){
    for(let step=0; step<(m.speed||1); step++){
      const dx = G.player.x - m.x; const dy = G.player.y - m.y; const dist = Math.hypot(dx,dy);
      if(m.attack==='ranged' && dist <= (m.range||4) && hasLineOfSight(m.x,m.y,G.player.x,G.player.y)){
        await playEffect({type:'arrow', x1:m.x, y1:m.y, x2:G.player.x, y2:G.player.y, color:'rgba(255,0,0,0.6)'});
        const dmg = Math.max(1, (m.atk||2) - G.player.def);
        G.player.hp -= dmg; log(`${m.name} shoots you for ${dmg}.`);
        if(G.player.hp<=0){ gameOver(); return; }
        break;
      } else if(m.attack==='magic' && dist <= (m.range||4) && (m.mp||0) >= (m.cost||2) && hasLineOfSight(m.x,m.y,G.player.x,G.player.y)){
        m.mp -= (m.cost||2);
        await playEffect({type:'arrow', x1:m.x, y1:m.y, x2:G.player.x, y2:G.player.y, color:'rgba(0,255,255,0.6)', icon:'✨'});
        const dmg = Math.max(1, (m.atk||2) - G.player.def);
        G.player.hp -= dmg; log(`${m.name} casts a spell for ${dmg}.`);
        if(G.player.hp<=0){ gameOver(); return; }
        break;
      } else if(dist<7){
        const sdx = Math.sign(dx), sdy = Math.sign(dy);
        const nx = m.x + (Math.abs(dx)>Math.abs(dy)? sdx : 0);
        const ny = m.y + (Math.abs(dy)>=Math.abs(dx)? sdy : 0);
        if(nx===G.player.x && ny===G.player.y){
          const dmg = Math.max(1, (m.atk||2) - G.player.def);
          G.player.hp -= dmg; log(`${m.name} hits you for ${dmg}.`);
          if(G.player.hp<=0){ gameOver(); return; }
          break;
        } else if(isWalkable(nx,ny) && !entityAt(nx,ny)) { m.x=nx; m.y=ny; }
      } else if(Math.random()<0.3){
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]]; const [ax,ay]=dirs[(Math.random()*4)|0];
        const nx=m.x+ax, ny=m.y+ay; if(isWalkable(nx,ny) && !entityAt(nx,ny)) { m.x=nx; m.y=ny; }
      }
    }
  }
}

async function tick(){
  G.animating++;
  G.turn++;
  if(G.player.abilityCd>0) G.player.abilityCd--;
  await enemyTurn();
  fov();
  G.animating--;
  updateUI();
  render();
}

function gameOver(){
  log('*** You died. Press "New Run" to try again.');
  window.removeEventListener('keydown', onKey);
}
