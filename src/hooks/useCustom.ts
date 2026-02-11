import { useCallback, useState, useEffect } from 'react';
import { useForm as useHookForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Custom form hook with Zod validation
export function useForm<T extends Record<string, any>>(
  schema: any,
  onSubmit: (data: T) => Promise<void> | void,
  defaultValues?: Partial<T>
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const methods = useHookForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
  });

  const handleSubmit = useCallback(
    async (data: T) => {
      try {
        setIsSubmitting(true);
        setSubmitError(null);
        await onSubmit(data);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit]
  );

  return {
    ...methods,
    isSubmitting,
    submitError,
    onSubmit: methods.handleSubmit(handleSubmit),
  };
}

// Async operation hook
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
): AsyncState<T> & { execute: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async () => {
    try {
      setState({ data: null, loading: true, error: null });
      const response = await asyncFunction();
      setState({ data: response, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, [asyncFunction]);

  // Auto-execute on mount
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { ...state, execute };
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Pagination hook
interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function usePagination(
  totalItems: number,
  pageSize: number = 10
): PaginationState & {
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  reset: () => void;
} {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(totalItems / pageSize);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    page,
    pageSize,
    totalItems,
    hasNextPage,
    hasPreviousPage,
    goToPage: (newPage) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setPage(newPage);
      }
    },
    nextPage: () => {
      if (hasNextPage) setPage(page + 1);
    },
    previousPage: () => {
      if (hasPreviousPage) setPage(page - 1);
    },
    reset: () => setPage(1),
  };
}

// Favorite toggle hook
interface FavoriteItem {
  id: number;
  [key: string]: any;
}

export function useFavorites<T extends FavoriteItem>(initialItems: T[] = []) {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [items, setItems] = useState(initialItems);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]
    );
  }, []);

  const isFavorite = useCallback((id: number) => favorites.includes(id), [favorites]);

  const addFavorite = useCallback((id: number) => {
    setFavorites((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeFavorite = useCallback((id: number) => {
    setFavorites((prev) => prev.filter((fav) => fav !== id));
  }, []);

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    items,
    setItems,
    toggleFavorite,
    isFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };
}

// Filter hook
export function useFilter<T>(items: T[], filterFn: (item: T, query: string) => boolean) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? items.filter((item) => filterFn(item, query.toLowerCase()))
    : items;

  return {
    query,
    setQuery,
    filtered,
    hasResults: filtered.length > 0,
    resultCount: filtered.length,
    reset: () => setQuery(''),
  };
}
