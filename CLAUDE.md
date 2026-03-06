# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro-based website for **Fundación Rescate de Mascotas Chile**, a nonprofit animal rescue organization based in Talca, Chile. Built with Astro, TailwindCSS & TypeScript, based on the Astroplate template. The site includes multi-author blog support, dark mode, search functionality, tags/categories, and Disqus comments.

The project has two main areas:
1. **Main site** (static): Blog, about, contact, activities, volunteer pages — content-driven via Markdown/MDX.
2. **Donation app** (SSR/hybrid): Interactive donation wizard with payment processing, tracking, and certificates. See `DONACIONES.md` for the full technical spec.

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

### Output Mode: Hybrid (Static + SSR)

The project uses Astro's `hybrid` output mode:
- **Static pages** (default, `prerender = true`): All content pages (blog, about, contact, activities, etc.) are pre-rendered at build time. No changes from original behavior.
- **Dynamic pages** (`prerender = false`): Donation wizard, payment API routes, tracking pages. These run as Vercel serverless functions.

```javascript
// astro.config.mjs
import vercel from '@astrojs/vercel';
export default defineConfig({
  output: 'hybrid',
  adapter: vercel(),
  // ...
});
```

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
- `pages/` - Static pages (privacy-policy, activities, haztesocio, regalaunrescate, sumaatuempresa, voluntario)
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

**Donation routes** (SSR, `prerender = false`):
- `donar.astro` - Donation wizard (React island)
- `seguimiento/[codigo].astro` - Public tracking page
- `donacion/confirmacion.astro` - Post-payment confirmation
- `api/crear-pago.ts` - Creates Flow payment order
- `api/flow-webhook.ts` - Receives Flow payment confirmation
- `api/flow-return.ts` - Post-payment return handler
- `api/productos.ts` - Lists donation products
- `api/donacion/[codigo].ts` - Donation tracking data
- `api/keep-alive.ts` - Cron job to prevent Supabase free tier pause

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

**Donation utilities** in `src/lib/`:
- `supabase.ts` - Supabase client configuration
- `flow.ts` - Flow.cl payment API utilities
- `certificate.ts` - PDF certificate generation (jsPDF)
- `email.ts` - Transactional email sending (Resend)

### Component Structure
- `src/layouts/components/` - Reusable UI components
- `src/layouts/shortcodes/` - MDX shortcodes (Button, Accordion, Notice, Video, Youtube, Tabs)
- `src/layouts/helpers/` - React helper components (SearchModal, Disqus, DynamicIcon, SearchResult)
- `src/layouts/partials/` - Page partials

**Donation components** in `src/layouts/components/donation/`:
- `DonationApp.tsx` - Main wizard component (mounted in donar.astro)
- `StepSelector.tsx` - Step 1: Choose what to donate
- `StepDetails.tsx` - Step 2: Quantity + recipient details
- `StepMessage.tsx` - Step 3: Personalize certificate message
- `StepPayment.tsx` - Step 4: Donor info + pay
- `StepConfirmation.tsx` - Step 5: Certificate + tracking code
- `ProductCard.tsx` - Donation product card
- `OrderSummary.tsx` - Sidebar order summary
- `TrackingTimeline.tsx` - Rescue animal update timeline

Shortcodes are auto-imported in `astro.config.mjs` for use in MDX files without explicit imports.

### Styling
TailwindCSS v4+ integrated via Vite plugin. Custom Tailwind plugins in `src/tailwind-plugin/`.

## External Services

### Supabase (Database + Storage)
- **Purpose**: PostgreSQL database for donations, products, rescue animals, tracking updates. Storage for animal photos.
- **Plan**: Free tier (500MB DB, 1GB storage, 50K MAUs)
- **Tables**: `productos`, `donaciones`, `rescatines`, `actualizaciones`
- **Access**: Server-side via service role key (API routes), client-side via anon key (read-only public data)
- **Dashboard**: Used by foundation staff to manage rescue animals and upload updates

### Flow.cl (Payment Processing)
- **Purpose**: Payment gateway for donations (credit card, debit, bank transfer, 30+ methods)
- **Plan**: No fixed cost, commission only (~3.19% + IVA per transaction)
- **Integration**: Server-side only (API routes). Never expose keys in frontend.
- **Environments**: sandbox.flow.cl (development), flow.cl (production)
- **Foundation data**: RUT 65.212.606-5, Cuenta Ahorro Banco Estado

### Resend (Transactional Emails)
- **Purpose**: Confirmation emails to donors, gift notification emails to recipients
- **Plan**: Free tier (100 emails/day, 3000/month)

## Environment Variables

```env
# Supabase
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...       # Server-side only

# Flow.cl
FLOW_API_KEY=your-api-key                  # Server-side only
FLOW_SECRET_KEY=your-secret-key            # Server-side only
FLOW_API_URL=https://sandbox.flow.cl/api   # Change to https://www.flow.cl/api in production

# Resend
RESEND_API_KEY=re_xxxxxxxx                 # Server-side only

# App
PUBLIC_SITE_URL=https://fund-res-mas.vercel.app
```

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

### Donation System
For the complete technical specification of the donation system, see **`DONACIONES.md`** in the project root. Key points:
- React multi-step wizard mounted as Astro island (`client:load`)
- Flow.cl for payment processing (server-side integration via API routes)
- Supabase for data persistence and file storage
- Resend for transactional emails
- jsPDF for client-side certificate generation
- Public tracking pages for donation traceability

## Important Notes

- Always run `yarn generate-json` before testing search functionality locally
- Content with `draft: true` in frontmatter is excluded from build
- The site base URL and path are configured in `config.json` and used in `astro.config.mjs`
- Image optimization uses Sharp
- Pagination limit set in `config.json` → `settings.pagination`
- **Static pages** don't need any changes — they continue to work exactly as before
- **API routes and dynamic pages** must include `export const prerender = false`
- **Never expose Flow or Supabase service keys in client-side code** — only in API routes
- Supabase free tier pauses after 7 days of inactivity — use a Vercel cron to ping it (see `vercel.json` and `/api/keep-alive.ts`)
- Foundation is registered as tax-deductible entity under Ley N° 21.440 (RUT: 65.212.606-5)
