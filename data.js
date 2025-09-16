// --- Game Constants ---
export const T = {
  WALL: 1,
  FLOOR: 0,
  STAIRS: 2,
  CHEST: 3,
  WATER: 4,
  FOUNTAIN: 5
};
export const TILE_SIZE = 24; // pixels per tile
export const MAP_W = 40, MAP_H = 30; // 40x30 -> 960x720 canvas

export const FLOOR_THEMES = [
  {
    floor: '#dcdad5',
    wallBase: '#9b9b9b',
    wallMortar: '#6f6f6f',
    wallBricks: ['#b9b9b9', '#a9a9a9', '#909090'],
    stairs: '#7b5a39',
    stairsInset: '#2f2f2f',
    chest: '#8b5e34',
    chestBand: '#d4af37',
    water: '#9bd0ff',
    fountain: '#4fc3f7',
    minimap: {
      floor: '#dcdad5',
      wall: '#6f6f6f',
      water: '#3a7bff',
      stairs: '#7b5a39',
      fountain: '#4fc3f7'
    }
  },
  {
    floor: '#d7e7c2',
    wallBase: '#758663',
    wallMortar: '#4f5a42',
    wallBricks: ['#94a77f', '#869b72', '#6f805c'],
    stairs: '#6f5137',
    stairsInset: '#252525',
    chest: '#7a5936',
    chestBand: '#cda24a',
    water: '#81c0b5',
    fountain: '#58b8a3',
    minimap: {
      floor: '#d7e7c2',
      wall: '#54644c',
      water: '#3aa18e',
      stairs: '#6f5137',
      fountain: '#58b8a3'
    }
  },
  {
    floor: '#d9e4f4',
    wallBase: '#6e84a6',
    wallMortar: '#4d5c72',
    wallBricks: ['#8ca1c0', '#7a91b1', '#63759a'],
    stairs: '#5e4b6b',
    stairsInset: '#211c32',
    chest: '#6d5a7d',
    chestBand: '#c6b3f0',
    water: '#7fb3ff',
    fountain: '#5fa0ff',
    minimap: {
      floor: '#d9e4f4',
      wall: '#4d5c72',
      water: '#3f7de1',
      stairs: '#5e4b6b',
      fountain: '#5fa0ff'
    }
  },
  {
    floor: '#f0d7d0',
    wallBase: '#8c5b4b',
    wallMortar: '#5d3a31',
    wallBricks: ['#b27562', '#9e6452', '#784438'],
    stairs: '#704237',
    stairsInset: '#261515',
    chest: '#7f4635',
    chestBand: '#e0a458',
    water: '#e08f76',
    fountain: '#ffb699',
    minimap: {
      floor: '#f0d7d0',
      wall: '#5d3a31',
      water: '#d76e52',
      stairs: '#704237',
      fountain: '#ffb699'
    }
  },
  {
    floor: '#eadbf4',
    wallBase: '#6f5f92',
    wallMortar: '#4b3f66',
    wallBricks: ['#8a79b2', '#7a69a3', '#5f4c86'],
    stairs: '#5c3f74',
    stairsInset: '#211330',
    chest: '#695088',
    chestBand: '#d5c4ff',
    water: '#89c4ff',
    fountain: '#5fb1ff',
    minimap: {
      floor: '#eadbf4',
      wall: '#4b3f66',
      water: '#4f94e8',
      stairs: '#5c3f74',
      fountain: '#5fb1ff'
    }
  }
];

// Monsters (D&D-ish)
export const MONSTERS = [
  {name:'Goblin', icon:'👺', hp:6, atk:2, mp:0, speed:2, attack:'melee', xp:4},
  {name:'Skeleton Archer', icon:'🏹', hp:8, atk:3, mp:0, speed:1, attack:'ranged', range:4, xp:6},
  {name:'Orc', icon:'👹', hp:12, atk:4, mp:2, speed:1, attack:'melee', xp:10},
  {name:'Zombie', icon:'🧟', hp:14, atk:3, mp:0, speed:0.5, attack:'melee', xp:10},
  {name:'Mimic', icon:'📦', hp:10, atk:5, mp:0, speed:1, attack:'melee', xp:12},
  {name:'Ogre', icon:'🧌', hp:18, atk:6, mp:0, speed:1, attack:'melee', xp:18},
  {name:'Young Dragon', icon:'🐉', hp:28, atk:8, mp:10, speed:3, attack:'magic', range:5, cost:3, xp:30}
];

export const LOOT = {
  common: [
    {name:'Potion of Healing', type:'potion', heal:10},
    {name:'Throwing Dagger', type:'throw', dmg:5},
    {name:'Mana Vial', type:'mana', mana:8},
    {name:'Bomb', type:'bomb', dmg:8},
    {name:'Bundle of Arrows', type:'ammo', ammo:20}
  ],
  rare: [
    {name:'Sword +1', type:'equip', atk:+1},
    {name:'Staff +1', type:'equip', atk:+1, mp:+4},
    {name:'Leather Armor', type:'equip', def:+1},
    {name:'Ring of Vigor', type:'equip', hp:+5},
    {name:'Sword +2', type:'equip', atk:+2},
    {name:'Staff +2', type:'equip', atk:+2, mp:+8},
    {name:'Chainmail +2', type:'equip', def:+2}
  ]
};

export const MERCHANT_ITEMS = [
  {name:'Sword +3', type:'equip', atk:+3, cost:100},
  {name:'Staff +3', type:'equip', atk:+3, mp:+12, cost:100},
  {name:'Plate Armor +3', type:'equip', def:+3, hp:+10, cost:100}
];

export const BOSS = {name:'Crystal Guardian', icon:'💠', hp:40, atk:9, mp:6, speed:0.5, attack:'magic', range:5, cost:3, xp:0};

export const CLASSES = {
  warrior: { hp: 30, mp: 0, atk: 5, def: 2, abilityCd: 5, icon:'⚔️', vision: 7 },
  mage:    { hp: 18, mp: 20, atk: 2, def: 1, abilityCd: 0, icon:'🧙', vision: 7 },
  hunter:  { hp: 24, mp: 8,  atk: 3, def: 1, abilityCd: 0, icon:'🏹', ammo: 40, ammoMax: 40, vision: 10 }
};
