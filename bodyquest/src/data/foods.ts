import type { Allergen, DietPreference, Food, NutritionPerServing, Region } from '../domain/types';

/**
 * SAMPLE FOOD DATABASE — APPROXIMATE VALUES.
 *
 * Values are rounded approximations based on typical entries in public food-composition
 * references (e.g. USDA FoodData Central) for the stated serving. Real values vary with
 * brand, variety, recipe and portion. Foods whose nutrition depends heavily on the recipe
 * (e.g. khichuri, mishti doi, mixed seasonal fruit) deliberately have `nutrition: null`
 * and are shown as "not estimated" rather than given invented numbers.
 *
 * Production: replace with a verified, licensed food database (e.g. USDA FDC API,
 * or a national composition table such as the Food Composition Table for Bangladesh).
 */
export const FOOD_DATA_SOURCE =
  'Approximate sample data, rounded from typical public food-composition values (e.g. USDA FoodData Central). Not a verified database — values vary with recipe and portion.';

const ALL_DIETS: DietPreference[] = ['omnivore', 'halal', 'vegetarian', 'eggetarian', 'pescatarian', 'vegan'];
const PLANT = ALL_DIETS;
const DAIRY: DietPreference[] = ['omnivore', 'halal', 'vegetarian', 'eggetarian', 'pescatarian'];
const EGG: DietPreference[] = ['omnivore', 'halal', 'eggetarian', 'pescatarian'];
const FISH: DietPreference[] = ['omnivore', 'halal', 'pescatarian'];
const MEAT: DietPreference[] = ['omnivore', 'halal'];

const SOUTH_ASIA: Region[] = ['BD', 'IN', 'PK'];

const n = (kcal: number, protein: number, carbs: number, fat: number): NutritionPerServing => ({ kcal, protein, carbs, fat });

function food(
  id: string,
  name: string,
  serving: string,
  grams: number | null,
  nutrition: NutritionPerServing | null,
  dietTags: DietPreference[],
  category: Food['category'],
  opts: { localName?: string; allergens?: Allergen[]; regions?: Region[] | 'all'; cost?: Food['cost'] } = {},
): Food {
  return {
    id,
    name,
    serving,
    grams,
    nutrition,
    dietTags,
    category,
    localName: opts.localName,
    allergens: opts.allergens ?? [],
    regions: opts.regions ?? 'all',
    cost: opts.cost ?? 'low',
  };
}

