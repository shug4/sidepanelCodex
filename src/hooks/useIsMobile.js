import { useSyncExternalStore } from 'react';

// styles.cssのブレークポイントと揃える。
const query = '(max-width: 767px)';
const subscribe = (callback) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getSnapshot = () => window.matchMedia(query).matches;

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
