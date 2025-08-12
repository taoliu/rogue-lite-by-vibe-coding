// --- Game Constants ---
export const T = {
  WALL: 1,
  FLOOR: 0,
  STAIRS: 2,
  CHEST: 3,
  WATER: 4,
  FOUNTAIN: 5,
  TRAP: 6
};
export const TILE_SIZE = 24; // pixels per tile
export const MAP_W = 40, MAP_H = 30; // 40x30 -> 960x720 canvas

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
