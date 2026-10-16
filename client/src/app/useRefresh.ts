import { useEffect, useRef } from 'preact/hooks';
import { useAppState } from './AppContext';

export const useRefresh = (onRefresh: () => void): void => {
  const { refresh } = useAppState();
  const latest = useRef(onRefresh);
  latest.current = onRefresh;
  useEffect(() => refresh.subscribe(() => latest.current()), [refresh]);
};
