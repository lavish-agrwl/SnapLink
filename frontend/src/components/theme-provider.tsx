import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  <NextThemesProvider attribute="class" {...props}>{children}</NextThemesProvider>
}
