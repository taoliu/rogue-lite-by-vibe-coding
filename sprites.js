const cache = {};

export function getSprite(name) {
  if (!cache[name]) {
    const img = new Image();
    img.onerror = () => {
      // Fallback to default sprite if the requested image fails to load.
      img.onerror = null;
      img.src = 'resource/default.jpeg';
    };
    // Set the source after assigning the error handler so that loading
    // failures are always caught and a placeholder sprite is displayed
    // instead of leaving the entity invisible.
    img.src = `resource/${encodeURIComponent(name)}.png`;
    cache[name] = img;
  }
  return cache[name];
}

export const SPRITE_SIZE = 96; // not used but kept for compatibility

