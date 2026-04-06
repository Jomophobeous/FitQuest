/**
 * DualAI Engine — Response Templates
 * COACH_TEMPLATES: Workout tips, nutrition, motivation, recovery
 * PROFESSOR_TEMPLATES: Reading analysis, learning techniques, Socratic prompts
 */

export const COACH_TEMPLATES = {
  greeting: [
    'Hey {name}! Ready to crush it today? 💪',
    "Let's go, {name}! Every rep counts.",
    "{name}, your body is ready for this. Let's make it happen!",
    "What's up, {name}! Time to turn potential into progress.",
    'Hey champion! Another day, another opportunity to grow.',
    "{name}, you showed up. That's already 90% of the battle.",
    'Ready when you are! What are we working on today? 💪',
  ],
  greeting_morning: [
    "Early bird gets the gains! Let's start the day strong, {name}. 🌅",
    'Morning workout = energized all day. Smart choice, {name}!',
    'Rise and grind, {name}! Your body will thank you later.',
    "Nothing beats a morning session. Let's wake up those muscles!",
  ],
  greeting_afternoon: [
    'Afternoon session! Perfect way to break up the day, {name}.',
    "Midday power-up! Let's get the blood flowing, {name}.",
    'Great timing — afternoon workouts boost focus for the rest of the day.',
    'Lunch break gains! Fuel up, train hard, crush the afternoon.',
    "The post-lunch slump is no match for a workout. Let's go, {name}!",
  ],
  greeting_evening: [
    "Evening grind time, {name}! Let's burn off the day's stress. 🌙",
    'End the day strong! Nothing beats that post-workout relaxation.',
    "Night owl gains incoming! Let's make this session count, {name}.",
    "The gym is quieter now — perfect focus time. Let's do this!",
  ],
  workout_motivation: [
    "You've got {setsRemaining} sets left — you're almost there! Don't quit now.",
    "That's {setsCompleted}/{totalSets} sets done. The burn you feel is growth happening.",
    'Focus on form, not speed. Quality reps build quality muscle.',
    'Your {muscleGroup} is firing up! Keep the tension steady.',
    "Remember why you started. You're stronger than yesterday.",
    'This is where champions are made — when it gets hard.',
    'Your future self is watching. Make them proud.',
    'The last rep is where the magic happens. Push through!',
    "Discipline beats motivation every single time. You're proving that right now.",
    "The weight doesn't know how tired you are. Neither should you.",
    "Embrace the struggle — it's the path to progress.",
    "You're not just building muscle, you're building character.",
    'Pain is temporary. Quitting lasts forever.',
    'One more rep. You can do anything for one rep.',
    "This discomfort? It's your body adapting. Keep going.",
  ],
  fatigue_warning: [
    'Your fatigue level is at {fatigueLevel}%. Consider lighter weights or more rest between sets.',
    "I'm seeing high fatigue signals. Listen to your body — recovery IS training.",
    "You've been pushing hard. Maybe a deload day tomorrow? Your muscles will thank you.",
    'High fatigue detected. Option: reduce volume by 30% and focus on technique.',
    'Your CNS is asking for a break. Respect the signals or risk injury.',
  ],
  form_tips: {
    chest: [
      'Keep your shoulder blades pinched together on bench movements.',
      'Control the negative — 2 seconds down, 1 second up.',
      "Don't bounce the bar off your chest. Touch and press.",
      'Slight arch in your lower back, feet planted firm.',
      'Activate your lats before you press — creates a stable base.',
    ],
    back: [
      'Squeeze your lats at the bottom of each pull-up.',
      "Think 'elbows to hips' on rows for max lat engagement.",
      "Don't use momentum — if you're swinging, the weight's too heavy.",
      'Initiate the pull with your back, not your biceps.',
      'Full stretch at the bottom, full squeeze at the top.',
    ],
    legs: [
      'Push through your heels on squats.',
      "Keep your knees tracking over your toes — don't let them cave in.",
      'Full range of motion beats heavy partial reps every time.',
      "Brace your core like you're about to get punched.",
      'On deadlifts: the bar stays close to your body the entire lift.',
    ],
    shoulders: [
      "Don't shrug on lateral raises — keep traps out of it.",
      'Slight forward lean on overhead press protects your lower back.',
      'Control the weight at the top of the movement.',
      'Rotate pinkies up slightly at the top of lateral raises.',
      'Keep tension throughout — no momentum swings.',
    ],
    arms: [
      'Full extension at the bottom of curls — no half reps.',
      'Lock out your tricep extensions for maximum contraction.',
      'Keep your elbows pinned to your sides on curls.',
      'On skull crushers: only your forearms should move.',
      'Squeeze and hold at peak contraction for 1 second.',
    ],
    core: [
      'Breathe out on the exertion — exhale as you crunch.',
      "Planks: squeeze your glutes and brace your abs like someone's about to punch you.",
      'Quality over quantity — 10 perfect reps beat 50 sloppy ones.',
      'Hollow body: Press your lower back into the floor.',
      'Anti-rotation exercises build real functional core strength.',
    ],
  },
  rest_day: [
    'Rest day! Your muscles grow during recovery, not during the workout.',
    'Active recovery is great — light walk, stretching, or yoga.',
    'Take it easy today. Hydrate well and get 7+ hours of sleep tonight.',
    'Recovery day = growth day. Trust the process.',
    "Your nervous system needs this break. You'll come back stronger.",
  ],
  streak_celebration: [
    "🔥 {streakDays} days in a row! You're building an unstoppable habit!",
    "Streak: {streakDays} days! Most people quit by day 3. You're different.",
    '{streakDays}-day streak! Consistency > perfection, always.',
    'Look at that — {streakDays} days strong! Your discipline is showing.',
    "{streakDays} days and counting! The only person you're competing with is yesterday's you.",
  ],
  streak_milestones: {
    '7': [
      "🎯 ONE WEEK! 7 days straight! You've proven this is more than a phase.",
      "7-day streak! Studies show habits start forming around now. You're on track!",
      "A full week of showing up! That's elite-level commitment.",
    ],
    '14': [
      '🔥 TWO WEEKS! 14 days! The hardest part is behind you.',
      "14-day streak! Your body is adapting — you'll start noticing changes soon.",
      'Half a month consistent! This is becoming part of who you are.',
    ],
    '30': [
      "🏆 ONE MONTH! 30 days! You've built a real habit now.",
      "30-day streak! This is no longer willpower — it's identity. You're an athlete.",
      "A full month! 93% of people never make it this far. You're exceptional.",
    ],
    '60': [
      '⭐ TWO MONTHS! 60 days of pure dedication! You inspire me.',
      '60-day streak! Your fitness DNA has been rewritten. This is you now.',
      'Two months strong! The compound effect is kicking in big time.',
    ],
    '90': [
      "👑 90 DAYS! THREE MONTHS! You're in the top 1% of consistency.",
      "90-day streak! You've proven that discipline > motivation. Legendary.",
      "A quarter-year of daily dedication! You're not just fit, you're BUILT different.",
    ],
  },
  comeback: [
    "Haven't seen you in a while! No judgment — let's ease back in with a lighter session.",
    'Welcome back! Start at 70% of your previous weights and build from there.',
    "Every comeback starts with showing up. You've already won today.",
    'The best time to restart was yesterday. The second best time is right now.',
    "Breaks happen — what matters is that you came back. Let's build momentum!",
  ],
  comeback_short: [
    // 3-7 days
    "3 days off? Perfect recovery window! Let's ease back in at 90%.",
    'Short break, no problem! Your muscles are rested and ready.',
    "A few days off won't hurt your gains. Let's pick up where we left off.",
    "That rest was smart — your body recovered. Now let's put that energy to work!",
    "Mini break over! You haven't lost anything. Let's get after it.",
  ],
  comeback_medium: [
    // 1-2 weeks
    'A week off? Your body got some deep recovery. Start at 75% and build up quickly.',
    'Two weeks away is nothing in the long run. Focus on form today, intensity tomorrow.',
    "Missed a few sessions? Life happens. What matters is you're here NOW.",
    "A week or two off? Your muscle memory is still there. Let's reactivate it!",
    "Time off doesn't erase your progress. It takes weeks to lose strength. You're good!",
  ],
  comeback_long: [
    // 2+ weeks
    "It's been a while! No shame — every champion has had to restart. Let's go 60% today.",
    'Long break? Perfect time for a fresh start. New phase, new goals, same warrior spirit.',
    "Welcome back after {days} days! We'll rebuild smarter this time. Trust the process.",
    "You're back! That takes courage. We'll take it easy today and ramp up gradually.",
    "A long break just means you get to experience beginner gains again! Let's enjoy this phase.",
  ],
  progressive_overload: [
    "📈 You lifted more than last time! That's progressive overload in action!",
    'New personal best on that set! Your strength is visibly increasing!',
    'More reps than last session! Your body is adapting beautifully.',
    'Weight increase successful! This is exactly how you build strength.',
    'Progress detected! Small improvements compound into massive gains.',
  ],
  sport_specific: {
    runner: [
      'Strength training makes runners faster and more injury-resistant. Smart combo!',
      'Strong legs = faster splits. Every squat pays dividends on race day.',
      'Core work today = better running economy tomorrow.',
    ],
    lifter: [
      'Compound movements are king. Squat, deadlift, press — the holy trinity.',
      'Time under tension is your friend. Control every rep.',
      "Hypertrophy comes from volume. Let's accumulate quality reps.",
    ],
    yogi: [
      "Strength supports flexibility. You'll hold those poses longer and deeper.",
      'Balance work today complements your yoga practice perfectly.',
      'Core strength = better inversions. Every plank helps your headstand.',
    ],
    body_control: [
      'Bodyweight mastery! Each rep brings you closer to that muscle-up.',
      'Progressions are your path. Master each level before advancing.',
      'Your strength-to-weight ratio is improving with every session.',
    ],
    general: [
      "Building a well-rounded athlete! Strength, endurance, mobility — you're covering it all.",
      'Functional fitness is the goal. Move well, move often.',
      'Every workout is an investment in your future self.',
    ],
  },
  injury_aware: [
    'Take it easy on that {muscle}. Modified movements are smart, not weak.',
    "Working around your injury? That's a sign of maturity, not defeat.",
    "Let's protect that area today. Alternative exercises will keep you progressing.",
    "Pain is a signal, not a challenge. We'll adapt the workout accordingly.",
    'Recovery from injury is still progress. Be patient with yourself.',
  ],
  post_workout_greeting: [
    '🎉 Great session! You just crushed {exerciseCount} exercises in {duration} minutes. How are you feeling?',
    "💪 Workout complete! {exerciseCount} exercises done — {xpEarned} XP earned. What's on your mind?",
    'You just finished a solid workout! {completedCount}/{totalCount} exercises completed. How can I help with recovery?',
    'Fresh off the training floor! That {duration}-minute session was well spent. Want recovery tips?',
    'Another one in the books! 🔥 {xpEarned} XP banked. Need nutrition or recovery advice?',
  ],
  post_workout_perfect: [
    "🏆 PERFECT SESSION! Every single exercise completed — that's elite dedication!",
    '💯 Flawless execution! {totalCount}/{totalCount} exercises, zero skips. Champion mindset!',
    "You didn't skip a single exercise! That discipline is what separates good from great.",
    '100% completion rate! Your future self just sent a thank-you note.',
    "Every. Single. Exercise. Done. That's the kind of discipline that builds champions! 👑",
  ],
  post_workout_recovery: [
    "After that workout, here's what I recommend:\n\n🧘 Light stretching for 5-10 minutes\n💧 Rehydrate immediately\n🥩 Eat protein within 30 minutes\n😴 Get quality sleep tonight",
    'Post-workout checklist:\n\n✅ Cool down with gentle movement\n✅ Hydrate (500ml minimum)\n✅ Protein-rich meal within the hour\n✅ Foam roll any tight spots',
    'Recovery starts NOW:\n\n1️⃣ Walk around for 2-3 minutes (cool down)\n2️⃣ Drink 500ml water + electrolytes\n3️⃣ Eat within 45 min (protein + carbs)\n4️⃣ Prioritize 7-9 hours of sleep tonight',
    "Great session! Here's your post-workout priority list:\n\n💧 Rehydrate immediately\n🍗 Protein within the hour\n🧘 Gentle stretch or walk\n📱 Log how you feel for next time",
    "You've earned your rest! Post-workout essentials:\n\n🧊 Ice any sore joints (15 min max)\n🥤 Protein shake or balanced meal\n🚶 Light 10-minute walk\n🛏️ Early bedtime tonight if possible",
  ],

  // ---- Extended Coach Topics ----

  nutrition: [
    "For bodyweight training:\n\n🥩 **Protein**: 1.6-2.2g per kg bodyweight daily\n🥗 **Meals**: Eat within 2 hours post-workout\n💧 **Water**: 2-3 litres daily, more on training days\n🍌 **Pre-workout**: Light carbs 30-60 min before\n😴 **Don't skimp on sleep** — it affects recovery more than supplements\n\nConsistency in nutrition > perfection!",
    "Nutrition basics for athletes:\n\n1️⃣ Prioritize whole foods over supplements\n2️⃣ Eat enough protein (1.6-2.2g/kg)\n3️⃣ Time your carbs around workouts\n4️⃣ Don't fear fats — they support hormones\n5️⃣ Stay hydrated throughout the day\n\nSmall changes compound into big results!",
    "Here's the simple nutrition formula:\n\n🥩 Protein at every meal (palm-sized portion)\n🍠 Complex carbs for energy (fist-sized)\n🥑 Healthy fats for hormones (thumb-sized)\n🥦 Veggies for micronutrients (fill the plate)\n\nNo need for perfection — aim for 80% consistency!",
    "Top 5 foods for fitness athletes:\n\n1️⃣ **Eggs** — complete protein + healthy fats\n2️⃣ **Oats** — slow-releasing carbs for energy\n3️⃣ **Chicken/Fish** — lean protein powerhouses\n4️⃣ **Sweet potato** — complex carbs + potassium\n5️⃣ **Greek yogurt** — protein + probiotics\n\nKeep these stocked and you're 80% there!",
    "The 80/20 nutrition rule:\n\n✅ 80% whole, minimally processed foods\n🎉 20% whatever you enjoy\n\nThis approach is sustainable, realistic, and still gets results. You don't need to be perfect — you need to be consistent!",
  ],

  meal_prep: [
    'Simple meal prep framework for training days:\n\n🍳 **Breakfast**: Oats + banana + peanut butter + protein\n🥗 **Lunch**: Grilled chicken/fish + rice + vegetables\n🍗 **Dinner**: Lean protein + complex carbs + healthy fats\n🥤 **Pre-workout snack** (30-60 min before): Banana + handful of nuts\n🥛 **Post-workout** (within 30 min): Protein shake + fruit\n\n📝 **Tip**: Cook proteins & carbs in bulk on Sunday. Store in containers for the week!',
    'Easy batch cooking guide:\n\n🔥 **Sunday Prep** (2 hours):\n• Grill 1.5kg chicken breast\n• Cook 1kg rice + 1kg sweet potato\n• Prep salad containers\n• Hard-boil 12 eggs\n\n📦 Store in glass containers — lasts 4-5 days.\n\nThis covers ~15 meals for the week!',
    'Quick pre/post-workout nutrition:\n\n⏰ **60 min before**: Rice cakes + honey, or banana + PB\n⏰ **30 min before**: Light fruit or sports drink\n⏰ **Within 30 min after**: Protein shake + banana\n⏰ **Within 2 hours after**: Full balanced meal\n\nTiming matters, but total daily intake matters MORE!',
    'Budget-friendly meal prep:\n\n💰 **Cheap protein**: Eggs, canned tuna, chicken thighs, lentils\n💰 **Cheap carbs**: Rice, oats, potatoes, pasta\n💰 **Cheap veggies**: Frozen broccoli, carrots, canned tomatoes\n\n🛒 Buy in bulk, cook on Sundays. ~$5/day is totally doable!',
    "5-minute high-protein meals:\n\n⚡ **Overnight oats**: Mix oats + protein + milk before bed\n⚡ **Tuna wrap**: Canned tuna + lettuce + mayo in a wrap\n⚡ **Greek yogurt bowl**: Yogurt + berries + honey + nuts\n⚡ **Scrambled eggs**: 3 eggs + spinach + cheese\n\nNo excuses — healthy eating doesn't have to be complicated!",
  ],

  macros: [
    'Quick macro guidelines for fitness athletes:\n\n📊 **Maintenance**: ~2,200-2,800 cal/day (varies by size)\n📊 **Muscle gain**: Add 300-500 cal above maintenance\n📊 **Fat loss**: Subtract 300-500 cal below maintenance\n\n🥩 **Protein**: 1.6-2.2g per kg bodyweight\n🍚 **Carbs**: 3-5g per kg (training days), 2-3g (rest days)\n🥑 **Fats**: 0.8-1.2g per kg\n\n💧 **Water**: Body weight (kg) × 0.033 = litres/day\n\n⚠️ These are estimates — adjust based on results over 2-3 weeks!',
    "Calculate your TDEE:\n\n1️⃣ BMR (Mifflin-St Jeor):\n• Men: (10 × kg) + (6.25 × cm) - (5 × age) + 5\n• Women: (10 × kg) + (6.25 × cm) - (5 × age) - 161\n\n2️⃣ Multiply by activity factor:\n• Sedentary: ×1.2\n• Light exercise: ×1.375\n• Moderate (3-5x/week): ×1.55\n• Heavy (6-7x/week): ×1.725\n\nThat's your daily calorie target!",
    'Protein timing simplified:\n\n🥩 Spread protein across 4-5 meals (30-40g each)\n⏰ Post-workout protein within 2 hours\n😴 Casein or cottage cheese before bed (slow release)\n\nTotal daily intake matters more than timing. Hit your target consistently!',
    "Macro tracking for beginners:\n\n📱 Use a food tracking app for 2-4 weeks to learn portion sizes\n🤚 Then switch to the **hand method**:\n• 🤜 Fist = 1 carb serving\n• 🫲 Palm = 1 protein serving\n• 👍 Thumb = 1 fat serving\n\nYou don't need to track forever — just long enough to calibrate!",
    'Adjusting macros based on results:\n\n📈 **Not gaining?** Add 200 cal (mostly carbs)\n📉 **Not losing?** Remove 200 cal (mostly carbs/fats)\n💪 **Losing strength?** Increase protein to 2.2g/kg\n😴 **Always tired?** You may need more carbs\n\nAdjust every 2-3 weeks. Small tweaks, not drastic changes!',
  ],

  progress_tips: [
    'To break through plateaus:\n\n1️⃣ Increase difficulty (harder variations)\n2️⃣ Add volume (more sets)\n3️⃣ Slow down tempo (3-4 second negatives)\n4️⃣ Take a deload week\n5️⃣ Check sleep & nutrition\n\nThe engine will auto-progress you when ready!',
    "Tracking your progress effectively:\n\n📸 Take progress photos monthly (same lighting/time)\n📝 Log your reps — beat last week's numbers\n⚖️ Weigh weekly, track the average\n📏 Measure chest, waist, arms, legs monthly\n\nNumbers don't lie — and they keep you motivated!",
    "The compound effect of consistency:\n\n• Week 1-2: You feel different\n• Week 3-4: You notice strength gains\n• Week 6-8: Others start noticing\n• Week 12+: Body transformation visible\n\nYou're {totalWorkouts} workouts in. Keep going — the results are compounding!",
    "5 signs you're making progress (beyond the scale):\n\n1️⃣ You can do harder exercise variations\n2️⃣ Recovery feels faster between sessions\n3️⃣ Your form has improved\n4️⃣ You have more daily energy\n5️⃣ Your clothes fit differently\n\nProgress isn't always visible — but it's always happening!",
    'How to handle a plateau:\n\n🔄 **Change the stimulus**: New exercises or angles\n📉 **Deload**: 50% intensity for 1 week, then attack\n🍗 **Nutrition check**: Are you eating enough? Enough protein?\n😴 **Sleep audit**: 7-9 hours? Consistent schedule?\n\nPlateaus are temporary. They mean your body adapted — now we adapt back!',
  ],

  stretching: [
    'For better flexibility:\n\n🧘 **Daily**: 5-10 min morning mobility routine\n⏱️ **Hold**: Each stretch for 30-60 seconds\n🌡️ **Warm first**: Stretch after exercise, not cold\n📈 **Progressive**: Go slightly further each week\n🎯 **Focus areas**: Hips, hamstrings, thoracic spine\n\nFlexibility unlocks better performance in every exercise!',
    "Essential stretches for bodyweight athletes:\n\n1️⃣ World's Greatest Stretch (hips + thoracic)\n2️⃣ Pike Stretch (hamstrings + calves)\n3️⃣ Frog Stretch (groin + inner thighs)\n4️⃣ Pigeon Pose (glutes + hip flexors)\n5️⃣ Shoulder Dislocates (shoulder mobility)\n6️⃣ Cat-Cow (spine mobilization)\n\nHold each 30-60s. Breathe deeply!",
    'Dynamic vs Static stretching:\n\n🏃 **Before training**: Do DYNAMIC stretches\n→ Arm circles, leg swings, high knees, hip circles\n\n🧘 **After training**: Do STATIC stretches\n→ Hold positions for 30-60 seconds each\n\n⚠️ Static stretching before exercise can reduce power output. Save it for afterwards!',
    '5-minute daily mobility routine:\n\n1️⃣ Neck circles — 30s each direction\n2️⃣ Arm circles — 30s forward, 30s back\n3️⃣ Hip circles — 30s each direction\n4️⃣ Deep squat hold — 60s\n5️⃣ Thoracic rotation — 30s each side\n\nDo this every morning. Your joints will thank you!',
    'Flexibility milestones to work toward:\n\n🥉 **Beginner**: Touch your toes, bodyweight squat to depth\n🥈 **Intermediate**: Pancake stretch, full bridge, deep lunge\n🥇 **Advanced**: Front splits, pike compression, backbend\n\nFlexibility is trainable at any age. Start where you are!',
  ],

  sleep: [
    'Sleep is your #1 recovery tool! 😴\n\n🌙 **7-9 hours** minimum for muscle recovery\n📱 **No screens** 30 min before bed\n🌡️ **Cool room** (18-20°C / 64-68°F)\n⏰ **Consistent schedule** — same time daily\n🧘 **Wind-down routine**: stretching, deep breathing\n\nPoor sleep = poor recovery = slower gains',
    "The sleep-gains connection:\n\n• Growth hormone peaks during deep sleep\n• Protein synthesis requires quality rest\n• CNS recovery depends on sleep quality\n• Poor sleep increases cortisol (muscle breakdown)\n\n💡 One bad night won't ruin you, but chronic sleep debt destroys progress. Prioritize it!",
    'Better sleep protocol:\n\n1️⃣ Last caffeine by 2pm\n2️⃣ Dim lights 1 hour before bed\n3️⃣ Cool shower 90 min before sleep\n4️⃣ Magnesium supplement at night (300mg)\n5️⃣ Box breathing: 4-4-4-4\n\nThis routine can improve sleep quality within days!',
    "Sleep and muscle recovery:\n\n⏰ **Deep sleep (stages 3-4)**: When HGH is released\n⏰ **REM sleep**: Brain and CNS recovery\n\n🔑 Both require 7+ hours. Cutting sleep to 6h = ~40% less growth hormone.\n\nSleep isn't lazy — it's when your body BUILDS what you broke down in training!",
    "Quick fixes for poor sleep:\n\n🛏️ Same bedtime every day (yes, weekends too)\n📱 Phone in another room or on airplane mode\n🫖 Chamomile tea or magnesium 30 min before bed\n🧦 Wear socks to bed (seriously — it helps)\n📓 Write tomorrow's to-do list to clear your mind\n\nTry these for one week and notice the difference!",
  ],

  frequency: [
    'Workout frequency guide:\n\n📅 **Beginner**: 3 days/week (full body)\n📅 **Intermediate**: 4 days/week (upper/lower split)\n📅 **Advanced**: 5-6 days/week (push/pull/legs)\n\n⚠️ Always take at least 1 full rest day!\n\nThe Train tab auto-generates workouts optimized for your recovery state. Trust the system! 🤖',
    "Finding your ideal frequency:\n\n🔑 Key principle: Recovery determines frequency\n\n• If you're sore for 3+ days → train less often\n• If you feel fresh after 1 day → you can train more\n• If progress stalls → try MORE rest, not more training\n\nQuality > quantity. 3 great sessions beats 6 mediocre ones!",
    "Training split options:\n\n📋 **3-day Full Body**: Mon/Wed/Fri — hit everything each session\n📋 **4-day Upper/Lower**: Mon/Tue + Thu/Fri — more volume per area\n📋 **5-day PPL**: Push/Pull/Legs/Upper/Lower — for advanced athletes\n\nYour goal is **{goal}** — I'll optimize your workouts accordingly!",
    "How to know if you're training enough:\n\n✅ You feel challenged during workouts\n✅ You're recovering between sessions\n✅ You're progressing week to week\n\n❌ If you're always sore → too much\n❌ If workouts feel easy → not enough\n\nThe sweet spot is different for everyone. Listen to your body!",
    'Rest day activities that HELP recovery:\n\n🚶 Light walks (20-30 min)\n🧘 Yoga or mobility work\n🏊 Light swimming\n🧘 Foam rolling + stretching\n\nActive recovery beats sitting on the couch. Move gently!',
  ],

  exercise_recommendations: [
    'Top exercises for bodyweight athletes:\n\n🌟 **Essential Compound Moves**:\n1. **Push-ups** — 3×12 (chest, triceps, shoulders). Rest 60s between sets\n2. **Pull-ups or Inverted Rows** — 3×8 (back, biceps). Rest 90s\n3. **Squats** — 3×15 (quads, glutes). Rest 60s\n4. **Plank Hold** — 3×45s (core stability). Rest 30s\n5. **Lunges** — 3×10 each leg (legs, balance). Rest 60s\n\nMaster these before chasing advanced variations!',
    'Exercise progressions to work toward:\n\n🎯 **Push**: Wall push-up (3×15) → Push-up (3×12) → Diamond (3×10) → Archer (3×6) → One-arm (3×3)\n🎯 **Pull**: Dead hang (3×30s) → Inverted row (3×10) → Pull-up (3×8) → Muscle-up (3×3)\n🎯 **Squat**: Assisted (3×15) → Full (3×15) → Pistol (3×5) → Shrimp (3×5)\n🎯 **Core**: Plank (3×45s) → L-sit (3×15s) → Dragon flag (3×5) → Front lever (3×10s)\n\nMaster each level before advancing!',
    'Goal-based exercise picks:\n\n💪 **Strength**: Pistol squats 3×5, Muscle-ups 3×3, Handstand push-ups 3×5. Rest 2-3 min\n🧘 **Flexibility**: Pancake 3×60s, Pike 3×45s, Bridge 3×30s\n🏃 **Speed**: Plyo push-ups 4×8, Box jumps 4×6, Sprint drills 6×30m. Rest 90s\n🎯 **Body control**: L-sits 3×15s, Levers 3×10s, Handstands 5×30s\n\nCheck the Exercise Library for {exerciseCount}+ options!',
    'The 3 exercises everyone should master:\n\n1️⃣ **Push-up** — 3×12 reps, full range of motion. Rest 60s\n2️⃣ **Squat** — 3×15 reps, thighs parallel. Rest 60s\n3️⃣ **Pull-up** — 3×8 reps (use band assist if needed). Rest 90s\n\nTotal workout time: ~20 minutes. These three alone can build an impressive physique!',
    "Best exercises for your goal (**{goal}**):\n\nHere's a quick session:\n\n1. **Compound #1** — 4×10 reps. Rest 90s\n2. **Compound #2** — 4×10 reps. Rest 90s\n3. **Isolation** — 3×12 reps. Rest 60s\n4. **Core finisher** — 3×45s hold. Rest 30s\n\n⏱ Total: ~25 min. Head to the Exercises tab for exercises filtered to your goal!",
  ],

  body_transformation: [
    "For body transformation, check out Craft My Body! 🎨\n\nHere's the quick version:\n• **Muscle Building**: Compound movements, progressive overload, 4-5x/week\n• **Fat Loss**: Calorie deficit (-300 to -500), high protein, add cardio\n• **Lean Look**: Strength training + HIIT, moderate calories\n\nGo to Profile → Craft My Body for your personalized plan!",
    "Body recomposition strategy:\n\n1️⃣ Eat at maintenance or slight deficit\n2️⃣ Keep protein HIGH (2g/kg bodyweight)\n3️⃣ Strength train 3-4x/week\n4️⃣ Get 7-9 hours of sleep\n5️⃣ Be patient — it's slower but more sustainable\n\nYou can lose fat AND build muscle at the same time!",
    "Visual change timeline:\n\n📅 **Week 1-2**: Feel stronger, more energy\n📅 **Week 3-4**: Clothes fit differently\n📅 **Week 6-8**: Others start to notice\n📅 **Week 12+**: Major visible transformation\n\nWith {totalWorkouts} workouts completed, you're on track! Consistency is everything.",
    'The 4 pillars of body transformation:\n\n🏋️ **Training**: Progressive overload, 3-5x/week\n🥩 **Nutrition**: Appropriate calories + high protein\n😴 **Sleep**: 7-9 hours for recovery\n🧠 **Mindset**: Patience + consistency\n\nNeglect any one pillar and progress slows. All four together = unstoppable!',
    'Common transformation mistakes to avoid:\n\n❌ Crash dieting → muscle loss + metabolic damage\n❌ Too much cardio → burning muscle, not fat\n❌ Ignoring protein → slow recovery, poor results\n❌ Comparing to others → everyone responds differently\n\nPlay the long game. 12 months of consistency beats 12 weeks of extremes!',
  ],

  warmup_cooldown: [
    'Essential warm-up & cool-down guide:\n\n🔥 **Warm-Up** (5-10 min):\n1. Light cardio (jumping jacks, high knees) — 2 min\n2. Dynamic stretching — 3 min\n3. Movement-specific prep — 2 min\n\n❄️ **Cool-Down** (5-10 min):\n1. Easy walk or light movement — 2 min\n2. Static stretching (30-60s holds) — 5 min\n3. Deep breathing — 2 min\n\n⚠️ Never skip warm-up! Cold muscles = higher injury risk.',
    'Why warm-ups matter:\n\n🌡️ Raises muscle temperature → better flexibility\n🫀 Increases heart rate gradually → safer for heart\n🧠 Improves neuromuscular connection → better coordination\n🛡️ Reduces injury risk by up to 50%\n\nJust 5-10 minutes makes a massive difference!',
    "Perfect cool-down routine:\n\n1️⃣ Walk in place for 2 minutes\n2️⃣ Stretch each major muscle group (30s holds)\n3️⃣ Child's pose (60s) — decompress spine\n4️⃣ Lying hamstring stretch (30s each leg)\n5️⃣ 10 deep breaths — activate recovery mode\n\nCooling down properly reduces soreness the next day!",
    "Movement-specific warm-up examples:\n\n🏋️ **Before pushing exercises**: Shoulder circles → Band pull-aparts → Light push-ups\n🏋️ **Before pulling exercises**: Arm circles → Scap retractions → Light rows\n🏋️ **Before legs**: Hip circles → Bodyweight squats → Leg swings\n\nPrime the muscles you're about to use!",
    'The 3-minute express warm-up:\n\n⚡ 30s jumping jacks\n⚡ 30s arm circles\n⚡ 30s hip circles\n⚡ 30s high knees\n⚡ 30s bodyweight squats\n⚡ 30s deep breathing\n\nShort on time? This covers the essentials!',
  ],

  injury_prevention: [
    'Injury prevention is KEY for long-term progress! 🛡️\n\n**General rules:**\n1. Always warm up properly (5-10 min)\n2. Learn proper form BEFORE adding difficulty\n3. Progress gradually (10% rule per week)\n4. Listen to your body — sharp pain = STOP\n\n**When to rest vs push through:**\n✅ Muscle soreness (DOMS) = OK to train\n❌ Joint pain, sharp pain, numbness = REST',
    "Common injury spots and prevention:\n\n🦵 **Knees**: Don't let knees cave inward during squats\n💪 **Shoulders**: Warm up rotator cuff before pressing\n🤚 **Wrists**: Wrist circles + stretches before push exercises\n🔙 **Lower back**: Brace core on EVERY exercise\n\nPrevention is 100x easier than recovery!",
    'The 10% rule:\n\nNever increase volume, intensity, or duration by more than 10% per week.\n\n• Last week 3 sets? → This week max 3-4 sets\n• Last week 10 reps? → This week max 11 reps\n• Completed intermediate? → Spend 2 weeks before advanced\n\nPatience prevents injuries. Your body needs time to adapt!',
    'Prehab moves to keep you injury-free:\n\n🦵 **Knees**: Terminal knee extensions, wall sits\n💪 **Shoulders**: Band external rotations, face pulls\n🤚 **Wrists**: Wrist circles, prayer stretches\n🔙 **Back**: Dead bugs, bird dogs\n\n5 minutes of prehab daily saves months of rehab!',
    'When to train through discomfort vs stop:\n\n✅ **Train**: Muscle soreness (DOMS), general fatigue, mild stiffness\n⚠️ **Modify**: Discomfort in a specific joint, tightness affecting form\n❌ **Stop**: Sharp pain, numbness, tingling, swelling\n\nWhen in doubt, rest. One day off beats one month off!',
  ],

  supplements: [
    "Supplement guide for fitness athletes:\n\n**Tier 1 (Recommended):**\n💊 **Creatine Monohydrate** — 5g/day, proven muscle & strength benefit\n🥤 **Protein Powder** — Only if you can't hit protein goals from food\n☀️ **Vitamin D** — If you don't get enough sun\n🐟 **Omega-3 (Fish Oil)** — For joint health & recovery\n\n**Skip these:**\n❌ BCAAs (if you eat enough protein)\n❌ Fat burners (waste of money)\n❌ Testosterone boosters (don't work)\n\n⚠️ Real food > supplements. Always.",
    'The only supplements backed by strong evidence:\n\n1️⃣ **Creatine** (5g/day) — 5-10% strength increase\n2️⃣ **Caffeine** (200mg pre-workout) — improved performance\n3️⃣ **Protein powder** — convenience, not magic\n4️⃣ **Vitamin D** — most people are deficient\n5️⃣ **Omega-3** — anti-inflammatory, joint support\n\nEverything else? Save your money for real food!',
    'Common supplement myths debunked:\n\n❌ "BCAAs help muscle growth" → Not if you eat enough protein\n❌ "Fat burners work" → They\'re just expensive caffeine\n❌ "You need a pre-workout" → Coffee works just as well\n❌ "More protein = more muscle" → There\'s a ceiling (2.2g/kg)\n\n✅ Focus on: food quality, sleep, consistency. That\'s 95% of results!',
    "Creatine — the best supplement for strength:\n\n📊 **What**: 5g of creatine monohydrate daily\n⏰ **When**: Any time — timing doesn't matter\n💧 **How**: Mix in water or shake\n📈 **Effect**: 5-10% strength gain, improved recovery\n⚠️ **Note**: Drink extra water (it pulls water into muscles)\n\nNo loading phase needed. Just 5g/day, every day.",
    "When to consider supplements:\n\n✅ You've nailed nutrition basics (whole foods, adequate protein)\n✅ You sleep 7+ hours consistently\n✅ You train regularly (3+ times/week)\n\nSupplements are the last 5%.\nFood, sleep, and training are the first 95%!",
  ],

  mental_health: [
    'Exercise is one of the BEST tools for mental health! 🧠\n\n**How exercise helps:**\n• Releases endorphins (natural mood boost)\n• Reduces cortisol (stress hormone)\n• Improves sleep quality\n• Builds discipline & confidence\n\n**When stressed:**\n🧘 Try deep breathing: 4s in → 4s hold → 4s out → 4s hold\n🚶 Even a 10-minute walk makes a difference\n\nYour streak is {streakDays} days. Every day you show up is a win! 💪',
    "Building the workout habit:\n\n1️⃣ Start with just 10 min/day (lower the barrier)\n2️⃣ Same time every day (routine = consistency)\n3️⃣ Track your streak (momentum matters)\n4️⃣ Celebrate small wins\n5️⃣ Don't break the chain — even 5 minutes counts\n\nDiscipline compounds. You're building mental resilience with every session!",
    'The mind-muscle connection:\n\n🧠 Visualization improves strength by up to 13% (research-backed)\n🎯 Focus on the muscle you\'re working — feel every rep\n🧘 Start each workout with 3 deep breaths\n💪 Positive self-talk: "I am strong" > "I can\'t do this"\n\nYour mindset is your most powerful muscle!',
    "Not feeling it today? That's normal.\n\n🔑 The secret: Show up anyway, but lower the bar.\n\n• Can't do 45 minutes? Do 15.\n• Can't do full intensity? Do 50%.\n• Can't do the full workout? Do 3 exercises.\n\nA bad workout is infinitely better than no workout. Action creates motivation, not the other way around.",
    'Dealing with comparison on social media:\n\n📱 Remember: You\'re seeing highlight reels\n⏰ Their "1-year transformation" might be 5+ years with breaks\n🧬 Genetics play a role — focus on YOUR progress\n📈 Compare yourself to who you were last month\n\nThe only competition that matters is you vs yesterday\'s you!',
  ],

  hydration: [
    'Hydration is crucial for performance! 💧\n\n**How much water:**\n• Baseline: 30-35ml per kg bodyweight\n• Training days: Add 500ml-1L extra\n• Hot weather: Add another 500ml\n\n**Signs of dehydration:**\n• Dark yellow urine\n• Fatigue & headaches\n• Decreased performance\n• Muscle cramps\n\nPro tip: Keep a water bottle visible at all times!',
    'Hydration schedule for athletes:\n\n☀️ Morning: 500ml within 30 min of waking\n🏋️ Pre-workout: 250ml, 30 min before\n💪 During: Sip every 15-20 min\n🥤 Post: 500ml within 30 min of finishing\n🌙 Evening: Taper off 2h before bed\n\nConsistent hydration = consistent performance!',
    'Beyond water — electrolyte basics:\n\n🧂 **Sodium**: Lost in sweat, add a pinch of salt to water\n🍌 **Potassium**: Bananas, potatoes, spinach\n💊 **Magnesium**: Nuts, dark chocolate, supplementation\n\nFor sessions under 60 min, water alone is fine.\nFor longer/intense sessions, consider electrolyte drinks!',
    'Quick hydration check — the pee test:\n\n🟡 Pale/light yellow = Well hydrated\n🟡 Dark yellow = Drink more water\n🟤 Brown/very dark = Dehydrated — drink NOW\n\n💡 Morning urine is normally darker. Check mid-day for accuracy.\n\nAim for pale yellow throughout the day!',
    "Hydration mistakes that hurt performance:\n\n❌ Chugging 1L right before training → stomach issues\n❌ Only drinking during workouts → already dehydrated by then\n❌ Relying on thirst → by then you're 1-2% dehydrated\n❌ Replacing water with sports drinks → unnecessary sugar\n\n✅ Sip consistently throughout the day. Small amounts, often!",
  ],

  weight_management: [
    'Weight management fundamentals:\n\n**To lose fat:**\n📉 Calorie deficit of 300-500 cal/day\n🥩 Keep protein HIGH (2g/kg) to preserve muscle\n🏃 Add 2-3 cardio sessions/week\n⏰ Be patient — 0.5-1kg/week is healthy\n\n**To gain muscle:**\n📈 Calorie surplus of 300-500 cal/day\n🥩 Protein at 1.8-2.2g/kg\n🏋️ Progressive overload in training\n😴 Sleep 8+ hours for recovery\n\n💡 Track weekly averages, not daily fluctuations!',
    "Body fat vs scale weight:\n\n⚖️ The scale tells ONE story. It doesn't show:\n• Muscle gain (denser than fat)\n• Water fluctuations (1-2kg daily)\n• Glycogen changes from training\n\n📏 Better measures:\n• Progress photos (monthly)\n• How clothes fit\n• Waist/hip measurements\n• Strength improvements\n\nDon't let the scale dictate your mood!",
    'The slow & steady approach wins:\n\n🐢 **Sustainable fat loss**: 0.5-1% body weight per week\n🐢 **Lean muscle gain**: 0.25-0.5kg per month (natural)\n\nFad diets and extreme deficits lead to:\n❌ Muscle loss\n❌ Metabolic adaptation\n❌ Binge-restrict cycles\n\nConsistency with a moderate approach always wins long-term!',
    "Setting realistic weight goals:\n\n📊 Healthy fat loss: ~0.5kg/week (2kg/month)\n📊 Healthy muscle gain: ~0.5kg/month (for most people)\n📊 Body recomp: Scale stays same, mirror changes\n\n🗓️ In 3 months at a moderate pace, you can see significant change.\n\nDon't chase the number on the scale — chase the reflection in the mirror!",
    'Why weight fluctuates daily:\n\n💧 **Water**: ±1-2kg daily from hydration, sodium, carbs\n🍽️ **Food volume**: Undigested food has weight\n🏋️ **Glycogen**: Training depletes it, eating refills it\n🌡️ **Hormones**: Monthly cycles, stress, sleep quality\n\nWeigh yourself weekly (same day/time) and track the TREND, not daily numbers!',
  ],

  thanks: [
    "You're welcome! That's what I'm here for. Keep pushing — you're doing amazing! 🌟",
    "Anytime! You're putting in the work, I'm just here to support. Keep it up! 💪",
    "Happy to help! Remember, every question you ask shows you're invested in your growth.",
    "No problem at all! Your curiosity and drive are what make the difference. Let's keep going!",
    "That's what coaches are for! Now go crush it! 💪",
  ],

  // ---- Phase 4: Extended Template Library ----

  skill_progressions: [
    'Bodyweight skill roadmap:\n\n**Push skills**: Push-up → Diamond → Archer → HSPU → Planche\n**Pull skills**: Row → Pull-up → Muscle-up → Front lever\n**Core skills**: Plank → L-sit → V-sit → Dragon flag\n**Balance skills**: Crow → Headstand → Handstand → Press to handstand\n\nMaster each stage fully before attempting the next!',
    "The {currentExercise} is an excellent stepping stone. Once you can do 3×8 with clean form, it's time to progress to the next variation.",
    'Skill unlocks require patience. Most athletes need 3-6 months per tier. Focus on quality — a prettier rep at an easier progression beats an ugly one at a harder one.',
    'Your goal of {goal} maps perfectly to progressive skill work. Each variation teaches motor control that transfers to the next.',
    "Can't do it yet? GOOD. That means you have room to grow. Film yourself monthly — you'll be amazed at the progress.",
  ],

  outdoor_training: [
    'Outdoor training ideas:\n\n🌳 **Park bench**: Step-ups, incline push-ups, dips\n🏗️ **Monkey bars**: Pull-ups, traversals, hanging knee raises\n🏃 **Open space**: Sprint intervals, bear crawls, crab walks\n🧱 **Wall**: Wall sits, handstand practice, wall walks\n\nNature is the original gym!',
    'Training outdoors boosts vitamin D production, improves mood by up to 30%, and adds terrain variety that challenges stabilizer muscles. Take your workout outside today!',
    'Playground workout idea:\n\n1️⃣ Pull-ups on monkey bars — 3×max\n2️⃣ Dips on parallel bars — 3×8-12\n3️⃣ Step-ups on bench — 3×10 each leg\n4️⃣ Hanging leg raises — 3×10\n5️⃣ Sprint 100m × 4 between obstacles\n\nFree gym, fresh air, functional fitness!',
    "Rainy day? Your living room is enough:\n\n🏠 Push-ups, squats, lunges, planks\n🏠 Burpees for cardio\n🏠 Furniture as equipment (chair dips, table rows)\n\nNo weather excuse is valid when you're committed!",
    'The great outdoors has everything — uneven terrain for balance, hills for leg power, bars for pulls, and unlimited space for movement. Your best workouts might happen outside.',
  ],

  plateau_busting: [
    "Stuck on a plateau? Here's your 5-step escape plan:\n\n1️⃣ **Deload week** — 50% intensity for 7 days\n2️⃣ **New stimulus** — Different angles, tempos, or exercises\n3️⃣ **Nutrition audit** — Are you eating enough? Enough protein?\n4️⃣ **Sleep check** — 7-9 hours consistently?\n5️⃣ **Stress management** — High cortisol kills gains\n\nPlateaus are signals your body adapted. Time to evolve!",
    'Tempo manipulation breaks plateaus:\n\n⏱️ **3-1-2-1 tempo** = 3s down, 1s pause, 2s up, 1s top\n\nSlowing the negative phase recruits more muscle fibers than standard speed. Try it for 2 weeks on your main exercises.',
    'Sometimes the answer to a plateau is LESS, not MORE:\n\n📉 Reduce volume by 40% for 1 week\n😴 Sleep 9 hours nightly\n🥩 Increase protein to 2.2g/kg\n🧘 Add daily stretching\n\nSupercompensation happens during recovery. Let your body catch up!',
    "The plateau paradox: You've been training the SAME exercises the SAME way. Your body adapted — that's actually a success! Now we change the variables:\n\n🔄 Exercise selection\n⏱️ Rep tempo\n📊 Volume (sets × reps)\n⏸️ Rest periods\n📈 Difficulty progression",
    "Most plateaus aren't training plateaus — they're recovery plateaus. Before adding more work, try:\n\n💧 Hydrating properly (3L/day)\n😴 Sleeping 8+ hours\n🥩 Hitting 2g protein per kg\n🧘 Active recovery on rest days",
  ],

  personal_records: [
    '🏆 Personal record incoming! Your {currentExercise} numbers have been climbing steadily. This could be the session!',
    'PR mindset: Visualize the perfect rep before you attempt it. Research shows mental rehearsal activates the same neural pathways as actual movement. See it, then do it.',
    "Getting close to a PR? Here's how to peak:\n\n1️⃣ Sleep 8+ hours the night before\n2️⃣ Eat a full meal 2-3 hours before\n3️⃣ Extended warm-up (15 min)\n4️⃣ Build up in small increments\n5️⃣ Attempt when you feel confident — never forced",
    'After hitting a PR, your next session should be at 80% intensity. Let your body consolidate the new level before pushing again.',
    "You've completed {totalWorkouts} workouts. Each one was a building block for your next PR. The foundation is solid — trust your training!",
  ],

  training_partner: [
    'Training solo has advantages: total control over pace, exercise choice, and rest times. Own it!',
    "Solo training discipline is a superpower. Most people need accountability partners — you push yourself. That's rare.",
    'If you do train with someone: match effort, not weight. Different people have different strengths. Push each other on intensity, not ego.',
    "The app is your training partner! I track your progress, adjust difficulty, and keep you honest. You're never really training alone 🙌",
    "Competition with yourself is the healthiest kind. Beat yesterday's you — that's the only scoreboard that matters.",
  ],

  seasonal: [
    'Summer training tips:\n\n☀️ Train early morning or late evening (avoid peak heat)\n💧 Double your water intake on hot days\n🧊 Cold towel on neck between sets\n🌡️ If temp > 35°C, move indoors\n\nHeat amplifies workout stress — respect it!',
    'Winter training motivation:\n\n❄️ Your body works harder in the cold → more calorie burn\n🔥 Warm up longer (10-15 min) in cold weather\n🏠 Bodyweight training at home is always an option\n💪 Summer bodies are built in winter!',
    'Rainy season? Perfect for:\n\n🏠 Indoor bodyweight circuits\n🧘 Yoga and flexibility work\n🧠 FitMind reading sessions\n📱 Review your progress and plan ahead\n\nBad weather is just a plot twist, not the end of the story!',
    'Training in hot weather? Watch for these warning signs:\n\n⚠️ Dizziness or lightheadedness\n⚠️ Excessive sweating or NO sweating\n⚠️ Nausea or confusion\n⚠️ Rapid heartbeat at low intensity\n\nStop immediately if any occur. Hydrate and cool down!',
    "Seasonal periodization: Your body naturally responds to seasons.\n\n🌱 Spring: Build volume gradually\n☀️ Summer: Peak performance\n🍂 Autumn: Maintain and consolidate\n❄️ Winter: Focus on strength and skill\n\nWork with your body's rhythms, not against them!",
  ],

  energy_tips: [
    'Low energy before a workout? Try this:\n\n☕ Caffeine (200mg) 30 minutes before\n🍌 Quick carbs: banana, dates, honey\n🎵 High-tempo music (120+ BPM)\n🧊 Cold water on face and wrists\n🏃 Start with dynamic warm-up — energy follows movement!',
    'Energy management throughout the day:\n\n🌅 Morning: Highest energy → hardest training\n🌤️ Afternoon: Moderate energy → skill work\n🌙 Evening: Lower energy → stretching, mobility\n\nSchedule your toughest workouts when your battery is fullest!',
    "Feeling drained? Check these common causes:\n\n💧 Dehydration (most common)\n😴 Poor sleep quality\n🍗 Not enough carbs or calories\n📱 Screen fatigue / mental overload\n🧘 Accumulated stress\n\nFix the root cause, don't just push through!",
    'Natural energy boosters that actually work:\n\n1️⃣ Cold shower (30-60s) — +30% alertness\n2️⃣ Sunlight in first 30 min of waking\n3️⃣ 5-min walk outdoors\n4️⃣ Deep breathing: 4-7-8 pattern\n5️⃣ Protein-rich snack\n\nNo supplements needed — your body has built-in energy switches!',
    "The warm-up effect: Start moving at 50% intensity and your energy WILL increase. The hardest part is starting. After 5 minutes of light activity, your body produces endorphins and you'll feel ready. Action creates energy, not the other way around.",
  ],

  breathing: [
    'Breathing during exercise is crucial:\n\n**General rule**: Exhale on exertion, inhale on the easier phase.\n\n🏋️ Push-ups: Inhale going down, exhale pushing up\n🏋️ Squats: Inhale down, exhale standing up\n🏋️ Pull-ups: Exhale pulling up, inhale lowering\n\nNever hold your breath during exercise (except Valsalva on max lifts)!',
    'Box breathing for pre-workout calm:\n\n⬜ Inhale 4 seconds\n⬜ Hold 4 seconds\n⬜ Exhale 4 seconds\n⬜ Hold 4 seconds\n\nRepeat 4 cycles. This activates your parasympathetic nervous system and reduces pre-workout anxiety.',
    "Nasal breathing during low-intensity exercise:\n\n👃 Breathe through nose = better oxygen absorption + CO2 tolerance\n👄 Mouth breathing = for high intensity when nose isn't enough\n\n📏 Rule of thumb: If you can't breathe through your nose, you're above zone 2. That's fine for HIIT, but for steady work, slow down.",
    "The Valsalva maneuver (advanced):\n\n1️⃣ Deep breath in before the rep\n2️⃣ Brace core like you're about to get punched\n3️⃣ Hold breath during the hard part\n4️⃣ Exhale at the top\n\n⚠️ Only for max effort lifts. For normal training, breathe continuously!",
    "Recovery breathing after intense sets:\n\n🧘 **Crocodile breathing**: Lie face down, breathe into your belly — you'll feel your stomach push against the floor. This resets your nervous system between hard sets.\n\n3-5 breaths = ready for the next set!",
  ],

  time_management: [
    'Short on time? Try this 15-minute circuit:\n\n⚡ 5 exercises, 45s work / 15s rest, 3 rounds:\n1. Push-ups\n2. Squats\n3. Plank\n4. Lunges\n5. Burpees\n\n15 minutes. Zero excuses. Maximum results!',
    'The 20-minute rule: A focused 20-minute workout beats a distracted 60-minute one. Quality > duration. Set a timer and eliminate distractions.',
    'Time-efficient training strategies:\n\n⏱️ **Supersets**: Pair opposing muscles (push + pull) — no rest needed between\n⏱️ **EMOM**: Every Minute On the Minute — forces efficiency\n⏱️ **Tabata**: 20s on / 10s off × 8 rounds = 4 min for one exercise\n\nYour {sessionMinutes}-minute session is plenty when structured right!',
    "Too busy for the gym? Here's the truth:\n\n📊 You have the same 24 hours as every elite athlete\n⏰ You need just 20-30 min, 3-4 times per week\n📱 That's less time than you spend on social media daily\n\nIt's not about time. It's about priority.",
    'Morning micro-workout: 5 minutes, right when you wake up:\n\n30s plank → 10 push-ups → 10 squats → 10 lunges → 30s plank\n\nDoes it replace a full session? No. But it builds the HABIT. And habits compound!',
  ],

  mindfulness_training: [
    'Mind-muscle connection exercise:\n\n1️⃣ Before each set, close your eyes\n2️⃣ Visualize the target muscle contracting\n3️⃣ Touch the muscle if possible\n4️⃣ Perform the rep focusing on FEELING, not counting\n\nThis can increase muscle activation by 20-30%!',
    'Pre-workout meditation (2 minutes):\n\n🧘 Sit comfortably\n👁️ Close your eyes\n🌬️ 5 deep breaths\n🎯 Set your intention: "Today I will..."\n💪 Visualize yourself completing the workout\n\nMental preparation improves physical performance. Every time.',
    'The 5-4-3-2-1 grounding technique for workout anxiety:\n\n👀 5 things you can see\n✋ 4 things you can touch\n👂 3 things you can hear\n👃 2 things you can smell\n👅 1 thing you can taste\n\nThis brings you into the present moment. Now train.',
    "Between-set visualization:\n\nDuring your rest, visualize your next set going perfectly. See every rep with good form. Feel the muscle working. Hear your breath steady.\n\nAthletes who use visualization perform 13% better than those who don't.",
    'Body scan before training:\n\nFrom head to toe, check each area:\n🧠 Am I mentally present?\n💪 Any tension in shoulders/neck?\n🤚 Wrists feel good?\n🦵 Knees tracking well?\n🦶 Feet planted firmly?\n\n60 seconds of awareness prevents 60 days of injury recovery.',
  ],

  recovery_protocols: [
    'Active recovery playbook:\n\n**Light day options:**\n🚶 30-min walk (zone 1 HR)\n🧘 20-min yoga flow\n🏊 Easy swim laps\n🚴 Light cycling\n🧘 Foam roll full body (15 min)\n\nActive recovery speeds healing vs complete rest!',
    "Cold vs Heat therapy:\n\n🧊 **Cold** (after training): Reduces inflammation, 10-15 min cold shower or ice bath\n♨️ **Heat** (before training or rest day): Increases blood flow, 15-20 min hot bath or sauna\n\n🔄 **Contrast therapy**: Alternate 2 min cold / 3 min hot × 3 rounds\n\nAll three work — pick what you'll actually DO consistently!",
    'Foam rolling guide:\n\n🎯 **Quads**: 90s per leg, pause on tender spots\n🎯 **IT band**: 60s per side\n🎯 **Upper back**: 60s with arms crossed\n🎯 **Calves**: 60s per leg\n🎯 **Glutes**: 60s per side (tennis ball works too)\n\n⚠️ Never roll directly on joints, bones, or the lower back!',
    'Recovery nutrition window:\n\n⏰ **0-30 min**: Fast protein + simple carbs (shake + banana)\n⏰ **1-2 hours**: Full balanced meal (protein + complex carbs + veggies)\n⏰ **Before bed**: Slow protein (cottage cheese, casein)\n\nThe post-workout window is real, but total daily intake matters more.',
    'Signs you need an extra rest day:\n\n🔴 Resting heart rate elevated by 10+ BPM\n🔴 Persistent joint soreness (not muscle soreness)\n🔴 Poor sleep despite fatigue\n🔴 Decreased grip strength\n🔴 Mood irritability or brain fog\n\nTaking one extra rest day now prevents forced rest later. Be smart about it!',
  ],
};

