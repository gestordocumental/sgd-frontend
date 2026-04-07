import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/lib/api/auth'
import { companiesApi } from '@/lib/api/companies'
import { usersApi } from '@/lib/api/users'
import { useAuthStore } from '@/store/authStore'
import { decodeJwt } from '@/lib/jwt'

export function useUserProfile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isSuperAdmin, accessToken, enterCompany, exitCompany } = useAuthStore()

  // Extract user ID directly from the JWT — store's user.id may be empty if login
  // response doesn't include a user object (backend only returns tokens)
  const tokenPayload = accessToken ? decodeJwt(accessToken) : null
  const userId = tokenPayload?.sub ?? user?.id ?? null

  const currentCompanyId = user?.companyId ?? null

  // If the super admin is in global context and the token isn't saved yet
  // (e.g. session from before this feature was added), save it now.
  useEffect(() => {
    if (isSuperAdmin && !currentCompanyId && accessToken) {
      const key = 'sgd-super-admin-token'
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, accessToken)
      }
    }
  }, [isSuperAdmin, currentCompanyId, accessToken])

  const hasSuperAdminToken =
    !!localStorage.getItem('sgd-super-admin-token') ||
    (isSuperAdmin && !currentCompanyId && !!accessToken)

  // Fetch the IDs of companies this user belongs to
  const { data: companyIds = [] } = useQuery({
    queryKey: ['my-companies'],
    queryFn: authApi.getMyCompanies,
    staleTime: 300_000,
    enabled: !!accessToken,
  })

  // Super admins: load all companies then filter to the user's assigned ones.
  // This avoids per-org permission issues with getById on a global token.
  const { data: allCompanies = [] } = useQuery({
    queryKey: ['all-companies-for-switch'],
    queryFn: companiesApi.list,
    staleTime: 300_000,
    enabled: isSuperAdmin && companyIds.length > 0,
  })

  // Regular users: fetch details per company
  const { data: myCompanies = [] } = useQuery({
    queryKey: ['companies-by-ids', companyIds],
    queryFn: () => Promise.all(companyIds.map((id) => companiesApi.getById(id))),
    staleTime: 300_000,
    enabled: !isSuperAdmin && companyIds.length > 0,
  })

  const companies = isSuperAdmin
    ? allCompanies.filter((c) => companyIds.includes(c.id))
    : myCompanies

  // Fetch full profile of the logged-in user using the ID from the JWT sub claim
  const { data: userDetails } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => usersApi.getById(userId!),
    staleTime: 300_000,
    enabled: !!userId,
    retry: false,
  })

  const canSwitchContext =
    // active super admin with assigned companies, or any user that can return
    hasSuperAdminToken ||
    // regular user in multiple companies
    companies.length > 1

  async function switchToCompany(companyId: string) {
    const { accessToken: companyToken } = await authApi.switchCompany(companyId)
    const decoded = decodeJwt(companyToken)
    const company = companies.find((c) => c.id === companyId)
    enterCompany(companyId, company?.name ?? companyId, companyToken)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['all-companies-for-switch'] }),
      queryClient.invalidateQueries({ queryKey: ['companies-by-ids'] }),
    ])
    // If the token no longer has isSuperAdmin, navigate to company dashboard
    if (!decoded?.isSuperAdmin) {
      navigate({ to: '/dashboard' })
    }
  }

  async function switchToSuperAdmin() {
    const restored = exitCompany()
    if (!restored) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['all-companies-for-switch'] }),
      queryClient.invalidateQueries({ queryKey: ['companies-by-ids'] }),
    ])
    navigate({ to: '/dashboard/admin' })
  }

  const currentCompany = currentCompanyId
    ? (companies.find((c) => c.id === currentCompanyId) ?? null)
    : null

  // Reliable email: userDetails > token payload > store user
  const email = userDetails?.email ?? tokenPayload?.email ?? user?.email ?? null

  return {
    user,
    userDetails,
    email,
    isSuperAdmin,
    currentCompanyId,
    currentCompany,
    companies,
    canSwitchContext,
    hasSuperAdminToken,
    switchToCompany,
    switchToSuperAdmin,
  }
}
