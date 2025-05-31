# Brand Assets Structure

## Recommended File Organization

```
brand/
├── README.md                     # Main brand guidelines index
├── brand-quick-reference.md      # Quick reference card
├── assets-structure.md           # This file
├── guidelines/
│   ├── logo-guidelines.md
│   ├── color-palette.md
│   ├── typography.md
│   ├── iconography.md
│   ├── layout-system.md
│   ├── voice-tone.md
│   └── applications.md
├── assets/
│   ├── logos/
│   │   ├── svg/
│   │   │   ├── logo-horizontal-teal.svg
│   │   │   ├── logo-horizontal-white.svg
│   │   │   ├── logo-stacked-teal.svg
│   │   │   ├── logo-stacked-white.svg
│   │   │   ├── symbol-only-teal.svg
│   │   │   ├── symbol-only-white.svg
│   │   │   └── logotype-only-teal.svg
│   │   ├── png/
│   │   │   ├── @1x/ (standard resolution)
│   │   │   ├── @2x/ (retina/high-DPI)
│   │   │   └── @3x/ (ultra-high-DPI)
│   │   ├── eps/
│   │   │   └── [vector files for print]
│   │   └── favicon/
│   │       ├── favicon.ico
│   │       ├── favicon-16x16.png
│   │       ├── favicon-32x32.png
│   │       └── apple-touch-icon.png
│   ├── colors/
│   │   ├── color-swatches.ase    # Adobe Swatch Exchange
│   │   ├── color-palette.sketch  # Sketch palette
│   │   └── color-values.json     # JSON color definitions
│   ├── fonts/
│   │   ├── inter/
│   │   │   ├── Inter-Regular.woff2
│   │   │   ├── Inter-Medium.woff2
│   │   │   ├── Inter-SemiBold.woff2
│   │   │   └── Inter-Bold.woff2
│   │   ├── outfit/
│   │   │   ├── Outfit-SemiBold.woff2
│   │   │   ├── Outfit-Bold.woff2
│   │   │   └── Outfit-ExtraBold.woff2
│   │   └── source-code-pro/
│   │       ├── SourceCodePro-Regular.woff2
│   │       ├── SourceCodePro-Medium.woff2
│   │       └── SourceCodePro-SemiBold.woff2
│   ├── icons/
│   │   ├── svg/
│   │   │   ├── core/
│   │   │   ├── data/
│   │   │   ├── technical/
│   │   │   └── business/
│   │   └── icon-font/
│   │       ├── baseout-icons.woff2
│   │       ├── baseout-icons.css
│   │       └── demo.html
│   ├── patterns/
│   │   ├── background-patterns.svg
│   │   ├── brand-elements.ai
│   │   └── texture-library/
│   └── templates/
│       ├── presentation/
│       │   ├── baseout-template.pptx
│       │   ├── baseout-template.key
│       │   └── slide-examples/
│       ├── documents/
│       │   ├── letterhead.docx
│       │   ├── business-card.ai
│       │   └── email-signature.html
│       ├── web/
│       │   ├── css/
│       │   │   ├── brand-variables.css
│       │   │   └── component-styles.css
│       │   └── html/
│       │       └── email-templates/
│       └── social-media/
│           ├── linkedin-post-template.psd
│           ├── twitter-header.psd
│           └── social-media-sizes.sketch
├── examples/
│   ├── website-mockups/
│   ├── application-screenshots/
│   ├── marketing-materials/
│   └── merchandise-samples/
└── legal/
    ├── trademark-guidelines.md
    ├── usage-agreements/
    └── approval-process.md
```

## File Naming Conventions

### Logos
```
logo-[orientation]-[color]-[version].[extension]
Examples:
- logo-horizontal-teal-v1.svg
- logo-stacked-white-v1.png
- symbol-only-black-v1.eps
```

### Icons
```
[category]-[name]-[variant]-[size].[extension]
Examples:
- data-chart-line-24.svg
- nav-arrow-right-16.svg
- status-success-filled-20.svg
```

### Colors
```
[color-name]-[variant]
Examples:
- baseout-teal-primary
- baseout-teal-light
- peak-orange-accent
```

## Version Control

### Asset Versioning
- Use semantic versioning (v1.0, v1.1, v2.0)
- Document changes in version notes
- Maintain legacy versions for compatibility
- Archive outdated assets in separate folder

### Change Management
1. **Proposal**: Submit change request with rationale
2. **Review**: Brand team evaluates impact
3. **Approval**: Stakeholder sign-off required
4. **Implementation**: Update assets and guidelines
5. **Communication**: Notify all relevant teams
6. **Archive**: Move old versions to archive folder

## Asset Distribution

### Internal Access
- Central brand portal or shared drive
- Download permissions by role
- Usage tracking and analytics
- Regular asset audits

### External Vendors
- Approved asset packages
- Usage restrictions clearly defined
- Approval workflow for modifications
- Regular compliance checks

### Quality Standards
- **Logos**: Vector formats preferred, minimum 300 DPI for print
- **Colors**: Exact color specifications provided
- **Fonts**: Licensed versions with usage rights
- **Icons**: Consistent grid and stroke weights

## Maintenance Schedule

### Monthly
- Review new asset requests
- Update download statistics
- Check for broken links or files

### Quarterly
- Audit brand compliance across touchpoints
- Update asset packages if needed
- Review and optimize file organization

### Annually
- Complete brand guideline review
- Update legal and trademark information
- Refresh templates and examples
- Archive outdated materials

## Access & Permissions

### Internal Teams
- **Marketing**: Full access to all assets
- **Product**: UI assets and digital guidelines
- **Sales**: Presentation templates and logos
- **Engineering**: Web fonts and CSS variables
- **Legal**: Trademark and usage guidelines

### External Partners
- **Agencies**: Project-specific asset packages
- **Vendors**: Logo and basic brand elements
- **Press**: Approved press kit assets
- **Customers**: Co-marketing approved assets

## Technical Specifications

### Web Assets
- **SVG**: Optimized file sizes, clean markup
- **PNG**: Transparent backgrounds, optimized compression
- **Fonts**: WOFF2 format with fallbacks
- **CSS**: Custom properties for colors and spacing

### Print Assets
- **EPS**: CMYK color mode, embedded fonts
- **PDF**: High resolution, press-ready
- **AI**: Editable source files with layers
- **Color matching**: Pantone specifications provided

This organized structure ensures brand assets are easily accessible, properly maintained, and consistently applied across all Baseout touchpoints. 