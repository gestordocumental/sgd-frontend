import { createFileRoute, redirect } from '@tanstack/react-router'

// La raíz redirige al login por defecto
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/login' })
  },
})
