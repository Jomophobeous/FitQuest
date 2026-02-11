#!/usr/bin/env python3
"""
FitQuest AI — Intent Router Training Data Generator
Generates synthetic labeled examples for all 8 intent categories.
No manual labeling required — templates + entity substitution.
"""

import json
import random
from typing import List, Dict
from collections import Counter

class IntentDataGenerator:
    def __init__(self):
        self.intents = {
            'WORKOUT_GENERATION': {
                'templates': [
                    "Create a {muscle} workout",
                    "I want to train {muscle}",
                    "Give me a {muscle} routine",
                    "What's a good {muscle} workout?",
                    "Build me a {duration} minute {muscle} session",
                    "I need {muscle} exercises",
                    "Plan a {muscle} day for me",
                    "Suggest a {muscle} workout",
                    "Help me work on my {muscle}",
                    "Design a {muscle} routine",
                    "{muscle} workout for {experience}",
                    "Quick {muscle} workout",
                    "Intense {muscle} session",
                    "Beginner {muscle} routine",
                    "Advanced {muscle} program",
                    "Can you make me a {muscle} plan?",
                    "I want a {duration} minute workout targeting {muscle}",
                    "Build a {experience} {muscle} workout",
                    "Generate {muscle} exercises for today",
                    "What should I do for {muscle} today?",
                    "Create a push pull routine",
                    "Make me a full body workout",
                    "Give me something for {muscle}",
                    "Need a workout for {muscle}",
                    "Design an upper body session",
                    "Plan my leg day",
                    "Create a HIIT routine",
                    "Build a bodyweight workout",
                    "Make a {duration} minute session",
                    "I need a workout plan",
                ],
                'entities': {
                    'muscle': ['chest', 'back', 'legs', 'shoulders', 'arms', 'core',
                               'biceps', 'triceps', 'full body', 'upper body', 'lower body',
                               'glutes', 'quads', 'hamstrings', 'abs'],
                    'duration': ['15', '20', '30', '45', '60', '90'],
                    'experience': ['beginners', 'intermediates', 'advanced', 'newbies', 'pros']
                }
            },

            'FORM_CHECK': {
                'templates': [
                    "How do I do a {exercise}?",
                    "Is my {exercise} form correct?",
                    "Show me {exercise} technique",
                    "What's the proper way to {exercise}?",
                    "Teach me {exercise}",
                    "Common mistakes in {exercise}",
                    "Why does {exercise} hurt my {body_part}?",
                    "{exercise} form tips",
                    "How to improve {exercise}",
                    "Correct {exercise} posture",
                    "What muscles does {exercise} work?",
                    "Am I doing {exercise} right?",
                    "Tips for better {exercise}",
                    "{exercise} form check",
                    "How to avoid injury during {exercise}",
                    "Should my {body_part} hurt during {exercise}?",
                    "Proper {exercise} form for beginners",
                    "How wide should my grip be for {exercise}?",
                    "How deep should I go on {exercise}?",
                    "Breathing technique for {exercise}",
                ],
                'entities': {
                    'exercise': ['squat', 'deadlift', 'bench press', 'pullup', 'pushup',
                                 'overhead press', 'row', 'lunge', 'plank', 'dip',
                                 'curl', 'crunch', 'burpee', 'clean', 'snatch'],
                    'body_part': ['knee', 'back', 'shoulder', 'wrist', 'elbow', 'hip',
                                  'neck', 'ankle', 'lower back']
                }
            },

            'DOCUMENT_SUMMARY': {
                'templates': [
                    "Summarize this",
                    "Give me the summary",
                    "TLDR this chapter",
                    "What are the main points?",
                    "Condense this for me",
                    "Brief overview please",
                    "Key takeaways?",
                    "Summarize the document",
                    "Short version",
                    "Executive summary",
                    "Sum up what I just read",
                    "Can you summarize this page?",
                    "What's the gist?",
                    "Break this down for me",
                    "Give me the highlights",
                    "Cliff notes version",
                    "Main ideas of this section",
                    "Boil this down",
                    "What's the bottom line?",
                    "Quick recap please",
                ],
                'entities': {}
            },

            'DOCUMENT_QUESTION': {
                'templates': [
                    "What does this mean?",
                    "Explain this paragraph",
                    "Why does the author say this?",
                    "What is {concept}?",
                    "How does {concept} work?",
                    "Compare {concept_a} and {concept_b}",
                    "What are the implications of {concept}?",
                    "Define {term}",
                    "Clarify this section",
                    "What should I learn from this?",
                    "I don't understand this part",
                    "Can you explain {concept} in simple terms?",
                    "What does the author mean by {term}?",
                    "Is {concept} related to {concept_b}?",
                    "Why is {concept} important?",
                    "What's the difference between {concept_a} and {concept_b}?",
                    "Help me understand this",
                    "What's the significance of {concept}?",
                    "Quiz me on this chapter",
                    "Test my understanding of {concept}",
                ],
                'entities': {
                    'concept': ['this', 'the main idea', 'the theory', 'the method',
                                'the approach', 'the framework', 'the model', 'the hypothesis',
                                'the argument', 'the evidence'],
                    'term': ['this term', 'this concept', 'this phrase',
                             'this word', 'this definition', 'this principle'],
                    'concept_a': ['this', 'the first approach', 'theory A',
                                  'the old method', 'the traditional view'],
                    'concept_b': ['that', 'the second approach', 'theory B',
                                  'the new method', 'the modern view']
                }
            },

            'HEALTH_QUERY': {
                'templates': [
                    "How many calories did I burn?",
                    "What's my heart rate?",
                    "Show my sleep data",
                    "How did I sleep last night?",
                    "What's my recovery score?",
                    "Am I overtraining?",
                    "Check my health stats",
                    "Weekly activity summary",
                    "My fitness progress",
                    "Body fat percentage?",
                    "Weight trend",
                    "Steps today",
                    "How many steps have I taken?",
                    "What's my BMI?",
                    "Show my calorie intake",
                    "Am I getting enough sleep?",
                    "What's my resting heart rate?",
                    "Health report for this week",
                    "How active was I yesterday?",
                    "Show my workout history",
                    "Am I in a calorie deficit?",
                    "What's my TDEE?",
                    "How much water should I drink?",
                    "My recovery status",
                    "Daily health summary",
                ],
                'entities': {}
            },

            'ACTIVITY_TRACKING': {
                'templates': [
                    "Start tracking my run",
                    "Begin workout",
                    "Start {activity}",
                    "Track {activity}",
                    "I'm going for a {activity}",
                    "Begin {activity} session",
                    "Start monitoring",
                    "Record my {activity}",
                    "Track my exercise",
                    "Start fitness tracking",
                    "Log a {activity}",
                    "I'm about to {activity}",
                    "Start a {activity} session",
                    "Ready to {activity}",
                    "Let's go for a {activity}",
                    "Start the timer",
                    "Begin tracking",
                    "Start my workout timer",
                    "I'm starting my {activity}",
                    "Track my steps",
                ],
                'entities': {
                    'activity': ['run', 'walk', 'jog', 'bike ride', 'hike', 'swim',
                                 'workout', 'exercise', 'sprint', 'cycle']
                }
            },

            'GREETING': {
                'templates': [
                    "Hey",
                    "Hello",
                    "Hi there",
                    "Good morning",
                    "Good evening",
                    "What's up?",
                    "How are you?",
                    "Hey FitQuest",
                    "Morning",
                    "Evening",
                    "Hi",
                    "Yo",
                    "Sup",
                    "Good afternoon",
                    "Hello there",
                    "Hey buddy",
                    "What's going on?",
                    "Howdy",
                    "Greetings",
                    "Hey coach",
                ],
                'entities': {}
            },

            'FAREWELL': {
                'templates': [
                    "Bye",
                    "Goodbye",
                    "See you",
                    "Thanks, bye",
                    "That's all",
                    "Done for today",
                    "Catch you later",
                    "Signing off",
                    "See you later",
                    "Peace out",
                    "Later",
                    "I'm done",
                    "Thanks for the help",
                    "Gotta go",
                    "Talk to you later",
                    "Good night",
                    "Until next time",
                    "Thanks, that's all",
                    "Bye for now",
                    "Take care",
                ],
                'entities': {}
            }
        }

    def generate_example(self, intent: str) -> Dict:
        """Generate one training example for an intent"""
        intent_data = self.intents[intent]
        template = random.choice(intent_data['templates'])

        # Fill in entities
        entities = {}
        text = template

        for entity_type, values in intent_data.get('entities', {}).items():
            if f'{{{entity_type}}}' in text:
                value = random.choice(values)
                text = text.replace(f'{{{entity_type}}}', value)
                entities[entity_type] = value

        return {
            'text': text,
            'intent': intent,
            'entities': entities
        }

    def generate_dataset(self, samples_per_intent: int = 1000) -> List[Dict]:
        """Generate full training dataset"""
        dataset = []

        for intent in self.intents.keys():
            for _ in range(samples_per_intent):
                example = self.generate_example(intent)
                dataset.append(example)

        random.shuffle(dataset)
        return dataset

    def add_variations(self, dataset: List[Dict]) -> List[Dict]:
        """Add typos, abbreviations, informal variants"""
        variations = []

        for example in dataset:
            variations.append(example)  # Original

            # Add lowercase variant
            variations.append({
                **example,
                'text': example['text'].lower()
            })

            # Add no-punctuation variant (20% chance)
            if random.random() < 0.2:
                variations.append({
                    **example,
                    'text': example['text'].replace('?', '').replace('.', '').replace('!', '')
                })

            # Add contraction variant (30% chance)
            if random.random() < 0.3:
                text = example['text']
                text = text.replace('What is', "What's")
                text = text.replace('How do', "How'd")
                text = text.replace('I am', "I'm")
                text = text.replace('I want', "I wanna")
                text = text.replace('going to', "gonna")
                if text != example['text']:
                    variations.append({
                        **example,
                        'text': text
                    })

            # Add emoji variant (10% chance)
            if random.random() < 0.1:
                emojis = ['💪', '🏋️', '🔥', '📖', '❤️', '👋', '🏃']
                variations.append({
                    **example,
                    'text': example['text'] + ' ' + random.choice(emojis)
                })

        return variations


