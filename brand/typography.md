# Typography

The Baseout typography system emphasizes clarity, readability, and modern professionalism. Our type choices reflect the geometric precision of our logo while maintaining accessibility and versatility across all platforms.

## Font Families

### Primary Font: Inter
**Modern Sans-Serif**
- **Usage**: Headers, UI elements, body text
- **Characteristics**: Clean, highly legible, optimized for digital screens
- **Variants**: Thin (100), Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800)
- **Fallback**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

### Secondary Font: Source Code Pro
**Monospace**
- **Usage**: Code blocks, technical documentation, data displays
- **Characteristics**: Fixed-width, excellent for technical content
- **Variants**: Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700)
- **Fallback**: 'SF Mono', Monaco, Consolas, monospace

### Display Font: Outfit
**Geometric Sans-Serif**
- **Usage**: Large headlines, hero text, branding materials
- **Characteristics**: Geometric, modern, high impact
- **Variants**: Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800)
- **Fallback**: Inter, sans-serif

## Typography Hierarchy

### Display Text
```
Font: Outfit
Size: 48px (3rem)
Weight: 700 (Bold)
Line Height: 1.1
Letter Spacing: -0.02em
Use: Hero headlines, major page titles
```

### Heading 1
```
Font: Inter
Size: 36px (2.25rem)
Weight: 600 (SemiBold)
Line Height: 1.2
Letter Spacing: -0.01em
Use: Main page headings
```

### Heading 2
```
Font: Inter
Size: 28px (1.75rem)
Weight: 600 (SemiBold)
Line Height: 1.25
Letter Spacing: normal
Use: Section headings
```

### Heading 3
```
Font: Inter
Size: 22px (1.375rem)
Weight: 500 (Medium)
Line Height: 1.3
Letter Spacing: normal
Use: Subsection headings
```

### Heading 4
```
Font: Inter
Size: 18px (1.125rem)
Weight: 500 (Medium)
Line Height: 1.35
Letter Spacing: normal
Use: Card titles, component headings
```

### Body Large
```
Font: Inter
Size: 18px (1.125rem)
Weight: 400 (Regular)
Line Height: 1.6
Letter Spacing: normal
Use: Lead paragraphs, important body text
```

### Body Regular
```
Font: Inter
Size: 16px (1rem)
Weight: 400 (Regular)
Line Height: 1.5
Letter Spacing: normal
Use: Standard body text, paragraphs
```

### Body Small
```
Font: Inter
Size: 14px (0.875rem)
Weight: 400 (Regular)
Line Height: 1.4
Letter Spacing: normal
Use: Captions, metadata, secondary information
```

### Caption
```
Font: Inter
Size: 12px (0.75rem)
Weight: 400 (Regular)
Line Height: 1.4
Letter Spacing: 0.01em
Use: Labels, fine print, form helper text
```

### Code
```
Font: Source Code Pro
Size: 14px (0.875rem)
Weight: 400 (Regular)
Line Height: 1.6
Letter Spacing: normal
Use: Code snippets, technical references
```

## Typography Usage Guidelines

### Readability Standards
- Maintain minimum 16px font size for body text
- Use sufficient color contrast (4.5:1 minimum)
- Limit line length to 45-75 characters
- Provide adequate line spacing (1.4-1.6 for body text)
- Use appropriate font weights for emphasis

### Hierarchy Principles
1. **Size**: Larger text indicates higher importance
2. **Weight**: Bolder text draws attention
3. **Color**: Brand colors for emphasis, neutral for body
4. **Spacing**: More space around important elements

### Platform Considerations

#### Digital/Web
- Use web-safe font stacks with fallbacks
- Optimize for various screen densities (1x, 2x, 3x)
- Consider font loading performance
- Test across different browsers and devices

#### Print
- Use high-resolution font files
- Account for different paper types and printing methods
- Consider readability at small sizes
- Test color accuracy with chosen printing process

#### Mobile
- Increase touch target sizes (minimum 44px)
- Use larger font sizes for improved readability
- Consider thumb-friendly layouts
- Test across various screen sizes

## Text Colors

### Primary Text
- **Color**: Charcoal (#2C3E50)
- **Usage**: Headlines, important body text
- **Contrast**: High contrast on light backgrounds

### Secondary Text
- **Color**: Slate Gray (#5D6D7E)
- **Usage**: Supporting text, captions
- **Contrast**: Medium contrast, still accessible

### Subtle Text
- **Color**: Light Gray (#8E9AAF)
- **Usage**: Placeholder text, disabled states
- **Contrast**: Lower contrast, use sparingly

### Brand Text
- **Color**: Baseout Teal (#2D5A5A)
- **Usage**: Links, brand elements, CTAs
- **Contrast**: High contrast, brand recognition

### Reversed Text
- **Color**: Pure White (#FFFFFF)
- **Usage**: Text on dark backgrounds
- **Contrast**: Ensure sufficient contrast with background

## Typography Do's and Don'ts

### ✅ DO
- Use consistent font sizes and weights
- Maintain proper hierarchy
- Ensure adequate contrast ratios
- Test readability at various sizes
- Use web fonts with proper fallbacks
- Consider loading performance
- Maintain consistent line heights

### ❌ DON'T
- Mix too many font families (max 3)
- Use very light fonts on light backgrounds
- Create insufficient hierarchy
- Ignore accessibility guidelines
- Use decorative fonts for body text
- Stretch or condense fonts artificially
- Forget to test on mobile devices

## Responsive Typography

### Breakpoint Scale
```css
/* Mobile First Approach */
@media (min-width: 768px) {
  /* Tablet adjustments */
}

@media (min-width: 1024px) {
  /* Desktop adjustments */
}

@media (min-width: 1440px) {
  /* Large desktop adjustments */
}
```

### Fluid Typography
Use CSS clamp() for responsive scaling:
```css
font-size: clamp(1.5rem, 4vw, 3rem);
```

## Special Applications

### Data Visualization
- Use Source Code Pro for precise data
- Maintain consistency in size and weight
- Ensure readability at small sizes
- Consider colorblind accessibility

### Technical Documentation
- Use clear hierarchy for nested information
- Implement consistent code formatting
- Provide adequate white space
- Use monospace for code examples

### Marketing Materials
- Use Outfit for high-impact headlines
- Maintain brand voice through typography
- Consider emotional impact of font choices
- Ensure scalability across formats

## Font Loading Best Practices

### Web Performance
```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('inter-regular.woff2') format('woff2');
}
```

### Fallback Strategy
1. Web font loads
2. System font displays during load
3. Fallback font if web font fails
4. Graceful degradation maintained 