import * as THREE from 'three';

const SPRITE_SIZE = 96;
const loader = new THREE.TextureLoader();

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

const SPRITE_INFO = {
  player_warrior: '#aa0000',
  player_mage: '#0000aa',
  player_hunter: '#008800',
  Goblin: '#00aa00',
  'Skeleton Archer': '#ffffff',
  Orc: '#225500',
  Zombie: '#99cc00',
  Ogre: '#553300',
  'Young Dragon': '#ff0000',
  'Crystal Guardian': '#00ffff',
  merchant: '#996633',
  default: '#ff00ff'
};

const cache = {};

for (const [name, color] of Object.entries(SPRITE_INFO)) {
  const tex = loader.load(
    `resource/${encodeURIComponent(name)}.png`,
    undefined,
    undefined,
    () => {
      cache[name] = makeSprite(color);
    }
  );
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  cache[name] = tex;
}

export function getSprite(name) {
  return cache[name] || cache.default;
}

export { SPRITE_SIZE };
