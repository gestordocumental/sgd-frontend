import type { ApiUser } from './users'

export interface ApiCompany {
  id: string
  name: string
  nit: string
  status: 'active' | 'inactive'
  city: string
  userCount: number
  createdAt: string
}

export interface CreateCompanyDto {
  name: string
  nit: string
  city: string
}

export interface UpdateCompanyDto {
  name?: string
  nit?: string
  city?: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockCompanies: ApiCompany[] = [
  {
    id: 'c1',
    name: 'Helisa Software S.A.S',
    nit: '900.123.456-7',
    status: 'active',
    city: 'Bogotá',
    userCount: 3,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'c2',
    name: 'TechCorp Colombia Ltda.',
    nit: '800.654.321-2',
    status: 'active',
    city: 'Medellín',
    userCount: 2,
    createdAt: '2024-03-22T08:30:00Z',
  },
  {
    id: 'c3',
    name: 'Inversiones Norte S.A.',
    nit: '700.111.222-3',
    status: 'inactive',
    city: 'Barranquilla',
    userCount: 1,
    createdAt: '2023-11-05T14:00:00Z',
  },
  {
    id: 'c4',
    name: 'Grupo Empresarial del Pacífico',
    nit: '830.456.789-1',
    status: 'active',
    city: 'Cali',
    userCount: 4,
    createdAt: '2024-06-10T11:00:00Z',
  },
]

export const mockCompanyUsers: Record<string, ApiUser[]> = {
  c1: [
    {
      id: 'u1',
      firstName: 'Carlos',
      lastName: 'Martínez',
      position: 'Gerente General',
      email: 'carlos@helisa.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2024-02-01T09:00:00Z',
    },
    {
      id: 'u2',
      firstName: 'Ana',
      lastName: 'López',
      position: 'Coordinadora de Documentación',
      email: 'ana@helisa.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2024-02-15T09:00:00Z',
    },
    {
      id: 'u3',
      firstName: 'Luis',
      lastName: 'Pérez',
      position: 'Analista',
      email: 'luis@helisa.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2024-03-01T09:00:00Z',
      deletedAt: '2024-09-01T00:00:00Z',
    },
  ],
  c2: [
    {
      id: 'u4',
      firstName: 'María',
      lastName: 'García',
      position: 'Directora de Operaciones',
      email: 'maria@techcorp.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2024-04-10T09:00:00Z',
    },
    {
      id: 'u5',
      firstName: 'Jorge',
      lastName: 'Rodríguez',
      position: 'Auxiliar Contable',
      email: 'jorge@techcorp.com',
      registrationStatus: 'pending_credentials',
      isSuperAdmin: false,
      createdAt: '2024-05-20T09:00:00Z',
    },
  ],
  c3: [
    {
      id: 'u6',
      firstName: 'Patricia',
      lastName: 'Gómez',
      position: 'Jefe de Archivo',
      email: 'patricia@inversnorte.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2023-12-01T09:00:00Z',
    },
  ],
  c4: [
    {
      id: 'u7',
      firstName: 'Andrés',
      lastName: 'Torres',
      position: 'Gerente Administrativo',
      email: 'andres@pacifico.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2024-07-01T09:00:00Z',
    },
    {
      id: 'u8',
      firstName: 'Camila',
      lastName: 'Ruiz',
      position: 'Secretaria Ejecutiva',
      email: 'camila@pacifico.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2024-07-15T09:00:00Z',
    },
    {
      id: 'u9',
      firstName: 'Felipe',
      lastName: 'Vargas',
      position: 'Contador',
      email: 'felipe@pacifico.com',
      registrationStatus: 'active',
      isSuperAdmin: false,
      createdAt: '2024-08-01T09:00:00Z',
    },
    {
      id: 'u10',
      firstName: 'Diana',
      lastName: 'Morales',
      position: 'Asistente Jurídico',
      email: 'diana@pacifico.com',
      registrationStatus: 'pending_credentials',
      isSuperAdmin: false,
      createdAt: '2024-08-20T09:00:00Z',
    },
  ],
}

// ── API ───────────────────────────────────────────────────────────────────────

export const companiesApi = {
  list: (): Promise<ApiCompany[]> =>
    Promise.resolve([...mockCompanies]),

  getById: (id: string): Promise<ApiCompany | null> => {
    const company = mockCompanies.find((c) => c.id === id) ?? null
    return Promise.resolve(company ? { ...company } : null)
  },

  create: (dto: CreateCompanyDto): Promise<ApiCompany> => {
    const company: ApiCompany = {
      id: `c${Date.now()}`,
      ...dto,
      status: 'active',
      userCount: 0,
      createdAt: new Date().toISOString(),
    }
    mockCompanies.push(company)
    mockCompanyUsers[company.id] = []
    return Promise.resolve({ ...company })
  },

  update: (id: string, dto: UpdateCompanyDto): Promise<ApiCompany> => {
    const idx = mockCompanies.findIndex((c) => c.id === id)
    if (idx === -1) return Promise.reject(new Error('Empresa no encontrada'))
    mockCompanies[idx] = { ...mockCompanies[idx], ...dto }
    return Promise.resolve({ ...mockCompanies[idx] })
  },

  remove: (id: string): Promise<void> => {
    const idx = mockCompanies.findIndex((c) => c.id === id)
    if (idx !== -1) mockCompanies.splice(idx, 1)
    delete mockCompanyUsers[id]
    return Promise.resolve()
  },

  toggleStatus: (id: string): Promise<ApiCompany> => {
    const idx = mockCompanies.findIndex((c) => c.id === id)
    if (idx === -1) return Promise.reject(new Error('Empresa no encontrada'))
    mockCompanies[idx].status =
      mockCompanies[idx].status === 'active' ? 'inactive' : 'active'
    return Promise.resolve({ ...mockCompanies[idx] })
  },

  listUsers: (companyId: string): Promise<ApiUser[]> =>
    Promise.resolve([...(mockCompanyUsers[companyId] ?? [])]),

  addUser: (companyId: string, user: ApiUser): void => {
    if (!mockCompanyUsers[companyId]) mockCompanyUsers[companyId] = []
    mockCompanyUsers[companyId].push(user)
    const idx = mockCompanies.findIndex((c) => c.id === companyId)
    if (idx !== -1) mockCompanies[idx].userCount++
  },
}
