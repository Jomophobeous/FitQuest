# Food Database Research — Global Coverage with Images

## Current State

- **861 items** in `assets/food-data.json`
- **0 images**, **0 calorie data**
- 10 regions: AU, ZA, SA, NA, AS, CAS, EE, EME, MAF, PAC
- 5 categories: protein, carb, fat, vegetable, fruit

## Recommended Open-Source Food Databases

### 1. Open Food Facts (BEST FIT)

| Attribute | Value |
|-----------|-------|
| **URL** | https://github.com/openfoodfacts |
| **Items** | 3M+ products globally |
| **Images** | Yes — product photos for most items |
| **Nutrition** | Full: calories, macros, micros, Nutri-Score |
| **Global** | 200+ countries, multi-language |
| **License** | ODbL (data) + CC-BY-SA (images) |
| **Format** | CSV/JSON dump, REST API, MongoDB dump |
| **Size** | ~10GB full dump, but filterable |

**Why it fits:**
- Largest open food DB with images
- Global coverage including South Africa, India, Brazil, Australia
- REST API for on-demand queries OR offline dump for embedded use
- Image URLs in `image_url`, `image_front_url`, `image_nutrition_url`

**Integration path:**
1. Use API: `https://world.openfoodfacts.org/api/v2/search?countries_tags=en:south-africa`
2. OR download country-specific CSV extracts
3. Map to existing `RegionalFoodItem` interface + add `image_url` field

**Key repos:**
- `openfoodfacts/openfoodfacts-server` — Backend + data
- `openfoodfacts/openfoodfacts-dart` — Mobile SDK (Dart, but API patterns transferable)
- `openfoodfacts/smooth-app` — Their Flutter mobile app (reference implementation)

---

### 2. USDA FoodData Central (BEST NUTRITION DATA)

| Attribute | Value |
|-----------|-------|
| **URL** | https://fdc.nal.usda.gov/ |
| **Items** | ~370K items |
| **Images** | No |
| **Nutrition** | Gold standard: 150+ nutrients per item |
| **Global** | US-focused but generic foods are universal |
| **License** | Public domain (US government) |
| **Format** | JSON API + downloadable CSV |
| **Size** | ~2GB full, ~50MB filtered to common foods |

**Why it fits:**
- Most accurate nutrition data available (used by dietitians worldwide)
- Free API with generous limits: `https://api.nal.usda.gov/fdc/v1/`
- Categories: Foundation, SR Legacy, Branded, Survey
- No images, but pair with Open Food Facts images

**Integration path:**
1. Download "Foundation Foods" subset (~2K items, most common whole foods)
2. Extract: calories, protein, carbs, fat, fiber per 100g
3. Map to FitQuest categories
4. Cross-reference with Open Food Facts for images

---

### 3. Foodish (FOOD IMAGES ONLY)

| Attribute | Value |
|-----------|-------|
| **URL** | https://github.com/surhud004/Foodish |
| **Items** | 1000+ food images |
| **Images** | Yes — high-quality food photos |
| **Nutrition** | No |
| **License** | MIT |
| **Format** | REST API returning random food image URLs |

**Why it fits:**
- Quick source of beautiful food images by category
- Categories: burger, pizza, rice, pasta, biryani, dosa, idly, etc.
- API: `https://foodish-api.com/api/images/{category}`

---

### 4. TheMealDB (MEALS + IMAGES)

| Attribute | Value |
|-----------|-------|
| **URL** | https://github.com/themealdb |
| **Items** | 300+ meals |
| **Images** | Yes — meal photos |
| **Nutrition** | Basic (category, area/origin) |
| **Global** | Multi-cuisine: Indian, Japanese, Mexican, etc. |
| **License** | CC-BY-NC-SA |
| **Format** | REST API |

**Why it fits:**
- Meal-level data (not ingredients) — fits meal-prep screen
- Area-based filtering (matches your region concept)
- API: `https://www.themealdb.com/api/json/v1/1/filter.php?a=Indian`

---

### 5. Nutritionix (COMMERCIAL — FREE TIER)

| Attribute | Value |
|-----------|-------|
| **Items** | 1M+ branded + generic |
| **Images** | Yes — food thumbnails |
| **License** | Commercial (free tier: 500 calls/day) |
| **Format** | REST API |

Not open-source but has generous free tier. Good for supplements and branded foods.

---

## Recommended Strategy

### Phase 1: Enrich Current Data (Quick Win)
1. Add calorie/macro data from **USDA FoodData Central** to existing 861 items
2. Cross-reference names to get nutrition per serving
3. No images yet — just fix the 0-calorie gap

### Phase 2: Food Image Integration
1. Use **Open Food Facts API** to match foods by name → get `image_front_url`
2. Cache images locally (download on first view, store in `documentDirectory/food-images/`)
3. Add `image_url` field to `RegionalFoodItem` interface
4. Fall back to category icon when no image

### Phase 3: Separate Food SQLite Table
1. Create `foods` table in schema:
   ```sql
   CREATE TABLE foods (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT NOT NULL,
     calories_per_100g REAL,
     protein_per_100g REAL,
     carbs_per_100g REAL,
     fat_per_100g REAL,
     fiber_per_100g REAL,
     serving_size_g REAL DEFAULT 100,
     image_url TEXT,
     image_local_path TEXT,
     available_regions TEXT NOT NULL DEFAULT '[]',
     local_names TEXT DEFAULT '{}',
     source TEXT DEFAULT 'usda',
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   ```
2. Seed from combined USDA + Open Food Facts data
3. Migrate `food-data.json` → SQLite
4. Enable search, filtering, and offline image caching

### Phase 4: Global Expansion
1. Bulk import from Open Food Facts by country
2. Focus on user's active regions first
3. Background sync for new foods when online

## Image Sourcing Summary

| Source | Images | License | Quality |
|--------|--------|---------|---------|
| Open Food Facts | 3M+ product photos | CC-BY-SA | Variable (user-submitted) |
| Foodish | 1K+ food photos | MIT | High (curated) |
| TheMealDB | 300+ meal photos | CC-BY-NC-SA | High |
| Unsplash API | Unlimited food photos | Free for commercial | Professional |
| Pexels API | Unlimited food photos | Free for commercial | Professional |

**Recommendation:** Open Food Facts for product-level images + Unsplash/Pexels for category-level hero images.
