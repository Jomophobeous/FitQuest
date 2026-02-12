/**
 * Auto-generated from Food_base_info.txt
 * Do not edit manually.
 */

export type RegionalFoodCategory = 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'snack' | 'meal';

export interface RegionalFoodItem {
  name: string;
  category: RegionalFoodCategory;
  description: string;
  calories_per_serving?: number;
  protein_g?: number;
  available_regions: string[];
  local_name?: string;
}

export const REGIONAL_FOOD_DATABASE: RegionalFoodItem[] = [
  {
    "name": "Kangaroo Meat",
    "category": "protein",
    "description": "Leanest red meat, sustainable, high protein, low saturated fat",
    "protein_g": 40,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Barramundi",
    "category": "protein",
    "description": "Heart health, lean protein, low mercury",
    "protein_g": 23,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Flathead Fish",
    "category": "protein",
    "description": "Lean protein, thyroid health, local catch",
    "protein_g": 22,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Emu Meat",
    "category": "protein",
    "description": "Lean game meat, native protein source",
    "protein_g": 30,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Crocodile Meat",
    "category": "protein",
    "description": "Lean white meat, exotic protein",
    "protein_g": 24,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Witchetty Grub",
    "category": "protein",
    "description": "Traditional protein, immune support, nutrient-dense",
    "protein_g": 15,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Green Ants",
    "category": "protein",
    "description": "Headache relief, protein source, traditional",
    "protein_g": 13,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Chicken (Free-Range)",
    "category": "protein",
    "description": "Lean protein, versatile, widely available",
    "protein_g": 27,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Beef (Grass-Fed)",
    "category": "protein",
    "description": "Muscle building, iron absorption, nutrient dense",
    "protein_g": 26,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Lamb",
    "category": "protein",
    "description": "Protein synthesis, immune function, hormone health",
    "protein_g": 25,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Pork",
    "category": "protein",
    "description": "Energy metabolism, thyroid function",
    "protein_g": 26,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Turkey",
    "category": "protein",
    "description": "Lean protein, mood support, sleep aid",
    "protein_g": 29,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Duck",
    "category": "protein",
    "description": "Flavorful protein, nutrient dense",
    "protein_g": 19,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Eggs (Free-Range)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health",
    "protein_g": 6,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Salmon (Atlantic)",
    "category": "protein",
    "description": "Anti-inflammatory, heart health, brain function",
    "protein_g": 25,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Tuna (Canned in Water)",
    "category": "protein",
    "description": "Lean protein, budget-friendly, versatile",
    "protein_g": 26,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Prawns/Shrimp",
    "category": "protein",
    "description": "Lean protein, thyroid health, low calorie",
    "protein_g": 24,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Mussels",
    "category": "protein",
    "description": "Brain health, iron absorption, sustainable",
    "protein_g": 18,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Oysters",
    "category": "protein",
    "description": "Immune function, testosterone support, zinc",
    "protein_g": 9,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Lamb Liver",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A",
    "protein_g": 20,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Wattleseed",
    "category": "protein",
    "description": "Sustained energy, nutty flavor, indigenous superfood",
    "protein_g": 25,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Lentils (Green/Red)",
    "category": "protein",
    "description": "Heart health, blood sugar control, budget protein",
    "protein_g": 18,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Chickpeas",
    "category": "protein",
    "description": "Satiety, digestive health, versatile protein",
    "protein_g": 12,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Black Beans",
    "category": "protein",
    "description": "Blood sugar regulation, gut health, heart health",
    "protein_g": 15,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Kidney Beans",
    "category": "protein",
    "description": "Heart health, blood sugar control, mineral dense",
    "protein_g": 15,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Peanuts",
    "category": "protein",
    "description": "Heart health, satiety, antioxidant",
    "protein_g": 7,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Almonds",
    "category": "fat",
    "description": "Heart health, skin health, bone health",
    "protein_g": 6,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Macadamia Nuts",
    "category": "fat",
    "description": "Heart health, brain function, healthy fats",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Walnuts",
    "category": "fat",
    "description": "Brain health, anti-inflammatory, heart health",
    "protein_g": 4,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Pumpkin Seeds",
    "category": "fat",
    "description": "Prostate health, sleep, muscle recovery",
    "protein_g": 9,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Weet-Bix",
    "category": "fat",
    "description": "Heart health, breakfast staple, sustained energy",
    "protein_g": 4,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Oats (Steel-Cut/Rolled)",
    "category": "carb",
    "description": "Cholesterol reduction, heart health, sustained energy",
    "protein_g": 6,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Quinoa",
    "category": "fat",
    "description": "Complete amino acids, gluten-free, sustained energy",
    "protein_g": 8,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Brown Rice",
    "category": "carb",
    "description": "Mineral dense, sustained energy, whole grain",
    "protein_g": 5,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Barley",
    "category": "carb",
    "description": "Heart health, blood sugar control, digestive health",
    "protein_g": 4,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Buckwheat",
    "category": "fat",
    "description": "Blood vessel health, gluten-free, heart health",
    "protein_g": 6,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Millet",
    "category": "carb",
    "description": "Alkalizing, gluten-free, heart health",
    "protein_g": 6,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Sorghum",
    "category": "carb",
    "description": "Gluten-free, antioxidant, sustained energy",
    "protein_g": 8,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Spelt",
    "category": "fat",
    "description": "Ancient grain, mineral dense, sustained energy",
    "protein_g": 11,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Wild Rice",
    "category": "carb",
    "description": "Protein-rich rice, mineral dense, whole grain",
    "protein_g": 7,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Sweet Potato (Kumara)",
    "category": "carb",
    "description": "Eye health, immune support, versatile carb",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Spinach",
    "category": "carb",
    "description": "Bone health, anemia prevention, nutrient dense",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Kale",
    "category": "carb",
    "description": "Anti-inflammatory, bone health, antioxidant",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Broccoli",
    "category": "carb",
    "description": "Cancer-fighting, immune support, detoxification",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Brussels Sprouts",
    "category": "carb",
    "description": "Heart health, anti-inflammatory, gut health",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Cauliflower",
    "category": "carb",
    "description": "Low calorie, versatile, anti-inflammatory",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Cabbage (Green/Red)",
    "category": "carb",
    "description": "Anti-inflammatory, gut health, affordable",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Carrots",
    "category": "carb",
    "description": "Eye health, immune function, skin health",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Beets",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver health",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Asparagus",
    "category": "carb",
    "description": "Detoxification, digestive health, diuretic",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Kakadu Plum",
    "category": "fruit",
    "description": "Highest vitamin C food, immune defense, anti-aging",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Quandong",
    "category": "fruit",
    "description": "Immune support, skin health, native fruit",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Finger Lime",
    "category": "fruit",
    "description": "Unique texture, citrus pearls, nutrient boost",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Bush Tomato",
    "category": "fruit",
    "description": "Antioxidant, savory flavor, traditional",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Muntries",
    "category": "fruit",
    "description": "Gut health, immune support, native",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Lilly Pilly",
    "category": "fruit",
    "description": "Immune support, digestive health, native",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Apples",
    "category": "fruit",
    "description": "Heart health, blood sugar control, satiety",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Bananas",
    "category": "fruit",
    "description": "Electrolyte balance, energy, digestion",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Oranges",
    "category": "fruit",
    "description": "Immune function, heart health, hydration",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Blueberries",
    "category": "fruit",
    "description": "Brain health, antioxidant, anti-inflammatory",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Greek Yogurt",
    "category": "fruit",
    "description": "Gut health, muscle repair, bone density, satiety",
    "protein_g": 20,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Milk (Dairy)",
    "category": "fruit",
    "description": "Bone health, muscle function, hydration",
    "protein_g": 8,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Cheese (Cheddar)",
    "category": "fruit",
    "description": "Bone health, protein synthesis, satiety",
    "protein_g": 7,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Cottage Cheese",
    "category": "fruit",
    "description": "Slow-digesting protein, muscle maintenance, satiety",
    "protein_g": 12,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Kefir",
    "category": "fruit",
    "description": "Gut health, immune function, lactose digestion",
    "protein_g": 9,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Mushrooms (Button)",
    "category": "fruit",
    "description": "Immune support, vitamin D (UV-exposed), low calorie",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Shiitake Mushrooms",
    "category": "fruit",
    "description": "Immune support, heart health, anti-inflammatory",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Oyster Mushrooms",
    "category": "fruit",
    "description": "Cholesterol reduction, immune support, protein",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Lemon Myrtle",
    "category": "fruit",
    "description": "Digestive health, immune support, flavor",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Tasmanian Pepperberry",
    "category": "fruit",
    "description": "Antioxidant, antimicrobial, unique spice",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Saltbush",
    "category": "fruit",
    "description": "Mineral rich, natural salt alternative, native",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Aniseed Myrtle",
    "category": "fruit",
    "description": "Digestive aid, flavor, traditional medicine",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Mountain Pepper",
    "category": "fruit",
    "description": "Antioxidant, antimicrobial, spicy flavor",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Turmeric",
    "category": "fruit",
    "description": "Anti-inflammatory, joint health, recovery",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Ginger",
    "category": "carb",
    "description": "Anti-inflammatory, digestive aid, nausea relief",
    "protein_g": 1,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Green Tea",
    "category": "fruit",
    "description": "Metabolism, focus, fat oxidation, heart health",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Rooibos Tea",
    "category": "fruit",
    "description": "Hydration, anti-inflammatory, caffeine-free, stress reduction",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Coffee",
    "category": "fruit",
    "description": "Alertness, metabolism, antioxidant, performance",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Coconut Water",
    "category": "fruit",
    "description": "Hydration, exercise recovery, natural electrolytes",
    "protein_g": 2,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Kombucha",
    "category": "fruit",
    "description": "Gut health, immune support, detoxification",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Avocado",
    "category": "fruit",
    "description": "Heart health, satiety, nutrient absorption, potassium",
    "protein_g": 3,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Olive Oil (Extra Virgin)",
    "category": "fat",
    "description": "Heart health, anti-inflammatory, cognitive protection",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Coconut Oil",
    "category": "fat",
    "description": "Quick energy, antimicrobial, metabolism support",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Flaxseed Oil",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance",
    "protein_g": 0,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Chia Seeds",
    "category": "fat",
    "description": "Hydration, sustained energy, omega-3, fiber",
    "protein_g": 5,
    "available_regions": [
      "AU"
    ]
  },
  {
    "name": "Beef (Grass-Fed)",
    "category": "protein",
    "description": "Muscle building, iron absorption, nutrient dense, hormone support",
    "protein_g": 26,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Lamb",
    "category": "protein",
    "description": "Protein synthesis, immune function, hormone health",
    "protein_g": 25,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Chicken (Free-Range)",
    "category": "protein",
    "description": "Lean protein, versatile, widely available, affordable",
    "protein_g": 27,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Ostrich Meat",
    "category": "protein",
    "description": "Leanest red meat, sustainable, high protein, low cholesterol",
    "protein_g": 26,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Springbok",
    "category": "protein",
    "description": "Lean game meat, sustainable hunting, nutrient dense",
    "protein_g": 28,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Kudu",
    "category": "protein",
    "description": "Very lean protein, traditional game, muscle building",
    "protein_g": 30,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Impala",
    "category": "protein",
    "description": "Lean game protein, sustainable, local delicacy",
    "protein_g": 29,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Warthog",
    "category": "protein",
    "description": "Traditional protein, lean meat, sustainable",
    "protein_g": 24,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Venison (Wild Deer)",
    "category": "protein",
    "description": "Very lean, iron-rich, muscle building, wild protein",
    "protein_g": 30,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Eggs (Free-Range)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, affordable",
    "protein_g": 6,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Pilchards (Sardines)",
    "category": "protein",
    "description": "Bone health, anti-inflammatory, budget-friendly, heart health",
    "protein_g": 25,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Mackerel",
    "category": "protein",
    "description": "Heart health, brain function, anti-inflammatory",
    "protein_g": 19,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Hake",
    "category": "protein",
    "description": "Lean protein, local catch, affordable fish",
    "protein_g": 18,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Snoek",
    "category": "protein",
    "description": "Traditional fish, braai staple, heart health",
    "protein_g": 20,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Yellowtail",
    "category": "protein",
    "description": "Sport fishing prize, lean protein, local favorite",
    "protein_g": 23,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Mussels",
    "category": "protein",
    "description": "Brain health, iron absorption, sustainable seafood",
    "protein_g": 18,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Chicken Feet",
    "category": "protein",
    "description": "Joint health, skin elasticity, traditional delicacy, connective tissue",
    "protein_g": 19,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Beef Liver",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse",
    "protein_g": 20,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Lamb Liver",
    "category": "protein",
    "description": "Iron-rich, vitamin A, traditional organ meat",
    "protein_g": 21,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Tripe",
    "category": "protein",
    "description": "Traditional stew ingredient, affordable protein, gut health",
    "protein_g": 12,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Sugar Beans (Red Speckled)",
    "category": "protein",
    "description": "Heart health, blood sugar control, affordable protein, satiety",
    "protein_g": 15,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Black-eyed Peas (Cowpeas)",
    "category": "protein",
    "description": "Digestive health, anemia prevention, traditional staple",
    "protein_g": 13,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Chickpeas",
    "category": "protein",
    "description": "Satiety, blood sugar control, versatile protein, digestive health",
    "protein_g": 12,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Lentils (Brown/Green)",
    "category": "protein",
    "description": "Heart health, blood sugar regulation, budget protein, energy",
    "protein_g": 18,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Bambara Groundnuts",
    "category": "protein",
    "description": "Drought-resistant, sustainable protein, nutrient dense",
    "protein_g": 19,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Peanuts (Groundnuts)",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant",
    "protein_g": 7,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Almonds",
    "category": "fat",
    "description": "Heart health, skin health, bone health, satiety",
    "protein_g": 6,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Macadamia Nuts",
    "category": "fat",
    "description": "Heart health, brain function, healthy fats, cholesterol",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Pecan Nuts",
    "category": "fat",
    "description": "Heart health, antioxidant, brain function, mineral dense",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Pumpkin Seeds (Pepitas)",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune",
    "protein_g": 9,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Sunflower Seeds",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack",
    "protein_g": 6,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Sesame Seeds",
    "category": "fat",
    "description": "Bone health, hormone production, mineral absorption",
    "protein_g": 5,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Chia Seeds",
    "category": "fat",
    "description": "Hydration, sustained energy, omega-3, fiber, satiety",
    "protein_g": 5,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Flaxseeds",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance, fiber",
    "protein_g": 5,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Maize Meal (Pap/Porridge)",
    "category": "carb",
    "description": "Sustained energy, national staple, versatile base, affordable calories",
    "protein_g": 8,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Samp (Crushed Maize)",
    "category": "protein",
    "description": "Traditional staple, sustained energy, digestive health",
    "protein_g": 7,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Oats (Steel-Cut/Rolled)",
    "category": "protein",
    "description": "Cholesterol reduction, heart health, sustained energy, breakfast",
    "protein_g": 6,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Sorghum (Mabele)",
    "category": "protein",
    "description": "Gluten-free, antioxidant, sustained energy, traditional grain",
    "protein_g": 8,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Millet",
    "category": "protein",
    "description": "Alkalizing, gluten-free, heart health, warming grain",
    "protein_g": 6,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Brown Rice",
    "category": "protein",
    "description": "Mineral dense, sustained energy, whole grain, versatile",
    "protein_g": 5,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Quinoa",
    "category": "protein",
    "description": "Complete amino acids, gluten-free, sustained energy, protein",
    "protein_g": 8,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Barley",
    "category": "protein",
    "description": "Heart health, blood sugar control, digestive health, satiety",
    "protein_g": 4,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Whole Wheat Bread",
    "category": "protein",
    "description": "Sustained energy, affordable staple, whole grain benefits",
    "protein_g": 4,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Rye Bread",
    "category": "protein",
    "description": "Blood sugar control, satiety, traditional bread, digestive",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Morogo (Wild Spinach/Amaranth)",
    "category": "vegetable",
    "description": "Traditional nutrient-dense green, anemia prevention, local superfood",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Spider Flower (Cleome)",
    "category": "vegetable",
    "description": "Traditional leafy green, nutrient dense, drought-resistant",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Black Jack (Bidens pilosa)",
    "category": "vegetable",
    "description": "Traditional medicine, nutrient dense, wild harvested",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Purslane",
    "category": "vegetable",
    "description": "Omega-3 in greens, antioxidant, traditional food, mineral dense",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Stinging Nettle",
    "category": "vegetable",
    "description": "Iron-rich, traditional medicine, nutrient dense, wild",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Cowpea Leaves (Muruwo)",
    "category": "vegetable",
    "description": "Anti-diabetic properties, anemia prevention, local superfood",
    "protein_g": 4,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Sweet Potato Leaves",
    "category": "carb",
    "description": "Nutrient dense, affordable green, traditional vegetable",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Pumpkin Leaves",
    "category": "vegetable",
    "description": "Iron-rich, nutrient dense, traditional cooking green",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Cassava Leaves",
    "category": "vegetable",
    "description": "Protein-rich green, traditional African vegetable, nutrient dense",
    "protein_g": 4,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Swiss Chard",
    "category": "vegetable",
    "description": "Bone health, blood pressure, antioxidant, versatile green",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Kale",
    "category": "vegetable",
    "description": "Anti-inflammatory, bone health, antioxidant, superfood",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Spinach",
    "category": "vegetable",
    "description": "Bone health, anemia prevention, nutrient dense, versatile",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Cabbage",
    "category": "vegetable",
    "description": "Anti-inflammatory, gut health, affordable, cancer-fighting",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Broccoli",
    "category": "vegetable",
    "description": "Cancer-fighting, immune support, detoxification, antioxidant",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Cauliflower",
    "category": "vegetable",
    "description": "Low calorie, versatile, anti-inflammatory, brain health",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Butternut Squash",
    "category": "vegetable",
    "description": "Eye health, immune support, low cost, complex carbs",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Sweet Potato",
    "category": "carb",
    "description": "Eye health, immune support, low GI, complex carbs",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Cassava (Yuca)",
    "category": "carb",
    "description": "Primary energy source, gluten-free, gut health, sustained fuel",
    "protein_g": 3,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Potatoes",
    "category": "carb",
    "description": "Satiety, energy, versatile base, potassium for cramps",
    "protein_g": 4,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Carrots",
    "category": "carb",
    "description": "Eye health, immune function, skin health, affordable",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Beetroot",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver detox, blood flow",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Turnips",
    "category": "carb",
    "description": "Low calorie, digestive health, affordable root vegetable",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Parsnips",
    "category": "carb",
    "description": "Digestive health, immune support, complex carbs",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Baobab Fruit",
    "category": "fruit",
    "description": "Immune support, prebiotic fiber, hydration, antioxidant",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Marula Fruit",
    "category": "fruit",
    "description": "Traditional fruit, immune support, cosmetic uses",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Kei Apple",
    "category": "fruit",
    "description": "Immune support, digestive health, wild fruit",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Num-Num (Natal Plum)",
    "category": "fruit",
    "description": "Iron absorption, immune support, traditional food",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Monkey Orange",
    "category": "fruit",
    "description": "Immune support, digestive health, wild harvested",
    "protein_g": 2,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Apples",
    "category": "fruit",
    "description": "Heart health, blood sugar control, satiety, portable",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Bananas",
    "category": "fruit",
    "description": "Electrolyte balance, energy, digestion, affordable",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Oranges",
    "category": "fruit",
    "description": "Immune function, heart health, hydration, citrus",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Pears",
    "category": "fruit",
    "description": "Digestive health, heart health, low glycemic",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Grapes",
    "category": "fruit",
    "description": "Heart health, anti-inflammatory, antioxidant, hydration",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Pineapple",
    "category": "fruit",
    "description": "Digestive enzyme, anti-inflammatory, immune support",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Mango",
    "category": "fruit",
    "description": "Immune support, eye health, digestion, tropical",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Papaya",
    "category": "fruit",
    "description": "Digestive enzyme, immune support, skin health",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Amasi (Fermented Milk)",
    "category": "fat",
    "description": "Gut health, lactose digestion, traditional staple, immune",
    "protein_g": 8,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Maas (Fermented Milk)",
    "category": "fat",
    "description": "Digestive health, traditional beverage, nutrient absorption",
    "protein_g": 8,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Milk (Fresh)",
    "category": "fat",
    "description": "Bone health, muscle function, hydration, complete protein",
    "protein_g": 8,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Cheese (Cheddar)",
    "category": "fat",
    "description": "Bone health, protein synthesis, satiety, mineral dense",
    "protein_g": 7,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Cottage Cheese",
    "category": "fat",
    "description": "Slow-digesting protein, muscle maintenance, satiety, night protein",
    "protein_g": 12,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Rooibos Tea",
    "category": "fat",
    "description": "Hydration, anti-inflammatory, caffeine-free, stress reduction, heart health",
    "protein_g": 0,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Honeybush Tea",
    "category": "fat",
    "description": "Caffeine-free, anti-inflammatory, traditional, immune support",
    "protein_g": 0,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Buchu",
    "category": "fat",
    "description": "Traditional medicine, urinary health, anti-inflammatory",
    "protein_g": 0,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Devil's Claw",
    "category": "fat",
    "description": "Joint health, anti-inflammatory, traditional medicine",
    "protein_g": 0,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "African Potato (Hypoxis)",
    "category": "carb",
    "description": "Immune support, traditional medicine, anti-inflammatory",
    "protein_g": 1,
    "available_regions": [
      "ZA"
    ]
  },
  {
    "name": "Beef (Grass-Fed)",
    "category": "protein",
    "description": "Muscle building, iron absorption, nutrient dense, cold climate fuel",
    "protein_g": 26,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Pork",
    "category": "protein",
    "description": "Energy metabolism, thyroid function, traditional staple",
    "protein_g": 26,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Lamb/Mutton",
    "category": "protein",
    "description": "Protein synthesis, immune function, warming meat, hormone health",
    "protein_g": 25,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Chicken",
    "category": "protein",
    "description": "Lean protein, versatile, widely available, affordable",
    "protein_g": 27,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Duck",
    "category": "protein",
    "description": "Flavorful protein, nutrient dense, traditional dish, warming",
    "protein_g": 19,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Goose",
    "category": "protein",
    "description": "Rich flavor, holiday tradition, nutrient dense, warming",
    "protein_g": 25,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Turkey",
    "category": "protein",
    "description": "Lean protein, mood support, sleep aid, low fat",
    "protein_g": 29,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Rabbit",
    "category": "protein",
    "description": "Very lean protein, low cholesterol, traditional game, affordable",
    "protein_g": 33,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Venison (Elk/Moose)",
    "category": "protein",
    "description": "Very lean, iron-rich, muscle building, wild protein, sustainable",
    "protein_g": 30,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Wild Boar",
    "category": "protein",
    "description": "Lean game meat, traditional hunting, nutrient dense",
    "protein_g": 28,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Bear Meat",
    "category": "protein",
    "description": "Traditional game, very lean, wilderness protein",
    "protein_g": 26,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Eggs",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, affordable staple",
    "protein_g": 6,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Herring",
    "category": "protein",
    "description": "Brain health, bone health, traditional protein, heart health",
    "protein_g": 20,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Mackerel",
    "category": "protein",
    "description": "Heart health, brain function, anti-inflammatory, affordable fish",
    "protein_g": 19,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Salmon (Wild Caught)",
    "category": "protein",
    "description": "Anti-inflammatory, heart health, brain function, premium protein",
    "protein_g": 25,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Trout",
    "category": "protein",
    "description": "Heart health, lean protein, local freshwater fish",
    "protein_g": 20,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Pike",
    "category": "protein",
    "description": "Lean freshwater fish, traditional catch, affordable protein",
    "protein_g": 19,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Bream",
    "category": "protein",
    "description": "White fish, mild flavor, versatile cooking, lean protein",
    "protein_g": 18,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Carp",
    "category": "protein",
    "description": "Traditional fish, sustainable aquaculture, affordable protein",
    "protein_g": 18,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Sturgeon",
    "category": "protein",
    "description": "Premium fish, caviar source, nutrient dense, traditional",
    "protein_g": 21,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Beef Liver",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse, affordable",
    "protein_g": 20,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Chicken Liver",
    "category": "protein",
    "description": "Iron-rich, vitamin A, affordable offal, nutrient dense",
    "protein_g": 17,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Beef Heart",
    "category": "protein",
    "description": "Coenzyme Q10, lean muscle meat, affordable, traditional",
    "protein_g": 20,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Beef Tongue",
    "category": "protein",
    "description": "Tender offal, nutrient dense, traditional delicacy",
    "protein_g": 19,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Bone Marrow",
    "category": "protein",
    "description": "Joint health, immune support, traditional nutrition, collagen",
    "protein_g": 7,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Buckwheat (Grechka)",
    "category": "protein",
    "description": "Gluten-free, heart health, warming staple, blood sugar control, complete amino acids",
    "protein_g": 8,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Lentils (Green/Brown)",
    "category": "protein",
    "description": "Heart health, blood sugar regulation, budget protein, energy, warming",
    "protein_g": 18,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Chickpeas",
    "category": "protein",
    "description": "Satiety, blood sugar control, versatile protein, digestive health",
    "protein_g": 12,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Peas (Dried)",
    "category": "protein",
    "description": "Split pea soup base, fiber, affordable protein, traditional",
    "protein_g": 16,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Beans (Kidney/Black)",
    "category": "protein",
    "description": "Heart health, blood sugar control, mineral dense, sustained energy",
    "protein_g": 15,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Soybeans",
    "category": "protein",
    "description": "Complete plant protein, bone health, hormone balance, versatile",
    "protein_g": 29,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Peanuts",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant",
    "protein_g": 7,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Sunflower Seeds",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Pumpkin Seeds",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune function",
    "protein_g": 9,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Flaxseeds",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance, digestive",
    "protein_g": 5,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Chia Seeds",
    "category": "fat",
    "description": "Hydration, sustained energy, omega-3, fiber, satiety",
    "protein_g": 5,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Hemp Seeds",
    "category": "fat",
    "description": "Complete amino acids, anti-inflammatory, mineral dense, modern superfood",
    "protein_g": 10,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Sesame Seeds",
    "category": "fat",
    "description": "Bone health, hormone production, mineral absorption, tahini base",
    "protein_g": 5,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Walnuts",
    "category": "fat",
    "description": "Brain health, anti-inflammatory, heart health, sleep support",
    "protein_g": 4,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Almonds",
    "category": "fat",
    "description": "Heart health, skin health, bone health, satiety, antioxidant",
    "protein_g": 6,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Rye Bread (Dark)",
    "category": "carb",
    "description": "Blood sugar control, satiety, traditional staple, digestive health, warming",
    "protein_g": 9,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Rye Berries (Whole)",
    "category": "carb",
    "description": "Heart health, blood sugar control, sustained energy, mineral dense",
    "protein_g": 9,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Oats (Oatmeal/Grechka)",
    "category": "carb",
    "description": "Cholesterol reduction, heart health, sustained energy, warming breakfast",
    "protein_g": 6,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Barley (Pearl/Whole)",
    "category": "carb",
    "description": "Heart health, blood sugar control, digestive health, soup staple",
    "protein_g": 4,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Millet (Proso)",
    "category": "carb",
    "description": "Alkalizing, gluten-free, heart health, digestive health, warming porridge",
    "protein_g": 6,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Wheat Berries (Whole)",
    "category": "carb",
    "description": "Whole grain, sustained energy, mineral dense, traditional",
    "protein_g": 8,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Semolina (Durum Wheat)",
    "category": "carb",
    "description": "Pasta base, sustained energy, versatile, affordable",
    "protein_g": 8,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Bulgur Wheat",
    "category": "carb",
    "description": "Quick-cooking, whole grain, digestive health, mineral dense",
    "protein_g": 6,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Quinoa",
    "category": "carb",
    "description": "Complete amino acids, gluten-free, sustained energy, modern grain",
    "protein_g": 8,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Amaranth",
    "category": "carb",
    "description": "Complete protein, bone health, gluten-free, ancient grain",
    "protein_g": 9,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Brown Rice",
    "category": "carb",
    "description": "Mineral dense, sustained energy, whole grain, versatile base",
    "protein_g": 5,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Wild Rice",
    "category": "carb",
    "description": "Protein-rich rice, mineral dense, whole grain, premium",
    "protein_g": 7,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Beets (Beetroot)",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver detox, blood flow, borscht base",
    "protein_g": 2,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Cabbage (White/Red)",
    "category": "vegetable",
    "description": "Anti-inflammatory, gut health, affordable, cancer-fighting, fermentation base",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Sauerkraut (Fermented Cabbage)",
    "category": "vegetable",
    "description": "Gut health, immune support, preservation method, digestive aid, probiotics",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Potatoes",
    "category": "carb",
    "description": "Satiety, energy, versatile base, potassium for cramps, national staple",
    "protein_g": 4,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Carrots",
    "category": "carb",
    "description": "Eye health, immune function, skin health, affordable, versatile",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Onions",
    "category": "vegetable",
    "description": "Anti-inflammatory, heart health, immune support, flavor base",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Garlic",
    "category": "vegetable",
    "description": "Immune boosting, heart health, antimicrobial, anti-inflammatory",
    "protein_g": 2,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Leeks",
    "category": "vegetable",
    "description": "Bone health, heart health, digestive health, mild onion flavor",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Turnips",
    "category": "carb",
    "description": "Low calorie, digestive health, affordable root, greens edible",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Parsnips",
    "category": "carb",
    "description": "Digestive health, immune support, complex carbs, sweet flavor",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Radishes",
    "category": "carb",
    "description": "Digestive aid, detoxification, low calorie, spicy flavor",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Horseradish",
    "category": "carb",
    "description": "Sinus clearing, antimicrobial, digestive stimulant, traditional condiment",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Celery Root (Celeriac)",
    "category": "carb",
    "description": "Low calorie, digestive health, versatile, celery flavor",
    "protein_g": 2,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Kohlrabi",
    "category": "carb",
    "description": "Cruciferous benefits, low calorie, crunchy texture, vitamin C",
    "protein_g": 2,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Rutabaga (Swede)",
    "category": "carb",
    "description": "Winter vegetable, digestive health, affordable, sustained energy",
    "protein_g": 2,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Spinach",
    "category": "carb",
    "description": "Bone health, anemia prevention, nutrient dense, versatile green",
    "protein_g": 3,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Kale",
    "category": "carb",
    "description": "Anti-inflammatory, bone health, antioxidant, superfood green",
    "protein_g": 3,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Swiss Chard",
    "category": "carb",
    "description": "Bone health, blood pressure, antioxidant, colorful stems",
    "protein_g": 3,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Porcini Mushrooms",
    "category": "carb",
    "description": "Umami flavor, immune support, wild foraged, mineral dense",
    "protein_g": 7,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Chanterelle Mushrooms",
    "category": "carb",
    "description": "Vitamin D (sun-exposed), immune support, wild delicacy",
    "protein_g": 4,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Shiitake Mushrooms",
    "category": "carb",
    "description": "Immune support, heart health, anti-inflammatory, medicinal",
    "protein_g": 2,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Oyster Mushrooms",
    "category": "carb",
    "description": "Cholesterol reduction, immune support, protein, affordable",
    "protein_g": 3,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "White Button Mushrooms",
    "category": "carb",
    "description": "Immune support, vitamin D, low calorie, versatile, affordable",
    "protein_g": 3,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Kefir",
    "category": "carb",
    "description": "Gut health, immune function, lactose digestion, bone health, protein synthesis",
    "protein_g": 9,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Ryazhenka (Baked Fermented Milk)",
    "category": "carb",
    "description": "Gut health, traditional fermented, easier digestion, unique flavor",
    "protein_g": 8,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Tvorog (Farmer's Cheese/Cottage Cheese)",
    "category": "carb",
    "description": "Slow-digesting protein, muscle maintenance, satiety, bone health, overnight recovery",
    "protein_g": 24,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Smetana (Sour Cream)",
    "category": "carb",
    "description": "Traditional condiment, gut health, rich flavor, calcium",
    "protein_g": 7,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Milk (Fresh/Whole)",
    "category": "carb",
    "description": "Bone health, muscle function, hydration, complete protein, affordable",
    "protein_g": 8,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Cheese (Russian Varieties)",
    "category": "carb",
    "description": "Bone health, protein synthesis, satiety, traditional, preservation",
    "protein_g": 7,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Yogurt (Plain)",
    "category": "carb",
    "description": "Gut health, muscle repair, bone density, immune support",
    "protein_g": 10,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Dill",
    "category": "carb",
    "description": "Digestive aid, traditional flavoring, antimicrobial, calcium absorption",
    "protein_g": 0,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Parsley",
    "category": "carb",
    "description": "Bone health, immune support, detoxification, heavy metal chelation",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Chives",
    "category": "carb",
    "description": "Bone health, immune support, mild onion flavor, traditional",
    "protein_g": 1,
    "available_regions": [
      "EE"
    ]
  },
  {
    "name": "Beef (Grass-Fed)",
    "category": "protein",
    "description": "Muscle building, iron absorption, nutrient dense, Brazilian barbecue staple",
    "protein_g": 26,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Picanha (Top Sirloin Cap)",
    "category": "protein",
    "description": "Premium Brazilian cut, muscle building, traditional churrasco, rich flavor",
    "protein_g": 27,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Chicken (Frango)",
    "category": "protein",
    "description": "Lean protein, versatile, widely available, budget-friendly staple",
    "protein_g": 27,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Pork (Porco)",
    "category": "protein",
    "description": "Energy metabolism, thyroid function, traditional feijoada ingredient",
    "protein_g": 26,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Lamb/Cordeiro",
    "category": "protein",
    "description": "Protein synthesis, immune function, Andean tradition, nutrient dense",
    "protein_g": 25,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Goat Meat (Chivo)",
    "category": "protein",
    "description": "Lean protein, traditional Andean meat, sustainable, low cholesterol",
    "protein_g": 27,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Eggs (Ovos)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, versatile staple",
    "protein_g": 6,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Fish (Pescado) - General",
    "category": "protein",
    "description": "Heart health, brain function, lean protein, Amazonian river fish",
    "protein_g": 20,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Tambaqui (Colossoma macropomum)",
    "category": "protein",
    "description": "Amazonian staple, sustainable aquaculture, lean protein, local favorite",
    "protein_g": 19,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Pirarucu (Arapaima)",
    "category": "protein",
    "description": "Largest freshwater fish, premium Amazonian protein, sustainable farming",
    "protein_g": 20,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Surubi (Striped Catfish)",
    "category": "protein",
    "description": "River fish, mild flavor, versatile cooking, affordable protein",
    "protein_g": 18,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Pacu",
    "category": "protein",
    "description": "Amazonian delicacy, nut-eating fish, unique flavor, sustainable",
    "protein_g": 19,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Corvina (Sea Bass)",
    "category": "protein",
    "description": "White fish, mild flavor, coastal favorite, lean protein",
    "protein_g": 24,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Anchoveta (Anchovy)",
    "category": "protein",
    "description": "Heart health, bone health, budget-friendly, Peruvian staple",
    "protein_g": 20,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Sardines",
    "category": "protein",
    "description": "Bone health, heart health, anti-inflammatory, budget seafood",
    "protein_g": 23,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Octopus (Pulpo)",
    "category": "protein",
    "description": "Very high protein, low fat, cognitive health, iron absorption",
    "protein_g": 30,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Squid (Calamari)",
    "category": "protein",
    "description": "Lean protein, versatile, quick cooking, mineral dense",
    "protein_g": 16,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Shrimp (Camarão)",
    "category": "protein",
    "description": "Lean protein, thyroid health, antioxidant, coastal delicacy",
    "protein_g": 24,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Mussels (Mexilhões)",
    "category": "protein",
    "description": "Brain health, iron absorption, sustainable seafood, affordable",
    "protein_g": 18,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Beef Liver (Fígado)",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse, affordable",
    "protein_g": 20,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Chicken Hearts (Coração de Frango)",
    "category": "protein",
    "description": "Coenzyme Q10, lean muscle meat, affordable, churrasco favorite",
    "protein_g": 20,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Black Pudding (Morcilla)",
    "category": "protein",
    "description": "Iron-rich, traditional sausage, nutrient dense, cultural staple",
    "protein_g": 12,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Black Beans (Feijão Preto)",
    "category": "protein",
    "description": "Blood sugar regulation, gut health, feijoada base, heart health, sustained energy",
    "protein_g": 15,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Pinto Beans (Feijão Carioca)",
    "category": "protein",
    "description": "Brazilian favorite, digestive health, affordable protein, mineral dense",
    "protein_g": 15,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Kidney Beans (Feijão Vermelho)",
    "category": "protein",
    "description": "Heart health, blood sugar control, chili base, sustained energy",
    "protein_g": 15,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Chickpeas (Grão de Bico)",
    "category": "protein",
    "description": "Satiety, blood sugar control, versatile protein, digestive health",
    "protein_g": 12,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Lentils (Lentilha)",
    "category": "protein",
    "description": "Heart health, blood sugar regulation, budget protein, energy, Andean",
    "protein_g": 18,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Fava Beans (Fava)",
    "category": "protein",
    "description": "Plant protein, Mediterranean tradition, digestive health, nutrient dense",
    "protein_g": 13,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Peanuts (Amendoim)",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant, peanut base",
    "protein_g": 7,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Brazil Nuts (Castanha do Pará)",
    "category": "fat",
    "description": "Thyroid function, antioxidant protection, Amazonian superfood (limit 1-2/day)",
    "protein_g": 4,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Cashew Nuts (Caju)",
    "category": "fat",
    "description": "Heart health, bone health, mineral dense, creamy texture",
    "protein_g": 5,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Almonds (Amêndoas)",
    "category": "fat",
    "description": "Heart health, skin health, bone health, satiety, antioxidant",
    "protein_g": 6,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Walnuts (Nozes)",
    "category": "fat",
    "description": "Brain health, anti-inflammatory, heart health, sleep support",
    "protein_g": 4,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Pecans (Nozes Pecã)",
    "category": "fat",
    "description": "Heart health, antioxidant, brain function, mineral dense, sweet flavor",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Pumpkin Seeds (Sementes de Abóbora)",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune function",
    "protein_g": 9,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Sunflower Seeds (Sementes de Girassol)",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Chia Seeds",
    "category": "fat",
    "description": "Hydration, sustained energy, omega-3, fiber, satiety, ancient grain",
    "protein_g": 5,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Flaxseeds (Linhaça)",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance, digestive health",
    "protein_g": 5,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Hemp Seeds",
    "category": "fat",
    "description": "Complete amino acids, anti-inflammatory, mineral dense, modern superfood",
    "protein_g": 10,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Sesame Seeds (Gergelim)",
    "category": "fat",
    "description": "Bone health, hormone production, mineral absorption, tahini base",
    "protein_g": 5,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Quinoa",
    "category": "fat",
    "description": "Complete amino acids, gluten-free, sustained energy, Andean superfood, versatile",
    "protein_g": 8,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Amaranth",
    "category": "fat",
    "description": "Complete protein, bone health, gluten-free, ancient grain, cholesterol reduction",
    "protein_g": 9,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Teff",
    "category": "carb",
    "description": "Complete amino acids, gluten-free, bone health, Ethiopian staple, tiny grain",
    "protein_g": 10,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Millet",
    "category": "carb",
    "description": "Alkalizing, gluten-free, heart health, digestive health, warming",
    "protein_g": 6,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Sorghum",
    "category": "carb",
    "description": "Gluten-free, antioxidant, sustained energy, drought-resistant, traditional",
    "protein_g": 8,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Brown Rice (Arroz Integral)",
    "category": "carb",
    "description": "Mineral dense, sustained energy, whole grain, versatile base, affordable",
    "protein_g": 5,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Wild Rice (Arroz Selvagem)",
    "category": "carb",
    "description": "Protein-rich rice, mineral dense, whole grain, premium, nutty flavor",
    "protein_g": 7,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Oats (Aveia)",
    "category": "carb",
    "description": "Cholesterol reduction, heart health, sustained energy, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Barley (Cevada)",
    "category": "carb",
    "description": "Heart health, blood sugar control, digestive health, soup grain, satiety",
    "protein_g": 4,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Corn/Maize (Milho)",
    "category": "carb",
    "description": "Eye health, sustained energy, arepa base, traditional staple, gluten-free",
    "protein_g": 5,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Cassava/Yuca (Mandioca)",
    "category": "carb",
    "description": "Primary energy source, gluten-free, gut health, tapioca base, sustained fuel",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Sweet Potato (Batata Doce)",
    "category": "carb",
    "description": "Eye health, immune support, low GI, complex carbs, antioxidant, versatile",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Potatoes (Batatas)",
    "category": "carb",
    "description": "Satiety, energy, versatile base, potassium for cramps, affordable staple",
    "protein_g": 4,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Yams (Inhame)",
    "category": "carb",
    "description": "Digestive health, sustained energy, Caribbean/South American staple, mineral dense",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Carrots (Cenouras)",
    "category": "carb",
    "description": "Eye health, immune function, skin health, affordable, versatile",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Beets (Beterrabas)",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver detox, blood flow, endurance",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Turnips (Nabos)",
    "category": "carb",
    "description": "Low calorie, digestive health, affordable root, greens edible, versatile",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Parsnips (Chirivías)",
    "category": "carb",
    "description": "Digestive health, immune support, complex carbs, sweet flavor, winter vegetable",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Maca Root",
    "category": "carb",
    "description": "Energy boost, hormone balance, fertility, endurance, Andean adaptogen",
    "protein_g": 4,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Jicama",
    "category": "carb",
    "description": "Digestive health, immune support, crunchy texture, low calorie, gut health",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Kale (Couve)",
    "category": "vegetable",
    "description": "Anti-inflammatory, bone health, antioxidant, superfood, versatile",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Spinach (Espinafre)",
    "category": "vegetable",
    "description": "Bone health, anemia prevention, nutrient dense, versatile green, performance",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Swiss Chard (Acelga)",
    "category": "vegetable",
    "description": "Bone health, blood pressure, antioxidant, colorful, mineral dense",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Collard Greens (Couve)",
    "category": "vegetable",
    "description": "Bone health, digestive health, Southern Brazilian tradition, nutrient dense",
    "protein_g": 4,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Cabbage (Repolho)",
    "category": "vegetable",
    "description": "Anti-inflammatory, gut health, affordable, cancer-fighting, fermentation base",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Broccoli (Brócolis)",
    "category": "vegetable",
    "description": "Cancer-fighting, immune support, detoxification, blood sugar, antioxidant",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Cauliflower (Couve-Flor)",
    "category": "vegetable",
    "description": "Low calorie, versatile, anti-inflammatory, brain health, rice substitute",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Brussels Sprouts (Couve de Bruxelas)",
    "category": "vegetable",
    "description": "Heart health, anti-inflammatory, gut health, detoxification, nutrient dense",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Asparagus (Aspargos)",
    "category": "vegetable",
    "description": "Detoxification, digestive health, diuretic, blood sugar, antioxidant",
    "protein_g": 3,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Artichokes (Alcachofras)",
    "category": "vegetable",
    "description": "Liver health, digestive health, cholesterol reduction, prebiotic fiber",
    "protein_g": 4,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Okra (Quiabo)",
    "category": "vegetable",
    "description": "Blood sugar control, digestive health, folate for recovery, soluble fiber",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Zucchini (Abobrinha)",
    "category": "vegetable",
    "description": "Low calorie, versatile, digestive health, hydration, noodle substitute",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Bell Peppers (Pimentões)",
    "category": "vegetable",
    "description": "Immune support, eye health, antioxidant, low calorie, colorful",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Tomatoes (Tomates)",
    "category": "vegetable",
    "description": "Heart health, prostate health, cancer prevention, skin health, lycopene absorption",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Onions (Cebolas)",
    "category": "vegetable",
    "description": "Anti-inflammatory, heart health, immune support, blood sugar, flavor base",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Garlic (Alho)",
    "category": "vegetable",
    "description": "Immune boosting, heart health, antimicrobial, anti-inflammatory, blood pressure",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Açaí Berries",
    "category": "fruit",
    "description": "Antioxidant powerhouse, heart health, energy, anti-aging, Amazonian staple",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Camu Camu",
    "category": "fruit",
    "description": "Highest vitamin C food, potent antioxidant, anti-inflammatory, immune defense, collagen",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Guaraná",
    "category": "fat",
    "description": "Sustained energy, mental focus, metabolism boost, traditional stimulant, endurance",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Cupuaçu",
    "category": "fruit",
    "description": "Energy boost, antioxidant, skin health, chocolate relative, Amazonian delicacy",
    "protein_g": 2,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Acerola (Barbados Cherry)",
    "category": "fruit",
    "description": "Immune support, collagen synthesis, antioxidant, anti-inflammatory, Caribbean",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Passion Fruit (Maracujá)",
    "category": "fruit",
    "description": "Digestive health, immune support, anxiety reduction, sleep aid, fiber champion",
    "protein_g": 5,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Papaya (Mamão)",
    "category": "fruit",
    "description": "Digestion, immune support, skin health, anti-inflammatory, enzyme support",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Pineapple (Abacaxi)",
    "category": "fruit",
    "description": "Digestive enzyme, anti-inflammatory, immune support, manganese for bones",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Mango (Manga)",
    "category": "fruit",
    "description": "Immune support, eye health, digestion, skin health, tropical delight",
    "protein_g": 1,
    "available_regions": [
      "SA"
    ]
  },
  {
    "name": "Lamb (Kefta/Cutlets)",
    "category": "protein",
    "description": "Protein synthesis, immune function, tagine staple, nutrient dense, warming",
    "protein_g": 25,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Beef (Ground/Steaks)",
    "category": "protein",
    "description": "Muscle building, iron absorption, nutrient dense, couscous pairing, energy",
    "protein_g": 26,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Goat Meat",
    "category": "protein",
    "description": "Lean protein, traditional Berber meat, sustainable, low cholesterol, hearty",
    "protein_g": 27,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Camel Meat",
    "category": "protein",
    "description": "Desert staple, lean protein, traditional Bedouin, diabetes-friendly, unique",
    "protein_g": 22,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Chicken (Djej)",
    "category": "protein",
    "description": "Lean protein, versatile, tagine favorite, widely available, affordable",
    "protein_g": 27,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Turkey",
    "category": "protein",
    "description": "Lean protein, mood support, sleep aid, low fat, versatile",
    "protein_g": 29,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Eggs (Bayd)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, shakshuka base, versatile",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Sardines (Sardines)",
    "category": "protein",
    "description": "Bone health, heart health, anti-inflammatory, budget-friendly, Mediterranean staple",
    "protein_g": 25,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Mackerel",
    "category": "protein",
    "description": "Heart health, brain function, anti-inflammatory, grilled favorite, affordable",
    "protein_g": 19,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Sea Bream (Dorade)",
    "category": "protein",
    "description": "White fish, mild flavor, Mediterranean favorite, lean protein, delicate",
    "protein_g": 21,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Sea Bass (Louz)",
    "category": "protein",
    "description": "Premium white fish, lean protein, coastal delicacy, heart health",
    "protein_g": 24,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Anchovies (Anchois)",
    "category": "protein",
    "description": "Heart health, bone health, pizza topping, budget-friendly, umami",
    "protein_g": 20,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Octopus (Hit)",
    "category": "protein",
    "description": "Very high protein, low fat, cognitive health, iron absorption, tagine",
    "protein_g": 30,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Squid (Calamar)",
    "category": "protein",
    "description": "Lean protein, versatile, quick cooking, mineral dense, affordable",
    "protein_g": 16,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Shrimp (Crevettes)",
    "category": "protein",
    "description": "Lean protein, thyroid health, antioxidant, coastal delicacy, brain health",
    "protein_g": 24,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Mussels (Moules)",
    "category": "protein",
    "description": "Brain health, iron absorption, sustainable seafood, affordable, mineral dense",
    "protein_g": 18,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Tuna (Thon)",
    "category": "protein",
    "description": "Heart health, brain function, lean protein, anti-inflammatory, steak-like",
    "protein_g": 28,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Swordfish (Espadon)",
    "category": "protein",
    "description": "Grilling fish, meaty texture, premium seafood, mineral dense",
    "protein_g": 20,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Beef Liver (Kebda)",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse, affordable, traditional",
    "protein_g": 20,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Lamb Liver",
    "category": "protein",
    "description": "Iron-rich, vitamin A, affordable offal, nutrient dense, breakfast dish",
    "protein_g": 21,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Chickpeas (Hummus/Hommos)",
    "category": "protein",
    "description": "Heart health, diabetes prevention, hummus base, digestive wellness, satiety",
    "protein_g": 12,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Fava Beans (Ful Medames)",
    "category": "protein",
    "description": "Plant protein, folate for cell repair, Egyptian breakfast, dopamine precursor, sustained energy",
    "protein_g": 13,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Lentils (Adas)",
    "category": "protein",
    "description": "Blood sugar regulation, iron deficiency prevention, heart health, energy, affordable",
    "protein_g": 18,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Black Beans",
    "category": "protein",
    "description": "Blood sugar regulation, gut health, heart health, sustained energy, versatile",
    "protein_g": 15,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Kidney Beans (Loubia)",
    "category": "protein",
    "description": "Heart health, blood sugar control, Moroccan tagine, mineral dense, sustained",
    "protein_g": 15,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "White Beans (Cannellini/Navy)",
    "category": "protein",
    "description": "Creamy texture, digestive health, Italian/North African fusion, mineral dense",
    "protein_g": 15,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Peas (Split/Dried)",
    "category": "protein",
    "description": "Split pea soup, fiber, affordable protein, sustained energy, versatile",
    "protein_g": 16,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Peanuts",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant, snack staple",
    "protein_g": 7,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Almonds (Loz)",
    "category": "fat",
    "description": "Heart health, skin health, bone health, satiety, antioxidant, tagine garnish",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Walnuts (Joz)",
    "category": "fat",
    "description": "Brain health, anti-inflammatory, heart health, sleep support, pastry filling",
    "protein_g": 4,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Pistachios (Fustuq)",
    "category": "fat",
    "description": "Eye health, blood sugar control, heart health, antioxidant, dessert garnish",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Cashews (Kaju)",
    "category": "fat",
    "description": "Heart health, bone health, mineral dense, creamy texture, sauce base",
    "protein_g": 5,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Hazelnuts (Bunduq)",
    "category": "fat",
    "description": "Heart health, brain function, antioxidant, dessert ingredient, rich flavor",
    "protein_g": 4,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Pine Nuts (Snoubar)",
    "category": "fat",
    "description": "Heart health, energy, appetite suppression, pesto base, premium",
    "protein_g": 4,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Sesame Seeds (Simsim)",
    "category": "protein",
    "description": "Bone health, hormone production, tahini base, mineral absorption, antioxidant",
    "protein_g": 5,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Sunflower Seeds",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Pumpkin Seeds",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune function, snack",
    "protein_g": 9,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Chia Seeds",
    "category": "fat",
    "description": "Hydration, sustained energy, omega-3, fiber, satiety, modern addition",
    "protein_g": 5,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Flaxseeds (Kittan)",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance, digestive health",
    "protein_g": 5,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Hemp Seeds",
    "category": "fat",
    "description": "Complete amino acids, anti-inflammatory, mineral dense, modern superfood",
    "protein_g": 10,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Couscous (Semolina)",
    "category": "carb",
    "description": "Quick-cooking, versatile base, selenium antioxidant, sustained energy, Moroccan staple",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Whole Wheat Couscous",
    "category": "carb",
    "description": "Higher fiber, more nutrients, sustained energy, digestive health, whole grain",
    "protein_g": 7,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Bulgur Wheat (Cracked Wheat)",
    "category": "carb",
    "description": "Quick-cooking whole grain, tabbouleh base, digestive health, mineral dense",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Freekeh (Green Wheat)",
    "category": "carb",
    "description": "Young green wheat, smoky flavor, high fiber, sustained energy, Middle Eastern",
    "protein_g": 8,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Barley (Sha'ir)",
    "category": "carb",
    "description": "Heart health, blood sugar control, digestive health, soup grain, ancient",
    "protein_g": 4,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Farro (Emmer Wheat)",
    "category": "carb",
    "description": "Ancient wheat, nutty flavor, sustained energy, mineral dense, Italian/North African",
    "protein_g": 8,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Spelt",
    "category": "carb",
    "description": "Ancient grain, mineral dense, sustained energy, nutty flavor, protein-rich",
    "protein_g": 11,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Oats (Shufan)",
    "category": "carb",
    "description": "Cholesterol reduction, heart health, sustained energy, breakfast, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Brown Rice (Ruz)",
    "category": "carb",
    "description": "Mineral dense, sustained energy, whole grain, versatile base, Egyptian staple",
    "protein_g": 5,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Wild Rice",
    "category": "carb",
    "description": "Protein-rich rice, mineral dense, whole grain, premium, nutty flavor",
    "protein_g": 7,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Millet (Dokhn)",
    "category": "carb",
    "description": "Alkalizing, gluten-free, heart health, digestive health, African heritage",
    "protein_g": 6,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Sorghum (Dura)",
    "category": "carb",
    "description": "Gluten-free, antioxidant, sustained energy, drought-resistant, traditional African",
    "protein_g": 8,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Quinoa",
    "category": "carb",
    "description": "Complete amino acids, gluten-free, sustained energy, modern addition, versatile",
    "protein_g": 8,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Teff",
    "category": "carb",
    "description": "Complete amino acids, gluten-free, bone health, tiny grain, Ethiopian/North African",
    "protein_g": 10,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Eggplant (Betingan)",
    "category": "vegetable",
    "description": "Cognitive health, heart health, baba ganoush base, blood sugar control, versatile",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Zucchini (Kousa)",
    "category": "vegetable",
    "description": "Low calorie, versatile, digestive health, hydration, stuffed (mahshi), noodle substitute",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Okra (Bamia)",
    "category": "vegetable",
    "description": "Blood sugar control, digestive health, folate for recovery, soluble fiber, traditional",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Tomatoes (Tomatim)",
    "category": "vegetable",
    "description": "Heart health, prostate health, cancer prevention, shakshuka base, skin health",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Bell Peppers (Filfil)",
    "category": "vegetable",
    "description": "Immune support, eye health, antioxidant, low calorie, colorful, stuffed",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Onions (Bassal)",
    "category": "vegetable",
    "description": "Anti-inflammatory, heart health, immune support, blood sugar, flavor base",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Garlic (Thom)",
    "category": "vegetable",
    "description": "Immune boosting, heart health, antimicrobial, anti-inflammatory, blood pressure",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Spinach (Sabanekh)",
    "category": "vegetable",
    "description": "Bone health, anemia prevention, nutrient dense, versatile green, performance",
    "protein_g": 3,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Swiss Chard (Silq)",
    "category": "vegetable",
    "description": "Bone health, blood pressure, antioxidant, colorful, mineral dense, sautéed",
    "protein_g": 3,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Kale",
    "category": "vegetable",
    "description": "Anti-inflammatory, bone health, antioxidant, superfood, modern addition",
    "protein_g": 3,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Cabbage (Malfoof)",
    "category": "vegetable",
    "description": "Anti-inflammatory, gut health, affordable, cancer-fighting, stuffed (mahshi)",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Cauliflower (Arnabeet)",
    "category": "vegetable",
    "description": "Low calorie, versatile, anti-inflammatory, brain health, rice substitute",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Carrots (Jazar)",
    "category": "carb",
    "description": "Eye health, immune function, skin health, affordable, versatile, sweet",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Beets (Shamandar)",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver detox, blood flow, endurance",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Turnips (Lift)",
    "category": "carb",
    "description": "Low calorie, digestive health, affordable root, pickled (torshi), greens edible",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Fennel (Shamar)",
    "category": "vegetable",
    "description": "Digestive aid, anti-inflammatory, licorice flavor, blood pressure, aromatic",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Artichokes (Ardi Shawki)",
    "category": "vegetable",
    "description": "Liver health, digestive health, cholesterol reduction, prebiotic fiber, stuffed",
    "protein_g": 4,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Celery (Krafs)",
    "category": "vegetable",
    "description": "Low calorie, digestive health, hydration, blood pressure, crunchy snack",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Cucumber (Khiyar)",
    "category": "vegetable",
    "description": "Hydration, skin health, low calorie, digestive aid, cooling, salad staple",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Leeks (Kurrath)",
    "category": "vegetable",
    "description": "Bone health, heart health, digestive health, mild onion flavor, soup base",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Radishes (Fijl)",
    "category": "carb",
    "description": "Digestive aid, detoxification, low calorie, spicy flavor, pickled (torshi)",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Dates (Tamr)",
    "category": "fruit",
    "description": "Quick energy, digestive health, natural sweetener, mineral dense, Ramadan staple",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Figs (Teen)",
    "category": "fruit",
    "description": "Bone health, digestive health, natural sweetness, mineral dense, ancient",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Pomegranates (Rumman)",
    "category": "fruit",
    "description": "Heart health, anti-inflammatory, prostate health, exercise recovery, antioxidant king",
    "protein_g": 2,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Oranges (Burtuqal)",
    "category": "fruit",
    "description": "Immune function, heart health, hydration, Moroccan export, affordable",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Lemons (Laymoun)",
    "category": "fruit",
    "description": "Immune support, digestion, hydration, flavor enhancer, preservation, detox",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Olives (Zaytoon)",
    "category": "fruit",
    "description": "Heart health, anti-inflammatory, Mediterranean staple, satiety, probiotic (fermented)",
    "protein_g": 0,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Apricots (Mishmish)",
    "category": "fruit",
    "description": "Eye health, immune support, digestive health, natural sweetness, dried staple",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Grapes (Enab)",
    "category": "fruit",
    "description": "Heart health, anti-inflammatory, antioxidant, wine production, hydration",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Watermelon (Battikh)",
    "category": "fruit",
    "description": "Hydration, heart health, muscle recovery (citrulline), cooling, summer staple",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Melon (Shamam)",
    "category": "fruit",
    "description": "Hydration, immune support, digestive health, cooling, summer fruit",
    "protein_g": 1,
    "available_regions": [
      "NA"
    ]
  },
  {
    "name": "Beef (Grass-Fed)",
    "category": "protein",
    "description": "Muscle building, iron absorption, nutrient dense, braai/grill staple, energy",
    "protein_g": 26,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Goat Meat (Chèvre/Cabrito)",
    "category": "protein",
    "description": "Lean protein, traditional African meat, sustainable, low cholesterol, preferred",
    "protein_g": 27,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Chicken (Poulet)",
    "category": "protein",
    "description": "Lean protein, versatile, widely available, affordable staple, village raised",
    "protein_g": 27,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Bushmeat (Various)",
    "category": "protein",
    "description": "Traditional protein, sustainable hunting, lean, cultural importance, forest",
    "protein_g": 25,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Antelope (Various Species)",
    "category": "protein",
    "description": "Very lean, iron-rich, traditional hunting, forest savanna, nutrient dense",
    "protein_g": 28,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Porcupine",
    "category": "protein",
    "description": "Forest delicacy, lean protein, traditional medicine, cultural",
    "protein_g": 24,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Pangolin (Protected/Illegal)",
    "category": "protein",
    "description": "NOTE: Critically endangered, illegal trade, conservation priority, cultural history",
    "protein_g": 22,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Eggs",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, affordable protein, versatile",
    "protein_g": 6,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Tilapia",
    "category": "protein",
    "description": "Lean protein, affordable, farmed locally, mild flavor, widely available",
    "protein_g": 26,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Catfish (Siluriformes)",
    "category": "protein",
    "description": "River fish, affordable protein, traditional catch, sustainable aquaculture",
    "protein_g": 18,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Nile Perch (Sangala)",
    "category": "protein",
    "description": "Large lake fish, premium protein, Lake Tanganyika/Victoria, export quality",
    "protein_g": 25,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Bream (Tilapia relatives)",
    "category": "protein",
    "description": "White fish, mild flavor, river/lake catch, affordable, versatile",
    "protein_g": 18,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Smoked Fish (Various)",
    "category": "protein",
    "description": "Preservation method, traditional flavor, long shelf life, market staple, umami",
    "protein_g": 25,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Kapenta (Small Dried Fish)",
    "category": "protein",
    "description": "Most affordable zinc source, multiple micronutrients, budget protein, crunchy",
    "protein_g": 63,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Mackerel",
    "category": "protein",
    "description": "Heart health, brain function, anti-inflammatory, coastal trade, affordable",
    "protein_g": 19,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Sardines",
    "category": "protein",
    "description": "Bone health, heart health, anti-inflammatory, budget-friendly, imported",
    "protein_g": 25,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Snails (Escargots)",
    "category": "protein",
    "description": "Forest gathering, lean protein, traditional delicacy, mineral dense",
    "protein_g": 16,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Caterpillars (Mopane/Makongo)",
    "category": "protein",
    "description": "Traditional protein, seasonal harvest, nutrient dense, sustainable, crunchy",
    "protein_g": 55,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Termites",
    "category": "protein",
    "description": "Seasonal delicacy, traditional protein, nutrient dense, sustainable harvesting",
    "protein_g": 20,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Beef Liver",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse, affordable, traditional",
    "protein_g": 20,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Cowpeas (Niébé)",
    "category": "protein",
    "description": "Drought-resistant, sustainable protein, African staple, blood sugar control",
    "protein_g": 13,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Black-eyed Peas (Cowpeas variety)",
    "category": "protein",
    "description": "Digestive health, anemia prevention, traditional staple, New Year's tradition",
    "protein_g": 13,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Pigeon Peas (Cajanus cajan)",
    "category": "protein",
    "description": "Nitrogen-fixing crop, sustainable agriculture, protein, soil health",
    "protein_g": 11,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Bambara Groundnuts (Voandzou)",
    "category": "protein",
    "description": "Drought-resistant, sustainable protein source, complete amino acids, traditional",
    "protein_g": 18,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Groundnuts/Peanuts (Arachide)",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant, groundnut stew base",
    "protein_g": 7,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Soybeans",
    "category": "protein",
    "description": "Complete plant protein, bone health, hormone balance, modern crop",
    "protein_g": 29,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Lentils",
    "category": "protein",
    "description": "Heart health, blood sugar regulation, imported protein, energy",
    "protein_g": 18,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Beans (Kidney/Red)",
    "category": "protein",
    "description": "Heart health, blood sugar control, mineral dense, sustained energy, versatile",
    "protein_g": 15,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Pumpkin Seeds (Graines de Courge)",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune function, snack",
    "protein_g": 9,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Sesame Seeds",
    "category": "fat",
    "description": "Bone health, hormone production, mineral absorption, sauce thickener",
    "protein_g": 5,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Sunflower Seeds",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Melon Seeds (Egusi)",
    "category": "fat",
    "description": "Egusi soup base, nutrient dense, traditional thickener, sustainable",
    "protein_g": 11,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Baobab Seeds",
    "category": "protein",
    "description": "Baobab oil source, nutrient dense, traditional uses, sustainable",
    "protein_g": 6,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Cassava (Manioc)",
    "category": "protein",
    "description": "Primary energy source, gluten-free, gut health, fufu base, sustained fuel",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Plantains (Banane Plantain)",
    "category": "protein",
    "description": "Heart health, digestive regularity, workout fuel, versatile (ripe/unripe), staple",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Yams (Igname)",
    "category": "carb",
    "description": "Digestive health, sustained energy, African staple, mineral dense, pounded yam",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Sweet Potatoes (Patate Douce)",
    "category": "carb",
    "description": "Eye health, immune support, low GI, complex carbs, antioxidant, versatile",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Taro (Cocoyam)",
    "category": "carb",
    "description": "Stable energy, gut health, gluten-free, traditional African/Asian, easily digestible",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Millet (Petit Mil)",
    "category": "carb",
    "description": "Alkalizing, gluten-free, heart health, digestive health, porridge base, drought-resistant",
    "protein_g": 6,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Sorghum (Gros Mil)",
    "category": "carb",
    "description": "Gluten-free, antioxidant, sustained energy, drought-resistant, traditional beer (dolo)",
    "protein_g": 8,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Maize/Corn (Mais)",
    "category": "carb",
    "description": "Eye health, sustained energy, ugali/fufu base, versatile, affordable staple",
    "protein_g": 5,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Rice (Riz)",
    "category": "carb",
    "description": "Quick energy, versatile base, imported staple, jollof base, widely consumed",
    "protein_g": 4,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Fonio (Acha)",
    "category": "carb",
    "description": "Quick-cooking, gluten-free, African heritage grain, sustainable, nutritious",
    "protein_g": 8,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Teff",
    "category": "carb",
    "description": "Complete amino acids, gluten-free, bone health, tiny grain, injera base",
    "protein_g": 10,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Oats",
    "category": "carb",
    "description": "Cholesterol reduction, heart health, sustained energy, breakfast, imported",
    "protein_g": 6,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Wheat (Ble)",
    "category": "carb",
    "description": "Bread base, versatile, imported, energy, urban consumption",
    "protein_g": 8,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Cassava Leaves (Feuilles de Manioc)",
    "category": "vegetable",
    "description": "Protein-rich green, traditional African vegetable, nutrient dense, pondu/base leaf",
    "protein_g": 4,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Sweet Potato Leaves",
    "category": "carb",
    "description": "Nutrient dense, affordable green, traditional vegetable, easily grown",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Pumpkin Leaves (Feuilles de Courge)",
    "category": "vegetable",
    "description": "Iron-rich, nutrient dense, traditional cooking green, sustainable harvesting",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Amaranth Leaves (Lenga-Lenga/Biteku-Teku)",
    "category": "vegetable",
    "description": "Bone health, protein quality, anemia prevention, nutrient synergy, traditional",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Cowpea Leaves (Munawa/Muruwo)",
    "category": "vegetable",
    "description": "Anti-diabetic properties, anemia prevention, local superfood, traditional medicine",
    "protein_g": 4,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Jute Mallow (Ewedu/Molokhia)",
    "category": "vegetable",
    "description": "Digestive health, immune support, mucilaginous texture, traditional soup green",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Spinach (Epinard)",
    "category": "vegetable",
    "description": "Bone health, anemia prevention, nutrient dense, versatile green, performance",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Kale",
    "category": "vegetable",
    "description": "Anti-inflammatory, bone health, antioxidant, superfood, modern introduction",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Cabbage (Chou)",
    "category": "vegetable",
    "description": "Anti-inflammatory, gut health, affordable, cancer-fighting, fermentation potential",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Okra (Gombo)",
    "category": "vegetable",
    "description": "Blood sugar control, digestive health, folate for recovery, soluble fiber, thickener",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Eggplant (Aubergine)",
    "category": "vegetable",
    "description": "Cognitive health, heart health, blood sugar control, versatile, low calorie",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Tomatoes",
    "category": "vegetable",
    "description": "Heart health, prostate health, cancer prevention, skin health, sauce base",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Onions (Oignon)",
    "category": "vegetable",
    "description": "Anti-inflammatory, heart health, immune support, blood sugar, flavor base",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Garlic (Ail)",
    "category": "vegetable",
    "description": "Immune boosting, heart health, antimicrobial, anti-inflammatory, blood pressure",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Bell Peppers (Poivron)",
    "category": "vegetable",
    "description": "Immune support, eye health, antioxidant, low calorie, colorful",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Carrots (Carotte)",
    "category": "carb",
    "description": "Eye health, immune function, skin health, affordable, versatile",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Beets (Betterave)",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver detox, blood flow, endurance",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Wild Mushrooms (Various)",
    "category": "vegetable",
    "description": "Immune support, forest gathering, seasonal delicacy, umami flavor, traditional",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Bush Mango (Irvingia gabonensis)",
    "category": "vegetable",
    "description": "Dika bread base, weight management, traditional medicine, forest product",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "African Pear (Dacryodes edulis)",
    "category": "protein",
    "description": "Forest fruit, traditional food, healthy fats, seasonal delicacy, local market",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Cola Nuts",
    "category": "fruit",
    "description": "Traditional stimulant, cultural ceremonies, energy boost, digestive aid",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Bitter Kola (Garcinia kola)",
    "category": "fruit",
    "description": "Traditional medicine, antimicrobial, anti-inflammatory, cultural uses",
    "protein_g": 0,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Palm Nuts",
    "category": "fruit",
    "description": "Palm oil source, traditional soup base, vitamin A, forest sustainable",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Raphia Palm Grubs",
    "category": "protein",
    "description": "Traditional protein, seasonal delicacy, forest gathering, nutrient dense",
    "protein_g": 20,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Bananas (Plantain dessert variety)",
    "category": "fruit",
    "description": "Electrolyte balance, energy, digestion, affordable, quick energy",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Mangoes",
    "category": "fruit",
    "description": "Immune support, eye health, digestion, skin health, seasonal delight",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Papayas (Pawpaw)",
    "category": "fruit",
    "description": "Digestion, immune support, skin health, enzyme support, affordable",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Pineapples (Ananas)",
    "category": "fruit",
    "description": "Digestive enzyme, anti-inflammatory, immune support, manganese for bones",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Oranges (Pomme de Terre)",
    "category": "fruit",
    "description": "Immune function, heart health, hydration, imported/regional, citrus",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Guavas (Goyave)",
    "category": "fruit",
    "description": "Immune support, skin health, local affordability, antioxidant, fiber champion",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Avocados (Avocat)",
    "category": "fruit",
    "description": "Heart health, satiety, nutrient absorption, potassium for cramps, creamy",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Baobab Fruit (Pain de Singe)",
    "category": "fruit",
    "description": "Immune support, prebiotic fiber, hydration, antioxidant, gut health, African superfood",
    "protein_g": 2,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Tamarind (Tamarin)",
    "category": "fruit",
    "description": "Digestive health, laxative, tart flavor, traditional medicine, cooling",
    "protein_g": 3,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Watermelon (Pasteque)",
    "category": "fruit",
    "description": "Hydration, heart health, muscle recovery (citrulline), cooling, summer staple",
    "protein_g": 1,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Fresh Milk (Lait Frais)",
    "category": "fat",
    "description": "Bone health, muscle function, complete protein, limited urban availability",
    "protein_g": 8,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Fermented Milk (Lait Caillé)",
    "category": "fat",
    "description": "Gut health, lactose digestion, traditional preservation, immune support",
    "protein_g": 8,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Yogurt (Yaourt)",
    "category": "fat",
    "description": "Gut health, muscle repair, bone density, urban/imported, modern",
    "protein_g": 10,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Cheese (Fromage)",
    "category": "fat",
    "description": "Bone health, protein synthesis, satiety, imported luxury, preservation",
    "protein_g": 7,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Red Palm Oil (Huile de Palme Rouge)",
    "category": "fat",
    "description": "Antioxidant protection, traditional cooking fat, vitamin A source, cellular health, controversial sustainability",
    "protein_g": 0,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Coconut Oil (Huile de Coco)",
    "category": "fat",
    "description": "Quick energy, antimicrobial, metabolism support, coastal regions, modern trend",
    "protein_g": 0,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Groundnut Oil (Huile d'Arachide)",
    "category": "fat",
    "description": "Heart health, affordable cooking oil, traditional frying, stable at high heat",
    "protein_g": 0,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Shea Butter (Beurre de Karité)",
    "category": "fat",
    "description": "Skin health, traditional food use (rare), cosmetic primarily, sustainable forest product",
    "protein_g": 0,
    "available_regions": [
      "MAF"
    ]
  },
  {
    "name": "Lamb (Kuzu/Agneau)",
    "category": "protein",
    "description": "Protein synthesis, immune function, kebab staple, nutrient dense, Mediterranean favorite",
    "protein_g": 25,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Beef (Boeuf/Lahm)",
    "category": "protein",
    "description": "Muscle building, iron absorption, shawarma base, nutrient dense, energy",
    "protein_g": 26,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Goat Meat",
    "category": "protein",
    "description": "Lean protein, traditional Middle Eastern, sustainable, low cholesterol, curry base",
    "protein_g": 27,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Chicken (Pollo/Djej)",
    "category": "protein",
    "description": "Lean protein, versatile, shawarma favorite, widely available, affordable staple",
    "protein_g": 27,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Turkey (Hindi)",
    "category": "protein",
    "description": "Lean protein, mood support, sleep aid, doner kebab base, low fat",
    "protein_g": 29,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Duck (Canard/Bata)",
    "category": "protein",
    "description": "Flavorful protein, nutrient dense, French/Mediterranean tradition, rich taste",
    "protein_g": 19,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Goose (Oie/Oca)",
    "category": "protein",
    "description": "Rich flavor, holiday tradition, nutrient dense, foie gras source, European",
    "protein_g": 25,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Rabbit (Lapin/Arnab)",
    "category": "protein",
    "description": "Very lean protein, low cholesterol, Mediterranean game, affordable, sustainable",
    "protein_g": 33,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Quail (Caille/Suman)",
    "category": "protein",
    "description": "Lean game bird, delicacy, Mediterranean tradition, nutrient dense, small portion",
    "protein_g": 25,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Eggs (Bayd/Oeufs)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, shakshuka base, versatile staple",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Sea Bass (Loup de Mer)",
    "category": "protein",
    "description": "Premium white fish, lean protein, Mediterranean delicacy, heart health",
    "protein_g": 24,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Sea Bream (Dorade/Daurade)",
    "category": "protein",
    "description": "White fish, mild flavor, grilled favorite, lean protein, coastal staple",
    "protein_g": 21,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Sardines (Sardines/Sardin)",
    "category": "protein",
    "description": "Bone health, heart health, anti-inflammatory, budget-friendly, Mediterranean staple",
    "protein_g": 25,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Anchovies (Anchois/Hamsi)",
    "category": "protein",
    "description": "Heart health, bone health, pizza topping, umami, affordable, preserved",
    "protein_g": 20,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Mackerel (Maquereau/Uskumru)",
    "category": "protein",
    "description": "Heart health, brain function, anti-inflammatory, grilled, affordable",
    "protein_g": 19,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Tuna (Thon/Ton)",
    "category": "protein",
    "description": "Heart health, brain function, lean protein, anti-inflammatory, steak-like",
    "protein_g": 28,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Swordfish (Espadon/Kılıç)",
    "category": "protein",
    "description": "Grilling fish, meaty texture, premium seafood, mineral dense, Mediterranean",
    "protein_g": 20,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Octopus (Poulpe/Ahtapot)",
    "category": "protein",
    "description": "Very high protein, low fat, cognitive health, iron absorption, Greek tradition",
    "protein_g": 30,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Squid (Calamar/Kalamar)",
    "category": "protein",
    "description": "Lean protein, versatile, quick cooking, mineral dense, Mediterranean fried",
    "protein_g": 16,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Shrimp (Crevettes/Karides)",
    "category": "protein",
    "description": "Lean protein, thyroid health, antioxidant, coastal delicacy, brain health",
    "protein_g": 24,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Mussels (Moules/Midye)",
    "category": "protein",
    "description": "Brain health, iron absorption, sustainable seafood, affordable, moules-frites",
    "protein_g": 18,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Oysters (Huîtres/Istiridye)",
    "category": "protein",
    "description": "Immune function, testosterone support, zinc champion, aphrodisiac, luxury",
    "protein_g": 9,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Clams (Palourdes/Tridacna)",
    "category": "protein",
    "description": "Iron-rich, lean protein, sustainable, pasta companion, mineral dense",
    "protein_g": 13,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Calamari (Fried Squid)",
    "category": "protein",
    "description": "Lean protein, Mediterranean favorite, quick cooking, appetizer staple",
    "protein_g": 16,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Beef Liver (Foie de Boeuf)",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse, affordable, traditional",
    "protein_g": 20,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Lamb Liver",
    "category": "protein",
    "description": "Iron-rich, vitamin A, affordable offal, nutrient dense, breakfast dish",
    "protein_g": 21,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Sweetbreads (Ris d'Agneau)",
    "category": "protein",
    "description": "Delicacy, tender texture, nutrient dense, French tradition, thymus/pancreas",
    "protein_g": 18,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Bone Marrow (Moelle)",
    "category": "protein",
    "description": "Joint health, immune support, rich flavor, toast spread, traditional nutrition",
    "protein_g": 7,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Chickpeas (Hummus/Revithia)",
    "category": "protein",
    "description": "Heart health, diabetes prevention, hummus base, digestive wellness, satiety",
    "protein_g": 12,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Fava Beans (Ful/Fava)",
    "category": "protein",
    "description": "Plant protein, folate for cell repair, Egyptian breakfast, dopamine precursor",
    "protein_g": 13,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Lentils (Adas/Fakes)",
    "category": "protein",
    "description": "Blood sugar regulation, iron deficiency prevention, heart health, energy, soup base",
    "protein_g": 18,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Black Beans",
    "category": "protein",
    "description": "Blood sugar regulation, gut health, heart health, sustained energy, less common",
    "protein_g": 15,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Kidney Beans (Loubia/Fasolia)",
    "category": "protein",
    "description": "Heart health, blood sugar control, Greek/Middle Eastern, mineral dense, sustained",
    "protein_g": 15,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "White Beans (Cannellini/Navy)",
    "category": "protein",
    "description": "Creamy texture, digestive health, Italian/Mediterranean, mineral dense, soup",
    "protein_g": 15,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Peas (Matar/Bizelia)",
    "category": "protein",
    "description": "Fresh or dried, fiber, affordable protein, risotto companion, versatile",
    "protein_g": 8,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Soybeans",
    "category": "protein",
    "description": "Complete plant protein, bone health, hormone balance, modern/Lebanese",
    "protein_g": 29,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Peanuts",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant, snack staple",
    "protein_g": 7,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Almonds (Loz/Amandes)",
    "category": "fat",
    "description": "Heart health, skin health, bone health, satiety, antioxidant, dessert garnish",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Walnuts (Joz/Noix)",
    "category": "fat",
    "description": "Brain health, anti-inflammatory, heart health, sleep support, baklava filling",
    "protein_g": 4,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Pistachios (Fustuk/Antep Fıstığı)",
    "category": "fat",
    "description": "Eye health, blood sugar control, heart health, antioxidant, Turkish delight",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Cashews (Kaju/Kajou)",
    "category": "fat",
    "description": "Heart health, bone health, mineral dense, creamy texture, sauce base",
    "protein_g": 5,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Hazelnuts (Fındık/Noisettes)",
    "category": "fat",
    "description": "Heart health, brain function, antioxidant, Nutella base, Turkish/Italian",
    "protein_g": 4,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Pine Nuts (Çam Fıstığı/Snoubar)",
    "category": "fat",
    "description": "Heart health, energy, appetite suppression, pesto base, premium, Lebanese",
    "protein_g": 4,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Macadamia Nuts",
    "category": "protein",
    "description": "Heart health, brain function, healthy fats, cholesterol reduction, luxury",
    "protein_g": 2,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Sesame Seeds (Simsim/Susam)",
    "category": "fat",
    "description": "Bone health, hormone production, tahini base, mineral absorption, antioxidant",
    "protein_g": 5,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Sunflower Seeds (Ayçekirdeği)",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack, anti-inflammatory, Turkish snack",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Pumpkin Seeds (Kabak Çekirdeği)",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune function, snack",
    "protein_g": 9,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Chia Seeds",
    "category": "fat",
    "description": "Hydration, sustained energy, omega-3, fiber, satiety, modern addition",
    "protein_g": 5,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Flaxseeds (Keten Tohumu)",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance, digestive health",
    "protein_g": 5,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Hemp Seeds",
    "category": "fat",
    "description": "Complete amino acids, anti-inflammatory, mineral dense, modern superfood",
    "protein_g": 10,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Wheat (Buğday/Blé)",
    "category": "carb",
    "description": "Bread base, pasta source, versatile, energy, Mediterranean staple, pita",
    "protein_g": 8,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Bulgur (Bulgur/Boulgour)",
    "category": "carb",
    "description": "Quick-cooking whole grain, tabbouleh base, digestive health, mineral dense, Turkish",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Couscous (Kuskus)",
    "category": "carb",
    "description": "Quick-cooking, versatile base, selenium antioxidant, sustained energy, North African",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Freekeh (Frekeh/Firik)",
    "category": "carb",
    "description": "Young green wheat, smoky flavor, high fiber, sustained energy, Levantine",
    "protein_g": 8,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Barley (Arpa/Orge)",
    "category": "carb",
    "description": "Heart health, blood sugar control, digestive health, soup grain, ancient",
    "protein_g": 4,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Farro (Farro/Siyez)",
    "category": "carb",
    "description": "Ancient wheat, nutty flavor, sustained energy, mineral dense, Italian heritage",
    "protein_g": 8,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Spelt (Dinkel/Siyez)",
    "category": "carb",
    "description": "Ancient grain, mineral dense, sustained energy, nutty flavor, protein-rich",
    "protein_g": 11,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Oats (Yulaf/Avoine)",
    "category": "carb",
    "description": "Cholesterol reduction, heart health, sustained energy, breakfast, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Rye (Çavdar/Seigle)",
    "category": "carb",
    "description": "Blood sugar control, satiety, traditional bread, digestive health, Eastern European",
    "protein_g": 9,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Brown Rice (Pilav/Pilaf)",
    "category": "carb",
    "description": "Mineral dense, sustained energy, whole grain, pilaf base, versatile",
    "protein_g": 5,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Wild Rice",
    "category": "carb",
    "description": "Protein-rich rice, mineral dense, whole grain, premium, nutty flavor",
    "protein_g": 7,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Millet (Darı/Mil)",
    "category": "carb",
    "description": "Alkalizing, gluten-free, heart health, digestive health, bird food/human",
    "protein_g": 6,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Quinoa",
    "category": "carb",
    "description": "Complete amino acids, gluten-free, sustained energy, modern addition, versatile",
    "protein_g": 8,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Amaranth (Amarant)",
    "category": "carb",
    "description": "Complete protein, bone health, gluten-free, ancient grain, cholesterol reduction",
    "protein_g": 9,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Teff",
    "category": "carb",
    "description": "Complete amino acids, gluten-free, bone health, tiny grain, injera base",
    "protein_g": 10,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Eggplant (Patlıcan/Betingan)",
    "category": "vegetable",
    "description": "Cognitive health, heart health, baba ganoush base, blood sugar control, versatile",
    "protein_g": 1,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Zucchini (Kabak/Kousa)",
    "category": "vegetable",
    "description": "Low calorie, versatile, digestive health, hydration, stuffed (mahshi), noodle substitute",
    "protein_g": 2,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Okra (Bamya/Bamia)",
    "category": "vegetable",
    "description": "Blood sugar control, digestive health, folate for recovery, soluble fiber, traditional",
    "protein_g": 2,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Tomatoes (Domates/Tomatim)",
    "category": "vegetable",
    "description": "Heart health, prostate health, cancer prevention, shakshuka base, skin health",
    "protein_g": 2,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Bell Peppers (Biber/Filfil)",
    "category": "vegetable",
    "description": "Immune support, eye health, antioxidant, low calorie, colorful, stuffed",
    "protein_g": 1,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Onions (Soğan/Bassal)",
    "category": "vegetable",
    "description": "Anti-inflammatory, heart health, immune support, blood sugar, flavor base",
    "protein_g": 1,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Garlic (Sarımsak/Thom)",
    "category": "vegetable",
    "description": "Immune boosting, heart health, antimicrobial, anti-inflammatory, blood pressure",
    "protein_g": 2,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Spinach (Ispanak/Sabanekh)",
    "category": "vegetable",
    "description": "Bone health, anemia prevention, nutrient dense, versatile green, performance",
    "protein_g": 3,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Swiss Chard (Pazı/Silq)",
    "category": "vegetable",
    "description": "Bone health, blood pressure, antioxidant, colorful, mineral dense, sautéed",
    "protein_g": 3,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Kale (Lahana/Kale)",
    "category": "vegetable",
    "description": "Anti-inflammatory, bone health, antioxidant, superfood, modern addition",
    "protein_g": 3,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Cabbage (Lahana/Malfoof)",
    "category": "vegetable",
    "description": "Anti-inflammatory, gut health, affordable, cancer-fighting, stuffed (mahshi)",
    "protein_g": 1,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Cauliflower (Karnabahar/Arnabeet)",
    "category": "vegetable",
    "description": "Low calorie, versatile, anti-inflammatory, brain health, rice substitute",
    "protein_g": 2,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Carrots (Havuç/Jazar)",
    "category": "carb",
    "description": "Eye health, immune function, skin health, affordable, versatile",
    "protein_g": 1,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Beets (Pancar/Shamandar)",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver detox, blood flow, endurance",
    "protein_g": 2,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Artichokes (Enginar/Ardi Shawki)",
    "category": "vegetable",
    "description": "Liver health, digestive health, cholesterol reduction, prebiotic fiber, Mediterranean",
    "protein_g": 4,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Olive Oil (Zeytinyağı/Zeit)",
    "category": "fat",
    "description": "Heart health, anti-inflammatory, cognitive protection, longevity, Mediterranean pillar",
    "protein_g": 0,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Tahini (Tahin)",
    "category": "fat",
    "description": "Bone health, hormone production, hummus base, mineral absorption, creamy",
    "protein_g": 5,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Yogurt (Yoğurt/Laban)",
    "category": "protein",
    "description": "Gut health, muscle repair, bone density, immune support, tzatziki base",
    "protein_g": 10,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Feta Cheese",
    "category": "protein",
    "description": "Bone health, gut health (traditional), salad topping, Greek tradition, tangy",
    "protein_g": 4,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Halloumi",
    "category": "protein",
    "description": "Grilling cheese, high melting point, Cypriot tradition, protein, salty",
    "protein_g": 7,
    "available_regions": [
      "EME"
    ]
  },
  {
    "name": "Pork (Zhu Rou/Buta)",
    "category": "protein",
    "description": "Energy metabolism, thyroid function, Chinese/Japanese staple, versatile cuts",
    "protein_g": 26,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Beef (Niu Rou/Gyu)",
    "category": "protein",
    "description": "Muscle building, iron absorption, Korean BBQ, nutrient dense, energy",
    "protein_g": 26,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Chicken (Ji Rou/Tori)",
    "category": "protein",
    "description": "Lean protein, versatile, widely available, affordable staple, Hainanese chicken",
    "protein_g": 27,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Duck (Ya Rou/Kamo)",
    "category": "protein",
    "description": "Flavorful protein, Peking duck tradition, nutrient dense, rich taste, Chinese",
    "protein_g": 19,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Goose (E/ Gachō)",
    "category": "protein",
    "description": "Rich flavor, holiday tradition, nutrient dense, Cantonese roast, European",
    "protein_g": 25,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Lamb (Yang Rou/Hitsuji)",
    "category": "protein",
    "description": "Protein synthesis, immune function, Mongolian hot pot, warming, nutrient dense",
    "protein_g": 25,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Goat Meat",
    "category": "protein",
    "description": "Lean protein, Indian subcontinent favorite, sustainable, low cholesterol, curry base",
    "protein_g": 27,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Turkey (Huo Ji/Shichimenchō)",
    "category": "protein",
    "description": "Lean protein, mood support, sleep aid, low fat, Western adoption",
    "protein_g": 29,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Eggs (Dan/Tamago)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, thousand-year egg, versatile",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Century Egg (Pidan)",
    "category": "protein",
    "description": "Preserved delicacy, acquired taste, protein, traditional Chinese, umami",
    "protein_g": 9,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Fish (Yu/Sakana) - General",
    "category": "protein",
    "description": "Heart health, brain function, lean protein, daily staple, variety",
    "protein_g": 20,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Salmon (Sake/Shake)",
    "category": "protein",
    "description": "Anti-inflammatory, heart health, brain function, sushi staple, premium",
    "protein_g": 25,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Tuna (Maguro/Shiyu)",
    "category": "protein",
    "description": "Heart health, brain function, lean protein, sashimi king, anti-inflammatory",
    "protein_g": 28,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Mackerel (Saba/Saba)",
    "category": "protein",
    "description": "Heart health, brain function, anti-inflammatory, grilled favorite, affordable",
    "protein_g": 19,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Sardines (Iwashi)",
    "category": "protein",
    "description": "Bone health, heart health, anti-inflammatory, budget-friendly, canned staple",
    "protein_g": 25,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Eel (Unagi/Anago)",
    "category": "protein",
    "description": "Summer stamina, vitamin A powerhouse, Japanese delicacy, grilled, energy",
    "protein_g": 19,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Sea Bream (Tai)",
    "category": "protein",
    "description": "White fish, celebration fish, mild flavor, lean protein, Japanese premium",
    "protein_g": 21,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Yellowtail (Hamachi/Buri)",
    "category": "protein",
    "description": "Rich flavor, sashimi favorite, name changes with age, Japanese, fatty",
    "protein_g": 23,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Squid (Ika/Yu You)",
    "category": "protein",
    "description": "Lean protein, versatile, quick cooking, mineral dense, taurine source",
    "protein_g": 16,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Octopus (Tako/Zhang Yu)",
    "category": "protein",
    "description": "Very high protein, low fat, cognitive health, iron absorption, takoyaki",
    "protein_g": 30,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Shrimp (Xia/Ebi)",
    "category": "protein",
    "description": "Lean protein, thyroid health, antioxidant, tempura favorite, brain health",
    "protein_g": 24,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Crab (Xie/Kani)",
    "category": "protein",
    "description": "Lean protein, mineral dense, delicacy, cholesterol (dietary), umami",
    "protein_g": 19,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Lobster (Long Xia/Ise Ebi)",
    "category": "protein",
    "description": "Lean protein, luxury, mineral dense, special occasion, sweet meat",
    "protein_g": 19,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Scallops (Shan Bei/Hotate)",
    "category": "protein",
    "description": "Lean protein, mineral dense, sweet flavor, quick cooking, premium",
    "protein_g": 20,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Clams (Ge Li/Asari)",
    "category": "protein",
    "description": "Iron-rich, lean protein, sustainable, miso soup companion, mineral dense",
    "protein_g": 13,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Oysters (Mu Li/Kaki)",
    "category": "protein",
    "description": "Immune function, testosterone support, zinc champion, aphrodisiac, luxury",
    "protein_g": 9,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Mussels (Dan Cai/Mussel)",
    "category": "protein",
    "description": "Brain health, iron absorption, sustainable seafood, affordable, curry base",
    "protein_g": 18,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Sea Cucumber (Hai Shen/Namako)",
    "category": "protein",
    "description": "Joint health, traditional Chinese medicine, collagen, luxury, texture",
    "protein_g": 13,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Jellyfish (Hai Zhe/Kurage)",
    "category": "protein",
    "description": "Low calorie, collagen, crunchy texture, salad ingredient, acquired taste",
    "protein_g": 5,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Beef Liver (Niu Gan/Reba)",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse, affordable, traditional",
    "protein_g": 20,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Chicken Liver (Ji Gan)",
    "category": "protein",
    "description": "Iron-rich, vitamin A, affordable offal, nutrient dense, yakitori favorite",
    "protein_g": 17,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Pork Belly (Wu Hua Rou/Butabara)",
    "category": "protein",
    "description": "Flavorful, umami, braised dishes, collagen, energy dense, comfort food",
    "protein_g": 9,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Tofu (Dou Fu/Tofu)",
    "category": "protein",
    "description": "Complete plant protein, bone health, hormone balance, versatile, cholesterol-free",
    "protein_g": 8,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Tempeh",
    "category": "protein",
    "description": "Complete protein, gut health, mineral dense, Indonesian, nutty flavor, fermented",
    "protein_g": 19,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Edamame (Mao Dou)",
    "category": "protein",
    "description": "Complete protein, snackable, heart health, bone density, menopause support",
    "protein_g": 11,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Soy Milk (Dou Jiang/Tonyu)",
    "category": "protein",
    "description": "Dairy alternative, bone health, hormone balance, lactose-free, breakfast",
    "protein_g": 3,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Miso (Wei Zeng/Miso)",
    "category": "protein",
    "description": "Gut health, umami flavor, immune support, digestive aid, soup base, longevity",
    "protein_g": 11,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Natto (Natto)",
    "category": "protein",
    "description": "Cardiovascular health, bone density, gut flora, blood clot prevention, acquired",
    "protein_g": 18,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Seitan (Wheat Gluten/Mian Jin)",
    "category": "protein",
    "description": "High protein, meat substitute, Buddhist vegetarian, chewy texture, gluten",
    "protein_g": 25,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Chickpeas (Ying Zui Dou/Hiyoko Mame)",
    "category": "protein",
    "description": "Satiety, blood sugar control, versatile protein, digestive health, hummus",
    "protein_g": 12,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Lentils (Bing Dou)",
    "category": "protein",
    "description": "Heart health, blood sugar regulation, budget protein, energy, Indian dal",
    "protein_g": 18,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Mung Beans (Lu Dou/Ryokutō)",
    "category": "protein",
    "description": "Cooling (TCM), digestive health, sprouting (bean sprouts), detox, affordable",
    "protein_g": 14,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Adzuki Beans (Hong Dou/Azuki)",
    "category": "protein",
    "description": "Heart health, weight management, Japanese dessert (anko), mineral dense, sweet",
    "protein_g": 17,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Black Beans (Hei Dou/Kuro Mame)",
    "category": "protein",
    "description": "Blood sugar regulation, gut health, heart health, sustained energy, Korean",
    "protein_g": 15,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Peanuts (Hua Sheng/Rakkasei)",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant, kung pao chicken",
    "protein_g": 7,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Almonds (Xing Ren/Amondo)",
    "category": "fat",
    "description": "Heart health, skin health, bone health, satiety, antioxidant, dessert",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Walnuts (Hu Tao/Kurumi)",
    "category": "fat",
    "description": "Brain health (shape), anti-inflammatory, heart health, sleep support, TCM",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Cashews (Yao Guo/Kajū)",
    "category": "fat",
    "description": "Heart health, bone health, mineral dense, creamy texture, stir-fry",
    "protein_g": 5,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Pistachios (Kai Xin Guo/Pisutachio)",
    "category": "fat",
    "description": "Eye health, blood sugar control, heart health, antioxidant, dessert garnish",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Ginkgo Nuts (Bai Guo/Ginnan)",
    "category": "fat",
    "description": "Cognitive health (traditional), antioxidant, Chinese medicine, acquired taste, toxic raw",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Lotus Seeds (Lian Zi/Hasu no Mi)",
    "category": "fat",
    "description": "Calming (TCM), protein, dessert ingredient, mineral dense, Buddhist food",
    "protein_g": 5,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Pumpkin Seeds (Nan Gua Zi/Kabotya no Tane)",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune function, snack",
    "protein_g": 9,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Sesame Seeds (Zhi Ma/Goma)",
    "category": "fat",
    "description": "Bone health, hormone production, tahini base, mineral absorption, antioxidant",
    "protein_g": 5,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Sunflower Seeds (Kui Hua Zi/Himawari no Tane)",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Chia Seeds",
    "category": "fat",
    "description": "Hydration, sustained energy, omega-3, fiber, satiety, modern addition",
    "protein_g": 5,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Flaxseeds (Ya Ma Zi/Ama ni)",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance, digestive health",
    "protein_g": 5,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "White Rice (Bai Mi/Gohan)",
    "category": "carb",
    "description": "Quick energy, versatile base, Asian staple, sushi base, easily digestible",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Brown Rice (Cao Mi/Genmai)",
    "category": "carb",
    "description": "Mineral dense, sustained energy, whole grain, fiber-rich, healthier choice",
    "protein_g": 5,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Jasmine Rice (Xiang Mi/Thai Hom Mali)",
    "category": "carb",
    "description": "Aromatic, Thai staple, quick energy, fragrant, versatile",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Basmati Rice (Basmati)",
    "category": "carb",
    "description": "Low glycemic index, Indian/Pakistani staple, aromatic, biryani base, sustained",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Sticky Rice (Nuo Mi/Mochigome)",
    "category": "carb",
    "description": "Binding texture, mochi base, mango sticky rice, dessert, gluten-free",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Wild Rice (Ye Sheng Dao/Canadian)",
    "category": "carb",
    "description": "Protein-rich rice, mineral dense, whole grain, premium, nutty flavor",
    "protein_g": 7,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Oats (Yan Mai/Otomeal)",
    "category": "carb",
    "description": "Cholesterol reduction, heart health, sustained energy, breakfast, anti-inflammatory",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Barley (Da Mai/Oomugi)",
    "category": "carb",
    "description": "Heart health, blood sugar control, digestive health, soup grain, tea (mugicha)",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Millet (Xiao Mi/Awa)",
    "category": "carb",
    "description": "Alkalizing, gluten-free, heart health, digestive health, bird food/human",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Buckwheat (Qiao Mai/Soba)",
    "category": "fat",
    "description": "Blood vessel health, gluten-free, soba noodles, heart health, complete protein",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Quinoa",
    "category": "fat",
    "description": "Complete amino acids, gluten-free, sustained energy, modern addition, versatile",
    "protein_g": 8,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Wheat Noodles (Mian/Mein)",
    "category": "fat",
    "description": "Ramen/udon base, versatile, energy, Asian staple, comfort food",
    "protein_g": 8,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Rice Noodles (Mi Fen/Kome Men)",
    "category": "carb",
    "description": "Gluten-free, pho base, pad thai, light, easily digestible, versatile",
    "protein_g": 2,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Soba Noodles (Soba)",
    "category": "carb",
    "description": "Blood vessel health, gluten-free (100%), Japanese tradition, hot/cold, mineral dense",
    "protein_g": 8,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Bok Choy (Bai Cai/Chingensai)",
    "category": "vegetable",
    "description": "Bone health, immune function, low calorie, cruciferous benefits, stir-fry staple",
    "protein_g": 2,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Napa Cabbage (Da Bai Cai/Hakusai)",
    "category": "vegetable",
    "description": "Kimchi base, digestive health, low calorie, vitamin C, versatile, Korean",
    "protein_g": 2,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Chinese Broccoli (Gai Lan)",
    "category": "vegetable",
    "description": "Bone health, immune support, Cantonese favorite, slightly bitter, nutrient dense",
    "protein_g": 3,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Spinach (Bo Cai/Horenso)",
    "category": "vegetable",
    "description": "Bone health, anemia prevention, nutrient dense, ohitashi (Japanese), versatile",
    "protein_g": 3,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Kale (Yu Zhou Sheng Gai/Kēru)",
    "category": "vegetable",
    "description": "Anti-inflammatory, bone health, antioxidant, superfood, Western adoption",
    "protein_g": 3,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Seaweed - Nori",
    "category": "vegetable",
    "description": "Thyroid function, bone health, umami, sushi wrap, mineral dense, B12 source",
    "protein_g": 6,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Seaweed - Wakame",
    "category": "vegetable",
    "description": "Thyroid function, bone density, miso soup, weight management (fucoxanthin), mineral",
    "protein_g": 3,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Seaweed - Kombu",
    "category": "vegetable",
    "description": "Dashi base, umami, thyroid health, mineral rich, immune support (fucoidan)",
    "protein_g": 2,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Bamboo Shoots (Zhu Sun/Takenoko)",
    "category": "vegetable",
    "description": "Low calorie, fiber, spring delicacy, crunchy texture, toxin removal (boiling required)",
    "protein_g": 3,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Lotus Root (Ou Ren/Renkon)",
    "category": "vegetable",
    "description": "Immune support, digestive health, crunchy texture, beautiful pattern, stir-fry",
    "protein_g": 3,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Daikon Radish (Bai Luo Bo/Daikon)",
    "category": "carb",
    "description": "Digestive aid, detoxification, low calorie, pickled (takuan), versatile, cooling",
    "protein_g": 1,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Shiitake Mushrooms (Xiang Gu/Shiitake)",
    "category": "vegetable",
    "description": "Immune support (lentinan), heart health, anti-inflammatory, umami, medicinal",
    "protein_g": 2,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Enoki Mushrooms (Jin Zhen Gu/Enokitake)",
    "category": "vegetable",
    "description": "Immune support, low calorie, crunchy texture, hot pot favorite, delicate",
    "protein_g": 2,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Shiitake - Dried (Dong Gu)",
    "category": "vegetable",
    "description": "Intense flavor, immune support, umami bomb, soup base, concentrated nutrients",
    "protein_g": 4,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Persimmons (Shi/Kaki)",
    "category": "fruit",
    "description": "Eye health, immune support, autumn delicacy, sweet when ripe, astringent unripe",
    "protein_g": 1,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Yuzu",
    "category": "fruit",
    "description": "Immune support, aromatic, bath (yuzu-yu), ponzu sauce, winter solstice",
    "protein_g": 0,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Lychee (Li Zhi/Litchi)",
    "category": "fruit",
    "description": "Immune support, antioxidant, tropical delight, sweet, summer fruit",
    "protein_g": 1,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Longan (Long Yan/Ryūgan)",
    "category": "fruit",
    "description": "Immune support, calming (TCM), similar to lychee, sweet, dried snack",
    "protein_g": 1,
    "available_regions": [
      "AS"
    ]
  },
  {
    "name": "Tuna (Ahi/Maguro)",
    "category": "protein",
    "description": "Heart health, brain function, lean protein, sashimi grade, sustainable pole-caught",
    "protein_g": 28,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Mahi-Mahi (Dorado/Dolphin Fish)",
    "category": "protein",
    "description": "Lean protein, mild flavor, grilling favorite, low mercury, tropical staple",
    "protein_g": 20,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Wahoo (Ono)",
    "category": "protein",
    "description": "Very lean, firm texture, Hawaiian favorite, fast-swimming, mild flavor",
    "protein_g": 23,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Yellowfin Tuna (Ahi)",
    "category": "protein",
    "description": "Poke bowl staple, heart health, protein dense, raw or seared, premium",
    "protein_g": 25,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Skipjack Taku (Bonito)",
    "category": "protein",
    "description": "Katsuobushi (dried flakes), dashi base, sustainable, smaller tuna species",
    "protein_g": 22,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Swordfish (Makajiki)",
    "category": "protein",
    "description": "Grilling fish, meaty texture, steak-like, mineral dense, deep sea",
    "protein_g": 20,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Marlin (Kajiki)",
    "category": "protein",
    "description": "Sport fishing trophy, lean protein, billfish family, firm texture",
    "protein_g": 23,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Sailfish (A'u)",
    "category": "protein",
    "description": "Sport fish, lean protein, fast swimmer, billfish, mild flavor",
    "protein_g": 22,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Grouper (Hapu'u/Hapu)",
    "category": "protein",
    "description": "Reef fish, mild flavor, firm texture, Hawaiian favorite, sustainable",
    "protein_g": 21,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Snapper (Onaga/Ula'ula)",
    "category": "protein",
    "description": "Red snapper variety, delicate flavor, celebration fish, reef dweller",
    "protein_g": 22,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Parrotfish (Uhu)",
    "category": "protein",
    "description": "Coral reef fish, traditional food, conservation concerns, unique flavor",
    "protein_g": 20,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Goatfish (Weke/Moano)",
    "category": "protein",
    "description": "Bottom feeder, sweet flavor, traditional Hawaiian, barbels for sensing",
    "protein_g": 19,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Mackerel Scad (Akule/Bigeye Scad)",
    "category": "protein",
    "description": "Schooling fish, bait fish, affordable protein, local staple, sustainable",
    "protein_g": 20,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Flying Fish (Tobiuo/Mālolo)",
    "category": "protein",
    "description": "Glides above water, traditional catch, Barbados national dish, unique",
    "protein_g": 18,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Octopus (He'e/Tako)",
    "category": "protein",
    "description": "Very high protein, low fat, traditional Hawaiian, poke ingredient, chewy",
    "protein_g": 25,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Squid (Mu/Tako relatives)",
    "category": "protein",
    "description": "Lean protein, quick cooking, calamari style, mineral dense, versatile",
    "protein_g": 15,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Lobster (Ula/Ise Ebi)",
    "category": "protein",
    "description": "Spiny lobster (no claws), luxury, mineral dense, special occasion, sweet",
    "protein_g": 19,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Crab (Papa'i/Kani)",
    "category": "protein",
    "description": "Lean protein, mineral dense, coconut crab (land), traditional, sweet meat",
    "protein_g": 17,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Shrimp (Opae/Ebi)",
    "category": "protein",
    "description": "Lean protein, thyroid health, antioxidant, freshwater/saltwater, versatile",
    "protein_g": 20,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Sea Cucumber (Loli/Namako)",
    "category": "protein",
    "description": "Joint health, traditional medicine, collagen, texture, Asian export market",
    "protein_g": 13,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Pork (Pua'a/Buta)",
    "category": "protein",
    "description": "Energy metabolism, luau staple, imu (underground oven), celebration food",
    "protein_g": 22,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Spam",
    "category": "protein",
    "description": "WWII legacy, Hawaiian favorite (spam musubi), convenient, controversial",
    "protein_g": 7,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Chicken (Moa/Tori)",
    "category": "protein",
    "description": "Lean protein, versatile, widely available, huli huli chicken, affordable",
    "protein_g": 26,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Eggs (Hua/Moa Tama)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, island fresh, versatile",
    "protein_g": 6,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Corned Beef (Pipi Kaula style)",
    "category": "protein",
    "description": "Preserved tradition, canned staple, Hawaiian breakfast, salty, convenient",
    "protein_g": 15,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Taro (Kalo/Satoimo)",
    "category": "protein",
    "description": "Sacred Hawaiian crop, stable energy, gut health, poi base, gluten-free, sustained",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Breadfruit (Ulu/Uru)",
    "category": "protein",
    "description": "Sustained energy, gluten-free, versatile (ripe/unripe), canoe plant, filling",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Sweet Potato (Uala/Satsumaimo)",
    "category": "carb",
    "description": "Eye health, immune support, low GI, purple varieties (antioxidants), staple",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Cassava (Manioc/Tapioka)",
    "category": "carb",
    "description": "Primary energy source, gluten-free, gut health, tapioca pearls, sustained",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Yams (Uhi/Yams)",
    "category": "carb",
    "description": "True yams (not sweet potatoes), sustained energy, mineral dense, tropical",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Plantains (Mei/Maia)",
    "category": "carb",
    "description": "Heart health, digestive regularity, workout fuel, less sweet than banana, staple",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Coconut (Niu/Cocos)",
    "category": "carb",
    "description": "Metabolism, immune support, satiety, quick ketone production, versatile uses",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Coconut Water (Wai Niu)",
    "category": "carb",
    "description": "Hydration, exercise recovery, natural electrolyte replacement, low calorie",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Coconut Milk (Ka Wai Ulu)",
    "category": "carb",
    "description": "Curries, satiety, mineral absorption, traditional cooking fat, creamy",
    "protein_g": 5,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Coconut Oil (Kona)",
    "category": "fat",
    "description": "Quick energy, antimicrobial, metabolism support, skin/hair care, stable cooking",
    "protein_g": 0,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Peanuts (Pī/Nuts)",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant, snack",
    "protein_g": 7,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Macadamia Nuts (Makademia)",
    "category": "fat",
    "description": "Heart health, brain function, healthy fats, cholesterol reduction, native",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Breadnut (Maya/Ulu seeds)",
    "category": "fat",
    "description": "Breadfruit relative, edible seeds, roasted like nuts, traditional protein",
    "protein_g": 7,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Pigeon Peas (Cajanus cajan)",
    "category": "protein",
    "description": "Nitrogen-fixing, sustainable agriculture, protein, Caribbean/Pacific influence",
    "protein_g": 11,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Lentils (imported)",
    "category": "protein",
    "description": "Heart health, blood sugar regulation, imported protein, energy, curry",
    "protein_g": 18,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Poi (Fermented Taro)",
    "category": "protein",
    "description": "Gut health, digestive aid, Hawaiian staple, prebiotic, sacred food, sour",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Rice (Laiki/Raisu)",
    "category": "protein",
    "description": "Quick energy, versatile base, imported staple, sushi, easily digestible",
    "protein_g": 4,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Sweet Rice (Mochigome)",
    "category": "protein",
    "description": "Binding texture, mochi, desserts, sticky, glutinous (no gluten), Japanese",
    "protein_g": 4,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Oats (imported)",
    "category": "protein",
    "description": "Cholesterol reduction, heart health, sustained energy, breakfast, imported",
    "protein_g": 6,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Quinoa (imported)",
    "category": "protein",
    "description": "Complete amino acids, gluten-free, sustained energy, modern health trend",
    "protein_g": 8,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Sago (Sagu)",
    "category": "protein",
    "description": "Sago palm starch, puddings, Papua New Guinea staple, gluten-free, energy",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Arrowroot (Maranta)",
    "category": "protein",
    "description": "Easy digestion, thickener, gluten-free, baby food, gentle on stomach",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Taro Leaves (Lū'au/Lū)",
    "category": "vegetable",
    "description": "Must be cooked (oxalates), traditional Hawaiian, mineral dense, laulau wrap",
    "protein_g": 4,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Breadfruit Leaves",
    "category": "vegetable",
    "description": "Traditional medicine, tea, anti-inflammatory, diabetes management (folk)",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Sweet Potato Leaves (Kamote Tops)",
    "category": "carb",
    "description": "Nutrient dense, affordable green, Filipino influence, sautéed, traditional",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Pumpkin Leaves (Lū)",
    "category": "vegetable",
    "description": "Iron-rich, nutrient dense, traditional cooking green, similar to taro leaves",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Watercress (Watakras)",
    "category": "vegetable",
    "description": "Peppery flavor, stream grown, mineral dense, salads, traditional gathering",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Bele (Abelmoschus manihot)",
    "category": "vegetable",
    "description": "Pacific native, slippery texture when cooked, nutritious, resilient crop",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Kangkong (Water Spinach)",
    "category": "vegetable",
    "description": "Aquatic vegetable, fast growing, Southeast Asian influence, stir-fry, mineral dense",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Ferns (Warabi/Bracken)",
    "category": "vegetable",
    "description": "Fiddlehead ferns, Japanese influence, seasonal delicacy, must be cooked",
    "protein_g": 4,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Bamboo Shoots (Takenoko)",
    "category": "vegetable",
    "description": "Low calorie, fiber, crunchy texture, toxin removal (boiling required), Asian",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Seaweed (Limmu/Limu)",
    "category": "vegetable",
    "description": "Thyroid health, bone density, mineral-rich, low calorie, Hawaiian traditional",
    "protein_g": 5,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Ogo (Gracilaria)",
    "category": "vegetable",
    "description": "Poke garnish, crunchy texture, mineral dense, traditional Hawaiian, agar production",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Sea Asparagus (Pickleweed)",
    "category": "vegetable",
    "description": "Salty vegetable, coastal marsh, gourmet, minerals, unique texture",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Papaya (Mīkana/Laikō)",
    "category": "vegetable",
    "description": "Digestion, immune support, skin health, meat tenderizer, breakfast fruit",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Pineapple (Hala Kahiki)",
    "category": "vegetable",
    "description": "Digestive enzyme, anti-inflammatory, immune support, manganese for bones, export",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Banana (Mai'a/Banana)",
    "category": "vegetable",
    "description": "Electrolyte balance, energy, digestion, affordable, versatile, multiple varieties",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Mango (Manako)",
    "category": "vegetable",
    "description": "Immune support, eye health, digestion, skin health, tropical delight, sweet",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Guava (Kuawa)",
    "category": "vegetable",
    "description": "Immune support, skin health, local affordability, antioxidant, fiber champion",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Passion Fruit (Liliko'i)",
    "category": "vegetable",
    "description": "Digestive health, immune support, anxiety reduction, sleep aid, fiber champion",
    "protein_g": 5,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Star Fruit (Balimbing)",
    "category": "vegetable",
    "description": "Low calorie, unique shape, kidney stone caution (oxalates), decorative, tart",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Dragon Fruit (Pitaya)",
    "category": "vegetable",
    "description": "Immune support, digestive health, antioxidant, exotic appearance, mild flavor",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Rambutan (imported)",
    "category": "vegetable",
    "description": "Immune support, blood cell production, hairy lychee relative, Southeast Asian",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Longan (imported)",
    "category": "vegetable",
    "description": "Immune support, calming (TCM), similar to lychee, sweet, dried snack",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Lychee (imported)",
    "category": "vegetable",
    "description": "Immune support, antioxidant, tropical delight, sweet, summer fruit",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Soursop (Guanabana)",
    "category": "vegetable",
    "description": "Immune support, digestive health, creamy texture, traditional medicine, controversial cancer claims",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Noni (Indian Mulberry)",
    "category": "vegetable",
    "description": "Traditional medicine, pungent smell, immune support, juice, Polynesian",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Breadfruit (Ulu) - repeated for emphasis",
    "category": "vegetable",
    "description": "Sustained energy, gluten-free, versatile (ripe/unripe), canoe plant, filling",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Coconut Cream (Kakano)",
    "category": "carb",
    "description": "Richer than milk, desserts, satiety, mineral absorption, traditional cooking",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Fresh Milk (imported)",
    "category": "fat",
    "description": "Bone health, muscle function, imported luxury, limited availability, Western",
    "protein_g": 8,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Powdered Milk (imported)",
    "category": "fat",
    "description": "Shelf-stable, imported, bone health, convenient, long storage",
    "protein_g": 8,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Poi (repeated for emphasis)",
    "category": "fat",
    "description": "Gut health, digestive aid, Hawaiian staple, prebiotic, sacred food, sour",
    "protein_g": 1,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Kava (Awa/Yaqona)",
    "category": "carb",
    "description": "Anxiety reduction, muscle relaxation, social ceremony, no alcohol, traditional",
    "protein_g": 0,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Hawaiian Salt (Alaea/Red Salt)",
    "category": "fat",
    "description": "Iron content, ceremonial use, flavor enhancement, preservation, less processed",
    "protein_g": 0,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Limu Kohu (Asparagopsis taxiformis)",
    "category": "vegetable",
    "description": "Strong flavor, traditional Hawaiian, coastal gathering, mineral dense, acquired taste",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Inamona (Kukui Nut Relish)",
    "category": "fat",
    "description": "Kukui/candlenut preparation, poke seasoning, traditional Hawaiian, rich flavor",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Haupia (Coconut Pudding)",
    "category": "fat",
    "description": "Traditional dessert, coconut celebration, easy to digest, energy, luaus",
    "protein_g": 2,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Kulolo (Taro Coconut Pudding)",
    "category": "fat",
    "description": "Traditional Hawaiian dessert, taro celebration, sustained energy, cultural",
    "protein_g": 3,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Laulau (Taro Leaf Wrapped Pork)",
    "category": "fat",
    "description": "Traditional preparation, luau staple, imu cooked, mineral dense, celebration",
    "protein_g": 15,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Kalua Pig (Imu Pork)",
    "category": "fat",
    "description": "Underground oven (imu), smoky flavor, luau centerpiece, tender, traditional",
    "protein_g": 22,
    "available_regions": [
      "PAC"
    ]
  },
  {
    "name": "Horse Meat (Kazy/Beshbarmak)",
    "category": "protein",
    "description": "Lean protein, nomadic staple, lower cholesterol than beef, iron-rich, traditional",
    "protein_g": 28,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Beef (Syir/Govadina)",
    "category": "protein",
    "description": "Muscle building, iron absorption, pilaf ingredient, nutrient dense, energy",
    "protein_g": 26,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Lamb (Koy/Gosht)",
    "category": "protein",
    "description": "Protein synthesis, immune function, shashlik favorite, warming, nutrient dense",
    "protein_g": 25,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Goat Meat (Echki/Teki)",
    "category": "protein",
    "description": "Lean protein, affordable, sustainable, low cholesterol, traditional, hardy animal",
    "protein_g": 27,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Camel Meat (Tuye/Vert)",
    "category": "protein",
    "description": "Desert staple, lean protein, traditional, diabetes-friendly, desert ship",
    "protein_g": 22,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Chicken (Tawuk/Tovuk)",
    "category": "protein",
    "description": "Lean protein, versatile, widely available, affordable, modern addition",
    "protein_g": 27,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Eggs (Jumurtka/Tuxum)",
    "category": "protein",
    "description": "Complete amino acids, brain health, eye health, lagman topping, versatile",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Horse Sausage (Kazy/Kazy)",
    "category": "protein",
    "description": "Preserved horse meat, traditional delicacy, shelf-stable, celebration food, fatty",
    "protein_g": 25,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Horse Fat (Zhaya/Salo)",
    "category": "protein",
    "description": "Energy dense, cold climate fuel, traditional preservation, winter survival, calories",
    "protein_g": 0,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Fish (Balik/Riba)",
    "category": "fat",
    "description": "Lake/river fish, limited availability, lean protein, Caspian/Aral Sea, imported",
    "protein_g": 20,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Carp (Sazan/Sazan)",
    "category": "fat",
    "description": "Lake fish, affordable protein, traditional catch, sustainable, mild flavor",
    "protein_g": 18,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Trout (Forel/Forel)",
    "category": "fat",
    "description": "Mountain streams, sport fishing, lean protein, local delicacy, pink flesh",
    "protein_g": 20,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Pike (Shchuka/Schuka)",
    "category": "fat",
    "description": "Predatory fish, lean protein, traditional catch, bony but tasty, affordable",
    "protein_g": 19,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Bream (Leshtch/Leshch)",
    "category": "fat",
    "description": "White fish, mild flavor, versatile cooking, lean protein, lake dweller",
    "protein_g": 18,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Beef Liver (Jiger/Pechen)",
    "category": "protein",
    "description": "Nutrient density, anemia prevention, vitamin A powerhouse, affordable, traditional",
    "protein_g": 20,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Lamb Liver",
    "category": "protein",
    "description": "Iron-rich, vitamin A, affordable offal, nutrient dense, breakfast dish",
    "protein_g": 21,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Sheep's Head (Khash/Kash)",
    "category": "protein",
    "description": "Traditional delicacy, nose-to-tail eating, collagen rich, celebration, male domain",
    "protein_g": 18,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Cow's Feet (Khash)",
    "category": "protein",
    "description": "Joint health, skin elasticity, traditional soup (khash), overnight cooking, winter",
    "protein_g": 19,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Sheep's Feet (Khash)",
    "category": "protein",
    "description": "Joint health, traditional soup, gelatin rich, overnight cooking, warming",
    "protein_g": 20,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Horse Milk (Kumis/Kymyz)",
    "category": "fat",
    "description": "Fermented mare's milk, probiotics, lactose-digestible, nomadic tradition, sparkling",
    "protein_g": 3,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Chickpeas (Nohut/Nut)",
    "category": "protein",
    "description": "Satiety, blood sugar control, versatile protein, pilaf addition, digestive health",
    "protein_g": 12,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Lentils (Mercimek/Mash)",
    "category": "protein",
    "description": "Heart health, blood sugar regulation, imported protein, soup, energy",
    "protein_g": 18,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Mung Beans (Mash/Mung)",
    "category": "protein",
    "description": "Cooling, digestive health, sprouting, imported, Asian influence, versatile",
    "protein_g": 14,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Red Beans (Lobiya/Fasol)",
    "category": "protein",
    "description": "Heart health, blood sugar control, mineral dense, sustained energy, soup",
    "protein_g": 15,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Peas (Noxat/Goroshek)",
    "category": "protein",
    "description": "Fresh or dried, fiber, affordable protein, sustained energy, versatile",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Peanuts (Yeryongjo/Arachis)",
    "category": "protein",
    "description": "Heart health, satiety, affordable protein, antioxidant, snack, imported",
    "protein_g": 7,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Walnuts (Yongak/Greekh)",
    "category": "fat",
    "description": "Brain health, anti-inflammatory, heart health, local harvest, sleep support",
    "protein_g": 4,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Almonds (Badam/Mindal)",
    "category": "fat",
    "description": "Heart health, skin health, bone health, satiety, antioxidant, pilaf garnish",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Pistachios (Pista/Fistashka)",
    "category": "fat",
    "description": "Eye health, blood sugar control, heart health, antioxidant, dessert garnish",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Hazelnuts (Funduk/Funduk)",
    "category": "fat",
    "description": "Heart health, brain function, antioxidant, local, rich flavor, energy",
    "protein_g": 4,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Sunflower Seeds (Kunjut Podsolnechnik)",
    "category": "fat",
    "description": "Antioxidant protection, thyroid health, affordable snack, anti-inflammatory, local",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Pumpkin Seeds (Kabaq Tykvennye)",
    "category": "fat",
    "description": "Prostate health, sleep quality, muscle recovery, immune function, snack",
    "protein_g": 9,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Sesame Seeds (Kunjut/Kunzhut)",
    "category": "fat",
    "description": "Bone health, hormone production, halva base, mineral absorption, antioxidant",
    "protein_g": 5,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Flaxseeds (Keten/Len)",
    "category": "fat",
    "description": "Omega-3 conversion, anti-inflammatory, hormone balance, digestive health, local",
    "protein_g": 5,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Hemp Seeds (Konoplya)",
    "category": "fat",
    "description": "Complete amino acids, anti-inflammatory, mineral dense, modern cultivation",
    "protein_g": 10,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Wheat (Bugday/Pshenitsa)",
    "category": "carb",
    "description": "Bread base, noodle source, versatile, energy, Central Asian staple, naan",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Wheat Berries (Bugday/Pshenitsa tselaya)",
    "category": "carb",
    "description": "Whole grain, sustained energy, mineral dense, traditional, porridge, chewy",
    "protein_g": 9,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Semolina (Dzhardy/Manka)",
    "category": "fat",
    "description": "Pasta base, halva, sustained energy, versatile, affordable, porridge",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Noodles (Lapsha/Kesme)",
    "category": "protein",
    "description": "Lagman base, hand-pulled, energy, comfort food, versatile, filling",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Lagman Noodles (Lagman/Laghman)",
    "category": "carb",
    "description": "Uyghur tradition, hand-stretched, chewy texture, soup base, labor intensive",
    "protein_g": 9,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Rice (Guruch/Ris)",
    "category": "protein",
    "description": "Quick energy, versatile base, pilaf essential, imported, easily digestible",
    "protein_g": 4,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Rice (Local Varieties)",
    "category": "protein",
    "description": "Fergana Valley famous, plov essential, aromatic, local pride, mineral dense",
    "protein_g": 4,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Barley (Arpa/Yachmen)",
    "category": "protein",
    "description": "Heart health, blood sugar control, digestive health, soup grain, ancient",
    "protein_g": 4,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Millet (Dyro/Dyra)",
    "category": "protein",
    "description": "Alkalizing, gluten-free, heart health, digestive health, porridge, bird food",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Oats (Suli/Oves)",
    "category": "protein",
    "description": "Cholesterol reduction, heart health, sustained energy, breakfast, imported",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Buckwheat (Grechka/Grechikha)",
    "category": "protein",
    "description": "Blood vessel health, gluten-free, Russian influence, porridge, complete protein",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Corn (Mekkej/Mais)",
    "category": "protein",
    "description": "Eye health, sustained energy, polenta style, local, versatile, gluten-free",
    "protein_g": 5,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Quinoa (imported)",
    "category": "protein",
    "description": "Complete amino acids, gluten-free, sustained energy, modern health trend",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Onions (Piyoz/Luk)",
    "category": "vegetable",
    "description": "Anti-inflammatory, heart health, immune support, blood sugar, pilaf base, essential",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Garlic (Sarimsak/Chesnok)",
    "category": "vegetable",
    "description": "Immune boosting, heart health, antimicrobial, anti-inflammatory, blood pressure",
    "protein_g": 2,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Carrots (Sabzi/Morkov)",
    "category": "carb",
    "description": "Eye health, immune function, skin health, pilaf color, affordable, local",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Beets (Chukandar/Svekla)",
    "category": "carb",
    "description": "Exercise performance, blood pressure, liver detox, blood flow, borscht influence",
    "protein_g": 2,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Cabbage (Karam/Kapusta)",
    "category": "vegetable",
    "description": "Anti-inflammatory, gut health, affordable, cancer-fighting, fermentation, Russian",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Potatoes (Kartoshka/Kartofel)",
    "category": "carb",
    "description": "Satiety, energy, versatile base, potassium for cramps, affordable, Russian influence",
    "protein_g": 4,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Tomatoes (Pomidor/Pomidor)",
    "category": "vegetable",
    "description": "Heart health, prostate health, cancer prevention, lagman ingredient, skin health",
    "protein_g": 2,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Bell Peppers (Bolgar/Bolgarskiy)",
    "category": "vegetable",
    "description": "Immune support, eye health, antioxidant, low calorie, colorful, lagman",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Eggplant (Baigan/Baklazhan)",
    "category": "vegetable",
    "description": "Cognitive health, heart health, blood sugar control, versatile, summer vegetable",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Zucchini (Kabaq/Kabachok)",
    "category": "vegetable",
    "description": "Low calorie, versatile, digestive health, hydration, summer abundance, manti filling",
    "protein_g": 2,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Spinach (Sabzi/Spinat)",
    "category": "vegetable",
    "description": "Bone health, anemia prevention, nutrient dense, versatile green, performance",
    "protein_g": 3,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Cilantro (Gashnis/Kinza)",
    "category": "vegetable",
    "description": "Detoxification, digestive aid, essential garnish, love-it-or-hate-it, antioxidant",
    "protein_g": 0,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Dill (Shibit/Ukrop)",
    "category": "vegetable",
    "description": "Digestive aid, traditional flavoring, antimicrobial, calcium absorption, Russian",
    "protein_g": 0,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Parsley (Maydanoz/Petrushka)",
    "category": "vegetable",
    "description": "Bone health, immune support, detoxification, heavy metal chelation, garnish",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Mint (Yalpiz/Myata)",
    "category": "vegetable",
    "description": "Digestive aid, refreshing, tea, breath freshener, calming, traditional",
    "protein_g": 0,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Radishes (Turp/Redis)",
    "category": "carb",
    "description": "Digestive aid, detoxification, low calorie, spicy flavor, quick growing, salad",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Turnips (Shalgam/Repa)",
    "category": "carb",
    "description": "Low calorie, digestive health, affordable root, greens edible, winter storage",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Celery (Kereviz/Selderey)",
    "category": "vegetable",
    "description": "Low calorie, digestive health, hydration, blood pressure, crunchy snack, imported",
    "protein_g": 1,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Cow's Milk (Sut/Moloko)",
    "category": "vegetable",
    "description": "Bone health, muscle function, complete protein, nomadic staple, fresh/fermented",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Sheep's Milk (Koy Suti/Ovche)",
    "category": "vegetable",
    "description": "Richer than cow, cheese making, nomadic tradition, mineral dense, fatty",
    "protein_g": 9,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Goat's Milk (Echki Suti/Kozhe)",
    "category": "vegetable",
    "description": "Easier digestion, smaller fat globules, traditional, mineral dense, less allergenic",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Mare's Milk (Kumis/Kymyz base)",
    "category": "vegetable",
    "description": "Kumis base, nomadic tradition, lower fat, fermentation substrate, unique",
    "protein_g": 2,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Yogurt (Chakki/Yogurt)",
    "category": "vegetable",
    "description": "Gut health, muscle repair, bone density, immune support, drinkable (suzma)",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Kefir (imported/local)",
    "category": "vegetable",
    "description": "Gut health, immune function, lactose digestion, bone health, modern trend",
    "protein_g": 9,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Cheese (Sir/Syr)",
    "category": "vegetable",
    "description": "Bone health, protein synthesis, satiety, preservation, local varieties (brined)",
    "protein_g": 7,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Qurt (Kashk/Kurut)",
    "category": "vegetable",
    "description": "Portable, shelf-stable, nomadic travel food, sour, mineral dense, traditional",
    "protein_g": 15,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Kaymak (Clotted Cream)",
    "category": "vegetable",
    "description": "Rich topping, dessert, high calorie, traditional breakfast, indulgent",
    "protein_g": 3,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Plov (Palov/Osh)",
    "category": "carb",
    "description": "Celebration dish, balanced meal, energy, social bonding, Uzbek national dish",
    "protein_g": 15,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Lagman (Hand-Pulled Noodle Soup)",
    "category": "protein",
    "description": "Uyghur tradition, warming, complete meal, labor of love, comforting",
    "protein_g": 12,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Manti (Steamed Dumplings)",
    "category": "protein",
    "description": "Turkish/Central Asian, communal preparation, steamed (healthier), filling",
    "protein_g": 10,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Shashlik (Skewered Meat)",
    "category": "protein",
    "description": "Social grilling, outdoor tradition, lean grilling, celebration, protein dense",
    "protein_g": 25,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Beshbarmak (Boiled Meat with Noodles)",
    "category": "protein",
    "description": "Kazakh national dish, \"five fingers\" (eat with hands), celebration, protein rich",
    "protein_g": 30,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Kuurdak (Stir-Fried Meat)",
    "category": "protein",
    "description": "Quick preparation, everyday meal, energy, warming, filling, traditional",
    "protein_g": 22,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Samsa (Baked Dumplings)",
    "category": "protein",
    "description": "Street food, portable, baked (not fried), tandoor cooked, savory",
    "protein_g": 8,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Naan (Tandyr Nan)",
    "category": "protein",
    "description": "Daily bread, tandoor baked, communal, utensil for scooping, cultural essential",
    "protein_g": 6,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Lepyoshka (Round Bread)",
    "category": "carb",
    "description": "Daily bread, round shape (sun), decorative, shared, cultural symbol",
    "protein_g": 5,
    "available_regions": [
      "CAS"
    ]
  },
  {
    "name": "Halva (Sweet Confection)",
    "category": "carb",
    "description": "Energy dense, celebration, sesame nutrition, sweet treat, traditional",
    "protein_g": 4,
    "available_regions": [
      "CAS"
    ]
  }
];
