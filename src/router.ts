import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Exported so modules outside the React tree (e.g. the axios client) can
// trigger programmatic navigation without touching window.location directly.
export const router = createRouter({
  routeTree,
  // queryClient is injected later in main.tsx via router.update()
  context: { queryClient: undefined as never },
});
