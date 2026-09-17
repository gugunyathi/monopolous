export interface VehicleToken {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  speedBonus: number;
  category: string;
  ownerIndex?: number; // Agent index or CEO who owns this physical token
}

export const MONOPOLY_VEHICLES: VehicleToken[] = [
  {
    id: 'racecar',
    name: 'Classic Racecar',
    icon: '🏎️',
    description: 'High-speed aerodynamic racer. Grants +50% movement speed across exchange tiles.',
    price: 350,
    speedBonus: 0.5,
    category: 'Automotive',
    ownerIndex: 0 // Default owned by CEO (Player)
  },
  {
    id: 'battleship',
    name: 'Iron Dreadnought Battleship',
    icon: '🚢',
    description: 'Heavy armored maritime vessel. Immune to standard gas spike penalties.',
    price: 500,
    speedBonus: 0.3,
    category: 'Maritime',
    ownerIndex: 1 // Owned by Top Agent #1
  },
  {
    id: 'tophat',
    name: 'Gentleman Top Hat',
    icon: '🎩',
    description: 'Distinguished velvet top hat. Doubles rental income collected from rival agents.',
    price: 400,
    speedBonus: 0.2,
    category: 'Apparel',
    ownerIndex: 2 // Owned by Top Agent #2
  },
  {
    id: 'scottiedog',
    name: 'Lucky Scottish Terrier',
    icon: '🐕',
    description: 'Loyal companion hound. Sniffs out hidden airdrops and yield bonuses automatically.',
    price: 300,
    speedBonus: 0.4,
    category: 'Companion',
    ownerIndex: 3 // Owned by Top Agent #3
  },
  {
    id: 'thimble',
    name: 'Golden Sewing Thimble',
    icon: '🪙',
    description: 'Precision artisan thimble. Reduces property upgrade costs by 25%.',
    price: 250,
    speedBonus: 0.1,
    category: 'Artisan',
    ownerIndex: 4 // Owned by Top Agent #4
  },
  {
    id: 'iron',
    name: 'Vintage Steam Iron',
    icon: '🚂',
    description: 'Heavy cast-iron locomotive press. Flattens out regulatory SEC fines and tax penalties.',
    price: 320,
    speedBonus: 0.3,
    category: 'Industrial',
    ownerIndex: 5 // Owned by Top Agent #5
  }
];

