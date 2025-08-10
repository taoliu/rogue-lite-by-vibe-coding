import * as THREE from 'three';

const SPRITE_SIZE = 96;

function makeSprite(color, emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  if (emoji) {
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(emoji, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const cache = {
  player_warrior: makeSprite('#aa0000'),
  player_mage: makeSprite('#0000aa'),
  player_hunter: makeSprite('#008800'),
  Goblin: makeSprite('#00aa00'),
  'Skeleton Archer': makeSprite('#ffffff'),
  Orc: makeSprite('#225500'),
  Zombie: makeSprite('#99cc00'),
  Mimic: makeSprite('#8b5e34'),
  Ogre: makeSprite('#553300'),
  'Young Dragon': makeSprite('#ff0000'),
  'Crystal Guardian': makeSprite('#00ffff'),
  merchant: makeSprite('#996633'),
  default: makeSprite('#ff00ff')
};

export function getSprite(name) {
  return cache[name] || cache.default;
}

export { SPRITE_SIZE };
