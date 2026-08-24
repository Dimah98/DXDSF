/**
 * Fire Pit recipes for Sunflower Land.
 * Maps dish name to required ingredients and quantities.
 */
export const FIRE_PIT_RECIPES: Record<string, Record<string, number>> = {
  "Furikake Sprinkle": { "Fish Flake": 1, "Seaweed": 1 },
  "Mashed Potato": { "Potato": 8 },
  "Pumpkin Soup": { "Pumpkin": 10 },
  "Reindeer Carrot": { "Carrot": 5 },
  "Mushroom Soup": { "Wild Mushroom": 5 },
  "Popcorn": { "Sunflower": 100, "Corn": 5 },
  "Bumpkin Broth": { "Carrot": 10, "Cabbage": 5 },
  "Cabbers n Mash": { "Mashed Potato": 10, "Cabbage": 20 },
  "Boiled Eggs": { "Egg": 10 },
  "Kale Stew": { "Kale": 10 },
  "Kale Omelette": { "Egg": 40, "Kale": 5 },
  "Gumbo": { "Potato": 50, "Pumpkin": 30, "Carrot": 20, "Red Snapper": 3 },
  "Rapid Roast": { "Magic Mushroom": 1, "Pumpkin": 40 },
  "Fried Tofu": { "Soybean": 15, "Sunflower": 200 },
  "Rice Bun": { "Rice": 2, "Wheat": 50 },
  "Antipasto": { "Olive": 2, "Grape": 2 },
  "Pizza Margherita": { "Tomato": 30, "Cheese": 5, "Wheat": 20 },
  "Rhubarb Tart": { "Rhubarb": 3 }
};

/**
 * Kitchen recipes for Sunflower Land.
 * Maps dish name to required ingredients and quantities.
 */
export const KITCHEN_RECIPES: Record<string, Record<string, number>> = {
  "Surimi Rice Bowl": { "Fish Stick": 1, "Rice": 1, "Onion": 1 },
  "Creamy Crab Bite": { "Crab Stick": 1, "Cheese": 3 },
  "Crimstone Infused Fish Oil": { "Fish Oil": 1, "Crimstone": 1 },
  "Sunflower Crunch": { "Sunflower": 300 },
  "Mushroom Jacket Potatoes": { "Wild Mushroom": 10, "Potato": 5 },
  "Fruit Salad": { "Apple": 1, "Orange": 1, "Blueberry": 1 },
  "Pancakes": { "Wheat": 10, "Egg": 10, "Honey": 6 },
  "Roast Veggies": { "Cauliflower": 15, "Carrot": 10 },
  "Cauliflower Burger": { "Cauliflower": 15, "Wheat": 5 },
  "Club Sandwich": { "Sunflower": 100, "Carrot": 25, "Wheat": 5 },
  "Bumpkin Salad": { "Beetroot": 20, "Parsnip": 10 },
  "Bumpkin ganoush": { "Eggplant": 30, "Potato": 50, "Parsnip": 10 },
  "Goblin's Treat": { "Pumpkin": 10, "Radish": 20, "Cabbage": 10 },
  "Chowder": { "Beetroot": 10, "Wheat": 10, "Parsnip": 5, "Anchovy": 3 },
  "Bumpkin Roast": { "Mashed Potato": 20, "Roast Veggies": 5 },
  "Goblin Brunch": { "Boiled Eggs": 5, "Goblin's Treat": 1 },
  "Beetroot Blaze": { "Magic Mushroom": 2, "Beetroot": 50 },
  "Steamed Red Rice": { "Rice": 3, "Beetroot": 50 },
  "Tofu Scramble": { "Soybean": 20, "Egg": 20, "Cauliflower": 10 },
  "Fried Calamari": { "Sunflower": 200, "Wheat": 15, "Squid": 1 },
  "Fish Burger": { "Beetroot": 10, "Wheat": 10, "Horse Mackerel": 1 },
  "Fish Omelette": { "Egg": 40, "Surgeonfish": 1, "Butterflyfish": 2 },
  "Ocean's Olive": { "Olive Flounder": 1, "Olive": 2 },
  "Seafood Basket": { "Blowfish": 2, "Napoleanfish": 2, "Sunfish": 2 },
  "Fish n Chips": { "Fancy Fries": 1, "Halibut": 1 },
  "Sushi Roll": { "Angelfish": 1, "Seaweed": 1, "Rice": 2 },
  "Caprese Salad": { "Cheese": 1, "Tomato": 25, "Kale": 20 },
  "Spaghetti al Limone": { "Wheat": 10, "Lemon": 15, "Cheese": 3 }
};

