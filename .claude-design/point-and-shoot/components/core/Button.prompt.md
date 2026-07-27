Primary action button in four variants, used across toolbar, popup, and dialogs.

```jsx
<Button variant="primary">Send to agent</Button>
<Button variant="secondary" icon={<Icon name="settings"/>}>Settings</Button>
<Button variant="ghost" size="sm">Cancel</Button>
```

Variants: `primary` (accent fill, the one CTA per view), `secondary` (bordered, elevated fill), `ghost` (text-only, for tertiary actions), `danger` (destructive). Sizes: `sm`/`md`/`lg`. Hover lightens, active/press deepens — never scales.
