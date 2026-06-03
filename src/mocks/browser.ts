import { setupWorker } from 'msw/browser';
import { authHandlers } from './handlers/auth';
import { usersHandlers } from './handlers/users';
import { workflowsHandlers } from './handlers/workflows';
import { rolesHandlers } from './handlers/roles';
import { companiesHandlers } from './handlers/companies';
import { notificationsHandlers } from './handlers/notifications';

export const worker = setupWorker(
  ...authHandlers,
  ...usersHandlers,
  ...workflowsHandlers,
  ...rolesHandlers,
  ...companiesHandlers,
  ...notificationsHandlers,
);
