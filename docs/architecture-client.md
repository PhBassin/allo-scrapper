# Architecture — Client (React Frontend)

## Executive Summary
Single-Page Application built with **React 19.2** + **TypeScript 6.0**, bundled with **Vite 8**. Provides public movie browsing and admin dashboard with role-based access control.

## Technology Stack
| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 19.2.0 |
| Language | TypeScript | ~6.0.2 |
| Bundler | Vite | 8.0 |
| Routing | React Router | 7.13.1 |
| Data Fetching | TanStack React Query | 5.90.21 |
| HTTP Client | Axios | 1.13.6 |
| Styling | Tailwind CSS | 4.1.18 |
| Validation | Zod | 4.3.6 |
| Testing | Vitest + Testing Library | 4.1.1 |

## Architecture Pattern
**Component-based SPA** with centralized state:
- Server state → React Query
- Auth state → React Context (AuthContext + localStorage)
- Theme state → React Context (SettingsContext)
- Local state → useState / useSearchParams

## Component Hierarchy
```
<ErrorBoundary>
  <QueryClientProvider>
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <HomePage>           {/* / */}
                <DaySelector />
                <MovieSearchBar />
                <CinemasQuickLinks />
                <MovieCard> → <CinemaShowtimes> → <ShowtimeList> → <CalendarPopover />
              </HomePage>
              <ProtectedRoute>     {/* /change-password */}
                <ChangePasswordPage />
              </ProtectedRoute>
              <RequirePermission>  {/* /admin */}
                <AdminPage>
                  <CinemasPage />
                  <SchedulesPage />
                  <ReportsPage />
                  <UsersPage />
                  <RoleManagementPage />
                  <SettingsPage />
                  <RateLimitsPage />
                  <SystemPage />
                </AdminPage>
              </RequirePermission>
            </Routes>
          </Layout>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
</ErrorBoundary>
```

## Key Design Decisions
1. **React Query for server state** — No manual cache management, automatic refetch on window focus
2. **JWT in localStorage** — Permissions embedded in token payload, no per-request DB lookup
3. **Permission guards as components** — RequirePermission wraps routes declaratively
4. **Portal rendering for popovers** — CalendarPopover escapes overflow clipping
5. **Memoized components** — MovieCard, DaySelector, CinemaDateSelector for scroll performance
6. **Zod validation at API boundary** — Runtime type safety for auth/permission responses
7. **Dynamic CSS from server** — `/api/theme.css` enables instant white-label changes without rebuild
