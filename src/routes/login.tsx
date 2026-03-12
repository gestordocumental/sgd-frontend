import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Iniciar sesión
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Sistema de Gestión Documental
        </p>
        <p className="text-xs text-gray-400 text-center mt-6">
          — formulario de login próximamente —
        </p>
      </div>
    </div>
  )
}
