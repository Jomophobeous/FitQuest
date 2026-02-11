// Mock GraphQL queries for development
export const GET_EXERCISES = `
  query GetExercises {
    getExercises {
      id
      name
      instructions
      difficulty
      equipment
      targetMuscle
      category {
        id
        name
      }
    }
  }
`;

export const GET_EXERCISE_CATEGORIES = `
  query GetExerciseCategories {
    getExerciseCategories {
      id
      name
    }
  }
`;

export const FILTER_EXERCISES = `
  query FilterExercises($filters: ExerciseFilterInput) {
    filterExercises(filters: $filters) {
      id
      name
      instructions
      difficulty
      category {
        id
        name
      }
    }
  }
`;
