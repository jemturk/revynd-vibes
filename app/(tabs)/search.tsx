import { useEffect } from 'react';
import { router } from 'expo-router';

// This screen is never actually shown — the "Search" tab intercepts its own
// press event and opens the search modal over the current screen instead.
// This file only exists as a fallback so the route is safe to land on directly.
export default function SearchRedirect() {
  useEffect(() => {
    router.replace('/(tabs)/?openSearch=true');
  }, []);

  return null;
}
