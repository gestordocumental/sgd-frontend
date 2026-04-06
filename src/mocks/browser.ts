import { setupWorker } from 'msw/browser'
import { authHandlers } from './handlers/auth'
import { usersHandlers } from './handlers/users'

export const worker = setupWorker(...authHandlers, ...usersHandlers)
