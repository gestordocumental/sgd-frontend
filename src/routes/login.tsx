import { useState } from 'react';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AxiosError } from 'axios';
import { Eye, EyeOff, Loader2, AlertCircle, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';
import { loginSchema, type LoginFormValues } from '@/lib/validations/schemas';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSwitchingCompany, setIsSwitchingCompany] = useState(false);
  const [revokedCompany] = useState<string | null>(() => {
    const name = localStorage.getItem('sgd-revoked-company');
    if (name) localStorage.removeItem('sgd-revoked-company');
    return name;
  });

  const [superAdminRevoked] = useState(() => {
    const flag = localStorage.getItem('sgd-super-admin-revoked');
    if (flag) localStorage.removeItem('sgd-super-admin-revoked');
    return !!flag;
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });

  const { mutate: login, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      const token = data.accessToken;
      const payload = token ? decodeJwt(token) : null;
      const isSuperAdmin = payload?.isSuperAdmin === true;

      if (!data.user && (!payload?.sub || !payload?.email)) {
        setServerError(t('auth.serverErrorFallback'));
        return;
      }

      // Build user from JWT payload — auth-service returns only tokens, no user object
      const baseUser = data.user ?? {
        id: payload?.sub ?? '',
        email: payload?.email ?? '',
        name: payload?.email ?? '',
        role: isSuperAdmin ? 'super-admin' : 'user',
      };

      if (isSuperAdmin) {
        setAuth(baseUser, token, true);
        navigate({ to: '/dashboard/admin' });
        return;
      }

      // Set auth immediately so the subsequent API calls (getMyCompanies, switchCompany)
      // include a valid Authorization header. Without this the requests go out without
      // auth, triggering the silent-refresh interceptor which may use stale cookies
      // from a previous session. On failure we roll back with clearAuth().
      setAuth(baseUser, token, false);
      setIsSwitchingCompany(true);
      try {
        const companies = await authApi.getMyCompanies();
        if (companies.length > 0) {
          const companyId = companies[0];
          const { accessToken: companyToken } = await authApi.switchCompany(companyId);
          setAuth({ ...baseUser, companyId }, companyToken, false);
        }
      } catch {
        useAuthStore.getState().clearAuth();
        setServerError(t('auth.serverErrorFallback'));
        return;
      } finally {
        setIsSwitchingCompany(false);
      }

      navigate({ to: '/dashboard' });
    },
    onError: (error: AxiosError<{ message: string | string[] }>) => {
      const raw = error.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : (raw ?? t('auth.serverErrorFallback'));
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
      <div className="hidden lg:flex lg:w-1/2 flex-col relative border-r border-border/50 overflow-hidden">
        {/* Ilustración de fondo */}
        <img
          src="/illustration-login.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      {/* ══════════════════════════════════════════
          Panel derecho — formulario de acceso
      ══════════════════════════════════════════ */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-8 bg-muted/30 relative">
        {/* Language switcher — top right */}
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm">
          {/* Logo en móvil (se oculta en lg porque ya aparece en el panel izquierdo) */}
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src="/logo.svg"
              alt="SGD — Document Management System"
              className="h-20 w-auto mix-blend-multiply dark:mix-blend-screen"
            />
          </div>

          {/* Encabezado */}
          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight">{t('auth.welcomeTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('auth.welcomeSubtitle')}</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            {/* Aviso de acceso revocado */}
            {revokedCompany && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                <TriangleAlert className="size-4 mt-0.5 shrink-0" />
                <span>{t('auth.revokedCompanyMessage', { company: revokedCompany })}</span>
              </div>
            )}

            {/* Aviso de privilegios de super admin revocados */}
            {superAdminRevoked && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                <TriangleAlert className="size-4 mt-0.5 shrink-0" />
                <span>{t('auth.superAdminRevokedMessage')}</span>
              </div>
            )}

            {/* Error del servidor */}
            {serverError && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Correo electrónico */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('auth.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                autoFocus
                disabled={isPending}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{t(errors.email.message!)}</p>
              )}
            </div>

            {/* Contraseña */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('auth.passwordLabel')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isPending}
                  aria-invalid={!!errors.password}
                  className="pr-9"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{t(errors.password.message!)}</p>
              )}
            </div>

            {/* ¿Olvidaste tu contraseña? */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:underline underline-offset-4"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {/* Botón de acceso */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending || isSwitchingCompany || !isValid}
            >
              {isSwitchingCompany ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('auth.loadingWorkspace')}
                </>
              ) : isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('auth.verifyingCredentials')}
                </>
              ) : (
                t('auth.signIn')
              )}
            </Button>
          </form>

          {/* Credenciales de prueba — solo visible cuando VITE_USE_MOCKS=true */}
          {import.meta.env.VITE_USE_MOCKS === 'true' && (
            <div className="mt-6 rounded-lg bg-muted border border-border px-4 py-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">{t('auth.devMode')}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{t('auth.devCredentials')}</p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground/40 mt-8" aria-hidden="true">
            {t('auth.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}
