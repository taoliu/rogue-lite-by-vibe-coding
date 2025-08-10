import { rngFromSeed } from './utils.js';
import { G, move, entityAt, defeat, tick, wait, ability, discardItem, useItem, newPlayer, genMap, log } from './game.js';
import { updateUI, render } from './render.js';

// --- Input & Bootstrap ---
function onKey(e){
  if(G.animating) return;
  const k=e.key.toLowerCase();
  if(['arrowup','w'].includes(k)){ move(0,-1); G.lastDir=[0,-1]; }
  else if(['arrowdown','s'].includes(k)){ move(0,1); G.lastDir=[0,1]; }
  else if(['arrowleft','a'].includes(k)){ move(-1,0); G.lastDir=[-1,0]; }
  else if(['arrowright','d'].includes(k)){ move(1,0); G.lastDir=[1,0]; }
  else if(k==='f'){ // melee in facing dir
    const d=G.lastDir||[0,-1];
    const m=entityAt(G.player.x+d[0], G.player.y+d[1]);
    if(m){
      const dmg=Math.max(1, G.player.atk-(m.def||0));
      m.hp-=dmg; log(`You strike the ${m.name} for ${dmg}.`);
      if(m.hp<=0){ defeat(m); } tick();
    } else log('No enemy to strike.');
  }
  else if(k==='.' || k==='5') wait();
  else if(k===' '){ e.preventDefault(); ability(); }
  else if(/^Digit[1-9]$/.test(e.code) || /^Numpad[1-9]$/.test(e.code)){
    const num = parseInt(e.code.slice(-1));
    if(e.shiftKey) discardItem(num-1);
    else useItem(num-1);
  }
}

function startRun(cls){
  const seedStr = document.getElementById('seed').value.trim();
  G.rng = rngFromSeed(seedStr || undefined);
  G.player = newPlayer(cls);
  G.floor=1; G.turn=0; G.gold=0; G.messages=[]; G.lastDir=[0,-1]; G.killCounts={}; G.win=false;
  const winModal=document.getElementById('winModal');
  if(winModal) winModal.remove();
  genMap(); updateUI(); render();
  document.getElementById('classModal').style.display='none';
  window.addEventListener('keydown', onKey);
  log(`You enter the dungeon as a ${cls}. Seed: ${G.rng.seed}`);
}

document.getElementById('btnRestart').addEventListener('click', ()=>{
  document.getElementById('classModal').style.display='grid';
  window.removeEventListener('keydown', onKey);
});
document.getElementById('btnHelp').addEventListener('click', ()=>{
  alert('Move: WASD/Arrows | Wait: . | Attack: F | Ability: Space | Open chest/Descend: wait on chest/stairs\nInventory: click item or press 1..9 to use, Shift+1..9 to drop');
});
for(const b of document.querySelectorAll('.classbtn')){
  b.addEventListener('click', ()=> startRun(b.dataset.class));
}

// mobile controls
for(const btn of document.querySelectorAll('#dpad button')){
  btn.addEventListener('pointerdown', e=>{
    e.preventDefault();
    if(G.animating) return;
    const dx=parseInt(btn.dataset.dx), dy=parseInt(btn.dataset.dy);
    if(dx===0 && dy===0) wait();
    else { move(dx,dy); G.lastDir=[dx,dy]; }
  });
}
document.getElementById('btnMobileAbility')?.addEventListener('pointerdown', e=>{ e.preventDefault(); ability(); });

// Start paused at class select
updateUI();
render();
