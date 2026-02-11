import { ApolloClient, InMemoryCache, ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// This is now a LOCAL STORAGE backed Apollo Client - fully serverless
// All data is stored in AsyncStorage on the device
// See mock-apollo-client.ts for all data operations

// Auth link - manages local authentication tokens only
const authLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    AsyncStorage.getItem('authToken')
      .then((token) => {
        if (token) {
          operation.setContext({
            headers: {
              authorization: `Bearer ${token}`,
            },
          });
        }
        forward(operation).subscribe(observer);
      })
      .catch((err) => {
        console.error('Auth token retrieval error:', err);
        observer.error(err);
      });
  });
});

// LOCAL-ONLY Apollo Client instance - no network calls
// This app is now fully serverless and uses local mock data
export const apolloClient = new ApolloClient({
  link: authLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
    },
    query: {
      fetchPolicy: 'cache-first',
    },
  },
});
