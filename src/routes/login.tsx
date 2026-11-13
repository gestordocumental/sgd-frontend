import { useState, useEffect, useCallback } from 'react';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AxiosError } from 'axios';
import { Eye, EyeOff, AlertCircle, TriangleAlert, Info, Mail, Lock, Moon, Sun } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { LoginScene } from '@/features/auth/LoginScene';
import { computeSceneProgress } from '@/features/auth/login-scene';
import { useLoginTheme } from '@/features/auth/use-login-theme';
import '@/features/auth/login.css';
import { authApi } from '@/lib/api/auth';
import { resolveApiError, type ApiErrorData } from '@/lib/utils/api-error';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';
import { loginSchema, type LoginFormValues } from '@/lib/validations/schemas';
import {
  readState,
  recordFailure,
  recordSuccess,
  isLocked,
  secondsRemaining,
  WARN_THRESHOLD,
  FAIL_LOCK_THRESHOLD,
} from '@/lib/login-throttle';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: LoginPage,
});

/** Versión mostrada en el pie. */
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

/** Sólo se aceptan enlaces http(s); cualquier otra cosa se ignora. */
function safeUrl(value: string | undefined): string | undefined {
  return value && /^https?:\/\//i.test(value) ? value : undefined;
}
const TERMS_URL = safeUrl(import.meta.env.VITE_TERMS_URL);
const PRIVACY_URL = safeUrl(import.meta.env.VITE_PRIVACY_URL);

/**
 * Enlace legal del pie del formulario. Si no hay URL configurada se muestra
 * como texto (no como un enlace muerto).
 */
function LegalLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  if (!href) return <span className="gd-login-legal-text">{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function useLoginThrottle() {
  const [state, setState] = useState(() => readState());

  useEffect(() => {
    if (!isLocked(state)) return;
    const id = setInterval(() => {
      const fresh = readState();
      setState(fresh);
      if (!isLocked(fresh)) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [state.lockedUntil]);

  const trackFailure = useCallback(() => {
    setState(recordFailure());
  }, []);

  const trackSuccess = useCallback(() => {
    recordSuccess();
    setState({ count: 0, lockedUntil: 0 });
  }, []);

  return {
    failCount: state.count,
    locked: isLocked(state),
    secondsLeft: secondsRemaining(state),
    trackFailure,
    trackSuccess,
  };
}

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useTranslation();
  const { failCount, locked, secondsLeft, trackFailure, trackSuccess } = useLoginThrottle();

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSwitchingCompany, setIsSwitchingCompany] = useState(false);
  // true una vez que el login fue aceptado: dispara la animación de ingreso.
  const [opening, setOpening] = useState(false);
  const { theme, isDark, toggle: toggleTheme } = useLoginTheme();
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

  const [idleLogout] = useState(() => {
    const flag = localStorage.getItem('sgd-idle-logout');
    if (flag) localStorage.removeItem('sgd-idle-logout');
    return !!flag;
  });

  const [accountDisabled] = useState(() => {
    const flag = localStorage.getItem('sgd-account-disabled');
    if (flag) localStorage.removeItem('sgd-account-disabled');
    return !!flag;
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });

  // La escena de fondo "organiza el archivo" a medida que se completa el formulario.
  const [emailValue, passwordValue] = useWatch({ control, name: ['email', 'password'] });
  const progress = computeSceneProgress(emailValue ?? '', passwordValue ?? '', isValid || opening);

  const docTypes: unknown = t('auth.login.docTypes', { returnObjects: true });
  const sceneLabels =
    Array.isArray(docTypes) && docTypes.every((d) => typeof d === 'string')
      ? (docTypes as string[])
      : undefined;
  const themeLabel = isDark ? t('auth.login.switchToLight') : t('auth.login.switchToDark');

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

      // Credenciales aceptadas: arranca la animación de ingreso. Se revierte si falla
      // el cambio de empresa, para que un error no deje el formulario oculto.
      setOpening(true);

      // Build user from JWT payload — auth-service returns only tokens, no user object
      const baseUser = data.user ?? {
        id: payload?.sub ?? '',
        email: payload?.email ?? '',
        name: payload?.email ?? '',
        role: isSuperAdmin ? 'super-admin' : 'user',
      };

      if (isSuperAdmin) {
        setAuth(baseUser, token, true);
        trackSuccess();
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
        setOpening(false);
        setServerError(t('auth.serverErrorFallback'));
        return;
      } finally {
        setIsSwitchingCompany(false);
      }

      trackSuccess();
      navigate({ to: '/dashboard' });
    },
    onError: (error: AxiosError<ApiErrorData>) => {
      const fallback = t('auth.serverErrorFallback');
      setServerError(resolveApiError(error, t, fallback) ?? fallback);
      if (error.response?.status === 401) {
        trackFailure();
      }
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    if (locked || opening) return;
    setServerError(null);
    login(values);
  };

  return (
    <div className={`gd-login${isDark ? ' dark' : ''}`}>
      <LoginScene progress={progress} entering={opening} dark={isDark} labels={sceneLabels} />

      {/* Controles superiores: idioma + modo claro/oscuro (el tema sólo afecta al login) */}
      <div className="gd-login-controls">
        <LanguageSwitcher />
        <button
          type="button"
          className="gd-login-theme"
          onClick={(e) => toggleTheme(e.currentTarget)}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <span className="gd-login-theme-icon" key={theme} aria-hidden="true">
            {isDark ? <Sun className="size-[19px]" /> : <Moon className="size-[19px]" />}
          </span>
        </button>
      </div>

      <main className="gd-login-main">
        <div className={`gd-login-col${opening ? ' is-leaving' : ''}`}>
          <img
            className="gd-login-logo"
            src={isDark ? '/logo-gestor-dark.svg' : '/logo-gestor-light.svg'}
            alt="Gestor Documental by HELISA"
          />

          <div className="gd-login-card">
            <h1 className="gd-login-title">{t('auth.signIn')}</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="gd-login-form" noValidate>
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

              {/* Aviso de cierre de sesión automático por inactividad */}
              {idleLogout && (
                <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-sm text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
                  <Info className="size-4 mt-0.5 shrink-0" />
                  <span>{t('auth.idleLogoutNotice')}</span>
                </div>
              )}

              {/* Aviso de cuenta desactivada por un administrador */}
              {accountDisabled && (
                <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span>{t('auth.accountDisabledMessage')}</span>
                </div>
              )}

              {/* Error del servidor */}
              {serverError && !locked && (
                <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Aviso de acercarse al límite de intentos */}
              {!locked && failCount >= WARN_THRESHOLD && (
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                  <TriangleAlert className="size-4 mt-0.5 shrink-0" />
                  <span>
                    {t('auth.loginAttemptsWarning', {
                      count: failCount,
                      threshold: FAIL_LOCK_THRESHOLD,
                    })}
                  </span>
                </div>
              )}

              {/* Bloqueo temporal por demasiados intentos fallidos */}
              {locked && (
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span>{t('auth.loginLocked', { seconds: secondsLeft })}</span>
                </div>
              )}

              <div className="gd-login-fields">
                {/* Correo electrónico */}
                <div className="gd-login-field">
                  <label htmlFor="email" className="gd-login-label">
                    <Mail className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                    {t('auth.emailLabel')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="gd-login-input"
                    placeholder={t('auth.login.emailPlaceholder')}
                    autoComplete="email"
                    autoFocus
                    disabled={isPending}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p id="email-error" role="alert" className="gd-login-error">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      <span>{t(errors.email.message!)}</span>
                    </p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="gd-login-field">
                  <label htmlFor="password" className="gd-login-label">
                    <Lock className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                    {t('auth.passwordLabel')}
                  </label>
                  <div className="gd-login-password">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="gd-login-input has-toggle"
                      placeholder={t('auth.login.passwordPlaceholder')}
                      autoComplete="current-password"
                      disabled={isPending}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="gd-login-eye"
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showPassword ? (
                        <EyeOff className="size-[18px]" strokeWidth={1.8} />
                      ) : (
                        <Eye className="size-[18px]" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" role="alert" className="gd-login-error">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      <span>{t(errors.password.message!)}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Botón de acceso */}
              <button
                type="submit"
                className="gd-login-btn"
                disabled={isPending || isSwitchingCompany || opening || !isValid || locked}
              >
                {locked ? (
                  t('auth.loginLockedButton', { seconds: secondsLeft })
                ) : isSwitchingCompany || opening ? (
                  <>
                    <span className="gd-login-spn" aria-hidden="true" />
                    {t('auth.loadingWorkspace')}
                  </>
                ) : isPending ? (
                  <>
                    <span className="gd-login-spn" aria-hidden="true" />
                    {t('auth.verifyingCredentials')}
                  </>
                ) : (
                  t('auth.login.submit')
                )}
              </button>
            </form>

            <div className="gd-login-link-row">
              <Link to="/forgot-password" className="gd-login-link">
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            <p className="gd-login-legal">
              <Trans
                i18nKey="auth.login.legal"
                components={{
                  terms: <LegalLink href={TERMS_URL} />,
                  privacy: <LegalLink href={PRIVACY_URL} />,
                }}
              />
            </p>
          </div>

          {/* Credenciales de prueba — solo visible cuando VITE_USE_MOCKS=true */}
          {import.meta.env.VITE_USE_MOCKS === 'true' && (
            <div className="gd-login-dev">
              <p className="font-medium">{t('auth.devMode')}</p>
              <p className="mt-0.5 opacity-70">{t('auth.devCredentials')}</p>
            </div>
          )}
        </div>
      </main>

      {/* Mensaje que acompaña la animación de ingreso */}
      <div className={`gd-login-msg${opening ? ' is-on' : ''}`} aria-live="polite">
        <span className="gd-login-msg-spn" aria-hidden="true" />
        {opening ? t('auth.login.openingFile') : ''}
      </div>

      <footer className="gd-login-footer">
        <span>{t('auth.login.copyright', { year: new Date().getFullYear() })}</span>
        <span>{t('auth.login.version', { version: APP_VERSION })}</span>
      </footer>
    </div>
  );
}
