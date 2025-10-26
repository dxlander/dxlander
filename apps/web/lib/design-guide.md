# DXLander Design System Guide

## Overview

This comprehensive guide ensures consistent design patterns across all pages and components in DXLander. Our design system provides a cohesive, professional, and modern interface that scales beautifully.

## Core Principles

1. **Ocean-themed** - Consistent use of ocean color palette (#3b82f6 family) as primary brand colors
2. **Elegant interactions** - Subtle animations (scale, shadows) and smooth micro-interactions
3. **Consistent spacing** - Use design tokens for spacing and sizing (4, 6, 8 unit system)
4. **Glass morphism** - Leverage backdrop blur effects for modern, layered UI
5. **Typography hierarchy** - Clear information architecture with Satoshi font
6. **Accessibility first** - Proper contrast ratios, focus states, and cursor feedback

## Updated Component Status ✅

### Recently Enhanced Components:

- **✅ Button**: Added `cursor-pointer` and `disabled:cursor-not-allowed`
- **✅ Tabs**: Full ocean theme integration with gradients and hover states
- **✅ Badge**: Ocean-themed variants with proper contrast and transparency
- **✅ FloatingInput**: Removed placeholder conflicts, proper floating labels
- **✅ PageLayout**: Transparent body background, ocean gradient backgrounds
- **✅ Card**: Multiple variants (default, interactive, elevated, glass, gradient)

## Layout Structure

### Page Layout Pattern

```tsx
import { PageLayout, Header, Section } from '@/components/layouts';

export default function MyPage() {
  return (
    <PageLayout background="ocean">
      <Header title="Page Title" badge="Optional" actions={<Button>Action</Button>} />

      <Section spacing="lg" variant="hero">
        {/* Hero content */}
      </Section>

      <Section spacing="md">{/* Main content */}</Section>
    </PageLayout>
  );
}
```

### Component Hierarchy

- **PageLayout**: Root wrapper with consistent background and container
- **Header**: Branded header with title, badges, and actions
- **Section**: Content sections with consistent spacing
- **Cards**: Use Card variants for content grouping
- **IconWrapper**: Consistent icon presentation

## Component Usage Guidelines

### Buttons

```tsx
// Primary actions
<Button variant="default">Primary Action</Button>

// Secondary actions
<Button variant="secondary">Secondary</Button>

// Outline for less important actions
<Button variant="outline">Cancel</Button>

// Ghost for navigation/subtle actions
<Button variant="ghost">Settings</Button>
```

### Cards

```tsx
// Standard content card
<Card variant="default">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Interactive/clickable cards
<Card variant="interactive" onClick={handleClick}>
  {/* Content */}
</Card>

// Elevated important cards
<Card variant="elevated">
  {/* Important content */}
</Card>
```

### Forms

```tsx
// Use FloatingInput for consistent form styling
<FloatingInput label="Field Label" value={value} onChange={handleChange} />

// No placeholder needed - label serves as placeholder
```

### Icons

```tsx
// Wrap icons for consistent presentation
<IconWrapper variant="primary" size="lg">
  <Settings className="h-6 w-6" />
</IconWrapper>

// Available variants and sizes
<IconWrapper variant="default" size="sm">   {/* Light ocean background */}
<IconWrapper variant="primary" size="md">   {/* Ocean gradient background */}
<IconWrapper variant="secondary" size="lg"> {/* Very light ocean background */}
<IconWrapper variant="ghost" size="xl">     {/* Transparent background */}
<IconWrapper variant="outline">             {/* White with ocean border */}
```

### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

<Tabs value={selectedTab} onValueChange={setSelectedTab}>
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="option1">
      <Database className="h-4 w-4" />
      <span>Option 1</span>
      <Badge variant="secondary">New</Badge> {/* Optional badge */}
    </TabsTrigger>
    <TabsTrigger value="option2">Option 2</TabsTrigger>
    <TabsTrigger value="option3">Option 3</TabsTrigger>
  </TabsList>

  <TabsContent value="option1">{/* Content for option 1 */}</TabsContent>
</Tabs>;
```

### Badges

```tsx
// Different badge variants
<Badge variant="default">Primary</Badge>        {/* Ocean gradient */}
<Badge variant="secondary">Recommended</Badge>  {/* Light ocean theme */}
<Badge variant="destructive">Error</Badge>      {/* Red gradient */}
<Badge variant="outline">Info</Badge>           {/* Ocean border only */}
```

### Feature Grid

```tsx
import { FeatureGrid, type FeatureItem } from "@/components/common"

const features: FeatureItem[] = [
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Secure",
    description: "Enterprise-grade security with encryption",
    iconVariant: "primary" // or "default", "secondary", "ghost", "outline"
  },
  // ... more features
]

