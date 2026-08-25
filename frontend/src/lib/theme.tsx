import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: typeof DARK_COLORS;
}

const DARK_COLORS = {
  bg: "#0a0f1a",
  surface: "#111827",
  surfaceHover: "#1e293b",
  border: "#1e293b",
  borderLight: "#334155",
  text: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textDim: "#475569",
  accent: "#06b6d4",
};

const LIGHT_COLORS = {
  bg: "#f1f5f9",
  surface: "#ffffff",
  surfaceHover: "#f8fafc",
  border: "#e2e8f0",
  borderLight: "#cbd5e1",
  text: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  accent: "#0891b2",
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  colors: DARK_COLORS,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("shade_theme") as Theme) || "dark";
  });

  useEffect(() => {
    localStorage.setItem("shade_theme", theme);
    document.body.style.background = theme === "dark" ? DARK_COLORS.bg : LIGHT_COLORS.bg;
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
