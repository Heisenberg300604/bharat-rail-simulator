// Biome kits: ground colours and what grows/stands beside the line. Each route
// picks one (route.scenery.biome). Weights are relative; densities 0…1+.
export const BIOMES = {
  // Gangetic plain: neem and eucalyptus, wheat and mustard, brick villages
  plains: {
    ground: { grass: '#9aa865', dust: '#c2b48a', rock: '#8d8573', cut: '#a8946e', sand: '#d6c69c', bed: '#8f8466', far: '#a9ad76' },
    trees: { round: 0.62, tall: 0.33, palm: 0.05 },
    treeDensity: 0.6,
    fieldDensity: 0.7,
    fields: ['#d9c037', '#cfb52e', '#7aa03e', '#6b9136', '#8c6f49', '#9fad55', '#5f8a33'],
    buildingDensity: 1,
    plaster: ['#f4ead2', '#f6d6c8', '#d6e6ee', '#f3e7a6', '#ececec', '#e3c39f', '#d3e2c0', '#f6dcdc', '#e9e0f0'],
    rocks: 0,
    ponds: 0.04,
    water: '#4f7b78',
  },
  // Western Ghats in the monsoon: dense green, black basalt, few houses
  ghats: {
    ground: { grass: '#5f8f3e', dust: '#7f9150', rock: '#57534b', cut: '#615a50', sand: '#8c8466', bed: '#4d4a40', far: '#6c8d4c' },
    trees: { round: 0.78, tall: 0.12, palm: 0.1 },
    treeDensity: 1.05,
    fieldDensity: 0.12,
    fields: ['#7fb34a', '#6ea13f', '#8fbf55'],
    buildingDensity: 0.35,
    plaster: ['#f1ece0', '#e8d9b5', '#d9e4ea', '#f0d6c4'],
    rocks: 0.7,
    ponds: 0,
    water: '#4b6e66',
  },
  // Konkan: red laterite, coconut palms, paddy, Goan houses with tiled roofs
  konkan: {
    ground: { grass: '#7aa04c', dust: '#a8603f', rock: '#8a4a32', cut: '#a2532f', sand: '#d8c08f', bed: '#6e5a45', far: '#86995a' },
    trees: { round: 0.42, tall: 0.08, palm: 0.5 },
    treeDensity: 0.95,
    fieldDensity: 0.4,
    fields: ['#8fbf4a', '#a6c95a', '#76a03c', '#9cb85a'],
    buildingDensity: 0.6,
    plaster: ['#f4f0e6', '#f2d36b', '#e8e2d0', '#9fc7d6', '#e9b8a0', '#f1f1ea'],
    rocks: 0.25,
    ponds: 0.05,
    water: '#3f6f74',
  },
  // Tamil Nadu coast: sand, coconut palms, thorny scrub, fishing villages
  coastal: {
    ground: { grass: '#a3a76a', dust: '#d9cb9c', rock: '#9c9280', cut: '#bfae86', sand: '#eadfb9', bed: '#b8a77e', far: '#c4bb8c' },
    trees: { round: 0.3, tall: 0.04, palm: 0.66 },
    treeDensity: 0.55,
    fieldDensity: 0.08,
    fields: ['#b4b06a', '#9fa65c'],
    buildingDensity: 0.45,
    plaster: ['#f6f1e2', '#e6f0f2', '#f3e2a8', '#cfe6d8', '#f4d7cf', '#bcd7ea'],
    rocks: 0.05,
    ponds: 0,
    water: '#2f7f8c',
  },
  // Bengal delta: paddy, ponds, banana and coconut, dense brick settlements
  bengal: {
    ground: { grass: '#78a948', dust: '#a49d64', rock: '#7d7563', cut: '#9a8a64', sand: '#c9b98a', bed: '#6f6a50', far: '#80a252' },
    trees: { round: 0.45, tall: 0.07, palm: 0.48 },
    treeDensity: 0.95,
    fieldDensity: 0.75,
    fields: ['#8cc04c', '#a2c85a', '#c9c25a', '#79a83e', '#6c9a38'],
    buildingDensity: 1.25,
    plaster: ['#e9dcc3', '#c9a27a', '#b25a40', '#f0e6d2', '#d9e3d0', '#e6cfa6'],
    rocks: 0,
    ponds: 0.55,
    water: '#4a6f62',
  },
};

export function biomeFor(route) {
  return BIOMES[route.scenery?.biome] ?? BIOMES.plains;
}