<FeatureGrid
  features={features}
  columns={3}          // 1, 2, 3, or 4
  gap="lg"            // "sm", "md", "lg"
/>
```

## Color Usage

### Primary Colors (Ocean Palette)

- `ocean-50` to `ocean-100`: Light backgrounds, subtle accents
- `ocean-200` to `ocean-300`: Borders, hover states
- `ocean-500`: Primary brand color
- `ocean-600` to `ocean-700`: Dark accents, text
- `ocean-800` to `ocean-950`: Dark text, high contrast

### Text Colors

- `text-gray-900`: Primary text
- `text-gray-600`: Secondary text
- `text-ocean-600` to `text-ocean-700`: Brand text
- `text-gradient-ocean`: Brand gradient text

### Background Patterns

```tsx
// Standard page background
<PageLayout background="ocean">{/* Includes ocean-themed background gradients */}</PageLayout>
```

## Spacing System

Use design tokens for consistent spacing:

- `gap-4` (1rem): Small gaps
- `gap-6` (1.5rem): Medium gaps
- `gap-8` (2rem): Large gaps
- `p-6`: Standard component padding
- `py-12`: Standard section padding

## Animation Standards

### Hover Effects

```tsx
// Standard hover scaling
className = 'hover:scale-[1.02] active:scale-[0.98] transition-all duration-300';

// Subtle hover scaling for large elements
className = 'hover:scale-[1.01] active:scale-[0.99] transition-all duration-300';
```

### Shadow Effects

```tsx
// Elegant shadows with ocean tint
className = 'shadow-elegant'; // Subtle
className = 'shadow-elegant-lg'; // Medium
className = 'shadow-ocean'; // Prominent
```

## Component Variants

### Feature Presentation

```tsx
import { FeatureGrid, type FeatureItem } from "@/components/common"

const features: FeatureItem[] = [
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Secure",
    description: "Enterprise-grade security",
    iconVariant: "primary"
  },
  // ... more features
]

<FeatureGrid features={features} columns={3} />
```

## Design System Lessons Learned 🎓

### Critical Fixes Applied:

1. **Button Cursor Issue**: Always include `cursor-pointer` for interactive elements
2. **Dark Mode Conflicts**: Use `background: transparent !important` on body to let PageLayout control backgrounds
3. **FloatingInput Placeholder**: Never use `placeholder` prop - conflicts with floating label pattern
4. **Tabs Dark Theme**: Replace generic `bg-muted` with ocean-themed colors
5. **Badge Consistency**: Avoid CSS variables that change in dark mode - use explicit ocean colors

### Common Pitfalls to Avoid:

- ❌ Using `bg-muted` or `bg-secondary` (changes in dark mode)
- ❌ Adding `placeholder` to FloatingInput components
- ❌ Forgetting `cursor-pointer` on interactive elements
- ❌ Using generic Tailwind colors instead of ocean palette
- ❌ Mixing animation durations (stick to 300ms)

## Best Practices

### ✅ DO

- Use `PageLayout` for all pages with proper background variants
- Use design tokens from `/lib/design-tokens.ts`
- Use `IconWrapper` for all icons with proper variants
- Use ocean color palette consistently (`ocean-50` to `ocean-950`)
- Apply standard hover/active animations (`hover:scale-[1.02]`)
- Use FloatingInput for forms (no placeholder prop)
- Include `cursor-pointer` on all interactive elements
- Use proper focus states (`focus-visible:ring-ocean-500/20`)
- Test components in both light and dark mode

### ❌ DON'T

- Hardcode colors (use CSS variables and ocean palette)
- Use different animation timings (stick to 300ms)
- Mix different shadow styles (use shadow-elegant variants)
- Add placeholder to FloatingInput
- Use non-ocean colors for primary elements
- Create custom spacing values (use 4, 6, 8 system)
- Use generic `bg-muted`, `bg-secondary` (use ocean variants)
- Forget hover and focus states

## File Structure

```
components/
├── ui/              # shadcn/ui components (customized)
├── layouts/         # Page layout components
├── common/          # Reusable common components
└── [feature]/       # Feature-specific components

lib/
├── design-tokens.ts # Design system constants
└── design-guide.md  # This guide
```

## Examples

### Simple Page

```tsx
import { PageLayout, Header, Section } from '@/components/layouts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SimplePage() {
  return (
    <PageLayout>
      <Header title="Simple Page" />

      <Section spacing="lg">
        <Card variant="default" className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              This is a simple page following DXLander design patterns.
            </p>
            <Button>Get Started</Button>
          </CardContent>
        </Card>
      </Section>
    </PageLayout>
  );
}
```
