#!/usr/bin/env python3
"""
FitQuest AI — FitCoach Training Data Generator
Generates workout plan examples using expert rules engine.
Each example: user profile → optimal workout plan.
"""

import json
import os
import random
import uuid
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict, field


# ============================================
# EXERCISE DATABASE
# ============================================

EXERCISES = {
    # CHEST
    'barbell_bench_press': {
        'name': 'Barbell Bench Press', 'primary': ['chest'], 'secondary': ['triceps', 'shoulders'],
        'equipment': ['barbell'], 'difficulty': 3, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [3, 5], 'rest': 180, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [8, 12], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 60, 'rpe': 7},
    },
    'dumbbell_fly': {
        'name': 'Dumbbell Fly', 'primary': ['chest'], 'secondary': ['shoulders'],
        'equipment': ['dumbbell'], 'difficulty': 2, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [6, 8], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 45, 'rpe': 7},
    },
    'pushup': {
        'name': 'Push-Up', 'primary': ['chest'], 'secondary': ['triceps', 'shoulders', 'core'],
        'equipment': ['bodyweight'], 'difficulty': 1, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [5, 10], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [12, 20], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [20, 30], 'rest': 45, 'rpe': 7},
    },
    'incline_dumbbell_press': {
        'name': 'Incline Dumbbell Press', 'primary': ['chest', 'shoulders'], 'secondary': ['triceps'],
        'equipment': ['dumbbell'], 'difficulty': 2, 'category': 'compound',
        'strength': {'sets': 4, 'reps': [5, 8], 'rest': 150, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [8, 12], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [12, 18], 'rest': 60, 'rpe': 7},
    },

    # BACK
    'deadlift': {
        'name': 'Barbell Deadlift', 'primary': ['back', 'hamstrings', 'glutes'], 'secondary': ['core', 'forearms'],
        'equipment': ['barbell'], 'difficulty': 4, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [1, 5], 'rest': 240, 'rpe': 9},
        'hypertrophy': {'sets': 3, 'reps': [6, 10], 'rest': 180, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [12, 15], 'rest': 120, 'rpe': 7},
    },
    'pullup': {
        'name': 'Pull-Up', 'primary': ['back', 'biceps'], 'secondary': ['core', 'shoulders'],
        'equipment': ['bodyweight'], 'difficulty': 3, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [3, 6], 'rest': 180, 'rpe': 9},
        'hypertrophy': {'sets': 4, 'reps': [8, 12], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [12, 20], 'rest': 60, 'rpe': 7},
    },
    'barbell_row': {
        'name': 'Barbell Row', 'primary': ['back', 'biceps'], 'secondary': ['core'],
        'equipment': ['barbell'], 'difficulty': 3, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [5, 8], 'rest': 180, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [8, 12], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [12, 15], 'rest': 60, 'rpe': 7},
    },
    'lat_pulldown': {
        'name': 'Lat Pulldown', 'primary': ['back', 'biceps'], 'secondary': ['shoulders'],
        'equipment': ['cable', 'machine'], 'difficulty': 2, 'category': 'compound',
        'strength': {'sets': 4, 'reps': [6, 8], 'rest': 150, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 12], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 60, 'rpe': 7},
    },
    'dumbbell_row': {
        'name': 'Single-Arm Dumbbell Row', 'primary': ['back', 'biceps'], 'secondary': ['core'],
        'equipment': ['dumbbell'], 'difficulty': 2, 'category': 'compound',
        'strength': {'sets': 4, 'reps': [6, 10], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 60, 'rpe': 7},
    },

    # LEGS
    'squat': {
        'name': 'Barbell Squat', 'primary': ['quadriceps', 'glutes'], 'secondary': ['hamstrings', 'core', 'back'],
        'equipment': ['barbell'], 'difficulty': 4, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [3, 5], 'rest': 240, 'rpe': 9},
        'hypertrophy': {'sets': 4, 'reps': [6, 10], 'rest': 180, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [12, 20], 'rest': 120, 'rpe': 7},
    },
    'leg_press': {
        'name': 'Leg Press', 'primary': ['quadriceps', 'glutes'], 'secondary': ['hamstrings'],
        'equipment': ['machine'], 'difficulty': 2, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [5, 8], 'rest': 180, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 120, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 25], 'rest': 90, 'rpe': 7},
    },
    'romanian_deadlift': {
        'name': 'Romanian Deadlift', 'primary': ['hamstrings', 'glutes'], 'secondary': ['back', 'core'],
        'equipment': ['barbell', 'dumbbell'], 'difficulty': 3, 'category': 'compound',
        'strength': {'sets': 4, 'reps': [6, 8], 'rest': 180, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [8, 12], 'rest': 120, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [12, 15], 'rest': 90, 'rpe': 7},
    },
    'leg_curl': {
        'name': 'Leg Curl', 'primary': ['hamstrings'], 'secondary': [],
        'equipment': ['machine'], 'difficulty': 1, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [6, 10], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 45, 'rpe': 7},
    },
    'calf_raise': {
        'name': 'Standing Calf Raise', 'primary': ['calves'], 'secondary': [],
        'equipment': ['machine', 'barbell', 'bodyweight'], 'difficulty': 1, 'category': 'isolation',
        'strength': {'sets': 5, 'reps': [5, 8], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 5, 'reps': [12, 20], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 4, 'reps': [20, 30], 'rest': 45, 'rpe': 7},
    },
    'lunges': {
        'name': 'Walking Lunge', 'primary': ['quadriceps', 'glutes'], 'secondary': ['hamstrings', 'core'],
        'equipment': ['barbell', 'dumbbell', 'bodyweight'], 'difficulty': 2, 'category': 'compound',
        'strength': {'sets': 4, 'reps': [6, 10], 'rest': 150, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 60, 'rpe': 7},
    },
    'goblet_squat': {
        'name': 'Goblet Squat', 'primary': ['quadriceps', 'glutes'], 'secondary': ['core'],
        'equipment': ['dumbbell', 'kettlebell'], 'difficulty': 1, 'category': 'compound',
        'strength': {'sets': 4, 'reps': [6, 10], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 60, 'rpe': 7},
    },

    # SHOULDERS
    'overhead_press': {
        'name': 'Overhead Press', 'primary': ['shoulders', 'triceps'], 'secondary': ['core'],
        'equipment': ['barbell', 'dumbbell'], 'difficulty': 3, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [3, 6], 'rest': 180, 'rpe': 9},
        'hypertrophy': {'sets': 4, 'reps': [8, 12], 'rest': 120, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [12, 15], 'rest': 90, 'rpe': 7},
    },
    'lateral_raise': {
        'name': 'Lateral Raise', 'primary': ['shoulders'], 'secondary': [],
        'equipment': ['dumbbell', 'cable'], 'difficulty': 1, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [8, 12], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 5, 'reps': [12, 20], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 4, 'reps': [20, 25], 'rest': 45, 'rpe': 7},
    },
    'face_pull': {
        'name': 'Face Pull', 'primary': ['shoulders', 'upper_back'], 'secondary': ['biceps'],
        'equipment': ['cable'], 'difficulty': 1, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [10, 15], 'rest': 90, 'rpe': 7},
        'hypertrophy': {'sets': 4, 'reps': [15, 20], 'rest': 60, 'rpe': 8},
        'endurance': {'sets': 3, 'reps': [20, 25], 'rest': 45, 'rpe': 7},
    },

    # ARMS
    'barbell_curl': {
        'name': 'Barbell Curl', 'primary': ['biceps'], 'secondary': ['forearms'],
        'equipment': ['barbell'], 'difficulty': 2, 'category': 'isolation',
        'strength': {'sets': 5, 'reps': [5, 8], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 5, 'reps': [10, 15], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 4, 'reps': [15, 20], 'rest': 45, 'rpe': 7},
    },
    'tricep_dip': {
        'name': 'Tricep Dip', 'primary': ['triceps'], 'secondary': ['chest', 'shoulders'],
        'equipment': ['bodyweight', 'machine'], 'difficulty': 2, 'category': 'compound',
        'strength': {'sets': 5, 'reps': [5, 10], 'rest': 150, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 25], 'rest': 60, 'rpe': 7},
    },
    'hammer_curl': {
        'name': 'Hammer Curl', 'primary': ['biceps', 'forearms'], 'secondary': [],
        'equipment': ['dumbbell'], 'difficulty': 1, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [6, 10], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 45, 'rpe': 7},
    },
    'tricep_pushdown': {
        'name': 'Tricep Pushdown', 'primary': ['triceps'], 'secondary': [],
        'equipment': ['cable'], 'difficulty': 1, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [6, 10], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 45, 'rpe': 7},
    },

    # CORE
    'plank': {
        'name': 'Plank', 'primary': ['core'], 'secondary': ['shoulders', 'back'],
        'equipment': ['bodyweight'], 'difficulty': 1, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [30, 60], 'rest': 60, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [45, 90], 'rest': 45, 'rpe': 8},
        'endurance': {'sets': 3, 'reps': [60, 120], 'rest': 30, 'rpe': 7},
    },
    'hanging_leg_raise': {
        'name': 'Hanging Leg Raise', 'primary': ['core'], 'secondary': ['forearms'],
        'equipment': ['bodyweight'], 'difficulty': 3, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [6, 10], 'rest': 120, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [10, 15], 'rest': 90, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [15, 20], 'rest': 60, 'rpe': 7},
    },
    'russian_twist': {
        'name': 'Russian Twist', 'primary': ['core'], 'secondary': [],
        'equipment': ['bodyweight', 'dumbbell', 'medicine_ball'], 'difficulty': 2, 'category': 'isolation',
        'strength': {'sets': 4, 'reps': [10, 15], 'rest': 90, 'rpe': 8},
        'hypertrophy': {'sets': 4, 'reps': [15, 25], 'rest': 60, 'rpe': 9},
        'endurance': {'sets': 3, 'reps': [25, 40], 'rest': 45, 'rpe': 7},
    },
}