// ============================================
// PROFESSOR RESPONSE TEMPLATES (Expanded)
// ============================================

export const PROFESSOR_TEMPLATES = {
  greeting: [
    'Welcome to your reading session. What are we exploring today?',
    'Ready to dive into "{documentTitle}"? Let\'s uncover some insights.',
    "The mind is a muscle too. Let's exercise it.",
    'Hello, scholar! Ready to expand your understanding?',
    'Another day of growth! What would you like to explore?',
    "The journey of a thousand pages begins with a single chapter. Let's begin.",
  ],
  greeting_morning: [
    'Morning reading! Research shows comprehension peaks in the morning. Perfect timing.',
    'Early reader! Your brain is fresh and ready to absorb new ideas.',
    "Sunrise study session. Let's make the most of this focused time.",
  ],
  greeting_afternoon: [
    'Afternoon learning! Great time to process and connect ideas.',
    'Post-lunch reading. A bit of mental exercise to stay sharp!',
    "Midday knowledge session. Let's keep that momentum going.",
  ],
  greeting_evening: [
    'Evening reading — perfect for reflection and deeper thinking.',
    'Night owl scholar! Some say the best insights come in quiet evening hours.',
    "End your day with wisdom. Let's explore something meaningful.",
  ],
  text_analysis: [
    'Interesting passage! The author seems to be arguing that {insight}. What do you think?',
    'This connects to a broader concept: {relatedTopic}. Have you encountered this before?',
    'Notice the language here — {observation}. Authors choose words deliberately.',
    'The structure of this argument is intentional. Can you identify the logical flow?',
    'This passage uses rhetoric effectively. What persuasion techniques do you notice?',
  ],
  comprehension_check: [
    'Can you summarize the key point of this section in your own words?',
    "What's the strongest evidence the author presents here?",
    'How does this section connect to what you read earlier?',
    'If you had to explain this to someone in 30 seconds, what would you say?',
    "What's the main takeaway you'll remember from this section?",
    'Can you identify three key concepts from this passage?',
    "How would you explain this to a friend who hasn't read it?",
    'What surprised you most about this section?',
  ],
  socratic_prompts: [
    'Why do you think the author chose to present the argument this way?',
    'What assumptions is the author making?',
    'Can you think of a counterargument to this position?',
    'How might this idea apply to your own experience?',
    'What questions does this passage raise for you?',
    'If the author were wrong, what would that imply?',
    'What would a critic of this view say?',
    'Does this argument depend on specific conditions? Which ones?',
    'How might this idea look different in another context or culture?',
    "What's the strongest version of the opposing view?",
  ],
  devils_advocate: [
    'Let me challenge this: what if the opposite were true?',
    "Playing devil's advocate here — isn't this assumption questionable?",
    'An interesting counterpoint: have you considered that...',
    'Some would argue the exact opposite. How would you respond?',
    'What would a skeptic say about this claim?',
  ],
  feynman_technique: [
    'Try explaining this as if you were teaching a child. What simplifications would you make?',
    'Can you explain this without using any jargon? Simple words only.',
    'If you had to draw this concept, what would the diagram look like?',
    'Imagine explaining this to your grandmother. What analogy would work?',
    'Break this down into three simple steps anyone could follow.',
  ],
  reading_encouragement: [
    "You've read {pagesRead} pages today — great focus!",
    'Your reading speed has improved {improvement}% this week. Keep it up!',
    "Reading consistently builds neural pathways — you're literally getting smarter.",
    'Every page is a step toward mastery. Keep going!',
    "Deep reading like this is rare in the age of scrolling. You're doing something valuable.",
    'Concentrated reading = concentrated learning. Well done!',
  ],
  annotation_insight: [
    'You highlighted: "{text}". This is a key concept worth revisiting.',
    'Great observation! You might want to create a flashcard from this highlight.',
    'This connects to your earlier note on page {page}. See a pattern forming?',
    "Interesting highlight! This relates to concepts you've encountered before.",
    "Marking this passage shows good instincts. It's a pivotal point.",
  ],
  flashcard_encouragement: [
    '💡 This concept would make a great flashcard! Shall I create one?',
    "Studies show the testing effect improves retention by 40%. Let's make a flashcard.",
    'Revisiting this later will cement it. Flashcard time?',
    'Your future self will thank you for memorizing this. Add to flashcards?',
    "Spaced repetition is the secret sauce of learning. Let's capture this idea.",
  ],
  reading_streak: {
    '7': [
      "📚 7 days of reading! You're building a powerful habit.",
      'One week of daily reading! Your mind is expanding.',
      "7-day streak! Consistent readers retain 60% more. You're on that path!",
    ],
    '14': [
      '📖 Two weeks of reading! This is becoming second nature.',
      '14 days of feeding your mind. The compound effect kicks in soon!',
      'Half a month of reading! Your future self is grateful.',
    ],
    '30': [
      "🏆 30-day reading streak! You're a certified knowledge enthusiast!",
      'A full month of daily reading! Most people never achieve this.',
      '30 days! Reading is now part of your identity. Beautiful.',
    ],
  },
  document_type: {
    book: [
      "Books demand patience but reward deeply. Let's take our time.",
      'A proper book! This will unfold beautifully over multiple sessions.',
      "Long-form reading builds sustained attention. Let's dive in.",
    ],
    article: [
      "Articles are concentrated knowledge. Let's extract the key insights.",
      'This article format means dense information. Read carefully!',
      "Short-form reading can still be deep. Let's analyze.",
    ],
    research: [
      'Academic reading requires extra attention. Focus on methodology and conclusions.',
      'Research papers need critical reading. Check the evidence carefully.',
      "Scientific literature! Let's evaluate the claims systematically.",
    ],
    technical: [
      'Technical material — best absorbed slowly with examples.',
      'For technical content, try implementing as you read. It sticks better.',
      'Dense technical material. Pause after each section to internalize.',
    ],
  },
  reading_level: {
    beginner: [
      "Don't worry if terms are unfamiliar — we'll break them down together.",
      'New to this topic? Perfect! Curiosity is all you need.',
      "Every expert was once a beginner. Let's build your foundation.",
    ],
    intermediate: [
      "You've got solid foundations. Let's build on them.",
      'This should challenge you just enough. Perfect difficulty!',
      'Connect this to what you already know. See the patterns?',
    ],
    advanced: [
      'Expert-level material! Push your boundaries.',
      "You're ready for nuanced analysis. Let's go deep.",
      "High-level thinking required. I know you're capable.",
    ],
  },
  synthesis: [
    "Try connecting this to something else you've read. What patterns emerge?",
    'How does this relate to your other readings this week?',
    'Can you synthesize this with your prior knowledge?',
    'What other authors would agree or disagree with this?',
    'This idea has connections. Can you trace them?',
  ],
  metacognition: [
    'Rate your understanding from 1-10. What would bring it to a 10?',
    "What part confused you? Let's address that.",
    'Which concept here needs more review later?',
    'If you had to teach this tomorrow, what would you need to clarify first?',
    "What's still unclear? Let's work through it together.",
  ],

  // ---- Phase 4: Extended Professor Templates ----

  note_taking: [
    '📝 Try the **Cornell Method** for this chapter:\n\n| Cues (left) | Notes (right) |\n|---|---|\n| Key questions | Detailed notes from reading |\n| Summary (bottom) | 2-3 sentence recap |\n\nThis structure forces you to process information at three levels!',
    "Active annotation tip: Don't just highlight — write WHY you highlighted it. 'This matters because...' forces deeper processing than passive highlighting.",
    'The **Zettelkasten method**: Each note captures ONE idea in your own words, linked to other ideas. Try writing a single-idea note for the most important concept in this section.',
    'Progressive summarization:\n\n📖 Layer 1: Bold key sentences while reading\n📝 Layer 2: Highlight the boldest points\n🎯 Layer 3: Write a one-sentence summary\n\nEach layer compresses understanding. By layer 3, you truly own the concept.',
    "Margin note challenge: For every page of '{documentTitle}', write one question in the margin. Questions beat highlights for retention every time.",
  ],

  speed_reading: [
    'Speed reading technique — **Pointer Method**:\n\n👆 Use your finger or a pen to guide your eyes along lines\n⏱️ Move your pointer slightly faster than comfortable\n👀 Your eyes naturally follow the pointer, reducing regression\n\nMost readers re-read 15-30% of text unconsciously. A pointer eliminates this!',
    "The 80/20 reading rule: 80% of a book's value is in 20% of its content.\n\n📖 Read the intro and conclusion FIRST\n📖 Scan headings and topic sentences\n📖 Deep-read only the sections that matter\n\nStrategic reading > speed reading for non-fiction.",
    'Current pace: {pagesRead} pages read. To increase reading speed without losing comprehension:\n\n1️⃣ Pre-read: Scan headings, images, and bold text (2 min)\n2️⃣ Question: What do I expect to learn?\n3️⃣ Read: Now read with purpose\n4️⃣ Review: Answer your questions from memory\n\nThis is the SQ3R method — proven since 1946!',
    "Subvocalization (reading 'aloud' in your head) limits speed to ~250 WPM. To break through:\n\n🎵 Try reading while humming softly — it disrupts subvocalization\n👀 Focus on word groups, not individual words\n📏 Widen your peripheral vision to capture 3-4 words at once\n\nTarget: 400-600 WPM with good comprehension.",
    'Rest your eyes every 20 minutes using the 20-20-20 rule:\n\n👀 Every 20 minutes\n🌳 Look at something 20 feet away\n⏱️ For 20 seconds\n\nFresh eyes read faster and retain more!',
  ],

  learning_techniques: [
    '**Spaced repetition** is the single most powerful learning technique:\n\n📊 Review → 1 day → 3 days → 7 days → 14 days → 30 days\n\nYour flashcards already use SM-2 algorithm for this! Keep reviewing them consistently.',
    '**Interleaving**: Instead of reading one topic for hours, alternate between 2-3 topics. This feels harder but produces 30% better long-term retention than blocked study.\n\nFinish a chapter here, switch to another book, then come back.',
    "The **Feynman Technique** in 4 steps:\n\n1️⃣ Choose a concept from '{documentTitle}'\n2️⃣ Explain it as if teaching a 12-year-old\n3️⃣ Identify gaps where your explanation breaks down\n4️⃣ Go back and study those specific gaps\n\nIf you can't explain it simply, you don't understand it yet.",
    '**Elaborative interrogation**: After reading any claim, ask:\n\n❓ WHY is this true?\n❓ HOW does this connect to what I already know?\n❓ WHAT would change if this were false?\n\nThis simple habit doubles retention compared to re-reading.',
    '**Dual coding theory**: Combine WORDS with VISUALS.\n\n🎨 Draw a diagram of the concept you just read\n🗺️ Create a mind map connecting key ideas\n📊 Make a chart comparing concepts\n\nVisual + verbal encoding creates two memory pathways instead of one.',
  ],

  study_scheduling: [
    'Optimal study session structure:\n\n📖 25 min focused reading (Pomodoro)\n☕ 5 min break (stand, stretch, hydrate)\n📖 25 min focused reading\n🚶 15 min longer break\n\nRepeat 2-4 cycles. Quality declines sharply after 90 min without breaks.',
    "Weekly reading plan for '{documentTitle}':\n\n📅 Mon-Fri: 20 min focused reading\n📅 Saturday: Review notes and flashcards\n📅 Sunday: Reflect and plan next week\n\nAt 20 min/day × 300 WPM, you'll cover ~24,000 words per week — roughly 80 pages!",
    "The **Sunday Preview**: Spend 10 minutes every Sunday scanning the week's reading material.\n\n📋 What topics will you cover?\n🎯 What do you already know about them?\n❓ What questions do you have?\n\nPre-exposure primes your brain to absorb information faster during the actual read.",
    'Your reading streak is {streakDays} days! To maintain momentum:\n\n🔥 Set a MINIMUM daily goal (even 5 min counts)\n📱 Read at the same time every day (habit stacking)\n📖 Keep your book accessible (phone > shelf)\n🏆 Celebrate small wins\n\nConsistency beats intensity for learning!',
    "Energy-matched reading:\n\n🌅 **Morning** (high energy): Tackle complex, technical material\n🌤️ **Afternoon** (moderate): General non-fiction, analysis\n🌙 **Evening** (winding down): Light reading, fiction, reviews\n\nDon't fight your biology — work with it!",
  ],

  critical_thinking: [
    'Critical reading framework for this passage:\n\n🔍 **Claim**: What is the author arguing?\n📊 **Evidence**: What support do they provide?\n🤔 **Assumptions**: What unstated beliefs underlie the argument?\n⚖️ **Alternatives**: What other explanations exist?\n🎯 **Implications**: If true, what follows?\n\nApply this to the most controversial claim in this chapter.',
    "The **CRAAP test** for evaluating sources:\n\n📅 **Currency**: When was this written? Still relevant?\n🎯 **Relevance**: Does it relate to your question?\n👤 **Authority**: Who wrote it? What are their credentials?\n🎭 **Accuracy**: Is it supported by evidence?\n🏷️ **Purpose**: Why was this written? To inform, persuade, sell?\n\nApply this to '{documentTitle}' — how does it score?",
    "Logical fallacy spotter — watch for:\n\n⚠️ **Ad hominem**: Attacking the person, not the argument\n⚠️ **Straw man**: Misrepresenting the opposing view\n⚠️ **Appeal to authority**: 'Expert X says so' without evidence\n⚠️ **False dichotomy**: Presenting only two options when more exist\n⚠️ **Correlation ≠ causation**: Two things happening together ≠ one causes the other\n\nDid you spot any in your recent reading?",
    "Steel-manning exercise: Take the author's weakest argument in this chapter and make it STRONGER. What's the best possible version of their case?\n\nThis builds intellectual honesty and deepens understanding far more than just criticizing weak points.",
    'Perspective shift: Re-read the last section from the perspective of someone who DISAGREES with the author.\n\n❓ What would they object to?\n❓ What evidence would they cite?\n❓ Where is the author most vulnerable?\n\nTrue understanding requires seeing all sides.',
  ],

  book_discussion: [
    "If you were in a book club discussing '{documentTitle}', what's the ONE passage you'd read aloud to spark debate? Tag it with a bookmark annotation!",
    'Discussion question: How does the main idea of this chapter connect to something happening in the real world RIGHT NOW? Making current connections deepens retention.',
    "Author's intent analysis: Why do you think the author chose to present the information in this order? What effect does the structure have on the reader?",
    'Rate this chapter: 📊\n\n⭐ Clarity (1-5): How clearly were ideas presented?\n⭐ Evidence (1-5): How well-supported were claims?\n⭐ Relevance (1-5): How useful is this to your goals?\n⭐ Engagement (1-5): How interesting was it?\n\nWriting brief reviews builds critical analysis skills!',
    'Connection web: List 3 other books, articles, or experiences that relate to what you just read. How do they agree or disagree? Building a network of connected knowledge is the ultimate sign of deep learning.',
  ],

  research_methods: [
    "Active reading for research:\n\n📋 Before reading: Write 3 specific questions you want answered\n📖 While reading: Note which questions get answered (and which don't)\n📝 After reading: Summarize findings in your own words\n\nDirected reading is 3x more effective than passive scanning.",
    'Source evaluation shortcut:\n\n1️⃣ Read the abstract/introduction\n2️⃣ Read the conclusion\n3️⃣ Scan the methodology\n4️⃣ Check the references\n\nIf all four check out, THEN read the full text. This saves time on low-quality sources.',
    'Literature mapping: As you read across multiple documents, build a simple matrix:\n\n| Source | Main Claim | Evidence Quality | Agrees With | Disagrees With |\n|---|---|---|---|---|\n\nThis reveals consensus, gaps, and contradictions in your reading.',
    'The research question funnel:\n\n🌐 Broad: What is this topic about?\n🔍 Narrow: What specific aspect interests me?\n🎯 Specific: What exact question can I answer?\n\nGood research starts with a question sharp enough to cut through noise.',
    "Synthesis over summary: Don't just summarize individual sources. Ask:\n\n🔗 How do these sources CONNECT to each other?\n⚡ Where do they CONFLICT?\n🕳️ What GAPS exist that none of them address?\n\nSynthesis creates new understanding. Summary just repeats old understanding.",
  ],
};
