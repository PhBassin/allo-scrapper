import type { Router } from 'express';

/**
 * Get the actual route handler from an Express router stack,
 * skipping middleware layers like rate limiters, auth, etc.
 *
 * Returns the last handler in the route's stack (the final route callback).
 */
export function getRouteHandler(
  router: Router,
  path: string,
  method: 'get' | 'post' | 'put' | 'delete',
) {
  const route = router.stack.find(
    (s: any) => s.route?.path === path && s.route?.methods[method],
  )?.route;
  return route?.stack[route.stack.length - 1]?.handle;
}
