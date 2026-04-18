import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { darkTheme, lightTheme } from './theme';

export type AppTheme = typeof lightTheme;

type ThemeContextValue = {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const theme = isDark ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({ theme, isDark, toggleTheme }),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};