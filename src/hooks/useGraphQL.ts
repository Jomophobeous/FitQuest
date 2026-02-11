import { DocumentNode } from 'graphql';
import { apolloClient } from '../services/apollo-client';
import { useEffect, useCallback, useState } from 'react';

interface UseQueryOptions {
  skip?: boolean;
  onCompleted?: (data: any) => void;
  onError?: (error: any) => void;
}

/**
 * Custom hook to execute GraphQL queries with Apollo Client
 * Integrates with our existing useAsync pattern
 */
export function useGraphQL<T = any>(
  query: DocumentNode,
  variables?: Record<string, any>,
  options?: UseQueryOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.skip);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    if (options?.skip) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await apolloClient.query({
        query,
        variables: variables || {},
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      setData(result.data);
      options?.onCompleted?.(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      options?.onError?.(err);
      console.error('GraphQL error:', err);
    } finally {
      setLoading(false);
    }
  }, [query, variables, options?.skip]);

  useEffect(() => {
    execute();
  }, [execute]);

  const refetch = useCallback(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch, execute };
}

/**
 * Custom hook to execute GraphQL mutations
 */
export function useMutation<T = any>(mutation: DocumentNode) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (variables?: Record<string, any>) => {
      try {
        setLoading(true);
        setError(null);
        const result = await apolloClient.mutate({
          mutation,
          variables: variables || {},
        });

        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return result.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('GraphQL mutation error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutation]
  );

  return { execute, loading, error };
}