EXERCISE_LIST = list(EXERCISES.keys())

ALL_EQUIPMENT = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight',
                 'resistance_band', 'medicine_ball']

ALL_MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core',
               'quadriceps', 'hamstrings', 'glutes', 'calves', 'forearms']

MUSCLE_GROUPS = {
    'chest': ['chest'],
    'back': ['back'],
    'legs': ['quadriceps', 'hamstrings', 'glutes', 'calves'],
    'shoulders': ['shoulders'],
    'arms': ['biceps', 'triceps', 'forearms'],
    'core': ['core'],
    'full_body': ALL_MUSCLES,
    'upper_body': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
    'lower_body': ['quadriceps', 'hamstrings', 'glutes', 'calves'],
}

INJURY_CONTRAINDICATIONS = {
    'shoulder': ['overhead_press', 'lateral_raise', 'barbell_bench_press'],
    'knee': ['squat', 'lunges', 'leg_press'],
    'back': ['deadlift', 'barbell_row', 'romanian_deadlift'],
    'wrist': ['barbell_bench_press', 'barbell_curl', 'barbell_row'],
    'elbow': ['tricep_dip', 'barbell_curl', 'pushup'],
}


def get_exercises_for_muscles(target_muscles: List[str], equipment: List[str],
                               injuries: List[str]) -> List[str]:
    """Filter exercises matching constraints"""
    available = []
    blocked = set()
    for injury in injuries:
        blocked.update(INJURY_CONTRAINDICATIONS.get(injury, []))

    for ex_id, ex in EXERCISES.items():
        if ex_id in blocked:
            continue
        # Equipment check
        if not any(eq in equipment for eq in ex['equipment']):
            continue
        # Muscle relevance
        if any(m in ex['primary'] for m in target_muscles):
            available.append(ex_id)

    return available


