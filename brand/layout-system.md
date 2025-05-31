# Layout System

The Baseout layout system emphasizes structured organization, geometric precision, and scalable hierarchy. Our approach reflects the layered, foundational nature of our brand while ensuring clarity and usability across all touchpoints.

## Grid Foundation

### 12-Column Grid System
**Primary layout structure for web and digital applications**
- **Columns**: 12 flexible columns
- **Gutters**: 24px between columns
- **Margins**: 24px minimum (responsive)
- **Max width**: 1200px
- **Breakpoints**: Mobile-first approach

### Breakpoint System
```css
/* Mobile First */
@media (min-width: 480px) { /* Small mobile */ }
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Large desktop */ }
@media (min-width: 1920px) { /* Extra large */ }
```

### Grid Variations

#### Dense Grid (8px)
- **Usage**: UI components, forms, cards
- **Spacing**: 8px base unit
- **Applications**: Buttons, inputs, small elements

#### Standard Grid (24px)
- **Usage**: Page layouts, sections, major components
- **Spacing**: 24px base unit
- **Applications**: Content blocks, navigation, headers

#### Loose Grid (48px)
- **Usage**: Marketing pages, hero sections
- **Spacing**: 48px base unit
- **Applications**: Landing pages, feature showcases

## Spacing System

### Base Unit: 8px
All spacing derives from an 8px base unit for consistency and mathematical precision.

```
4px  = 0.5 × base (micro spacing)
8px  = 1 × base (extra small)
16px = 2 × base (small)
24px = 3 × base (medium)
32px = 4 × base (large)
48px = 6 × base (extra large)
64px = 8 × base (huge)
96px = 12 × base (massive)
```

### Spacing Applications

#### Component Spacing
- **Padding**: Internal spacing within components
- **Margins**: External spacing between components
- **Gaps**: Spacing in flexbox and grid layouts

#### Vertical Rhythm
- **Line height**: 1.5 × font size minimum
- **Paragraph spacing**: 16px between paragraphs
- **Section spacing**: 48px between major sections
- **Module spacing**: 24px between related modules

#### Horizontal Spacing
- **Content margins**: 24px minimum on mobile, 48px+ on desktop
- **Element gaps**: 16px between related elements
- **Column gaps**: 24px in multi-column layouts
- **Button spacing**: 8px between adjacent buttons

## Layout Patterns

### Container Patterns

#### Full-Width Container
```css
.container-full {
  width: 100%;
  max-width: none;
  padding: 0 24px;
}
```

#### Content Container
```css
.container-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}
```

#### Narrow Container
```css
.container-narrow {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px;
}
```

### Section Patterns

#### Hero Section
- **Height**: Viewport-based (50vh minimum)
- **Content**: Centered vertically and horizontally
- **Spacing**: Large padding (64px+)
- **Background**: Full-width, brand colors or imagery

#### Content Section
- **Padding**: 48px vertical, 24px horizontal
- **Max-width**: 1200px
- **Alignment**: Center-aligned container
- **Background**: Alternating white/light gray

#### Footer Section
- **Structure**: Multi-column layout
- **Spacing**: 48px padding, 24px gaps
- **Content**: Links, legal, contact information
- **Background**: Dark brand colors

### Component Layout

#### Card Layout
```css
.card {
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}
```

#### Form Layout
```css
.form-group {
  margin-bottom: 24px;
}

.form-input {
  padding: 12px 16px;
  border-radius: 4px;
}
```

#### Navigation Layout
```css
.nav-item {
  padding: 8px 16px;
  margin-right: 8px;
}
```

## Responsive Design

### Mobile-First Approach
Start with mobile layouts and enhance for larger screens:

1. **Mobile (320px+)**: Single column, stacked content
2. **Tablet (768px+)**: 2-3 columns, sidebar layouts
3. **Desktop (1024px+)**: Full multi-column layouts
4. **Large (1440px+)**: Enhanced spacing, larger content areas

### Responsive Spacing
```css
/* Mobile */
.section { padding: 24px 16px; }

/* Tablet */
@media (min-width: 768px) {
  .section { padding: 48px 24px; }
}

/* Desktop */
@media (min-width: 1024px) {
  .section { padding: 64px 48px; }
}
```

