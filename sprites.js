export const ENTITY_COLORS = {
  warrior: '#d4a373',
  mage: '#6393ff',
  hunter: '#8b4513',
  goblin: '#00aa00',
  skeleton: '#e0e0e0',
  orc: '#225500',
  zombie: '#88aa88',
  mimic: '#8b5e34',
  ogre: '#663300',
  dragon: '#ff4444',
  merchant: '#ffaa00',
  boss: '#00ffff'
};

const cache = {};

export function getSprite(name){
  if(cache[name]) return cache[name];
  const color = ENTITY_COLORS[name] || '#ff00ff';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // body
  ctx.fillStyle = color;
  ctx.fillRect(0,0,16,16);
  // simple eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(4,4,2,2);
  ctx.fillRect(10,4,2,2);
  cache[name] = canvas;
  return canvas;
}
