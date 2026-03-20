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
  // Documentos
  {
    id: 'p1',
    name: 'crear_documento',
    label: 'Crear documento',
    description: 'Permite crear nuevos documentos en el sistema',
    category: 'Documentos',
  },
  {
    id: 'p2',
    name: 'ver_documentos',
    label: 'Ver documentos',
    description: 'Permite visualizar documentos existentes',
    category: 'Documentos',
  },
  {
    id: 'p3',
    name: 'editar_documento',
    label: 'Editar documento',
    description: 'Permite editar el contenido de documentos',
    category: 'Documentos',
  },
  {
    id: 'p4',
    name: 'eliminar_documento',
    label: 'Eliminar documento',
    description: 'Permite eliminar documentos del sistema',
    category: 'Documentos',
  },
  {
    id: 'p5',
    name: 'aprobar_documento',
    label: 'Aprobar documento',
    description: 'Permite aprobar documentos en flujo de revisión',
    category: 'Documentos',
  },
  // Usuarios
  {
    id: 'p6',
    name: 'ver_usuarios',
    label: 'Ver usuarios',
    description: 'Permite ver la lista de usuarios de la empresa',
    category: 'Usuarios',
  },
  {
    id: 'p7',
    name: 'gestionar_usuarios',
    label: 'Gestionar usuarios',
    description: 'Permite crear, editar y desactivar usuarios',
    category: 'Usuarios',
  },
  // Reportes
  {
    id: 'p8',
    name: 'ver_reportes',
    label: 'Ver reportes',
    description: 'Permite ver reportes y estadísticas del sistema',
    category: 'Reportes',
  },
  {
    id: 'p9',
    name: 'exportar_reportes',
    label: 'Exportar reportes',
    description: 'Permite exportar reportes en diferentes formatos',
    category: 'Reportes',
  },
  // Configuración
  {
    id: 'p10',
    name: 'ver_configuracion',
    label: 'Ver configuración',
    description: 'Permite ver la configuración de la empresa',
    category: 'Configuración',
  },
  {
    id: 'p11',
    name: 'editar_configuracion',
    label: 'Editar configuración',
    description: 'Permite modificar la configuración de la empresa',
    category: 'Configuración',
  },
]

// ── Mock roles per company ────────────────────────────────────────────────────

const mockRoles: ApiRole[] = [
  {
    id: 'r1',
    name: 'Admin Empresa',
    description: 'Acceso completo a todos los módulos de la empresa',
    permissionIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
    userIds: ['u1', 'u2'],
    companyId: 'c1',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'r2',
    name: 'Gestor Documentos',
    description: 'Creación, edición y aprobación de documentos',
    permissionIds: ['p1', 'p2', 'p3', 'p5'],
    userIds: [],
    companyId: 'c1',
    createdAt: '2024-02-01T10:00:00Z',
  },
  {
    id: 'r3',
    name: 'Visor',
    description: 'Solo lectura de documentos y reportes',
    permissionIds: ['p2', 'p8'],
    userIds: [],
    companyId: 'c1',
    createdAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'r4',
    name: 'Admin Empresa',
    description: 'Acceso completo a todos los módulos',
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
    if (idx === -1) return Promise.reject(new Error('Rol no encontrado'))
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
    if (!role) return Promise.reject(new Error('Rol no encontrado'))
    if (!role.userIds.includes(userId)) role.userIds.push(userId)
    return Promise.resolve({ ...role, userIds: [...role.userIds] })
  },

  removeUserFromRole: (roleId: string, userId: string): Promise<ApiRole> => {
    const role = mockRoles.find((r) => r.id === roleId)
    if (!role) return Promise.reject(new Error('Rol no encontrado'))
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
