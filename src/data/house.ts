/** A deep cottage plan: private rooms, a small landing, shared living, then kitchen/utility. */
export const HOUSE_ROOMS = [
  { id: 'bedroom', name: 'Bedroom', title: 'A little room of her own.', minX: -3.3, maxX: 3.3, minZ: -3.6, maxZ: 3.6 },
  { id: 'hall', name: 'Landing', title: 'Little everyday arrivals.', minX: 3.3, maxX: 6.5, minZ: .4, maxZ: 3.6 },
  { id: 'bathroom', name: 'Bathroom', title: 'Freshen up.', minX: 3.3, maxX: 6.5, minZ: -3.6, maxZ: .4 },
  { id: 'living', name: 'Living room', title: 'Make yourself at home.', minX: -3.3, maxX: 6.5, minZ: 3.6, maxZ: 9.5 },
  { id: 'kitchen', name: 'Kitchen & dining', title: 'Something good cooking.', minX: -3.3, maxX: 2.6, minZ: 9.5, maxZ: 16.3 },
  { id: 'laundry', name: 'Utility room', title: 'Fresh little folds.', minX: 2.6, maxX: 6.5, minZ: 9.5, maxZ: 13.2 },
  { id: 'nursery', name: 'Lilah’s room', title: 'Little dreams, big adventures.', minX: 6.5, maxX: 11, minZ: -3.6, maxZ: 3.6 },
  { id: 'marc-bedroom', name: 'Marc’s room', title: 'Dad’s little quiet corner.', minX: 6.5, maxX: 11, minZ: 3.6, maxZ: 13.2 },
] as const;
export type RoomId = typeof HOUSE_ROOMS[number]['id'];
export const HOUSE_DOORS: { id: string; a: RoomId; b: RoomId; x: number; z: number; axis: 'x' | 'z'; width: number }[] = [
  { id: 'bedroom-hall', a: 'bedroom', b: 'hall', x: 3.3, z: 2.7, axis: 'z', width: 1.35 },
  { id: 'bedroom-living', a: 'bedroom', b: 'living', x: .25, z: 3.6, axis: 'x', width: 1.8 },
  { id: 'hall-living', a: 'hall', b: 'living', x: 4.8, z: 3.6, axis: 'x', width: 1.7 },
  { id: 'hall-bathroom', a: 'hall', b: 'bathroom', x: 4.8, z: .4, axis: 'x', width: 1.45 },
  { id: 'living-kitchen', a: 'living', b: 'kitchen', x: .25, z: 9.5, axis: 'x', width: 2.1 },
  { id: 'living-laundry', a: 'living', b: 'laundry', x: 4.8, z: 9.5, axis: 'x', width: 1.7 },
  { id: 'kitchen-laundry', a: 'kitchen', b: 'laundry', x: 2.6, z: 11.5, axis: 'z', width: 1.5 },
  { id: 'landing-nursery', a: 'hall', b: 'nursery', x: 6.5, z: 2.05, axis: 'z', width: 1.5 },
  { id: 'living-marc', a: 'living', b: 'marc-bedroom', x: 6.5, z: 6.1, axis: 'z', width: 1.6 },
  { id: 'nursery-marc', a: 'nursery', b: 'marc-bedroom', x: 7.7, z: 3.6, axis: 'x', width: 1.45 },
];
export const HOUSE_TASKS = [
  { id: 'book', name: 'Book', icon: '📘', room: 'Bedroom' },
  { id: 'living-toy', name: 'Toy', icon: '🧸', room: 'Living room' },
  { id: 'kitchen-dish', name: 'Dish', icon: '🍽', room: 'Kitchen' },
  { id: 'kitchen-trash', name: 'Trash', icon: '♻', room: 'Kitchen' },
  { id: 'laundry-clothes', name: 'Laundry', icon: '👕', room: 'Laundry room' },
  { id: 'bath-towel', name: 'Towel', icon: '▤', room: 'Bathroom' },
];
export const EXTRA_HOUSE_TASKS = [
  { id: 'hall-shoes', name: 'Shoes', icon: '👟', room: 'Hall' },
  { id: 'hall-mail', name: 'Mail', icon: '✉', room: 'Hall' },
  { id: 'living-cushion', name: 'Cushion', icon: '♡', room: 'Living room' },
  { id: 'laundry-clean', name: 'Folded clothes', icon: '▤', room: 'Laundry room' },
  { id: 'bath-bottle', name: 'Toiletries', icon: '♧', room: 'Bathroom' },
];
