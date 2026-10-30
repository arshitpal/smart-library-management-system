import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../services/api';

// Loads data from an API path and reloads whenever the path or params change.
export function useFetch(path, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params || {});

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const response = await api.get(path, { params: JSON.parse(key) });
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [path, key]);

  useEffect(() => { reload(); }, [reload]);

  return { data, error, loading, reload };
}

// Adds search, filters and page handling on top of useFetch.
export function useList(path, initialFilters = {}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', ...initialFilters });
  const [debounced, setDebounced] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(filters), 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const setFilter = (name, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const result = useFetch(path, { ...debounced, page, limit: 10 });
  return { ...result, page, setPage, filters, setFilter };
}
