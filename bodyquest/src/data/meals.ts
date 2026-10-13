import type { Meal, MealItem, MealSlot, Region } from '../domain/types';

/**
 * Sample meal templates built from the food database. Quantities are suggestions; users
 * log what they actually eat. Regions control which meals are suggested first.
 */

const SA: Region[] = ['BD', 'IN', 'PK'];
const BD: Region[] = ['BD', 'IN'];
const WEST: Region[] = ['GB', 'US', 'OTHER'];
const i = (foodId: string, servings = 1): MealItem => ({ foodId, servings });

function meal(id: string, slot: MealSlot, name: string, regions: Region[] | 'all', items: MealItem[], preparation: string, affordableAlternatives: string[], tags: string[] = []): Meal {
  return { id, slot, name, regions, items, preparation, affordableAlternatives, tags };
}

export const MEALS: Meal[] = [
  // ---------------------------------------------------------------- Breakfast
  meal('b-roti-egg-veg', 'breakfast', 'Roti, eggs & vegetables', SA, [i('roti', 2), i('egg', 2), i('mixed-veg', 0.5), i('oil', 1)],
    'Make a 2-egg omelette or boil the eggs. Lightly cook chopped vegetables with 1 tsp oil, turmeric and salt. Serve with 2 rotis.',
    ['Use muri instead of roti', 'Replace one egg with ½ cup dal'], ['high-protein']),
  meal('b-chira-doi', 'breakfast', 'Chira with yogurt & banana', BD, [i('chira', 1), i('yogurt', 0.5), i('banana', 1)],
    'Rinse the chira briefly and drain. Mix with plain yogurt and sliced banana. Add a pinch of salt or a little jaggery to taste.',
    ['Muri instead of chira', 'Any seasonal fruit instead of banana'], ['vegetarian', 'quick']),
  meal('b-khichuri-egg', 'breakfast', 'Khichuri with a boiled egg', SA, [i('khichuri', 1), i('egg', 1)],
    'Cook rice and lentils together with turmeric, salt and a few vegetables. Serve warm with a boiled egg. (Khichuri nutrition varies a lot by recipe, so it is not estimated.)',
    ['Add extra dal instead of the egg for a vegetarian version'], []),
  meal('b-oats-milk', 'breakfast', 'Oats with milk, banana & peanuts', 'all', [i('oats', 1), i('milk', 1), i('banana', 1), i('peanuts', 0.5)],
    'Simmer oats in milk for 3–5 minutes, stirring. Top with sliced banana and a few peanuts.',
    ['Use water + 2 tbsp milk powder', 'Swap peanuts for sunflower seeds if allergic'], ['quick']),
  meal('b-egg-toast', 'breakfast', 'Eggs on whole-wheat toast with fruit', WEST, [i('bread-ww', 2), i('egg', 2), i('apple', 1)],
    'Scramble or poach two eggs and serve on two slices of toast. Add a piece of fruit.',
    ['Any bread you have', 'Banana instead of apple'], ['high-protein']),
  meal('b-greek-bowl', 'breakfast', 'Greek yogurt, oats & fruit bowl', [...WEST, 'MENA'], [i('greek-yogurt', 1), i('oats', 0.5), i('banana', 0.5), i('almonds', 0.5)],
    'Layer Greek yogurt with oats, sliced banana and a few almonds. Can be prepared the night before.',
    ['Plain yogurt instead of Greek yogurt', 'Peanuts instead of almonds'], ['high-protein']),
  meal('b-tofu-scramble', 'breakfast', 'Tofu scramble on toast', [...WEST, 'EAST_ASIA'], [i('tofu', 1), i('bread-ww', 2), i('leafy-greens', 0.5), i('oil', 1)],
    'Crumble tofu into a pan with 1 tsp oil, turmeric, salt and pepper. Add spinach until wilted. Serve on toast.',
    ['Chickpea flour omelette instead of tofu'], ['vegan', 'high-protein']),
  meal('b-pita-hummus-egg', 'breakfast', 'Pita, hummus, egg & salad', ['MENA'], [i('pita', 1), i('hummus', 1), i('egg', 1), i('salad', 1)],
    'Warm the pita, spread hummus, and serve with a boiled egg and chopped cucumber and tomato.',
    ['Any flatbread', 'Beans instead of egg'], []),
  meal('b-muri-chola', 'breakfast', 'Muri makha with chola', SA, [i('muri', 2), i('chickpeas', 1), i('salad', 0.5)],
    'Mix puffed rice with boiled chickpeas, chopped onion, tomato, cucumber, green chilli and a little mustard oil. Eat immediately so it stays crisp.',
    ['Use boiled peanuts instead of chickpeas (if no allergy)'], ['vegan', 'quick']),

  // ---------------------------------------------------------------- Lunch
  meal('l-rice-rui-dal', 'lunch', 'Rice, rui fish curry, dal & shak', BD, [i('rice-white', 1.5), i('rui', 1), i('masoor-dal', 1), i('leafy-greens', 1), i('oil', 2)],
    'Cook fish pieces in a light curry with onion, turmeric, chilli and 1 tsp oil. Make thin masoor dal. Stir-fry greens with garlic and 1 tsp oil. Serve with rice.',
    ['Pangas or tilapia instead of rui', 'Egg curry instead of fish'], ['bangladeshi']),
  meal('l-rice-chicken-dal', 'lunch', 'Rice, chicken curry, dal & salad', SA, [i('rice-white', 1.5), i('chicken-thigh', 1), i('masoor-dal', 1), i('salad', 1), i('oil', 2)],
    'Cook chicken with onion, ginger-garlic paste, spices and 2 tsp oil until tender. Serve with rice, dal and a fresh salad.',
    ['Egg curry instead of chicken', 'Mixed dal instead of masoor'], ['high-protein']),
  meal('l-rice-egg-curry', 'lunch', 'Rice, egg curry with potato & dal', SA, [i('rice-white', 1.5), i('egg', 2), i('potato', 0.5), i('masoor-dal', 1), i('oil', 1)],
    'Boil eggs and simmer in an onion-tomato curry with potato pieces and 1 tsp oil. Serve with rice and dal.',
    ['One of the most affordable protein-rich lunches'], ['budget']),
  meal('l-rice-chola-veg', 'lunch', 'Rice, chickpea curry & vegetables', 'all', [i('rice-white', 1.5), i('chickpeas', 2), i('mixed-veg', 1), i('oil', 1)],
    'Simmer boiled chickpeas in an onion-tomato-spice gravy. Serve with rice and lightly cooked vegetables.',
    ['Kidney beans or dal instead of chickpeas'], ['vegan', 'budget']),
  meal('l-rice-chingri', 'lunch', 'Rice, prawn curry & shak', BD, [i('rice-white', 1.5), i('shrimp', 1), i('leafy-greens', 1), i('oil', 2)],
    'Cook prawns quickly in a light onion and spice curry (do not overcook). Serve with rice and stir-fried greens.',
    ['Small fish (choto maach) or egg instead of prawns'], ['bangladeshi']),
  meal('l-roti-mung-veg', 'lunch', 'Roti, mung dal & vegetables', SA, [i('roti', 3), i('mung-dal', 2), i('mixed-veg', 1), i('oil', 1)],
    'Cook mung dal until soft with turmeric and salt; temper with cumin in 1 tsp oil. Serve with roti and vegetables.',
    ['Masoor dal instead of mung', 'Rice instead of roti'], ['vegan', 'budget']),
  meal('l-rajma-rice', 'lunch', 'Rajma (kidney beans), rice & yogurt', ['IN', 'PK', 'BD', 'OTHER'], [i('rice-white', 1.5), i('kidney-beans', 2), i('salad', 1), i('yogurt', 0.5)],
    'Simmer cooked kidney beans in an onion-tomato gravy. Serve with rice, salad and a little plain yogurt.',
    ['Chickpeas instead of kidney beans'], ['vegetarian']),
  meal('l-chicken-quinoa', 'lunch', 'Chicken, quinoa & broccoli', WEST, [i('quinoa', 1), i('chicken-breast', 1.2), i('broccoli', 1), i('oil', 1)],
    'Season and pan-cook chicken breast in 1 tsp oil. Serve with quinoa and steamed broccoli.',
    ['Rice instead of quinoa (cheaper)', 'Any seasonal vegetables'], ['high-protein']),
  meal('l-tuna-pasta', 'lunch', 'Tuna pasta with vegetables', WEST, [i('pasta-ww', 1.5), i('tuna', 1), i('mixed-veg', 1), i('oil', 1)],
    'Toss cooked pasta with drained tuna, vegetables, 1 tsp olive oil, lemon, salt and pepper.',
    ['Chickpeas instead of tuna'], ['high-protein']),
  meal('l-tofu-rice-bowl', 'lunch', 'Tofu & vegetable rice bowl', [...WEST, 'EAST_ASIA'], [i('rice-white', 1), i('tofu', 1.5), i('broccoli', 1), i('oil', 1)],
    'Pan-fry tofu cubes in 1 tsp oil until golden; add vegetables. Serve over rice.',
    ['Edamame or chickpeas instead of tofu'], ['vegan', 'high-protein']),
  meal('l-falafel-pita', 'lunch', 'Falafel pita with hummus & salad', ['MENA', 'GB', 'US'], [i('pita', 1), i('falafel', 1), i('hummus', 1), i('salad', 1)],
    'Fill warm pita with falafel, hummus and chopped salad.',
    ['Baked chickpeas instead of fried falafel'], ['vegan']),

  // ---------------------------------------------------------------- Dinner
  meal('d-roti-chicken-veg', 'dinner', 'Roti, chicken & vegetable curry', SA, [i('roti', 3), i('chicken-breast', 1), i('mixed-veg', 1), i('oil', 1)],
    'Cook chicken pieces with vegetables, spices and 1 tsp oil. Serve with rotis.',
    ['Egg or dal instead of chicken'], ['high-protein']),
  meal('d-rice-pangas-shak', 'dinner', 'Rice, pangas fish & shak', BD, [i('rice-white', 1.25), i('pangas', 1), i('leafy-greens', 1), i('oil', 1)],
    'Make a light pangas curry with onion and spices. Serve with rice and stir-fried greens.',
    ['Tilapia or rui instead of pangas'], ['bangladeshi', 'budget']),
  meal('d-rice-small-fish', 'dinner', 'Rice, small fish curry & dal', ['BD'], [i('rice-white', 1.25), i('small-fish', 1), i('masoor-dal', 1)],
    'Small fish such as mola are traditional and nutritious (eaten whole, including bones). Recipes vary, so the curry is not estimated.',
    ['Egg curry instead of fish'], ['bangladeshi']),
  meal('d-rice-goat', 'dinner', 'Rice, lean mutton curry & salad (occasional)', [...SA, 'MENA'], [i('rice-white', 1.25), i('goat', 1), i('salad', 1), i('oil', 1)],
    'Trim visible fat and cook mutton slowly with spices and 1 tsp oil. Serve with rice and salad. An occasional meal — higher cost.',
    ['Chicken curry instead of mutton (cheaper)'], ['high-protein']),
  meal('d-dal-rice-egg', 'dinner', 'Rice, thick dal, egg & shak (light)', SA, [i('rice-white', 1), i('masoor-dal', 2), i('egg', 1), i('leafy-greens', 1)],
    'A simple, light dinner: thick dal, a boiled egg and greens with rice.',
    ['Very affordable and quick'], ['budget']),
  meal('d-soy-curry', 'dinner', 'Soya chunk curry with rice', SA, [i('rice-white', 1.25), i('soy-chunks', 1), i('potato', 0.5), i('mixed-veg', 0.5), i('oil', 1)],
    'Soak soya chunks in hot water for 10 minutes, squeeze, then cook in an onion-tomato curry with potato and vegetables.',
    ['Chickpeas instead of soya chunks (if soy allergy)'], ['vegan', 'high-protein', 'budget']),
  meal('d-salmon-potato', 'dinner', 'Salmon, sweet potato & broccoli', WEST, [i('salmon', 1), i('sweet-potato', 1), i('broccoli', 1)],
    'Bake salmon and sweet potato at 200°C for about 20 minutes. Steam broccoli.',
    ['Canned fish or tilapia instead of salmon (cheaper)'], ['high-protein']),
  meal('d-chicken-noodles', 'dinner', 'Chicken & vegetable rice noodles', ['EAST_ASIA', 'OTHER', 'US', 'GB'], [i('rice-noodles', 1), i('chicken-breast', 1), i('mixed-veg', 1), i('oil', 1)],
    'Stir-fry sliced chicken and vegetables in 1 tsp oil with garlic and ginger, then toss with cooked noodles.',
    ['Tofu instead of chicken'], ['high-protein']),
  meal('d-paneer-roti', 'dinner', 'Paneer & spinach with roti', SA, [i('roti', 3), i('paneer', 1), i('leafy-greens', 1), i('oil', 1)],
    'Cook spinach with garlic and spices, then add cubed paneer and warm through. Serve with roti.',
    ['Tofu instead of paneer', 'Dal instead of paneer (cheaper)'], ['vegetarian']),
  meal('d-tilapia-rice', 'dinner', 'Tilapia, rice & vegetables', 'all', [i('rice-white', 1.25), i('tilapia', 1), i('mixed-veg', 1), i('oil', 1)],
    'Pan-cook or curry tilapia with spices in 1 tsp oil. Serve with rice and vegetables.',
    ['Any affordable local fish'], ['high-protein']),
  meal('d-bean-chili', 'dinner', 'Bean & vegetable stew with bread', WEST, [i('kidney-beans', 2), i('mixed-veg', 1), i('bread-ww', 2), i('oil', 1)],
    'Simmer beans and vegetables with tomatoes and spices for 15 minutes. Serve with bread.',
    ['Rice instead of bread'], ['vegan', 'budget']),

  // ---------------------------------------------------------------- Snacks
  meal('s-banana-peanuts', 'snack', 'Banana & peanuts', 'all', [i('banana', 1), i('peanuts', 1)], 'Grab-and-go: a banana with a small handful of peanuts.', ['Roasted chickpeas instead of peanuts'], ['quick']),
  meal('s-doi-guava', 'snack', 'Yogurt & guava', SA, [i('yogurt', 0.5), i('guava', 1)], 'Plain yogurt with a sliced guava (or any seasonal fruit).', ['Any seasonal fruit'], ['vegetarian']),
  meal('s-eggs', 'snack', 'Two boiled eggs', 'all', [i('egg', 2)], 'Boil eggs for 9–10 minutes, cool in water. Season with salt and pepper.', ['Very affordable protein snack'], ['high-protein', 'budget']),
  meal('s-milk', 'snack', 'Glass of milk', 'all', [i('milk', 1)], 'A glass of milk — handy after training.', ['Low-fat milk', 'Plain yogurt'], ['quick']),
  meal('s-chola', 'snack', 'Spiced chickpeas (chola)', 'all', [i('chickpeas', 1), i('salad', 0.5)], 'Toss boiled chickpeas with onion, chilli, lemon and a pinch of salt.', ['Boiled peanuts'], ['vegan', 'budget']),
  meal('s-apple-pb', 'snack', 'Apple & peanut butter', WEST, [i('apple', 1), i('peanut-butter', 0.5)], 'Slice an apple and dip in a tablespoon of peanut butter.', ['Banana instead of apple'], ['vegan']),
  meal('s-dates-almonds', 'snack', 'Dates & almonds', ['MENA', 'PK', 'BD', 'OTHER'], [i('dates', 1), i('almonds', 0.5)], 'Three dates with a few almonds.', ['Peanuts instead of almonds'], ['vegan']),
  meal('s-seasonal-fruit', 'snack', 'Seasonal fruit bowl', 'all', [i('seasonal-fruit', 1)], 'Whatever fruit is in season and affordable. Mixed fruit varies, so it is not estimated.', ['Any single fruit'], ['vegan']),
  meal('s-edamame', 'snack', 'Edamame', ['EAST_ASIA', 'US', 'GB', 'OTHER'], [i('edamame', 1)], 'Steam edamame and sprinkle with salt.', ['Roasted chickpeas'], ['vegan', 'high-protein']),
];

export const MEAL_MAP: Record<string, Meal> = Object.fromEntries(MEALS.map((m) => [m.id, m]));

export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack (optional)' };
export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
