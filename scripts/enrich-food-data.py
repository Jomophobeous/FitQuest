#!/usr/bin/env python3
"""
Food Data Enrichment Script — Phase 11

Adds realistic calories_per_serving, carbs_g, fat_g, and fiber_g
to all 861 items in assets/food-data.json.

Values are sourced from USDA FoodData Central reference ranges.
Each food is matched by name/category to the closest USDA equivalent.

Serving size: 100g (standard USDA reference) unless noted.
"""

import json
import re
import sys
from pathlib import Path

FOOD_FILE = Path(__file__).parent.parent / "assets" / "food-data.json"

# ──────────────────────────────────────────────
# USDA REFERENCE DATABASE (per 100g)
# Format: name_pattern → (calories, protein_g, carbs_g, fat_g, fiber_g)
# ──────────────────────────────────────────────

USDA_LOOKUP = {
    # ── PROTEINS (meats, fish, eggs, legumes) ──
    "chicken": (165, 31, 0, 3.6, 0),
    "turkey": (135, 30, 0, 1.0, 0),
    "beef": (250, 26, 0, 15, 0),
    "lamb": (258, 25, 0, 17, 0),
    "pork": (242, 27, 0, 14, 0),
    "goat": (143, 27, 0, 3.0, 0),
    "venison": (158, 30, 0, 3.2, 0),
    "kangaroo": (98, 23, 0, 1.0, 0),
    "emu": (110, 23, 0, 2.0, 0),
    "crocodile": (104, 24, 0, 1.0, 0),
    "ostrich": (115, 22, 0, 2.5, 0),
    "bison": (143, 28, 0, 2.4, 0),
    "rabbit": (173, 33, 0, 3.5, 0),
    "duck": (201, 24, 0, 11, 0),
    "quail": (234, 25, 0, 14, 0),
    "salmon": (208, 20, 0, 13, 0),
    "tuna": (130, 29, 0, 1.0, 0),
    "cod": (82, 18, 0, 0.7, 0),
    "tilapia": (96, 20, 0, 1.7, 0),
    "catfish": (119, 18, 0, 5.0, 0),
    "sardine": (208, 25, 0, 11, 0),
    "mackerel": (205, 19, 0, 14, 0),
    "herring": (203, 23, 0, 12, 0),
    "trout": (148, 21, 0, 6.6, 0),
    "bass": (97, 18, 0, 2.0, 0),
    "perch": (91, 19, 0, 0.9, 0),
    "carp": (127, 18, 0, 5.6, 0),
    "haddock": (90, 20, 0, 0.5, 0),
    "snapper": (100, 21, 0, 1.3, 0),
    "grouper": (92, 19, 0, 1.0, 0),
    "swordfish": (144, 24, 0, 4.7, 0),
    "anchov": (131, 20, 0, 4.8, 0),
    "shrimp": (85, 20, 0, 0.5, 0),
    "prawn": (85, 20, 0, 0.5, 0),
    "crab": (97, 19, 0, 1.5, 0),
    "lobster": (89, 19, 0, 0.5, 0),
    "mussel": (86, 12, 4, 2.2, 0),
    "oyster": (68, 7, 4, 2.5, 0),
    "clam": (74, 13, 3, 1.0, 0),
    "octopus": (82, 15, 2, 1.0, 0),
    "squid": (92, 16, 3, 1.4, 0),
    "calamari": (92, 16, 3, 1.4, 0),
    "barramundi": (110, 23, 0, 2.0, 0),
    "flathead": (90, 20, 0, 1.0, 0),
    "bream": (95, 20, 0, 1.5, 0),
    "kingfish": (146, 21, 0, 6.5, 0),
    "crayfish": (77, 16, 0, 0.9, 0),
    "marlin": (110, 24, 0, 1.5, 0),
    "wahoo": (110, 22, 0, 1.5, 0),
    "mahi": (85, 19, 0, 0.7, 0),
    "egg": (143, 13, 1.1, 9.5, 0),
    "tofu": (76, 8, 1.9, 4.8, 0.3),
    "tempeh": (192, 19, 7.6, 11, 0),
    "edamame": (122, 11, 10, 5.2, 5.2),
    "lentil": (116, 9, 20, 0.4, 7.9),
    "chickpea": (164, 9, 27, 2.6, 7.6),
    "bean": (127, 9, 23, 0.5, 6.4),
    "pea": (81, 5, 14, 0.4, 5.7),
    "soy": (173, 17, 10, 9, 6),
    "seitan": (370, 75, 14, 1.9, 0.6),
    "paneer": (265, 18, 4, 20, 0),
    "cottage cheese": (98, 11, 3.4, 4.3, 0),
    "yogurt": (59, 10, 3.6, 0.7, 0),
    "milk": (42, 3.4, 5, 1.0, 0),
    "cheese": (402, 25, 1.3, 33, 0),
    "whey": (352, 80, 8, 1.1, 0),
    "cricket": (121, 13, 5, 5.5, 0),
    "mealworm": (206, 19, 5, 13, 0),
    "grasshopper": (153, 21, 3, 6, 0),
    "locust": (179, 20, 4, 8, 0),
    "snail": (90, 16, 2, 1.4, 0),
    "guinea pig": (96, 19, 0, 1.6, 0),
    "alpaca": (120, 24, 0, 2, 0),
    "llama": (120, 24, 0, 2, 0),
    "yak": (130, 22, 0, 4.5, 0),
    "horse": (133, 21, 0, 5, 0),
    "camel": (120, 20, 0, 4, 0),
    "whale": (156, 22, 0, 7, 0),
    "seal": (150, 26, 0, 5, 0),
    "reindeer": (154, 30, 0, 3.2, 0),
    "wild boar": (160, 28, 0, 4.5, 0),
    "pheasant": (133, 24, 0, 3.6, 0),
    "pigeon": (142, 18, 0, 8, 0),
    "frog": (73, 16, 0, 0.3, 0),
    "alligator": (143, 29, 0, 2.6, 0),
    "turtle": (89, 20, 0, 0.5, 0),
    "fish": (105, 22, 0, 1.5, 0),

    # ── CARBS (grains, tubers, breads) ──
    "rice": (130, 2.7, 28, 0.3, 0.4),
    "brown rice": (112, 2.3, 24, 0.8, 1.8),
    "oat": (379, 13, 68, 6.5, 10),
    "wheat": (339, 14, 71, 2.5, 12),
    "quinoa": (120, 4.4, 21, 1.9, 2.8),
    "millet": (119, 3.5, 23, 1.0, 1.3),
    "sorghum": (329, 11, 72, 3.3, 6.3),
    "corn": (365, 9, 74, 4.7, 7.3),
    "maize": (365, 9, 74, 4.7, 7.3),
    "barley": (354, 12, 73, 2.3, 17),
    "rye": (338, 10, 76, 1.6, 15),
    "buckwheat": (343, 13, 72, 3.4, 10),
    "teff": (367, 13, 73, 2.4, 8),
    "fonio": (360, 10, 75, 1.8, 3.5),
    "amaranth": (371, 14, 65, 7, 6.7),
    "spelt": (338, 15, 70, 2.4, 11),
    "potato": (77, 2, 17, 0.1, 2.2),
    "sweet potato": (86, 1.6, 20, 0.1, 3),
    "yam": (118, 1.5, 28, 0.2, 4.1),
    "cassava": (160, 1.4, 38, 0.3, 1.8),
    "taro": (112, 1.5, 27, 0.2, 4.1),
    "plantain": (122, 1.3, 32, 0.4, 2.3),
    "breadfruit": (103, 1.1, 27, 0.2, 4.9),
    "pasta": (131, 5, 25, 1.1, 1.8),
    "noodle": (138, 4.5, 25, 2.1, 0.9),
    "bread": (265, 9, 49, 3.2, 2.7),
    "couscous": (112, 3.8, 23, 0.2, 1.4),
    "polenta": (85, 2, 18, 0.5, 1),
    "fufu": (267, 0.5, 66, 0.1, 1),
    "injera": (138, 3.9, 28, 0.7, 2.3),
    "naan": (290, 9, 50, 5, 2),
    "roti": (300, 9, 50, 7, 3),
    "chapati": (297, 10, 50, 7, 4),
    "pita": (275, 9, 55, 1.2, 2.2),
    "tortilla": (237, 6, 40, 6, 2),
    "ugali": (130, 2.5, 28, 0.5, 1),
    "pap": (130, 2.5, 28, 0.5, 1),
    "poha": (130, 2.5, 27, 0.5, 1.5),
    "paratha": (326, 7, 40, 16, 2),
    "dosa": (115, 4, 18, 3, 1.5),
    "idli": (60, 2.2, 12, 0.2, 0.8),
    "dumpling": (220, 5, 30, 8, 1),
    "wonton": (210, 6, 28, 8, 1),
    "bao": (252, 7, 46, 3, 1.5),
    "mantou": (258, 8, 50, 2, 1.5),
    "arepa": (207, 4, 35, 6, 3),
    "empanada": (300, 8, 30, 17, 2),
    "pierogi": (195, 7, 28, 6, 1.5),

    # ── FATS (nuts, seeds, oils, dairy fat) ──
    "almond": (579, 21, 22, 50, 12),
    "walnut": (654, 15, 14, 65, 6.7),
    "cashew": (553, 18, 30, 44, 3.3),
    "pistachio": (560, 20, 28, 45, 10),
    "pecan": (691, 9, 14, 72, 9.6),
    "macadamia": (718, 8, 14, 76, 8.6),
    "hazelnut": (628, 15, 17, 61, 9.7),
    "brazil nut": (659, 14, 12, 67, 7.5),
    "peanut": (567, 26, 16, 49, 8.5),
    "pine nut": (673, 14, 13, 68, 3.7),
    "sunflower seed": (584, 21, 20, 51, 8.6),
    "pumpkin seed": (559, 30, 11, 49, 6),
    "chia seed": (486, 17, 42, 31, 34),
    "flaxseed": (534, 18, 29, 42, 27),
    "hemp seed": (553, 32, 9, 49, 4),
    "sesame": (573, 18, 23, 50, 12),
    "coconut": (354, 3.3, 15, 33, 9),
    "avocado": (160, 2, 9, 15, 7),
    "olive": (115, 0.8, 6, 11, 3.2),
    "butter": (717, 0.9, 0.1, 81, 0),
    "ghee": (900, 0, 0, 100, 0),
    "cream": (340, 2, 3, 36, 0),
    "cream cheese": (342, 6, 4, 34, 0),
    "tahini": (595, 17, 21, 54, 9.3),
    "hummus": (166, 8, 14, 10, 6),
    "pesto": (378, 5, 4, 38, 2),
    "mayo": (680, 1, 0.6, 75, 0),
    "lard": (902, 0, 0, 100, 0),
    "tallow": (902, 0, 0, 100, 0),
    "suet": (854, 2, 0, 94, 0),

    # ── VEGETABLES ──
    "spinach": (23, 2.9, 3.6, 0.4, 2.2),
    "kale": (35, 2.9, 4.4, 1.5, 4.1),
    "broccoli": (34, 2.8, 7, 0.4, 2.6),
    "cauliflower": (25, 1.9, 5, 0.3, 2),
    "cabbage": (25, 1.3, 6, 0.1, 2.5),
    "carrot": (41, 0.9, 10, 0.2, 2.8),
    "tomato": (18, 0.9, 3.9, 0.2, 1.2),
    "onion": (40, 1.1, 9, 0.1, 1.7),
    "garlic": (149, 6.4, 33, 0.5, 2.1),
    "pepper": (31, 1, 6, 0.3, 2.1),
    "zucchini": (17, 1.2, 3.1, 0.3, 1),
    "squash": (26, 1, 7, 0.1, 1.5),
    "eggplant": (25, 1, 6, 0.2, 3),
    "cucumber": (15, 0.7, 3.6, 0.1, 0.5),
    "lettuce": (15, 1.4, 2.9, 0.2, 1.3),
    "celery": (14, 0.7, 3, 0.2, 1.6),
    "beet": (43, 1.6, 10, 0.2, 2.8),
    "radish": (16, 0.7, 3.4, 0.1, 1.6),
    "turnip": (28, 0.9, 6, 0.1, 1.8),
    "parsnip": (75, 1.2, 18, 0.3, 4.9),
    "asparagus": (20, 2.2, 3.9, 0.1, 2.1),
    "artichoke": (47, 3.3, 11, 0.2, 5.4),
    "pumpkin": (26, 1, 7, 0.1, 0.5),
    "okra": (33, 1.9, 7, 0.2, 3.2),
    "leek": (61, 1.5, 14, 0.3, 1.8),
    "fennel": (31, 1.2, 7, 0.2, 3.1),
    "moringa": (64, 9, 8, 1.4, 2),
    "seaweed": (45, 1.7, 10, 0.6, 0.5),
    "kelp": (43, 1.7, 10, 0.6, 1.3),
    "watercress": (11, 2.3, 1.3, 0.1, 0.5),
    "arugula": (25, 2.6, 3.7, 0.7, 1.6),
    "chard": (19, 1.8, 3.7, 0.2, 1.6),
    "collard": (32, 3, 6, 0.6, 4),
    "mustard green": (27, 2.9, 4.7, 0.4, 3.2),
    "bok choy": (13, 1.5, 2.2, 0.2, 1),
    "amaranth leaf": (23, 2.5, 4, 0.3, 2),
    "morogo": (20, 3, 3, 0.3, 2),
    "spider flower": (22, 3, 3.5, 0.3, 2),
    "black jack": (25, 2, 4, 0.3, 2),
    "purslane": (20, 2, 3.4, 0.4, 0),
    "nettle": (42, 2.7, 7, 0.1, 6.9),
    "bamboo shoot": (27, 2.6, 5.2, 0.3, 2.2),
    "lotus root": (74, 2.6, 17, 0.1, 4.9),
    "daikon": (18, 0.6, 4.1, 0.1, 1.6),
    "bitter melon": (17, 1, 3.7, 0.2, 2.8),
    "chayote": (19, 0.8, 4.5, 0.1, 1.7),
    "jicama": (38, 0.7, 9, 0.1, 4.9),
    "nopal": (16, 1.3, 3.3, 0.1, 2.2),
    "yuca": (160, 1.4, 38, 0.3, 1.8),
    "cactus": (16, 1.3, 3.3, 0.1, 2.2),
    "cassava leaf": (91, 7, 15, 0.4, 5),

    # ── FRUITS ──
    "apple": (52, 0.3, 14, 0.2, 2.4),
    "banana": (89, 1.1, 23, 0.3, 2.6),
    "orange": (47, 0.9, 12, 0.1, 2.4),
    "mango": (60, 0.8, 15, 0.4, 1.6),
    "pineapple": (50, 0.5, 13, 0.1, 1.4),
    "papaya": (43, 0.5, 11, 0.3, 1.7),
    "grape": (67, 0.6, 17, 0.4, 0.9),
    "watermelon": (30, 0.6, 8, 0.2, 0.4),
    "melon": (34, 0.8, 8, 0.2, 0.9),
    "strawberry": (32, 0.7, 8, 0.3, 2),
    "blueberry": (57, 0.7, 14, 0.3, 2.4),
    "raspberry": (52, 1.2, 12, 0.7, 6.5),
    "blackberry": (43, 1.4, 10, 0.5, 5.3),
    "cherry": (63, 1.1, 16, 0.2, 2.1),
    "peach": (39, 0.9, 10, 0.3, 1.5),
    "plum": (46, 0.7, 11, 0.3, 1.4),
    "pear": (57, 0.4, 15, 0.1, 3.1),
    "fig": (74, 0.8, 19, 0.3, 2.9),
    "date": (277, 1.8, 75, 0.2, 6.7),
    "pomegranate": (83, 1.7, 19, 1.2, 4),
    "kiwi": (61, 1.1, 15, 0.5, 3),
    "passion fruit": (97, 2.2, 23, 0.7, 10),
    "dragonfruit": (50, 1.1, 11, 0.4, 3),
    "pitaya": (50, 1.1, 11, 0.4, 3),
    "lychee": (66, 0.8, 17, 0.4, 1.3),
    "longan": (60, 1.3, 15, 0.1, 1.1),
    "rambutan": (68, 0.7, 16, 0.2, 0.9),
    "durian": (147, 1.5, 27, 5.3, 3.8),
    "jackfruit": (95, 1.7, 23, 0.6, 1.5),
    "guava": (68, 2.6, 14, 1, 5.4),
    "soursop": (66, 1, 17, 0.3, 3.3),
    "starfruit": (31, 1, 7, 0.3, 2.8),
    "persimmon": (70, 0.6, 19, 0.2, 3.6),
    "tamarind": (239, 2.8, 63, 0.6, 5.1),
    "baobab": (240, 2.3, 52, 0.4, 44),
    "acai": (70, 2, 4, 5, 3.3),
    "goji berry": (349, 14, 77, 0.4, 13),
    "mulberry": (43, 1.4, 10, 0.4, 1.7),
    "feijoa": (55, 1.0, 13, 0.6, 6.4),
    "kakadu plum": (110, 1, 20, 0.2, 5),
    "quandong": (73, 2, 15, 0.5, 6),
    "bush tomato": (56, 3, 10, 0.4, 6),
    "finger lime": (30, 1, 7, 0.3, 3),
    "muntries": (35, 1, 8, 0.3, 3),
    "breadnut": (217, 8, 34, 6, 4),
    "camu camu": (17, 0.4, 5, 0.1, 1),
    "cupuacu": (72, 1.3, 13, 2, 3),
    "açaí": (70, 2, 4, 5, 3.3),
    "coconut water": (19, 0.7, 3.7, 0.2, 1.1),
    "lemon": (29, 1.1, 9, 0.3, 2.8),
    "lime": (30, 0.7, 11, 0.2, 2.8),
    "grapefruit": (42, 0.8, 11, 0.1, 1.6),
    "tangerine": (53, 0.8, 13, 0.3, 1.8),
    "clementine": (47, 0.9, 12, 0.2, 1.7),
    "cranberry": (46, 0.5, 12, 0.1, 4.6),
    "gooseberry": (44, 0.9, 10, 0.6, 4.3),
    "boysenberry": (43, 1, 10, 0.3, 5),
    "elderberry": (73, 0.7, 18, 0.5, 7),
    "sea buckthorn": (82, 1, 6, 7, 4),
    "rosehip": (162, 1.6, 38, 0.3, 24),
    "marula": (55, 1, 12, 0.5, 2),
    "davids": (55, 1, 12, 0.5, 2),
    "sapodilla": (83, 0.4, 20, 1.1, 5.3),
    "rambai": (47, 0.6, 11, 0.2, 1),
    "mangosteen": (73, 0.4, 18, 0.6, 1.8),
    "salak": (82, 0.4, 22, 0.1, 1),
}

