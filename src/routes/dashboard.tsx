import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { FileText, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  const { mutate: logout } = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth()
      navigate({ to: '/login' })
    },
  })

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary">
              <FileText className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Sistema de Gestión Documental</h1>
              <p className="text-xs text-muted-foreground">Helisa S.A.S</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => logout()}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenido, {user?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Autenticación completada · rol: <span className="font-medium text-foreground">{user?.role}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Los módulos de gestión documental se implementarán en los siguientes sprints.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
