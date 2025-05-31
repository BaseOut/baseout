# BaseOut Website

The official website for BaseOut - the bedrock of modern data architecture for Airtable environments.

## 🚀 Tech Stack

- **Framework**: [Astro.js 4.0](https://astro.build/) - Modern static site generator
- **UI Framework**: [React 18](https://react.dev/) - For interactive components
- **Styling**: [Tailwind CSS 3.3](https://tailwindcss.com/) - Utility-first CSS framework
- **UI Components**: [FlowBite](https://flowbite.com/) - Component library
- **Documentation**: [Starlight](https://starlight.astro.build/) - Astro's documentation theme
- **Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) - Lightweight state management

## 🎨 Brand Compliance

The website follows the comprehensive BaseOut brand guidelines:

- **Colors**: BaseOut Teal (#2D5A5A) as primary, with supporting mountain green, data blue, and peak orange
- **Typography**: Inter (primary), Outfit (display), Source Code Pro (monospace)
- **Design System**: 8px grid system, consistent spacing, accessible color contrasts
- **Voice & Tone**: Professional yet approachable, technically sophisticated but accessible

## 📁 Project Structure

```
src/
├── components/           # Reusable components
│   ├── sections/        # Page sections (Hero, Features, etc.)
│   ├── Navigation.astro # Main navigation
│   ├── Footer.astro     # Site footer
│   └── Logo.astro       # BaseOut logo component
├── layouts/             # Page layouts
│   └── Layout.astro     # Main layout with SEO
├── pages/               # Site pages
│   ├── index.astro      # Homepage
│   ├── features.astro   # Features page
│   ├── pricing.astro    # Pricing page
│   ├── blog/           # Blog pages
│   └── support/        # Starlight documentation
└── styles/
    └── global.css       # Global styles and component classes
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

1. **Clone the repository**
   ```bash
   cd product/website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:4321`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Type check
- `npm run format` - Format code with Prettier
- `npm run lint` - Lint code with ESLint

## 🌟 Key Features

### Homepage Sections

1. **Hero Section**: Compelling value proposition with CTAs
2. **Stats**: Key metrics and achievements
3. **Features**: Core BaseOut capabilities
4. **Pricing Overview**: Four-tier pricing structure
5. **Testimonials**: Customer feedback
6. **Final CTA**: Strong conversion-focused section

### Brand Implementation

- **Logo**: Custom SVG with mountain layers representing data architecture
- **Color System**: Full BaseOut brand palette with Tailwind utilities
- **Typography**: Brand-compliant font hierarchy
- **Components**: Reusable UI patterns following brand guidelines

### Performance Optimizations

- **Static Generation**: Pre-rendered pages for optimal performance
- **Image Optimization**: Automatic image optimization
- **Critical CSS**: Inlined critical styles
- **Bundle Optimization**: Tree-shaking and code splitting

## 🚀 Deployment

### Cloudflare Workers

The site is configured for deployment on Cloudflare Workers:

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy with Wrangler**
   ```bash
   npm run deploy
   ```

### Environment Configuration

Create a `wrangler.toml` file in the project root:

```toml
name = "baseout-website"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[[routes]]
pattern = "baseout.com/*"
zone_name = "baseout.com"
```

## 📖 Content Management

### Adding Blog Posts

Create new `.md` files in `src/pages/blog/` with frontmatter:

```yaml
---
layout: ../layouts/BlogPost.astro
title: "Post Title"
description: "Post description"
publishDate: "2024-01-01"
author: "Author Name"
---
```

### Updating Documentation

The `/support` section uses Starlight. Add new docs in the configured sidebar structure in `astro.config.mjs`.

## 🎯 SEO & Analytics

- **Meta Tags**: Comprehensive SEO meta tags
- **Open Graph**: Social media sharing optimization
- **Schema.org**: Structured data for search engines
- **Sitemap**: Automatically generated
- **Analytics**: Ready for Google Analytics/Plausible integration

## 🔧 Customization

### Brand Colors

Colors are defined in `tailwind.config.mjs` and can be used throughout:

```css
bg-baseout-teal
text-baseout-orange
border-baseout-mountain
```

### Component Styling

Custom component classes in `src/styles/global.css`:

```css
.btn-primary    /* Primary button */
.btn-secondary  /* Secondary button */
.btn-cta        /* Call-to-action button */
.card           /* Standard card */
.feature-card   /* Feature card with hover effects */
```

## 🧪 Testing

### Browser Testing

- Chrome/Chromium
- Firefox
- Safari
- Edge

### Responsive Testing

- Mobile (375px+)
- Tablet (768px+)
- Desktop (1024px+)
- Large screens (1440px+)

### Accessibility Testing

- Keyboard navigation
- Screen reader compatibility
- Color contrast compliance (WCAG 2.1 AA)
- Focus management

## 📱 Progressive Enhancement

The site works without JavaScript but enhances with:

- Smooth scrolling animations
- Interactive navigation
- Form enhancements
- Progressive loading

## 🔐 Security

- No client-side secrets
- Secure headers configuration
- Content Security Policy ready
- HTTPS enforcement

## 📞 Support

For technical issues with the website:

1. Check the [documentation](/support)
2. Review [GitHub issues](https://github.com/baseout/website/issues)
3. Contact the development team

---

**BaseOut** - Transform complex data challenges into competitive advantages.

Built with ❤️ by the BaseOut team. 