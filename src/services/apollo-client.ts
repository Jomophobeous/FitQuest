import { ApolloClient, InMemoryCache, ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client';
import { getAuthToken } from '../security/StorageMigration';

// Local-only Apollo Client for legacy features (serverless)
// Auth token is stored in SecureStore
// See mock-apollo-client.ts for all data operations

// Auth link - manages local authentication tokens only
const authLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    getAuthToken()
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
