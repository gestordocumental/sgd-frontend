import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AxiosError } from 'axios';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { resolveApiError, type ApiErrorData } from '@/lib/utils/api-error';

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('validation.email.invalid').min(1, 'validation.email.required'),
});

type FormValues = z.infer<typeof schema>;

// ── Page ─────────────────────────────────────────────────────────────────────

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });

  const { mutate: requestReset, isPending } = useMutation({
    mutationFn: (values: FormValues) => authApi.forgotPassword(values.email),
    onSuccess: () => setSuccess(true),
    onError: (error: AxiosError<ApiErrorData>) => {
      const fallback = t('auth.forgotPasswordPage.serverErrorFallback');
      setServerError(resolveApiError(error, t, fallback) ?? fallback);
    },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    requestReset(values);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Panel izquierdo ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-background relative border-r border-border/50">
        <div className="absolute top-7 left-8">
          <img src="/logo.svg" alt="SGD — Document Management System" className="h-9 w-auto" />
        </div>
        <div className="flex-1 flex items-center justify-center p-16">
          <img
            src="/illustration-login.svg"
            alt=""
            aria-hidden="true"
            className="max-w-md w-full"
          />
        </div>
      </div>

      {/* ── Panel derecho ───────────────────────────────────────────── */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-8 bg-muted/30">
        <div className="w-full max-w-sm">
          {/* Logo en móvil */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/logo.svg" alt="SGD" className="h-9 w-auto" />
          </div>

          {/* ── Estado: correo enviado ───────────────────────────────── */}
          {success ? (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="flex items-center justify-center size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="size-7 text-emerald-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {t('auth.forgotPasswordPage.success.title')}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {t('auth.forgotPasswordPage.success.description')}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: '/login' })}
              >
                {t('auth.forgotPasswordPage.success.goToSignIn')}
              </Button>
            </div>
          ) : (
            <>
              {/* Encabezado + botón volver */}
              <div className="mb-7">
                <button
                  type="button"
                  onClick={() => navigate({ to: '/login' })}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ArrowLeft className="size-4" />
                  {t('auth.forgotPasswordPage.backToSignIn')}
                </button>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {t('auth.forgotPasswordPage.title')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('auth.forgotPasswordPage.subtitle')}
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
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
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      autoComplete="email"
                      autoFocus
                      disabled={isPending}
                      aria-invalid={!!errors.email}
                      className="pl-9"
                      {...register('email')}
                    />
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive">{t(errors.email.message!)}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isPending || !isValid}>
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('common.processing')}
                    </>
                  ) : (
                    t('auth.forgotPasswordPage.submitButton')
                  )}
                </Button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground/40 mt-8">{t('auth.footer')}</p>
        </div>
      </div>
    </div>
  );
}
