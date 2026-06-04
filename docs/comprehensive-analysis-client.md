# Comprehensive Analysis — Client (allo-scrapper)

> Generated: 2026-05-21 | React 19.2 SPA analysis

## Architecture Patterns

### Component Composition
The client follows **composition over inheritance**:
- Pages compose feature components
- Feature components compose UI primitives
- Admin components share patterns (Modal, Dialog, Form)

### Data Fetching Pattern
All server state uses **TanStack Query** hooks:
```tsx
// Pattern: useQuery for reads
const { data, isLoading, error } = useQuery({
  queryKey: ['theaters'],
  queryFn: () => theatersApi.getAll()
})

// Pattern: useMutation for writes
const mutation = useMutation({
  mutationFn: (data) => theatersApi.create(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['theaters'] })
})
```

### Routing Pattern
- **React Router** with nested routes
- Protected routes via auth guards
- Admin routes under `/admin/*` prefix
- Lazy loading for code splitting

---

## State Management Strategy

| State Type | Solution | Location |
|-----------|----------|----------|
| Server data | TanStack Query | Cached, auto-refetch |
| Auth state | Context/JWT tokens | Memory + localStorage |
| UI state | useState/useReducer | Component-local |
| Theme/branding | useTheme hook + CSS vars | White-label system |
| Form state | React Hook Form or controlled | Form components |
| URL state | React Router params | Browser URL |

---

## White-Label System

The client supports full white-label customization:
- **Colors** — Primary, secondary, accent via CSS custom properties
- **Fonts** — Google Fonts integration via FontSelector
- **Logo/Favicon** — Image upload via ImageUpload component
- **Footer Links** — Configurable via FooterLinksEditor
- **Theme** — Managed by `useTheme` hook, persisted to settings API

---

## Performance Optimizations

| Technique | Implementation |
|-----------|---------------|
| Code Splitting | React.lazy + Suspense for admin routes |
| Query Caching | TanStack Query stale-while-revalidate |
| Debounced Search | `useDebounce` hook on search inputs |
| Virtual Scrolling | For large lists (if implemented) |
| Image Optimization | Vite's asset handling |

---

## Error Handling

- **ErrorBoundary** component for React render errors
- **TanStack Query** error states per query (isError, error)
- **API interceptors** for global error handling (401 → logout)
- **Toast/notification** system for user feedback

---

## Testing

| Type | Framework | Location |
|------|-----------|----------|
| Unit tests | Vitest | Co-located `*.test.ts` |
| Component tests | Vitest + Testing Library | Co-located |
| E2E tests | Playwright | `client/e2e/` |

---

## Conventions

- **Functional components** only (no class components)
- **TypeScript strict** — all props typed
- **Tailwind CSS** for all styling (no CSS modules)
- **Named exports** preferred for components
- **Co-located tests** (`*.test.ts` / `*.test.tsx`)
- **Conventional commits** enforced
