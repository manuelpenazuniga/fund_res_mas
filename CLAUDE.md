# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro-based blog/content website built with TailwindCSS and TypeScript. It's based on the Astroplate template and includes features like multi-author support, dark mode, search functionality, tags/categories, and Disqus comments.

## Development Commands

### Package Manager
Uses Yarn v1.22+. All npm commands should use yarn instead.

### Common Commands
```bash
# Development server (auto-generates JSON, then starts dev server)
yarn dev

# Production build (generates JSON, then builds site)
yarn build

# Preview production build
yarn preview

# Type checking
yarn check

# Format code
yarn format

# Generate search JSON (runs automatically on dev/build)
yarn generate-json

# Remove dark mode feature
yarn remove-darkmode
```

## Architecture

### Path Aliases (tsconfig.json)
- `@/components/*` → `src/layouts/components/*`
- `@/shortcodes/*` → `src/layouts/shortcodes/*`
- `@/helpers/*` → `src/layouts/helpers/*`
- `@/partials/*` → `src/layouts/partials/*`
- `@/*` → `src/*`

### Content Structure
Content is organized in `src/content/` with the following collections:
- `blog/` - Blog posts
- `authors/` - Author profiles
- `pages/` - Static pages (e.g., privacy-policy)
- `about/` - About page content
- `homepage/` - Homepage content
- `contact/` - Contact page content
- `sections/` - Reusable sections (call-to-action, testimonial)

**Important**: Files prefixed with `-` (e.g., `-index.md`) are excluded from JSON generation but still used by Astro.

### Page Routing
Dynamic routes in `src/pages/`:
- `[regular].astro` - Catch-all for regular pages
- `blog/[single].astro` - Individual blog posts
- `blog/page/[slug].astro` - Blog pagination
- `tags/[tag].astro` - Tag filter pages
- `categories/[category].astro` - Category filter pages
- `authors/[single].astro` - Author profile pages

### Configuration System
Site configuration managed through JSON files in `src/config/`:
- `config.json` - Main site settings (base URL, features, metadata, integrations)
- `menu.json` - Navigation menu structure
- `social.json` - Social media links
- `theme.json` - Theme customization

The `config.json` enables/disables features:
- Search functionality
- Theme switcher (dark mode)
- Sticky header
- Google Tag Manager
- Disqus comments

### Build-Time JSON Generation
The `scripts/jsonGenerator.js` script runs before dev/build:
- Extracts frontmatter and content from markdown files in `src/content/blog/`
- Generates `.json/posts.json` and `.json/search.json`
- Filters out draft posts (where `draft: true` in frontmatter)
- Powers the search functionality via `SearchModal.tsx`

### Utility Functions
Located in `src/lib/utils/`:
- `textConverter.ts` - slugify, markdownify, humanize, titleify, plainify
- `sortFunctions.ts` - Sorting helpers for posts/taxonomies
- `similarItems.ts` - Related content suggestions
- `taxonomyFilter.ts` - Tag/category filtering
- `dateFormat.ts` - Date formatting utilities
- `readingTime.ts` - Reading time calculation
- `bgImageMod.ts` - Background image processing

### Component Structure
- `src/layouts/components/` - Reusable UI components
- `src/layouts/shortcodes/` - MDX shortcodes (Button, Accordion, Notice, Video, Youtube, Tabs)
- `src/layouts/helpers/` - React helper components (SearchModal, Disqus, DynamicIcon, SearchResult)
- `src/layouts/partials/` - Page partials

Shortcodes are auto-imported in `astro.config.mjs` for use in MDX files without explicit imports.

### Styling
TailwindCSS v4+ integrated via Vite plugin. Custom Tailwind plugins in `src/tailwind-plugin/`.

## Key Integration Points

### Search Functionality
Search is implemented via:
1. `jsonGenerator.js` creates searchable JSON at build time
2. `SearchModal.tsx` (React) provides the search UI
3. `SearchResult.tsx` renders search results
4. Enabled/disabled via `config.json` → `settings.search`

### MDX Content
Markdown/MDX files support:
- Frontmatter for metadata
- Auto-imported shortcodes (Button, Accordion, etc.)
- Table of contents via `remark-toc`
- Collapsible sections via `remark-collapse`
- Code syntax highlighting with `one-dark-pro` theme

### Dark Mode
Theme switching controlled by:
- `config.json` → `settings.theme_switcher` (enable/disable)
- `config.json` → `settings.default_theme` (system/light/dark)
- Separate logo files for light/dark modes
- Can be removed entirely via `yarn remove-darkmode`

## Important Notes

- Always run `yarn generate-json` before testing search functionality locally
- Content with `draft: true` in frontmatter is excluded from build
- The site base URL and path are configured in `config.json` and used in `astro.config.mjs`
- Image optimization uses Sharp
- Pagination limit set in `config.json` → `settings.pagination`