### Content Reflow
- **Single column** becomes **multi-column**
- **Stacked elements** become **side-by-side**
- **Compressed spacing** becomes **generous spacing**
- **Hidden elements** become **visible features**

## Visual Hierarchy

### Z-Index Scale
Consistent layering for overlapping elements:
```css
--z-below: -1;
--z-base: 0;
--z-elevated: 10;
--z-sticky: 100;
--z-overlay: 1000;
--z-modal: 2000;
--z-toast: 3000;
--z-tooltip: 4000;
```

### Layer Strategy
1. **Background**: Images, patterns, base colors
2. **Content**: Text, cards, primary interface elements
3. **Navigation**: Headers, sidebars, persistent UI
4. **Overlays**: Modals, dropdowns, temporary elements
5. **Alerts**: Notifications, tooltips, critical messages

### Elevation System
Use shadows and borders to create visual depth:

```css
/* Level 1: Subtle elevation */
box-shadow: 0 1px 3px rgba(0,0,0,0.1);

/* Level 2: Standard elevation */
box-shadow: 0 2px 8px rgba(0,0,0,0.1);

/* Level 3: Prominent elevation */
box-shadow: 0 4px 16px rgba(0,0,0,0.15);

/* Level 4: High elevation */
box-shadow: 0 8px 32px rgba(0,0,0,0.2);
```

## Layout Principles

### Alignment
- **Left-align text** for readability
- **Center-align headings** and hero content
- **Align elements** to grid columns
- **Maintain consistent margins** and padding

### Balance
- **Visual weight** distribution across layouts
- **White space** as an active design element
- **Proportional relationships** between elements
- **Hierarchy** through size and positioning

### Rhythm
- **Consistent spacing** creates visual rhythm
- **Repetitive patterns** establish familiarity
- **Varied spacing** creates emphasis and interest
- **Baseline grid** for text alignment

### Proximity
- **Group related elements** with closer spacing
- **Separate distinct sections** with generous spacing
- **Create visual relationships** through positioning
- **Use white space** to define boundaries

## Content Strategy

### Content Width
- **Body text**: 45-75 characters per line
- **Headlines**: Full container width acceptable
- **Captions**: Shorter line lengths for quick scanning
- **Code blocks**: Allow horizontal scrolling if needed

### Content Sections
```html
<section class="hero">
  <!-- Full-width, high-impact content -->
</section>

<section class="content">
  <!-- Constrained width, readable content -->
</section>

<section class="features">
  <!-- Grid-based, multi-column content -->
</section>
```

### Content Flow
1. **Hero/Introduction**: Establish context and purpose
2. **Primary Content**: Core information and features
3. **Supporting Content**: Details, testimonials, examples
4. **Call-to-Action**: Clear next steps for users
5. **Footer/Resources**: Additional information and links

## Layout Testing

### Cross-Device Testing
- **Mobile phones**: Various screen sizes and orientations
- **Tablets**: Portrait and landscape modes
- **Desktops**: Different monitor sizes and resolutions
- **Print**: Ensure layouts work for print media

### Performance Considerations
- **Minimize layout shifts** during loading
- **Optimize for critical rendering path**
- **Use efficient CSS** (avoid complex selectors)
- **Test on slower devices** and connections

### Accessibility Testing
- **Keyboard navigation**: Ensure logical tab order
- **Screen readers**: Test with assistive technology
- **High contrast**: Verify layouts work with contrast settings
- **Zoom levels**: Test at 200% and 400% zoom

## Layout Do's and Don'ts

### ✅ DO
- Use consistent spacing throughout
- Align elements to the grid system
- Prioritize content hierarchy
- Design mobile-first
- Test across devices and browsers
- Consider accessibility in layout decisions
- Use white space effectively

### ❌ DON'T
- Use arbitrary spacing values
- Create layouts that break at common breakpoints
- Ignore content hierarchy
- Design only for desktop
- Forget to test on real devices
- Create inaccessible layouts
- Overcrowd content without breathing room 