def generate_workout(profile: Dict) -> Dict:
    """Generate one workout from a user profile using expert rules"""
    experience = profile['experience']
    goal = profile['goal']
    time_minutes = profile['available_time']
    equipment = profile['equipment']
    fatigue_map = profile['fatigue_map']
    injuries = profile.get('injuries', [])
    target_group = profile['target_group']

    # Resolve target muscles
    target_muscles = MUSCLE_GROUPS.get(target_group, [target_group])

    # Determine exercise count
    if time_minutes <= 20:
        num_exercises = 3
    elif time_minutes <= 30:
        num_exercises = 4
    elif time_minutes <= 45:
        num_exercises = 5
    elif time_minutes <= 60:
        num_exercises = 6
    else:
        num_exercises = 8

    # Adjust for experience
    if experience == 'beginner':
        num_exercises = min(num_exercises, 5)

    # Get available exercises
    available = get_exercises_for_muscles(target_muscles, equipment, injuries)
    if not available:
        # Fallback to bodyweight
        available = get_exercises_for_muscles(target_muscles, ['bodyweight'], injuries)

    # Sort by difficulty match and fatigue
    exp_difficulty = {'beginner': 1, 'intermediate': 3, 'advanced': 4}[experience]

    def score_exercise(ex_id):
        ex = EXERCISES[ex_id]
        # Prefer compound first
        compound_bonus = 2 if ex['category'] == 'compound' else 0
        # Match difficulty
        diff_penalty = abs(ex['difficulty'] - exp_difficulty)
        # Low fatigue preferred
        fatigue_penalty = max(fatigue_map.get(m, 0) for m in ex['primary']) * 0.3
        return compound_bonus - diff_penalty - fatigue_penalty

    available.sort(key=score_exercise, reverse=True)

    # Select exercises ensuring diversity
    selected = []
    used_muscles = set()
    for ex_id in available:
        if len(selected) >= num_exercises:
            break
        ex = EXERCISES[ex_id]
        # Don't double-stack same primary muscle too much
        primary_overlap = sum(1 for m in ex['primary'] if m in used_muscles)
        if primary_overlap >= 2 and len(selected) > 2:
            continue
        selected.append(ex_id)
        used_muscles.update(ex['primary'])

    # Generate workout exercises with params
    workout_exercises = []
    for ex_id in selected:
        ex = EXERCISES[ex_id]

        # Get goal-specific params
        goal_key = goal if goal in ('strength', 'hypertrophy', 'endurance') else 'hypertrophy'
        params = ex[goal_key].copy()

        # Fatigue adjustment
        primary_fatigue = max(fatigue_map.get(m, 0) for m in ex['primary'])
        if primary_fatigue > 7:
            params['sets'] = max(2, params['sets'] - 2)
            params['rpe'] = max(6, params['rpe'] - 2)
        elif primary_fatigue > 5:
            params['sets'] = max(2, params['sets'] - 1)
            params['rpe'] = max(7, params['rpe'] - 1)

        # Experience adjustment
        if experience == 'beginner':
            params['sets'] = max(2, params['sets'] - 1)
            params['rpe'] = min(8, params['rpe'])

        # Fat loss: shorter rest
        if goal == 'fat_loss':
            params['rest'] = int(params['rest'] * 0.7)

        # Select reps from range
        reps = random.randint(params['reps'][0], params['reps'][1])

        workout_exercises.append({
            'exercise_id': ex_id,
            'exercise_name': ex['name'],
            'sets': params['sets'],
            'reps': reps,
            'rest_seconds': params['rest'],
            'rpe_target': params['rpe'],
            'category': ex['category'],
            'primary_muscles': ex['primary'],
        })

    # Generate reasoning
    reasons = []
    goal_reasons = {
        'strength': "Heavy loads with longer rest periods maximize neural drive and strength gains",
        'hypertrophy': "Moderate reps with controlled tempo optimize muscle protein synthesis",
        'endurance': "Higher rep ranges with shorter rest build muscular endurance",
        'fat_loss': "Circuit-style training with reduced rest maximizes metabolic demand",
        'maintenance': "Balanced volume maintains current fitness level",
    }
    reasons.append(goal_reasons.get(goal, "Balanced approach for overall fitness"))

    high_fatigue = [m for m, f in fatigue_map.items() if f > 6]
    if high_fatigue:
        reasons.append(f"Reduced volume for {', '.join(high_fatigue)} due to accumulated fatigue")

    compound_count = sum(1 for ex in workout_exercises if ex['category'] == 'compound')
    reasons.append(f"{compound_count} compound exercises for maximum efficiency")

    # Estimate duration
    total_seconds = 0
    for ex in workout_exercises:
        work_time = ex['sets'] * ex['reps'] * 3  # ~3s per rep
        rest_time = (ex['sets'] - 1) * ex['rest_seconds']
        total_seconds += work_time + rest_time
    total_seconds += 600  # warmup + cooldown
    duration = min(total_seconds // 60, time_minutes)

    return {
        'exercises': workout_exercises,
        'total_duration': duration,
        'target_group': target_group,
        'is_deload': any(fatigue_map.get(m, 0) > 8 for m in target_muscles),
        'reasoning': '. '.join(reasons),
        'compound_count': compound_count,
        'isolation_count': len(workout_exercises) - compound_count,
    }


def encode_profile(profile: Dict) -> List[float]:
    """Encode user profile as fixed-size feature vector"""
    vec = []

    # Experience: one-hot [3]
    exp_map = {'beginner': 0, 'intermediate': 1, 'advanced': 2}
    exp_vec = [0.0, 0.0, 0.0]
    exp_vec[exp_map[profile['experience']]] = 1.0
    vec.extend(exp_vec)

    # Goal: one-hot [5]
    goal_map = {'strength': 0, 'hypertrophy': 1, 'endurance': 2, 'fat_loss': 3, 'maintenance': 4}
    goal_vec = [0.0] * 5
    goal_vec[goal_map[profile['goal']]] = 1.0
    vec.extend(goal_vec)

    # Time: normalized [1]
    vec.append(profile['available_time'] / 120.0)

    # Equipment: multi-hot [8]
    equip_vec = [1.0 if e in profile['equipment'] else 0.0 for e in ALL_EQUIPMENT]
    vec.extend(equip_vec)

    # Fatigue: normalized [6]
    fatigue_muscles = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core']
    fatigue_vec = [profile['fatigue_map'].get(m, 0) / 10.0 for m in fatigue_muscles]
    vec.extend(fatigue_vec)

    # Target group: one-hot [9]
    groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core',
              'full_body', 'upper_body', 'lower_body']
    target_vec = [1.0 if g == profile['target_group'] else 0.0 for g in groups]
    vec.extend(target_vec)

    # Injuries: multi-hot [5]
    injury_types = ['shoulder', 'knee', 'back', 'wrist', 'elbow']
    injury_vec = [1.0 if i in profile.get('injuries', []) else 0.0 for i in injury_types]
    vec.extend(injury_vec)

    return vec  # Total: 3+5+1+8+6+9+5 = 37 features


