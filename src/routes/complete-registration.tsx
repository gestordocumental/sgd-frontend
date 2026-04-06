import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { AxiosError } from 'axios'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { usersApi } from '@/lib/api/users'
import { newPasswordField, requiredString } from '@/lib/validations/schemas'

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/complete-registration')({
  validateSearch: z.object({
    token: z.string().optional(),
  }),
  component: CompleteRegistrationPage,
})

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    firstName: requiredString('The first name'),
    lastName: requiredString('The last name'),
    idNumber: requiredString('The ID number'),
    password: newPasswordField,
    confirmPassword: z.string().min(1, 'validation.confirmPassword.required'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'validation.confirmPassword.noMatch',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

// ── Page ─────────────────────────────────────────────────────────────────────

function CompleteRegistrationPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const { t } = useTranslation()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  })

  const { mutate: complete, isPending } = useMutation({
    mutationFn: (values: FormValues) => {
      const { confirmPassword, ...payload } = values
      void confirmPassword
      return usersApi.completeRegistration({ ...payload, token: token! })
    },
    onSuccess: () => setSuccess(true),
    onError: (error: AxiosError<{ message: string | string[] }>) => {
      const raw = error.response?.data?.message
      const msg = Array.isArray(raw)
        ? raw[0]
        : (raw ?? t('auth.completeRegistration.serverErrorFallback'))
      setServerError(msg)
    },
  })

  const onSubmit = (values: FormValues) => {
    setServerError(null)
    complete(values)
  }

  const goToLogin = () => navigate({ to: '/login' })

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Panel izquierdo ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-background relative border-r border-border/50">
        <div className="absolute top-7 left-8">
          <img
            src="/logo.svg"
            alt="SGD — Document Management System"
            className="h-9 w-auto"
          />
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

          {/* ── Estado: token inválido ──────────────────────────────── */}
          {!token && <InvalidTokenState onGoToLogin={goToLogin} />}

          {/* ── Estado: registro completado ─────────────────────────── */}
          {token && success && <SuccessState onGoToLogin={goToLogin} />}

          {/* ── Formulario ──────────────────────────────────────────── */}
          {token && !success && (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {t('auth.completeRegistration.title')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('auth.completeRegistration.subtitle')}
                </p>
              </div>

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

                {/* Nombre + Apellido */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="firstName">{t('auth.completeRegistration.firstNameLabel')}</Label>
                    <Input
                      id="firstName"
                      placeholder={t('auth.completeRegistration.firstNamePlaceholder')}
                      autoFocus
                      autoComplete="given-name"
                      disabled={isPending}
                      aria-invalid={!!errors.firstName}
                      {...register('firstName')}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{t(errors.firstName.message!)}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lastName">{t('auth.completeRegistration.lastNameLabel')}</Label>
                    <Input
                      id="lastName"
                      placeholder={t('auth.completeRegistration.lastNamePlaceholder')}
                      autoComplete="family-name"
                      disabled={isPending}
                      aria-invalid={!!errors.lastName}
                      {...register('lastName')}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-destructive">{t(errors.lastName.message!)}</p>
                    )}
                  </div>
                </div>

                {/* Número de identificación */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="idNumber">{t('auth.completeRegistration.idNumberLabel')}</Label>
                  <Input
                    id="idNumber"
                    placeholder="1234567890"
                    autoComplete="off"
                    disabled={isPending}
                    aria-invalid={!!errors.idNumber}
                    {...register('idNumber')}
                  />
                  {errors.idNumber && (
                    <p className="text-xs text-destructive">{t(errors.idNumber.message!)}</p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">{t('auth.completeRegistration.passwordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isPending}
                      aria-invalid={!!errors.password}
                      className="pr-9"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="text-xs text-destructive">{t(errors.password.message!)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t('auth.completeRegistration.passwordHint')}
                    </p>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmPassword">{t('auth.completeRegistration.confirmPasswordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isPending}
                      aria-invalid={!!errors.confirmPassword}
                      className="pr-9"
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{t(errors.confirmPassword.message!)}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isPending || !isValid}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('common.processing')}
                    </>
                  ) : (
                    t('auth.completeRegistration.submitButton')
                  )}
                </Button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground/40 mt-8">
            {t('auth.footer')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InvalidTokenState({ onGoToLogin }: { onGoToLogin: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="text-center space-y-5">
      <div className="flex justify-center">
        <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10">
          <AlertCircle className="size-7 text-destructive" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold">{t('auth.completeRegistration.invalidToken.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {t('auth.completeRegistration.invalidToken.description')}
        </p>
      </div>
      <Button variant="outline" className="w-full" onClick={onGoToLogin}>
        {t('auth.completeRegistration.invalidToken.goToSignIn')}
      </Button>
    </div>
  )
}

function SuccessState({ onGoToLogin }: { onGoToLogin: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="text-center space-y-5">
      <div className="flex justify-center">
        <div className="flex items-center justify-center size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="size-7 text-emerald-600" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold">{t('auth.completeRegistration.success.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {t('auth.completeRegistration.success.description')}
        </p>
      </div>
      <Button className="w-full" size="lg" onClick={onGoToLogin}>
        {t('auth.completeRegistration.success.goToSignIn')}
      </Button>
    </div>
  )
}