export const FOODS: Food[] = [
  // Grains & starches
  food('rice-white', 'White rice, cooked', '1 cup (≈160 g)', 160, n(205, 4.3, 44.5, 0.4), PLANT, 'grain', { localName: 'Bhat' }),
  food('rice-brown', 'Brown rice, cooked', '1 cup (≈195 g)', 195, n(218, 4.5, 45.8, 1.6), PLANT, 'grain', { cost: 'medium' }),
  food('roti', 'Roti / chapati (whole wheat)', '1 medium (≈40 g)', 40, n(120, 3.5, 18, 3.5), PLANT, 'grain', { localName: 'Ruti', allergens: ['gluten'], regions: [...SOUTH_ASIA, 'MENA', 'GB', 'OTHER'] }),
  food('paratha', 'Paratha', '1 medium (≈60 g)', 60, n(190, 4, 25, 8.5), PLANT, 'grain', { allergens: ['gluten'], regions: SOUTH_ASIA }),
  food('oats', 'Rolled oats (dry)', '40 g', 40, n(150, 5.3, 27, 2.6), PLANT, 'grain', { allergens: ['gluten'] }),
  food('bread-ww', 'Whole-wheat bread', '1 slice (≈32 g)', 32, n(80, 4, 14, 1.1), PLANT, 'grain', { allergens: ['gluten'] }),
  food('muri', 'Puffed rice', '1 cup (≈14 g)', 14, n(56, 0.9, 12.6, 0.1), PLANT, 'grain', { localName: 'Muri', regions: SOUTH_ASIA }),
  food('chira', 'Flattened rice (dry)', '50 g', 50, n(175, 3.3, 38.5, 0.6), PLANT, 'grain', { localName: 'Chira / poha', regions: SOUTH_ASIA }),
  food('potato', 'Potato, boiled', '1 medium (≈150 g)', 150, n(130, 2.9, 30, 0.2), PLANT, 'vegetable', { localName: 'Alu' }),
  food('sweet-potato', 'Sweet potato, boiled', '1 medium (≈150 g)', 150, n(135, 2.5, 31, 0.2), PLANT, 'vegetable', { localName: 'Misti alu' }),
  food('pasta-ww', 'Whole-grain pasta, cooked', '1 cup (≈140 g)', 140, n(174, 7.5, 37, 0.8), PLANT, 'grain', { allergens: ['gluten'], regions: ['GB', 'US', 'OTHER', 'MENA'], cost: 'medium' }),
  food('quinoa', 'Quinoa, cooked', '1 cup (≈185 g)', 185, n(222, 8.1, 39.4, 3.6), PLANT, 'grain', { regions: ['GB', 'US', 'OTHER'], cost: 'high' }),
  food('pita', 'Whole-wheat pita', '1 pita (≈64 g)', 64, n(170, 6.3, 35, 1.7), PLANT, 'grain', { allergens: ['gluten'], regions: ['MENA', 'GB', 'US', 'OTHER'] }),
  food('rice-noodles', 'Rice noodles, cooked', '1 cup (≈176 g)', 176, n(190, 3.2, 42, 0.4), PLANT, 'grain', { regions: ['EAST_ASIA', 'OTHER', 'US', 'GB'] }),
  food('khichuri', 'Khichuri (rice & lentil, home-style)', '1 cup', null, null, PLANT, 'mixed', { localName: 'Khichuri', regions: SOUTH_ASIA }),

  // Protein foods
  food('egg', 'Egg, boiled or poached', '1 large (≈50 g)', 50, n(78, 6.3, 0.6, 5.3), EGG, 'protein', { localName: 'Dim', allergens: ['egg'] }),
  food('chicken-breast', 'Chicken breast, cooked (skinless)', '100 g', 100, n(165, 31, 0, 3.6), MEAT, 'protein', { localName: 'Murgi', cost: 'medium' }),
  food('chicken-thigh', 'Chicken thigh, cooked (skinless)', '100 g', 100, n(209, 26, 0, 10.9), MEAT, 'protein', { localName: 'Murgi', cost: 'medium' }),
  food('beef-lean', 'Beef, lean, cooked', '100 g', 100, n(217, 26, 0, 12), MEAT, 'protein', { localName: 'Gorur mangsho', cost: 'high' }),
  food('goat', 'Goat / mutton, lean, cooked', '100 g', 100, n(143, 27, 0, 3), MEAT, 'protein', { localName: 'Khashir mangsho', regions: [...SOUTH_ASIA, 'MENA'], cost: 'high' }),
  food('rui', 'Rohu fish, cooked', '100 g', 100, n(115, 20, 0, 3.5), FISH, 'protein', { localName: 'Rui maach', allergens: ['fish'], regions: SOUTH_ASIA }),
  food('ilish', 'Hilsa fish, cooked', '100 g', 100, n(270, 21, 0, 19.5), FISH, 'protein', { localName: 'Ilish maach', allergens: ['fish'], regions: ['BD', 'IN'], cost: 'high' }),
  food('pangas', 'Pangas fish, cooked', '100 g', 100, n(140, 18, 0, 7), FISH, 'protein', { localName: 'Pangas maach', allergens: ['fish'], regions: ['BD', 'IN'] }),
  food('tilapia', 'Tilapia, cooked', '100 g', 100, n(128, 26, 0, 2.7), FISH, 'protein', { localName: 'Telapia', allergens: ['fish'] }),
  food('shrimp', 'Prawns / shrimp, cooked', '100 g', 100, n(99, 24, 0.2, 0.3), FISH, 'protein', { localName: 'Chingri', allergens: ['shellfish'], cost: 'medium' }),
  food('tuna', 'Tuna, canned in water (drained)', '100 g', 100, n(116, 25.5, 0, 0.8), FISH, 'protein', { allergens: ['fish'], regions: ['GB', 'US', 'OTHER', 'MENA'], cost: 'medium' }),
  food('salmon', 'Salmon, cooked', '100 g', 100, n(206, 22, 0, 12), FISH, 'protein', { allergens: ['fish'], regions: ['GB', 'US', 'OTHER'], cost: 'high' }),
  food('small-fish', 'Small fish curry (mola / kachki, home-style)', '1 serving', null, null, FISH, 'mixed', { localName: 'Choto maach', allergens: ['fish'], regions: ['BD'] }),
  food('tofu', 'Tofu, firm', '100 g', 100, n(144, 17.3, 2.8, 8.7), PLANT, 'protein', { allergens: ['soy'], cost: 'medium' }),
  food('soy-chunks', 'Soya chunks (dry weight)', '30 g', 30, n(104, 15.6, 9.9, 0.2), PLANT, 'protein', { allergens: ['soy'], regions: [...SOUTH_ASIA, 'OTHER'] }),
  food('edamame', 'Edamame, shelled, cooked', '½ cup (≈75 g)', 75, n(94, 9.2, 6.9, 4), PLANT, 'legume', { allergens: ['soy'], regions: ['EAST_ASIA', 'US', 'GB', 'OTHER'], cost: 'medium' }),

  // Legumes
  food('masoor-dal', 'Red lentils (masoor dal), cooked', '½ cup (≈100 g)', 100, n(115, 9, 20, 0.4), PLANT, 'legume', { localName: 'Masoor dal' }),
  food('mung-dal', 'Mung dal, cooked', '½ cup (≈100 g)', 100, n(106, 7.1, 19.3, 0.4), PLANT, 'legume', { localName: 'Mug dal' }),
  food('chickpeas', 'Chickpeas, cooked', '½ cup (≈82 g)', 82, n(134, 7.3, 22.5, 2.1), PLANT, 'legume', { localName: 'Chola / boot' }),
  food('kidney-beans', 'Kidney beans, cooked', '½ cup (≈89 g)', 89, n(112, 7.7, 20, 0.4), PLANT, 'legume', { localName: 'Rajma' }),
  food('hummus', 'Hummus', '2 tbsp (≈30 g)', 30, n(70, 2, 4, 5), PLANT, 'legume', { allergens: ['sesame'], regions: ['MENA', 'GB', 'US', 'OTHER'] }),
  food('falafel', 'Falafel', '3 small (≈51 g)', 51, n(170, 6.8, 16, 9.1), PLANT, 'legume', { allergens: ['sesame'], regions: ['MENA', 'GB', 'US', 'OTHER'] }),

  // Dairy
  food('milk', 'Milk, whole', '1 cup (≈240 ml)', 244, n(149, 7.7, 11.7, 7.9), DAIRY, 'dairy', { localName: 'Dudh', allergens: ['dairy'] }),
  food('milk-lowfat', 'Milk, low-fat', '1 cup (≈240 ml)', 244, n(102, 8.2, 12.2, 2.4), DAIRY, 'dairy', { allergens: ['dairy'] }),
  food('yogurt', 'Plain yogurt (unsweetened)', '1 cup (≈245 g)', 245, n(149, 8.5, 11.4, 8), DAIRY, 'dairy', { localName: 'Tok doi', allergens: ['dairy'] }),
  food('mishti-doi', 'Sweet yogurt (mishti doi)', '1 small cup', null, null, DAIRY, 'dairy', { localName: 'Mishti doi', allergens: ['dairy'], regions: ['BD', 'IN'] }),
  food('greek-yogurt', 'Greek yogurt, plain, non-fat', '170 g', 170, n(100, 17, 6, 0.7), DAIRY, 'dairy', { allergens: ['dairy'], regions: ['GB', 'US', 'OTHER', 'MENA'], cost: 'medium' }),
  food('paneer', 'Paneer', '50 g', 50, n(150, 9, 2, 12), DAIRY, 'dairy', { allergens: ['dairy'], regions: SOUTH_ASIA, cost: 'medium' }),
  food('cheddar', 'Cheddar cheese', '28 g', 28, n(113, 7, 0.4, 9.3), DAIRY, 'dairy', { allergens: ['dairy'], regions: ['GB', 'US', 'OTHER'], cost: 'medium' }),

  // Nuts, seeds, fats
  food('peanuts', 'Peanuts, roasted', '28 g (small handful)', 28, n(161, 7.3, 4.6, 14), PLANT, 'fat', { localName: 'Badam', allergens: ['peanut'] }),
  food('peanut-butter', 'Peanut butter', '2 tbsp (≈32 g)', 32, n(190, 7, 7, 16), PLANT, 'fat', { allergens: ['peanut'], cost: 'medium' }),
  food('almonds', 'Almonds', '28 g (≈23 nuts)', 28, n(164, 6, 6.1, 14.2), PLANT, 'fat', { allergens: ['tree-nut'], cost: 'high' }),
  food('oil', 'Cooking oil (mustard / soybean / olive)', '1 tsp (≈4.5 g)', 4.5, n(40, 0, 0, 4.5), PLANT, 'fat', { localName: 'Tel' }),
  food('ghee', 'Ghee', '1 tsp (≈5 g)', 5, n(45, 0, 0, 5), DAIRY, 'fat', { allergens: ['dairy'], regions: SOUTH_ASIA }),

  // Vegetables
  food('mixed-veg', 'Mixed vegetables, cooked (carrot, peas, beans)', '1 cup (≈180 g)', 180, n(118, 5.2, 23.8, 0.3), PLANT, 'vegetable', { localName: 'Sobji' }),
  food('leafy-greens', 'Leafy greens (spinach / shak), cooked', '1 cup (≈180 g)', 180, n(41, 5.3, 6.8, 0.5), PLANT, 'vegetable', { localName: 'Shak' }),
  food('broccoli', 'Broccoli, cooked', '1 cup (≈156 g)', 156, n(55, 3.7, 11.2, 0.6), PLANT, 'vegetable', { regions: ['GB', 'US', 'OTHER', 'EAST_ASIA'], cost: 'medium' }),
  food('salad', 'Cucumber, tomato & onion salad', '1 cup', 150, n(25, 1, 5, 0.2), PLANT, 'vegetable', { localName: 'Salad' }),
  food('veg-bhaji', 'Vegetable bhaji (home-style, with oil)', '1 cup', null, null, PLANT, 'vegetable', { localName: 'Bhaji', regions: SOUTH_ASIA }),

  // Fruit
  food('banana', 'Banana', '1 medium (≈118 g)', 118, n(105, 1.3, 27, 0.4), PLANT, 'fruit', { localName: 'Kola' }),
  food('apple', 'Apple', '1 medium (≈182 g)', 182, n(95, 0.5, 25, 0.3), PLANT, 'fruit', { cost: 'medium' }),
  food('guava', 'Guava', '1 medium (≈55 g)', 55, n(37, 1.4, 7.9, 0.5), PLANT, 'fruit', { localName: 'Peyara', regions: [...SOUTH_ASIA, 'EAST_ASIA', 'OTHER'] }),
  food('mango', 'Mango, pieces', '1 cup (≈165 g)', 165, n(99, 1.4, 24.7, 0.6), PLANT, 'fruit', { localName: 'Aam' }),
  food('papaya', 'Papaya, pieces', '1 cup (≈145 g)', 145, n(62, 0.7, 15.7, 0.4), PLANT, 'fruit', { localName: 'Pepe' }),
  food('orange', 'Orange', '1 medium (≈131 g)', 131, n(62, 1.2, 15.4, 0.2), PLANT, 'fruit', { localName: 'Komola' }),
  food('dates', 'Dates', '3 dates (≈24 g)', 24, n(67, 0.6, 18, 0.1), PLANT, 'fruit', { localName: 'Khejur', cost: 'medium' }),
  food('seasonal-fruit', 'Seasonal fruit bowl (mixed)', '1 bowl', null, null, PLANT, 'fruit', { localName: 'Moushumi fol' }),

  // Beverages & extras
  food('tea-milk', 'Tea with milk & 1 tsp sugar', '1 cup', 200, n(35, 1, 6, 1), DAIRY, 'beverage', { localName: 'Dudh cha', allergens: ['dairy'] }),
  food('honey', 'Honey', '1 tbsp (≈21 g)', 21, n(64, 0.1, 17.3, 0), DAIRY, 'fat', { localName: 'Modhu' }),
];

export const FOOD_MAP: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export function getFood(id: string): Food | undefined {
  return FOOD_MAP[id];
}

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  dairy: 'Dairy / milk',
  egg: 'Egg',
  fish: 'Fish',
  shellfish: 'Shellfish',
  peanut: 'Peanut',
  'tree-nut': 'Tree nuts',
  gluten: 'Gluten (wheat, oats*)',
  soy: 'Soy',
  sesame: 'Sesame',
};

export const DIET_LABEL: Record<DietPreference, string> = {
  omnivore: 'No restrictions',
  halal: 'Halal',
  vegetarian: 'Vegetarian (dairy OK, no egg)',
  eggetarian: 'Vegetarian + eggs',
  pescatarian: 'Pescatarian',
  vegan: 'Vegan',
};