def encode_workout(workout: Dict) -> List[float]:
    """Encode workout as fixed-size output vector"""
    vec = []
    max_exercises = 8

    for i in range(max_exercises):
        if i < len(workout['exercises']):
            ex = workout['exercises'][i]
            ex_idx = EXERCISE_LIST.index(ex['exercise_id']) / len(EXERCISE_LIST)
            vec.extend([
                ex_idx,
                ex['sets'] / 10.0,
                ex['reps'] / 30.0,
                ex['rest_seconds'] / 300.0,
                ex['rpe_target'] / 10.0,
            ])
        else:
            vec.extend([-1.0, 0.0, 0.0, 0.0, 0.0])  # Padding

    return vec  # 8 * 5 = 40 features


def generate_random_profile() -> Dict:
    """Generate a realistic random user profile"""
    experience = random.choice(['beginner', 'intermediate', 'advanced'])
    goal = random.choice(['strength', 'hypertrophy', 'endurance', 'fat_loss', 'maintenance'])
    time = random.choice([20, 30, 45, 60, 90])
    equipment = random.sample(ALL_EQUIPMENT[:6], k=random.randint(2, 5))  # First 6 common

    # Ensure bodyweight always available
    if 'bodyweight' not in equipment:
        equipment.append('bodyweight')

    fatigue_map = {
        'chest': random.randint(0, 10),
        'back': random.randint(0, 10),
        'shoulders': random.randint(0, 10),
        'arms': random.randint(0, 8),
        'legs': random.randint(0, 10),
        'core': random.randint(0, 6),
    }

    injuries = []
    if random.random() < 0.2:
        injuries = random.sample(['shoulder', 'knee', 'back', 'wrist', 'elbow'], k=1)

    target_group = random.choice(['chest', 'back', 'legs', 'shoulders', 'arms',
                                  'core', 'full_body', 'upper_body', 'lower_body'])

    return {
        'experience': experience,
        'goal': goal,
        'available_time': time,
        'equipment': equipment,
        'fatigue_map': fatigue_map,
        'injuries': injuries,
        'target_group': target_group,
    }


