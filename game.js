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
  messages: []
};

function log(msg){
  G.messages.unshift(msg);
  const el = document.getElementById('uiLog');
  el.innerHTML = G.messages.slice(0,10).map(x=>`▶ ${x}`).join('<br>');
  el.scrollTop = 0;
}

function between(v,min,max){return v>=min && v<=max}

// --- Map generation: drunkard walk rooms + sprinkled walls ---
function genMap() {
  const {rand} = G.rng;
  const w=MAP_W,h=MAP_H;
  const map = Array.from({length:h},()=>Array(w).fill(T.WALL));
  const seen= Array.from({length:h},()=>Array(w).fill(false));

  // open up with random walk
  let x = (w/2)|0, y = (h/2)|0; map[y][x]=T.FLOOR;
  let floors = 1, target = (w*h*0.45)|0; // carve ~45% floors
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(floors<target){
    const [dx,dy]=dirs[(rand()*4)|0];
    x = Math.max(1, Math.min(w-2, x+dx));
    y = Math.max(1, Math.min(h-2, y+dy));
    if(map[y][x]===T.WALL){ map[y][x]=T.FLOOR; floors++; }
    // occasionally carve neighbors to make rooms
    if(rand()<0.18){
      for(const [ax,ay] of dirs){
        const nx=x+ax, ny=y+ay; if(nx>1&&ny>1&&nx<w-2&&ny<h-2){ map[ny][nx]=T.FLOOR; }
      }
    }
  }

  // place stairs far from center
  let sx=0, sy=0, tries=0;
  do { sx=(rand()*w)|0; sy=(rand()*h)|0; tries++; } while((map[sy][sx]!==T.FLOOR || Math.hypot(sx-w/2, sy-h/2)<Math.min(w,h)/3) && tries<5e3);
  map[sy][sx]=T.STAIRS;

  // sprinkle chests
  for(let i=0;i<10;i++){
    const cx=(rand()*w)|0, cy=(rand()*h)|0; if(map[cy][cx]===T.FLOOR) map[cy][cx]=T.CHEST;
  }

  G.map = map; G.seen = seen;

  // place monsters
  G.entities=[];
  const monsCount = 10 + (G.floor*2);
  let placed=0; let safety=0;
  while(placed<monsCount && safety<5000){
    safety++;
    const mx=(rand()*w)|0, my=(rand()*h)|0; if(map[my][mx]!==T.FLOOR) continue;
    // avoid center spawn area (for player)
    if(Math.hypot(mx-w/2,my-h/2) < 6) continue;
    const tier = Math.min(MONSTERS.length-1, 2 + ((rand()*G.floor)|0));
    const base = MONSTERS[(rand()*(tier+1))|0];
    G.entities.push({type:'monster', x:mx, y:my, ...JSON.parse(JSON.stringify(base)), hpMax: base.hp});
    placed++;
  }

  // scatter ground items
  G.items=[];
  for(let i=0;i<6;i++) placeGroundItem();

  // position player near center
  let px=(w/2)|0, py=(h/2)|0; while(map[py][px]!==T.FLOOR){ px++; }
  G.player.x=px; G.player.y=py;
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
    weapon: null, armor: null
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

function pickup(){
  const here = G.items.findIndex(it=>it.x===G.player.x && it.y===G.player.y);
  if(here===-1){ log('Nothing to pick up.'); return; }
  const obj = G.items.splice(here,1)[0].item;
  G.player.inv.push(obj);
  log(`Picked up ${obj.name}.`);
  renderInv();
}

function useItem(i){
  const it = G.player.inv[i]; if(!it) return;
  if(it.type==='potion'){ G.player.hp = Math.min(G.player.hpMax, G.player.hp + it.heal); log(`You drink a potion (+${it.heal} HP).`); G.player.inv.splice(i,1); }
  else if(it.type==='mana'){ G.player.mp = Math.min(G.player.mpMax, G.player.mp + (it.mana||5)); log(`Mana restored.`); G.player.inv.splice(i,1); }
  else if(it.type==='bomb'){ log('You throw a bomb!'); aoe(G.player.x, G.player.y, 1, it.dmg); G.player.inv.splice(i,1); tick(); }
  else if(it.type==='throw'){ log('You throw a dagger!'); shootLine(it.dmg, 4); G.player.inv.splice(i,1); tick(); }
  else if(it.type==='equip'){
    if(it.hp) G.player.hpMax += it.hp;
    if(it.mp) G.player.mpMax += it.mp;
    if(it.atk) G.player.atk += it.atk;
    if(it.def) G.player.def += it.def;
    log(`Equipped ${it.name}.`); G.player.inv.splice(i,1);
  }
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
function isWalkable(x,y){ return between(x,0,MAP_W-1) && between(y,0,MAP_H-1) && G.map[y][x]!==T.WALL; }
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
  G.player.x=nx; G.player.y=ny; tick();
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
function ability(){
  if(G.player.abilityCd>0){ log(`Ability on cooldown (${G.player.abilityCd}).`); return; }
  if(G.player.cls==='warrior'){
    log('Whirlwind!');
    const tiles=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for(const [dx,dy] of tiles){ const m=entityAt(G.player.x+dx, G.player.y+dy); if(m){ const dmg = Math.max(1, G.player.atk+1-(m.def||0)); m.hp-=dmg; log(`Whirlwind hits ${m.name} for ${dmg}.`); if(m.hp<=0){ gainXP(m.xp); maybeDrop(m); G.entities=G.entities.filter(e=>e!==m);} } }
    G.player.abilityCd = G.player.abilityMaxCd;
    tick();
  } else if(G.player.cls==='mage'){
    if(G.player.mp<6){ log('Not enough mana.'); return; }
    log('Fireball!');
    G.player.mp-=6; updateUI();
    // blast 2x2 centered one tile ahead in facing direction (use last move dir or default up)
    aoe(G.player.x, G.player.y, 1, 7);
    G.player.abilityCd = G.player.abilityMaxCd; tick();
  } else if(G.player.cls==='hunter'){
    log('You shoot an arrow.');
    shootLine(G.player.atk+2, 5);
    G.player.abilityCd = G.player.abilityMaxCd; tick();
  }
}

function aoe(cx,cy,r,dmg){
  for(const e of [...G.entities]){
    if(Math.hypot(e.x-cx,e.y-cy)<=r){ e.hp-=dmg; log(`${e.name} takes ${dmg} damage.`); if(e.hp<=0){ gainXP(e.xp); maybeDrop(e); G.entities=G.entities.filter(x=>x!==e); } }
  }
}

function shootLine(dmg, range){
  // shoot in the direction of last input; store lastDir
  const dir = G.lastDir || [0,-1];
  let [x,y]=[G.player.x, G.player.y];
  for(let i=0;i<range;i++){
    x+=dir[0]; y+=dir[1]; if(!isWalkable(x,y)) break; const m=entityAt(x,y); if(m){ m.hp-=dmg; log(`Arrow hits ${m.name} for ${dmg}.`); if(m.hp<=0){ gainXP(m.xp); maybeDrop(m); G.entities=G.entities.filter(e=>e!==m);} break; }
  }
}

function descend(){
  if(G.map[G.player.y][G.player.x]!==T.STAIRS){ log('No stairs here.'); return; }
  G.floor++; log(`You descend to floor ${G.floor}.`);
  genMap(); updateUI();
}

function enemyTurn(){
  for(const m of G.entities){
    // very simple AI: approach player if in sight (within radius), else wander
    const dx = G.player.x - m.x; const dy = G.player.y - m.y; const dist = Math.hypot(dx,dy);
    if(dist<7){
      const sdx = Math.sign(dx), sdy = Math.sign(dy);
      const nx = m.x + (Math.abs(dx)>Math.abs(dy)? sdx : 0);
      const ny = m.y + (Math.abs(dy)>=Math.abs(dx)? sdy : 0);
      if(nx===G.player.x && ny===G.player.y){
        const dmg = Math.max(1, (m.atk||2) - G.player.def);
        G.player.hp -= dmg; log(`${m.name} hits you for ${dmg}.`);
        if(G.player.hp<=0){ gameOver(); return; }
      } else if(isWalkable(nx,ny) && !entityAt(nx,ny)) { m.x=nx; m.y=ny; }
    } else if(Math.random()<0.3){
      const dirs=[[1,0],[-1,0],[0,1],[0,-1]]; const [ax,ay]=dirs[(Math.random()*4)|0];
      const nx=m.x+ax, ny=m.y+ay; if(isWalkable(nx,ny) && !entityAt(nx,ny)) { m.x=nx; m.y=ny; }
    }
  }
}

function tick(){
  G.turn++;
  if(G.player.abilityCd>0) G.player.abilityCd--;
  enemyTurn();
  fov();
  updateUI();
  render();
}

function gameOver(){
  log('*** You died. Press "New Run" to try again.');
  window.removeEventListener('keydown', onKey);
}
