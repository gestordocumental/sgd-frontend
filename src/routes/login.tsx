import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { decodeJwt } from "@/lib/jwt";
import { loginSchema, type LoginFormValues } from "@/lib/validations/schemas";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  });

  const { mutate: login, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      const token = data.accessToken;
      const payload = token ? decodeJwt(token) : null;
      const isSuperAdmin = payload?.isSuperAdmin === true;

      setAuth(data.user, token, data.refreshToken, isSuperAdmin);
      if (isSuperAdmin) {
        navigate({ to: "/dashboard/admin" });
      } else {
        // TODO: manejar selector de empresa cuando haya múltiples orgs
        navigate({ to: "/dashboard" });
      }
    },
    onError: (error: AxiosError<{ message: string | string[] }>) => {
      const raw = error.response?.data?.message;
      const msg = Array.isArray(raw)
        ? raw[0]
        : (raw ?? "Error al conectar con el servidor. Inténtalo de nuevo.");
      setServerError(msg);
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setServerError(null);
    login(values);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ══════════════════════════════════════════
          Panel izquierdo — ilustración + logo
          Visible solo en pantallas lg+
      ══════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-background relative border-r border-border/50">
        {/*
          LOGO
          ────
          Archivo: /public/logo.svg
          Para reemplazar: sustituir public/logo.svg con el logo definitivo.
          Si el nuevo logo es PNG: cambiar la extensión aquí → src="/logo.png"
          Tamaño recomendado: alto 36px, ancho proporcional.
        */}
        <div className="absolute top-7 left-8">
          <img
            src="/logo.svg"
            alt="SGD — Sistema de Gestión Documental"
            className="h-9 w-auto"
          />
        </div>

        {/*
          ILUSTRACIÓN
          ───────────
          Archivo: /public/illustration-login.svg
          Para reemplazar: sustituir public/illustration-login.svg con la ilustración definitiva.
          Si el nuevo archivo es PNG: cambiar la extensión aquí → src="/illustration-login.png"
          Tamaño recomendado: ~480×420px.
        */}
        <div className="flex-1 flex items-center justify-center p-16">
          <img
            src="/illustration-login.svg"
            alt=""
            aria-hidden="true"
            className="max-w-md w-full"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════
          Panel derecho — formulario de acceso
      ══════════════════════════════════════════ */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-8 bg-muted/30">
        <div className="w-full max-w-sm">
          {/* Logo en móvil (se oculta en lg porque ya aparece en el panel izquierdo) */}
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src="/logo.svg"
              alt="SGD — Sistema de Gestión Documental"
              className="h-9 w-auto"
            />
          </div>

          {/* Encabezado */}
          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight">
              Bienvenido al SGD
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          {/* Formulario */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            {/* Error del servidor */}
            {serverError && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Correo electrónico */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@empresa.com"
                autoComplete="email"
                autoFocus
                disabled={isPending}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Contraseña */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isPending}
                  aria-invalid={!!errors.password}
                  className="pr-9"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* ¿Olvidaste tu contraseña? */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-primary hover:underline underline-offset-4"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Botón de acceso */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending || !isValid}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Verificando credenciales...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </form>

          {/* Credenciales de prueba — solo visible cuando VITE_USE_MOCKS=true */}
          {import.meta.env.VITE_USE_MOCKS === "true" && (
            <div className="mt-6 rounded-lg bg-muted border border-border px-4 py-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                Modo desarrollo — mocks activos
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                admin@sgd.helisa.com · admin123
              </p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground/40 mt-8">
            SGD v0.1.0 — Helisa S.A.S
          </p>
        </div>
      </div>
    </div>
  );
}