def main():
    print("=" * 60)
    print("🏋️ Generating FitCoach Training Data")
    print("=" * 60)

    num_samples = 50000
    dataset = []

    for i in range(num_samples):
        profile = generate_random_profile()
        workout = generate_workout(profile)

        encoded_input = encode_profile(profile)
        encoded_output = encode_workout(workout)

        dataset.append({
            'profile': profile,
            'workout': workout,
            'encoded_input': encoded_input,
            'encoded_output': encoded_output,
        })

        if (i + 1) % 5000 == 0:
            print(f"  Generated {i + 1}/{num_samples} samples...")

    random.shuffle(dataset)

    os.makedirs('output', exist_ok=True)

    split = int(0.9 * len(dataset))
    train_data = dataset[:split]
    test_data = dataset[split:]

    with open('output/fitcoach_train.jsonl', 'w') as f:
        for item in train_data:
            f.write(json.dumps(item) + '\n')

    with open('output/fitcoach_test.jsonl', 'w') as f:
        for item in test_data:
            f.write(json.dumps(item) + '\n')

    print(f"\n✅ Generated {len(dataset)} workout examples")
    print(f"   Train: {len(train_data)}")
    print(f"   Test:  {len(test_data)}")
    print(f"   Input dim:  {len(dataset[0]['encoded_input'])} features")
    print(f"   Output dim: {len(dataset[0]['encoded_output'])} features")

    # Sample
    sample = dataset[0]
    print(f"\n📋 Sample profile:")
    print(f"   Experience: {sample['profile']['experience']}")
    print(f"   Goal: {sample['profile']['goal']}")
    print(f"   Time: {sample['profile']['available_time']}min")
    print(f"   Target: {sample['profile']['target_group']}")
    print(f"   Exercises: {len(sample['workout']['exercises'])}")
    for ex in sample['workout']['exercises']:
        print(f"     - {ex['exercise_name']}: {ex['sets']}x{ex['reps']} @ RPE {ex['rpe_target']}")


if __name__ == '__main__':
    main()
