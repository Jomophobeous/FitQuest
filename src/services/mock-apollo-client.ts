import { ApolloClient, InMemoryCache, ApolloLink, gql } from '@apollo/client';
import { Observable } from '@apollo/client';

// Mock data for the application
const mockData = {
  user: {
    id: '1',
    email: 'user@example.com',
    name: 'John Doe',
    avatar: null,
    profilePicture: null,
    bio: 'Fitness enthusiast',
    age: 28,
    height: 180,
    weight: 75,
    createdAt: new Date().toISOString(),
  },
  exercises: [
    {
      id: '1',
      name: 'Push-ups',
      description: 'Upper body exercise',
      category: 'strength',
      difficulty: 'beginner',
      duration: 300,
      caloriesBurned: 50,
      image: null,
    },
    {
      id: '2',
      name: 'Running',
      description: 'Cardio exercise',
      category: 'cardio',
      difficulty: 'intermediate',
      duration: 1800,
      caloriesBurned: 300,
      image: null,
    },
    {
      id: '3',
      name: 'Squats',
      description: 'Lower body exercise',
      category: 'strength',
      difficulty: 'intermediate',
      duration: 300,
      caloriesBurned: 100,
      image: null,
    },
  ],
  workouts: [
    {
      id: '1',
      name: 'Morning Cardio',
      description: 'Light cardio session',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      caloriesBurned: 300,
      exercises: [
        {
          id: '2',
          name: 'Running',
          duration: 1800,
          caloriesBurned: 300,
        },
      ],
    },
    {
      id: '2',
      name: 'Strength Training',
      description: 'Full body workout',
      startTime: new Date(Date.now() - 7200000).toISOString(),
      endTime: new Date(Date.now() - 3600000).toISOString(),
      caloriesBurned: 250,
      exercises: [
        {
          id: '1',
          name: 'Push-ups',
          duration: 300,
          caloriesBurned: 50,
        },
        {
          id: '3',
          name: 'Squats',
          duration: 300,
          caloriesBurned: 100,
        },
      ],
    },
  ],
};

// Create a link that intercepts GraphQL queries and returns mock data
const mockLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    const { query, operationName } = operation;
    
    // Simulate network delay
    setTimeout(() => {
      try {
        let data: any = {};

        // Handle different queries
        if (operationName === 'GetUser' || operationName === 'me') {
          data = { me: mockData.user };
        } else if (operationName === 'GetExercises' || operationName === 'exercises') {
          data = { exercises: mockData.exercises };
        } else if (operationName === 'GetWorkouts' || operationName === 'workouts') {
          data = { workouts: mockData.workouts };
        } else if (operationName === 'GetDashboard') {
          data = {
            me: mockData.user,
            workouts: mockData.workouts,
            exercises: mockData.exercises,
          };
        } else if (operationName === 'login') {
          data = {
            login: {
              token: 'mock-jwt-token-' + Date.now(),
              user: mockData.user,
            },
          };
        } else if (operationName === 'register') {
          data = {
            register: {
              token: 'mock-jwt-token-' + Date.now(),
              user: mockData.user,
            },
          };
        } else {
          // Default response for unknown queries
          data = {};
        }

        observer.next({ data });
        observer.complete();
      } catch (err) {
        observer.error(err);
      }
    }, 300); // 300ms delay to simulate network
  });
});

// Create Apollo Client with mock link
export const mockApolloClient = new ApolloClient({
  link: mockLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'cache-first',
    },
  },
});

export default mockApolloClient;
