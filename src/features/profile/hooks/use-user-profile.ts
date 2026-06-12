import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/auth';
import { companiesApi, fetchAllCompanies, type ApiCompany } from '@/lib/api/companies';
import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';

const EMPTY_COMPANY_IDS: string[] = [];
// localStorage key for company list snapshot taken when super-admin enters
// a company context.  Allows showing correct names after a page refresh or in
// a new tab, when the all-companies query is disabled (company token has
// isSuperAdmin: false).  localStorage is used instead of sessionStorage so the
// cache is shared across tabs opened while the user is in company context.
const COMPANIES_CACHE_KEY = 'sgd-companies-cache';
const EMPTY_COMPANIES: ApiCompany[] = [];

export function useUserProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const {
    user,
    isSuperAdmin,
    accessToken,
    enterCompany,
    exitCompany,
    clearAuth,
    hasSuperAdminContext,
  } = useAuthStore();

  // Extract user ID directly from the JWT — store's user.id may be empty if login
  // response doesn't include a user object (backend only returns tokens)
  const tokenPayload = accessToken ? decodeJwt(accessToken) : null;
  const userId = tokenPayload?.sub ?? user?.id ?? null;

  const currentCompanyId = user?.companyId ?? null;

  const hasSuperAdminToken =
    hasSuperAdminContext || (isSuperAdmin && !currentCompanyId && !!accessToken);

  // Company list snapshot derived from localStorage.
  // When hasSuperAdminContext is true but isSuperAdmin is false (company-scoped
  // token), the all-companies query is disabled and React Query cache is gone,
  // so non-current companies would otherwise display as raw IDs.
  // useMemo avoids a useState+useEffect pair and re-reads on every context switch.
  const sessionCompanies = useMemo<ApiCompany[]>(() => {
    if (!hasSuperAdminContext) return EMPTY_COMPANIES;
    try {
      const raw = localStorage.getItem(COMPANIES_CACHE_KEY);
      return raw ? (JSON.parse(raw) as ApiCompany[]) : EMPTY_COMPANIES;
    } catch {
      return EMPTY_COMPANIES;
    }
  }, [hasSuperAdminContext]);

  // Fetch the IDs of companies this user belongs to
  const { data: companyIds = EMPTY_COMPANY_IDS } = useQuery({
    queryKey: ['my-companies'],
    queryFn: ({ signal }) => authApi.getMyCompanies(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!accessToken,
  });

  // Super admins: load all companies then filter to the user's assigned ones.
  // This avoids per-org permission issues with getById on a global token.
  // fetchAllCompanies paginates automatically (100/page) so results are never
  // silently truncated regardless of how many organisations exist.
  const { data: allCompanies = EMPTY_COMPANIES } = useQuery({
    queryKey: ['all-companies-for-switch'],
    queryFn: ({ signal }) => fetchAllCompanies(signal),
    staleTime: 300_000,
    enabled: isSuperAdmin && companyIds.length > 0,
  });

  // Regular users: resolve org names in one call via GET /org/mine?ids=...
  // The frontend already has the org IDs from /auth/me/companies; passing them
  // directly avoids any cross-service call inside org-service (which would require
  // a token the user-service doesn't accept from org-service).
  const { data: myCompanies = EMPTY_COMPANIES } = useQuery({
    queryKey: ['my-org-details', companyIds],
    queryFn: ({ signal }) => companiesApi.getMyOrgs(companyIds, signal),
    staleTime: 300_000,
    enabled: !isSuperAdmin && companyIds.length > 0,
  });

  // When a super-admin switches into a company context their token becomes
  // company-scoped (isSuperAdmin: false). The myCompanies query can only fetch
  // the active company (OrgGuard 403s for others). Use the cached allCompanies
  // data — which React Query retains even after the query is disabled — to fill
  // in the companies that myCompanies couldn't reach.
  const companies = useMemo(
    () =>
      isSuperAdmin
        ? allCompanies.filter((c) => companyIds.includes(c.id))
        : companyIds
            .map(
              (id) =>
                myCompanies.find((c) => c.id === id) ??
                allCompanies.find((c) => c.id === id) ??
                sessionCompanies.find((c) => c.id === id),
            )
            .filter((c): c is ApiCompany => c !== undefined),
    [allCompanies, companyIds, isSuperAdmin, myCompanies, sessionCompanies],
  );

  // Fetch full profile of the logged-in user. Uses /users/me (no USERS:READ
  // required) so any role (VIEWER, EDITOR, etc.) can load their own profile.
  const { data: userDetails } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: ({ signal }) => usersApi.getMe(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!userId,
    retry: false,
  });

  const canSwitchContext =
    // active super admin with assigned companies, or any user that can return
    hasSuperAdminToken ||
    // regular user in multiple companies — use companyIds (not companies) because
    // getById may fail for non-current companies due to the OrgGuard companyId check
    companyIds.length > 1;

  const switchToCompany = useCallback(
    async (companyId: string) => {
      const { accessToken: companyToken } = await authApi.switchCompany(companyId);
      const company = companies.find((c) => c.id === companyId);
      // Persist the full company list before entering company context so that
      // after a page refresh or in a new tab (when isSuperAdmin becomes false and
      // the all-companies query is disabled) company names are still available.
      if (companies.length > 0) {
        localStorage.setItem(COMPANIES_CACHE_KEY, JSON.stringify(companies));
      }
      enterCompany(companyId, company?.name ?? companyId, companyToken);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-companies'] }),
        queryClient.invalidateQueries({ queryKey: ['all-companies-for-switch'] }),
        queryClient.invalidateQueries({ queryKey: ['my-org-details'] }),
        queryClient.removeQueries({ queryKey: ['my-org-roles'] }),
        // Workflow data is company-scoped but the query keys don't include companyId,
        // so React Query can't detect staleness automatically on company switch.
        queryClient.removeQueries({ queryKey: ['workflows'] }),
        queryClient.removeQueries({ queryKey: ['workflows-my-tasks'] }),
        queryClient.removeQueries({ queryKey: ['workflows-my-available'] }),
        queryClient.removeQueries({ queryKey: ['workflow-timeline'] }),
        queryClient.removeQueries({ queryKey: ['workflow'] }),
      ]);
      navigate({ to: '/dashboard' });
    },
    [companies, enterCompany, navigate, queryClient],
  );

  const switchToSuperAdmin = useCallback(async () => {
    const restored = await exitCompany();
    if (!restored) {
      toast.error(t('profile.exitCompanyFailed'));
      return;
    }
    // No longer in company context — the cached company list is no longer needed.
    localStorage.removeItem(COMPANIES_CACHE_KEY);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['all-companies-for-switch'] }),
      queryClient.invalidateQueries({ queryKey: ['my-org-details'] }),
      queryClient.removeQueries({ queryKey: ['my-org-roles'] }),
      queryClient.removeQueries({ queryKey: ['workflows'] }),
      queryClient.removeQueries({ queryKey: ['workflows-my-tasks'] }),
      queryClient.removeQueries({ queryKey: ['workflows-my-available'] }),
      queryClient.removeQueries({ queryKey: ['workflow-timeline'] }),
      queryClient.removeQueries({ queryKey: ['workflow'] }),
    ]);
    navigate({ to: '/dashboard/admin' });
  }, [exitCompany, navigate, queryClient, t]);

  const currentCompany = currentCompanyId
    ? (companies.find((c) => c.id === currentCompanyId) ?? null)
    : null;

  // Reliable email: userDetails > token payload > store user
  const email = userDetails?.email ?? tokenPayload?.email ?? user?.email ?? null;

  // ── Session revocation — triggered by SSE when admin removes this user ──────
  // Use a ref so the handler always sees fresh values without re-registering
  const ctxRef = useRef({
    companyIds,
    currentCompany,
    companies,
    hasSuperAdminToken,
    switchToCompany,
    switchToSuperAdmin,
    clearAuth,
    navigate,
    t,
  });

  useEffect(() => {
    ctxRef.current = {
      companyIds,
      currentCompany,
      companies,
      hasSuperAdminToken,
      switchToCompany,
      switchToSuperAdmin,
      clearAuth,
      navigate,
      t,
    };
  }, [
    companyIds,
    currentCompany,
    companies,
    hasSuperAdminToken,
    switchToCompany,
    switchToSuperAdmin,
    clearAuth,
    navigate,
    t,
  ]);

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ orgId?: string } | undefined>).detail;
      const { orgId } = detail ?? {};
      const {
        companyIds: ids,
        currentCompany: company,
        companies: allCompanies,
        hasSuperAdminToken: hasAdminToken,
        switchToCompany: doSwitch,
        switchToSuperAdmin: doSuperAdmin,
        clearAuth: doLogout,
        navigate: go,
        t: translate,
      } = ctxRef.current;

      const companyName =
        company?.name ?? orgId ?? translate('profile.sessionRevoked.unknownCompany');

      // Case 1: super admin that entered a company context → go back to global
      if (hasAdminToken) {
        toast.warning(
          translate('profile.sessionRevoked.switchToGlobal', { company: companyName }),
          {
            duration: 5000,
          },
        );
        await doSuperAdmin();
        return;
      }

      // Case 2: belongs to other companies → auto-switch
      const revokedOrgId = orgId ?? company?.id;
      const otherId = revokedOrgId ? ids.find((id) => id !== revokedOrgId) : undefined;
      if (otherId) {
        const otherName = allCompanies.find((c) => c.id === otherId)?.name;
        const msg = otherName
          ? translate('profile.sessionRevoked.switchingTo', {
              company: companyName,
              other: otherName,
            })
          : translate('profile.sessionRevoked.removedFrom', { company: companyName });
        toast.warning(msg, { duration: 5000 });
        await doSwitch(otherId);
        return;
      }

      // Case 3: no other companies → log out with a message on the login page
      localStorage.setItem('sgd-revoked-company', companyName);
      doLogout();
      void go({ to: '/login', replace: true });
    };

    window.addEventListener('sgd:session-revoked', handler);
    return () => window.removeEventListener('sgd:session-revoked', handler);
  }, []); // stable — reads from ref

  useEffect(() => {
    const handler = () => {
      const { clearAuth: doLogout, navigate: go } = ctxRef.current;
      localStorage.setItem('sgd-super-admin-revoked', '1');
      doLogout();
      void go({ to: '/login', replace: true });
    };
    window.addEventListener('sgd:super-admin-revoked', handler);
    return () => window.removeEventListener('sgd:super-admin-revoked', handler);
  }, []); // stable — reads from ref

  // Relay revocation events from other tabs via BroadcastChannel.
  // BroadcastChannel does not deliver back to the posting tab, so this only
  // fires in tabs that did NOT receive the original SSE event. Retransmitting
  // as a window custom event lets the existing handlers above take care of it.
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('sgd-session');
    } catch {
      // BroadcastChannel not supported (e.g. Safari < 15.4, some WebViews) — cross-tab sync disabled
      return;
    }
    bc.onmessage = ({ data }: MessageEvent<{ type: string; orgId?: string }>) => {
      if (data.type === 'sgd:session-revoked') {
        window.dispatchEvent(new CustomEvent('sgd:session-revoked', { detail: data }));
      } else if (data.type === 'sgd:super-admin-revoked') {
        window.dispatchEvent(new CustomEvent('sgd:super-admin-revoked'));
      }
    };
    return () => bc?.close();
  }, []);

  return {
    user,
    userDetails,
    email,
    isSuperAdmin,
    currentCompanyId,
    currentCompany,
    companies,
    companyIds,
    canSwitchContext,
    hasSuperAdminToken,
    switchToCompany,
    switchToSuperAdmin,
  };
}
