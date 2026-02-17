# Theme System (Next.js + shadcn/ui)

1. Wrap your app in `ThemeProvider` once:
   - `app/layout.tsx` -> `<Providers><App /></Providers>`
   - `components/providers.tsx` -> `<ThemeProvider>{children}</ThemeProvider>`
2. Keep global CSS variables in `app/globals.css`.
   - `tailwind.config.ts` is provided for standard setups, but this project runs without `@config` in CSS.
3. Define both themes in `lib/theme/tokens.ts`:
   - `default` = current standard theme
   - `ghibli` = warm/storybook palette
4. Read/switch theme from client components with:
   - `import { useTheme } from "@/hooks/use-theme"`
   - `const { theme, setTheme } = useTheme()`
5. Use `components/settings/theme-settings.tsx` to expose a settings selector UI.
6. Optional quick toggle in layout:
   - `components/theme/theme-toggle.tsx` used in `components/layout/app-shell.tsx`.