# ── CATEGORY DEFAULTS (per 100g) for items that don't match any name ──
CATEGORY_DEFAULTS = {
    "protein":   (160, 22, 2, 5, 0.5),   # generic lean protein
    "carb":      (180, 4, 36, 1.5, 3),    # generic starch/grain
    "fat":       (580, 15, 18, 50, 6),    # generic nuts/seeds
    "vegetable": (30, 2, 5, 0.3, 2.5),   # generic vegetable
    "fruit":     (55, 1, 13, 0.3, 2.5),  # generic fruit
    "snack":     (250, 5, 30, 12, 2),     # generic snack
    "meal":      (180, 12, 20, 6, 3),     # generic mixed meal
}


def find_best_match(name: str, category: str):
    """
    Match food item name against USDA lookup. Returns (cal, prot, carbs, fat, fiber).
    Uses longest-match-first to prefer specific matches ("sweet potato" > "potato").
    """
    name_lower = name.lower()

    # Sort lookup keys by length descending so longer (more specific) matches win
    sorted_keys = sorted(USDA_LOOKUP.keys(), key=len, reverse=True)

    for key in sorted_keys:
        if key in name_lower:
            return USDA_LOOKUP[key]

    return CATEGORY_DEFAULTS.get(category, CATEGORY_DEFAULTS["protein"])


def enrich():
    if not FOOD_FILE.exists():
        print(f"ERROR: {FOOD_FILE} not found", file=sys.stderr)
        sys.exit(1)

    with open(FOOD_FILE, "r") as f:
        data = json.load(f)

    print(f"Enriching {len(data)} food items...")

    enriched = 0
    for item in data:
        name = item["name"]
        category = item.get("category", "protein")
        cal, prot, carbs, fat, fiber = find_best_match(name, category)

        # Add calories (always — 0 items had it before)
        item["calories_per_serving"] = cal

        # Only override protein if it was missing
        if not item.get("protein_g"):
            item["protein_g"] = prot

        # Add new macro fields
        item["carbs_g"] = carbs
        item["fat_g"] = fat
        item["fiber_g"] = fiber

        enriched += 1

    # Validate
    has_cal = sum(1 for d in data if d.get("calories_per_serving"))
    has_prot = sum(1 for d in data if d.get("protein_g"))
    print(f"Enriched: {enriched}/{len(data)}")
    print(f"With calories: {has_cal}/{len(data)}")
    print(f"With protein_g: {has_prot}/{len(data)}")

    # Write back
    with open(FOOD_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"✓ Written to {FOOD_FILE}")


if __name__ == "__main__":
    enrich()