/**
 * Deli recipes for Sunflower Land.
 */
export const DELI_RECIPES: Record<string, Record<string, number>> = {
  "Shroom Syrup": { "Magic Mushroom": 3, "Honey": 20 },
  "Blue Cheese": { "Cheese": 2, "Blueberry": 10 },
  "Honey Cheddar": { "Cheese": 3, "Honey": 5 },
  "Fermented Fish": { "Tuna": 6 },
  "Blueberry Jam": { "Blueberry": 5 },
  "Fancy Fries": { "Sunflower": 500, "Potato": 500 },
  "Sauerkraut": { "Cabbage": 20 },
  "Fermented Carrots": { "Carrot": 20 },
  "Cheese": { "Milk": 3 }
};

/**
 * Smoothie Shack recipes for Sunflower Land.
 */
export const SMOOTHIE_SHACK_RECIPES: Record<string, Record<string, number>> = {
  "Grape Juice": { "Grape": 5, "Radish": 20 },
  "Sour Shake": { "Lemon": 20 },
  "Purple Smoothie": { "Blueberry": 5, "Cabbage": 10 },
  "Power Smoothie": { "Blueberry": 10, "Kale": 5 },
  "Orange Juice": { "Orange": 5 },
  "Apple Juice": { "Apple": 5 },
  "Bumpkin Detox": { "Apple": 5, "Orange": 5, "Carrot": 10 },
  "The Lot": { "Blueberry": 1, "Orange": 1, "Grape": 1, "Apple": 1, "Banana": 1 },
  "Banana Blast": { "Banana": 10, "Egg": 10 },
  "Slow Juice": { "Grape": 10, "Kale": 100 },
  "Carrot Juice": { "Carrot": 30 },
  "Quick Juice": { "Sunflower": 50, "Pumpkin": 40 }
};

/**
 * Bakery recipes for Sunflower Land.
 */
export const BAKERY_RECIPES: Record<string, Record<string, number>> = {
  "Lemon Cheesecake": { "Lemon": 20, "Cheese": 5, "Egg": 40 },
  "Honey Cake": { "Honey": 10, "Wheat": 10, "Egg": 20 },
  "Orange Cake": { "Orange": 5, "Egg": 30, "Wheat": 10 },
  "Apple Pie": { "Apple": 5, "Wheat": 10, "Egg": 20 },
  "Kale & Mushroom Pie": { "Wild Mushroom": 10, "Kale": 5, "Wheat": 5 },
  "Sunflower Cake": { "Sunflower": 1000, "Wheat": 10, "Egg": 30 },
  "Potato Cake": { "Potato": 500, "Wheat": 10, "Egg": 30 },
  "Pumpkin Cake": { "Pumpkin": 130, "Wheat": 10, "Egg": 30 },
  "Eggplant Cake": { "Eggplant": 30, "Wheat": 10, "Egg": 30 },
  "Carrot Cake": { "Carrot": 120, "Wheat": 10, "Egg": 30 },
  "Cabbage Cake": { "Cabbage": 90, "Wheat": 10, "Egg": 30 },
  "Beetroot Cake": { "Beetroot": 100, "Wheat": 10, "Egg": 30 },
  "Parsnip Cake": { "Parsnip": 45, "Wheat": 10, "Egg": 30 },
  "Cauliflower Cake": { "Cauliflower": 60, "Wheat": 10, "Egg": 30 },
  "Cornbread": { "Corn": 15, "Wheat": 5, "Egg": 10 },
  "Radish Cake": { "Radish": 25, "Wheat": 10, "Egg": 30 },
  "Wheat Cake": { "Wheat": 35, "Egg": 30 }
};
