const cache = {};

export function getSprite(name) {
  if (!cache[name]) {
    const img = new Image();
    img.src = `resource/${encodeURIComponent(name)}.png`;
    img.onerror = () => {
      img.onerror = null;
      img.src = 'resource/default.jpeg';
    };
    cache[name] = img;
  }
  return cache[name];
}

export const SPRITE_SIZE = 96; // not used but kept for compatibility

