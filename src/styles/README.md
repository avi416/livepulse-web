# OnlineChats Styling System

This folder contains the styling structure for the OnlineChats application, following a clean, modular approach with standard CSS files.

## Structure

- **tokens.css** - Design tokens and variables for the entire application
- **base.css** - Reset styles and base element styling
- **components.css** - Reusable UI components styling
- **pages.css** - Page-specific layouts and styles

## Naming Convention

We follow the BEM (Block, Element, Modifier) methodology for naming CSS classes:

- **Block**: The main component (e.g., `.button`)
- **Element**: A part of the block (e.g., `.button__icon`)
- **Modifier**: A variation of a block or element (e.g., `.button--primary`)

## Design Tokens

All design values are stored as CSS variables in `tokens.css`:

- **Colors**: Primary, secondary, neutrals, semantic colors
- **Typography**: Font sizes, weights, families
- **Spacing**: Consistent spacing scale
- **Borders & Radius**: Border styles and radius values
- **Shadows**: Elevation shadows
- **Animation**: Durations, easing functions

## Responsive Design

We use standard media queries for responsive design:

- **Mobile**: Default (up to 639px)
- **Small**: 640px and up
- **Medium**: 768px and up
- **Large**: 1024px and up
- **X-Large**: 1280px and up
- **2X-Large**: 1536px and up

## Theming

Light and dark theme support via CSS variables and `data-theme` attribute:

```css
/* Light theme (default) */
:root {
  --bg-primary: var(--color-white);
  --text-primary: var(--color-black);
  /* etc... */
}

/* Dark theme */
[data-theme='dark'] {
  --bg-primary: var(--color-black);
  --text-primary: var(--color-white);
  /* etc... */
}
```

## Accessibility

- Keyboard navigation indicators
- Focus states
- High contrast color modes
- Reduced motion support

## Components Overview

The `components.css` file includes styling for:

- **Buttons** - Primary, secondary, ghost variations
- **Avatar** - User avatars with size variations
- **Video Card** - TikTok-style video cards
- **Live Badge** - For indicating live content
- **Action Icons** - Like, comment, share buttons
- **Navigation** - Menu items and navigation elements
- **Search Bar** - Search input styling
- **Tabs** - Tab navigation components
- **Modal/Sheet** - Overlay and bottom sheet components
- **Feed** - Feed layout components
- **Loading States** - Skeleton loaders
- **User Info** - User profile information displays
- **Follow Button** - Follow/Following states
- **Mobile Navigation** - Bottom navigation bar for mobile

## Usage Guidelines

1. Import tokens and base styles at the application entry point
2. Import component styles where needed
3. Import page styles in specific page components
4. Use CSS classes with the defined BEM pattern
5. Avoid inline styles
6. Don't override variables except in theme definitions
