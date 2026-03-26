export interface ApiPermission {
  id: string
  name: string
  label: string
  description: string
  category: string
}

export interface ApiRole {
  id: string
  name: string
  description: string
  permissionIds: string[]
  userIds: string[]
  companyId: string
  createdAt: string
}

export interface ApiUserPermission {
  userId: string
  permissionId: string
  grantedAt: string
}

export interface CreateRoleDto {
  name: string
  description: string
  permissionIds: string[]
}

export interface UpdateRoleDto {
  name?: string
  description?: string
  permissionIds?: string[]
}

// ── Permissions catalog (global, same for all companies) ──────────────────────

export const ALL_PERMISSIONS: ApiPermission[] = [
  // Documents
  {
    id: 'p1',
    name: 'crear_documento',
    label: 'Create document',
    description: 'Allows creating new documents in the system',
    category: 'Documents',
  },
  {
    id: 'p2',
    name: 'ver_documentos',
    label: 'View documents',
    description: 'Allows viewing existing documents',
    category: 'Documents',
  },
  {
    id: 'p3',
    name: 'editar_documento',
    label: 'Edit document',
    description: 'Allows editing the content of documents',
    category: 'Documents',
  },
  {
    id: 'p4',
    name: 'eliminar_documento',
    label: 'Delete document',
    description: 'Allows deleting documents from the system',
    category: 'Documents',
  },
  {
    id: 'p5',
    name: 'aprobar_documento',
    label: 'Approve document',
    description: 'Allows approving documents in the review workflow',
    category: 'Documents',
  },
  // Users
  {
    id: 'p6',
    name: 'ver_usuarios',
    label: 'View users',
    description: 'Allows viewing the company user list',
    category: 'Users',
  },
  {
    id: 'p7',
    name: 'gestionar_usuarios',
    label: 'Manage users',
    description: 'Allows creating, editing and deactivating users',
    category: 'Users',
  },
  // Reports
  {
    id: 'p8',
    name: 'ver_reportes',
    label: 'View reports',
    description: 'Allows viewing reports and system statistics',
    category: 'Reports',
  },
  {
    id: 'p9',
    name: 'exportar_reportes',
    label: 'Export reports',
    description: 'Allows exporting reports in different formats',
    category: 'Reports',
  },
  // Configuration
  {
    id: 'p10',
    name: 'ver_configuracion',
    label: 'View configuration',
    description: 'Allows viewing the company configuration',
    category: 'Configuration',
  },
  {
    id: 'p11',
    name: 'editar_configuracion',
    label: 'Edit configuration',
    description: 'Allows modifying the company configuration',
    category: 'Configuration',
  },
]

// ── Mock roles per company ────────────────────────────────────────────────────

const mockRoles: ApiRole[] = [
  {
    id: 'r1',
    name: 'Company Admin',
    description: 'Full access to all company modules',
    permissionIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
    userIds: ['u1', 'u2'],
    companyId: 'c1',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'r2',
    name: 'Document Manager',
    description: 'Creation, editing and approval of documents',
    permissionIds: ['p1', 'p2', 'p3', 'p5'],
    userIds: [],
    companyId: 'c1',
    createdAt: '2024-02-01T10:00:00Z',
  },
  {
    id: 'r3',
    name: 'Viewer',
    description: 'Read-only access to documents and reports',
    permissionIds: ['p2', 'p8'],
    userIds: [],
    companyId: 'c1',
    createdAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'r4',
    name: 'Company Admin',
    description: 'Full access to all modules',
    permissionIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
    userIds: ['u4'],
    companyId: 'c2',
    createdAt: '2024-04-01T10:00:00Z',
  },
]

// ── Direct user-permission assignments ────────────────────────────────────────

let mockUserPermissions: ApiUserPermission[] = [
  { userId: 'u2', permissionId: 'p9', grantedAt: '2024-06-01T10:00:00Z' },
]

// ── API ───────────────────────────────────────────────────────────────────────

export const rolesApi = {
  listPermissions: (): Promise<ApiPermission[]> =>
    Promise.resolve([...ALL_PERMISSIONS]),

  listRoles: (companyId: string): Promise<ApiRole[]> =>
    Promise.resolve(
      mockRoles
        .filter((r) => r.companyId === companyId)
        .map((r) => ({ ...r, permissionIds: [...r.permissionIds], userIds: [...r.userIds] })),
    ),

  createRole: (companyId: string, dto: CreateRoleDto): Promise<ApiRole> => {
    const role: ApiRole = {
      id: `r${Date.now()}`,
      ...dto,
      userIds: [],
      companyId,
      createdAt: new Date().toISOString(),
    }
    mockRoles.push(role)
    return Promise.resolve({ ...role, permissionIds: [...role.permissionIds], userIds: [] })
  },

  updateRole: (id: string, dto: UpdateRoleDto): Promise<ApiRole> => {
    const idx = mockRoles.findIndex((r) => r.id === id)
    if (idx === -1) return Promise.reject(new Error('Role not found'))
    mockRoles[idx] = { ...mockRoles[idx], ...dto }
    return Promise.resolve({ ...mockRoles[idx] })
  },

  deleteRole: (id: string): Promise<void> => {
    const idx = mockRoles.findIndex((r) => r.id === id)
    if (idx !== -1) mockRoles.splice(idx, 1)
    return Promise.resolve()
  },

  assignUserToRole: (roleId: string, userId: string): Promise<ApiRole> => {
    const role = mockRoles.find((r) => r.id === roleId)
    if (!role) return Promise.reject(new Error('Role not found'))
    if (!role.userIds.includes(userId)) role.userIds.push(userId)
    return Promise.resolve({ ...role, userIds: [...role.userIds] })
  },

  removeUserFromRole: (roleId: string, userId: string): Promise<ApiRole> => {
    const role = mockRoles.find((r) => r.id === roleId)
    if (!role) return Promise.reject(new Error('Role not found'))
    role.userIds = role.userIds.filter((id) => id !== userId)
    return Promise.resolve({ ...role, userIds: [...role.userIds] })
  },

  listUserPermissions: (_companyId: string): Promise<ApiUserPermission[]> =>
    Promise.resolve([...mockUserPermissions]),

  assignPermissionToUser: (userId: string, permissionId: string): Promise<ApiUserPermission> => {
    const existing = mockUserPermissions.find(
      (up) => up.userId === userId && up.permissionId === permissionId,
    )
    if (existing) return Promise.resolve({ ...existing })
    const up: ApiUserPermission = { userId, permissionId, grantedAt: new Date().toISOString() }
    mockUserPermissions.push(up)
    return Promise.resolve({ ...up })
  },

  revokePermissionFromUser: (userId: string, permissionId: string): Promise<void> => {
    mockUserPermissions = mockUserPermissions.filter(
      (up) => !(up.userId === userId && up.permissionId === permissionId),
    )
    return Promise.resolve()
  },
}
