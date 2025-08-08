// --- Game Constants ---
const T = { WALL: 1, FLOOR: 0, STAIRS: 2, CHEST: 3 };
const TILE_SIZE = 24; // pixels per tile
const MAP_W = 40, MAP_H = 30; // 40x30 -> 960x720 canvas

// Monsters (D&D-ish)
const MONSTERS = [
  {name:'Goblin', ch:'g', hp:6, atk:2, xp:4, color:'#22c55e'},
  {name:'Skeleton', ch:'s', hp:8, atk:3, xp:6, color:'#d4d4d8'},
  {name:'Orc', ch:'o', hp:12, atk:4, xp:10, color:'#f97316'},
  {name:'Zombie', ch:'z', hp:14, atk:3, xp:10, color:'#4ade80'},
  {name:'Mimic', ch:'m', hp:10, atk:5, xp:12, color:'#c084fc'},
  {name:'Ogre', ch:'O', hp:18, atk:6, xp:18, color:'#a16207'},
  {name:'Young Dragon', ch:'D', hp:28, atk:8, xp:30, color:'#ef4444'}
];

const LOOT = {
  common: [
    {name:'Potion of Healing', type:'potion', heal:10},
    {name:'Throwing Dagger', type:'throw', dmg:5},
    {name:'Mana Vial', type:'mana', mana:8},
    {name:'Bomb', type:'bomb', dmg:8}
  ],
  rare: [
    {name:'Sword +1', type:'equip', atk:+1},
    {name:'Staff +1', type:'equip', atk:+1, mp:+4},
    {name:'Leather Armor', type:'equip', def:+1},
    {name:'Ring of Vigor', type:'equip', hp:+5}
  ]
};

const CLASSES = {
  warrior: { hp: 30, mp: 0, atk: 5, def: 2, abilityCd: 5 },
  mage:    { hp: 18, mp: 20, atk: 2, def: 1, abilityCd: 5 },
  hunter:  { hp: 24, mp: 8,  atk: 3, def: 1, abilityCd: 4 }
};
