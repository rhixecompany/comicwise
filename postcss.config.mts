/**
 * PostCSS Configuration
 * @description Tailwind CSS v4 setup for ComicWise
 *
 * Tailwind CSS v4 Migration Notes:
 * - Uses @tailwindcss/postcss plugin (v4.0+)
 * - Replaces v3's @tailwindcss/tailwind with the new @tailwindcss/postcss plugin
 * - No longer requires input CSS files with @tailwind directives
 * - Configuration is automatically loaded from tailwind.config.ts when detected
 *
 * Related Configuration Files:
 * - eslint.config.mts: Includes tailwindConfig for ESLint tailwind rules
 * - .prettierrc.ts: Tailwind CSS class sorting (auto-detects config)
 * - next.config.ts: Integrates Tailwind CSS via turbopack
 * - appConfig.ts: Exports feature flags and JWT configuration
 *
 * Validation:
 * - Run `pnpm lint:fix` to auto-sort Tailwind classes
 * - Run `pnpm build` to verify Tailwind CSS generation
 * - Ensure tailwind.config.ts exists in project root for custom configuration
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
