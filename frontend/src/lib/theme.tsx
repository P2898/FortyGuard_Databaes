import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: typeof DARK_COLORS;
}

const DARK_COLORS = {
  bg: "#0e1019",
  surface: "#161a28",
  surfaceHover: "#1e2234",
  border: "#262c42",
  borderLight: "#3a4060",
  text: "#e8e4df",
  textSecondary: "#9a928a",
  textMuted: "#685f58",
  textDim: "#48403a",
  accent: "#c07a28",
};

const LIGHT_COLORS = {
  bg: "#f6f3ef",
  surface: "#ffffff",
  surfaceHover: "#faf8f5",
  border: "#e2dbd3",
  borderLight: "#ccc4bb",
  text: "#1c1610",
  textSecondary: "#5a5048",
  textMuted: "#7a7068",
  textDim: "#a8a098",
  accent: "#a86018",
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