def main():
    import os
    print("=" * 50)
    print("Generating Intent Router Training Data")
    print("=" * 50)

    generator = IntentDataGenerator()

    # Generate 10,000 examples (1,250 per intent)
    dataset = generator.generate_dataset(samples_per_intent=1250)

    # Add variations (~2.5x data)
    dataset = generator.add_variations(dataset)

    print(f"Total examples: {len(dataset)}")

    # Split train/test
    random.shuffle(dataset)
    split_idx = int(0.9 * len(dataset))
    train_data = dataset[:split_idx]
    test_data = dataset[split_idx:]

    # Ensure output directory
    os.makedirs('output', exist_ok=True)

    # Save
    with open('output/intent_train.jsonl', 'w') as f:
        for ex in train_data:
            f.write(json.dumps(ex) + '\n')

    with open('output/intent_test.jsonl', 'w') as f:
        for ex in test_data:
            f.write(json.dumps(ex) + '\n')

    # Print distribution
    intent_counts = Counter(ex['intent'] for ex in dataset)
    print("\nIntent distribution:")
    for intent, count in sorted(intent_counts.items()):
        print(f"  {intent}: {count}")

    print(f"\nTrain: {len(train_data)}")
    print(f"Test:  {len(test_data)}")

    print("\nSample examples:")
    for intent in generator.intents.keys():
        sample = next(ex for ex in dataset if ex['intent'] == intent)
        print(f"\n  {intent}:")
        print(f"    Text: '{sample['text']}'")
        print(f"    Entities: {sample['entities']}")

    print("\n✅ Data saved to output/intent_train.jsonl and output/intent_test.jsonl")


if __name__ == '__main__':
    main()
