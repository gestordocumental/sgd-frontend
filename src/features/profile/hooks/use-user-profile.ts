import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/auth';
import { companiesApi, type ApiCompany } from '@/lib/api/companies';
import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';

const EMPTY_COMPANY_IDS: string[] = [];
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

  // Fetch the IDs of companies this user belongs to
  const { data: companyIds = EMPTY_COMPANY_IDS } = useQuery({
    queryKey: ['my-companies'],
    queryFn: authApi.getMyCompanies,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!accessToken,
  });

  // Super admins: load all companies then filter to the user's assigned ones.
  // This avoids per-org permission issues with getById on a global token.
  // limit=500 fetches the full list in one request — this is the context-switcher,
  // not the admin table, so we need the complete dataset without pagination UI.
  const { data: allCompaniesResult } = useQuery({
    queryKey: ['all-companies-for-switch'],
    queryFn: () => companiesApi.list({ limit: 500 }),
    staleTime: 300_000,
    enabled: isSuperAdmin && companyIds.length > 0,
  });

  const allCompanies: ApiCompany[] = allCompaniesResult?.data ?? EMPTY_COMPANIES;

  // Regular users: fetch details per company.
  // Use allSettled so a 403 on a non-current company (OrgGuard requires companyId === :id)
  // doesn't wipe out the whole list.
  const { data: myCompanies = EMPTY_COMPANIES } = useQuery({
    queryKey: ['companies-by-ids', companyIds],
    queryFn: async () => {
      const results = await Promise.allSettled(companyIds.map((id) => companiesApi.getById(id)));
      return results
        .filter((r): r is PromiseFulfilledResult<ApiCompany> => r.status === 'fulfilled')
        .map((r) => r.value);
    },
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
              (id) => myCompanies.find((c) => c.id === id) ?? allCompanies.find((c) => c.id === id),
            )
            .filter((c): c is ApiCompany => c !== undefined),
    [allCompanies, companyIds, isSuperAdmin, myCompanies],
  );

  // Fetch full profile of the logged-in user using the ID from the JWT sub claim
  const { data: userDetails } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => usersApi.getById(userId!),
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
      const { accessToken: companyToken, refreshToken: companyRefresh } =
        await authApi.switchCompany(companyId);
      const company = companies.find((c) => c.id === companyId);
      enterCompany(companyId, company?.name ?? companyId, companyToken, companyRefresh);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-companies'] }),
        queryClient.invalidateQueries({ queryKey: ['all-companies-for-switch'] }),
        queryClient.invalidateQueries({ queryKey: ['companies-by-ids'] }),
        queryClient.removeQueries({ queryKey: ['my-org-roles'] }),
      ]);
      navigate({ to: '/dashboard' });
    },
    [companies, enterCompany, navigate, queryClient],
  );

  const switchToSuperAdmin = useCallback(async () => {
    const restored = await exitCompany();
    if (!restored) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['all-companies-for-switch'] }),
      queryClient.invalidateQueries({ queryKey: ['companies-by-ids'] }),
      queryClient.removeQueries({ queryKey: ['my-org-roles'] }),
    ]);
    navigate({ to: '/dashboard/admin' });
  }, [exitCompany, navigate, queryClient]);

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
      const otherId = ids.find((id) => id !== orgId);
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
