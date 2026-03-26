import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Building2,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Pencil as PencilIcon,
  CheckCircle as CheckIcon,
  XCircle as XIcon,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/ui/stat-card";
import { type ApiCompany } from "@/lib/api/companies";
import { usersApi, type ApiUser } from "@/lib/api/users";
import { initials, isDeleted, formatDate } from "@/lib/formatters";
import type { useAdminCompanies } from "@/features/companies/hooks/use-admin-companies";

type CompaniesHook = ReturnType<typeof useAdminCompanies>;

interface CompaniesTableProps {
  hook: CompaniesHook;
  onCreateUser: (companyId: string) => void;
  onEditUser: (u: ApiUser) => void;
  onDeleteUser: (u: ApiUser) => void;
}

export function CompaniesTable({
  hook,
  onCreateUser,
  onEditUser,
  onDeleteUser,
}: CompaniesTableProps) {
  const {
    companies,
    companiesLoading,
    expandedCompanies,
    selectedCompany,
    openEdit,
    setDeleteCompany,
    toggleExpand,
    toggleStatusMutation,
  } = hook;
  const { t } = useTranslation();

  const totalActiveCompanies = companies.filter(
    (c) => c.status === "active",
  ).length;

  return (
    <main className="p-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title={t('companies.totalCompanies')}
          value={companies.length}
          icon={<Building2 className="size-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('companies.activeCompanies')}
          value={totalActiveCompanies}
          icon={<CheckCircle className="size-5 text-muted-foreground" />}
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">{t('companies.title')}</h2>
        </div>

        {companiesLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('companies.loading')}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('companies.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('companies.companyColumn')}</TableHead>
                <TableHead>{t('companies.nit')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.address')}</TableHead>
                <TableHead>{t('common.phone')}</TableHead>
                <TableHead>{t('common.created')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <Fragment key={company.id}>
                  <TableRow
                    className={
                      selectedCompany?.id === company.id ? "bg-primary/5" : ""
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(company)}
                          className="flex items-center justify-center size-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                        >
                          {expandedCompanies.has(company.id) ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
                            <Building2 className="size-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">
                            {company.name}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {company.nit ?? "—"}
                    </TableCell>
                    <TableCell>
                      {company.status === "active" ? (
                        <Badge
                          variant="outline"
                          className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                        >
                          {t('common.active')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          {t('common.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(company.createdAt)}
                    </TableCell>
                    <TableCell>
                      <CompanyActions
                        company={company}
                        onCreateUser={() => onCreateUser(company.id)}
                        onEdit={() => openEdit(company)}
                        onToggleStatus={() =>
                          toggleStatusMutation.mutate({
                            id: company.id,
                            status:
                              company.status === "active"
                                ? "inactive"
                                : "active",
                          })
                        }
                        onDelete={() => setDeleteCompany(company)}
                      />
                    </TableCell>
                  </TableRow>

                  {expandedCompanies.has(company.id) && (
                    <CompanyUsersRow
                      companyId={company.id}
                      onEditUser={onEditUser}
                      onDeleteUser={onDeleteUser}
                    />
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}

// ── CompanyActions ────────────────────────────────────────────────────────────

interface CompanyActionsProps {
  company: ApiCompany;
  onCreateUser: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function CompanyActions({
  company,
  onCreateUser,
  onEdit,
  onToggleStatus,
  onDelete,
}: CompanyActionsProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreateUser}>
          <UserPlus className="size-4" /> {t('companies.actions.createUser')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon className="size-4" /> {t('companies.actions.editCompany')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleStatus}>
          {company.status === "active" ? (
            <>
              <XCircle className="size-4" /> {t('companies.actions.deactivateCompany')}
            </>
          ) : (
            <>
              <CheckCircle className="size-4" /> {t('companies.actions.activateCompany')}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" /> {t('companies.actions.deleteCompany')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── CompanyUsersRow ───────────────────────────────────────────────────────────

interface CompanyUsersRowProps {
  companyId: string;
  onEditUser: (u: ApiUser) => void;
  onDeleteUser: (u: ApiUser) => void;
}

function CompanyUsersRow({
  companyId,
  onEditUser,
  onDeleteUser,
}: CompanyUsersRowProps) {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={7} className="p-0">
        <div className="bg-muted/40 border-b border-border">
          <div className="pl-14 pr-6 py-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('companies.companyUsers')}
            </p>

            {isLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t('companies.loadingUsers')}
              </p>
            ) : users.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t('companies.noUsers')}
              </p>
            ) : (
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs py-2.5">{t('common.user')}</TableHead>
                      <TableHead className="text-xs py-2.5">{t('common.status')}</TableHead>
                      <TableHead className="text-xs py-2.5">
                        {t('companies.registrationStatus')}
                      </TableHead>
                      <TableHead className="text-xs py-2.5">{t('common.role')}</TableHead>
                      <TableHead className="w-10 py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow
                        key={u.id}
                        className={isDeleted(u) ? "opacity-50" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {initials(u.firstName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {isDeleted(u) ? (
                            <Badge variant="destructive" className="text-xs">
                              {t('common.inactive')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                            >
                              {t('common.active')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.registrationStatus === "pending_credentials" ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <ShieldCheck className="size-3" /> {t('companies.pendingCredentials')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                            >
                              <ShieldCheck className="size-3" /> {t('common.registered')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {u.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map((r) => (
                                <Badge key={r.roleId} variant="secondary" className="text-xs">
                                  {r.roleName}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t('common.noRole')}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                              <MoreHorizontal className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditUser(u)}>
                                <PencilIcon className="size-4" /> {t('companies.actions.editUser')}
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                {isDeleted(u) ? (
                                  <>
                                    <CheckIcon className="size-4" /> {t('companies.actions.activateUser')}
                                  </>
                                ) : (
                                  <>
                                    <XIcon className="size-4" /> {t('companies.actions.deactivateUser')}
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteUser(u)}
                              >
                                <Trash2 className="size-4" /> {t('companies.actions.deleteUser')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
