import { useState, startTransition } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { UserProfileCard } from "@/features/profile/components/UserProfileCard";
import { FileText, Users, Building2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { isDeleted } from "@/lib/formatters";
import { useAdminUsers } from "@/features/users/hooks/use-admin-users";
import { useAdminCompanies } from "@/features/companies/hooks/use-admin-companies";
import { UsersTable } from "@/features/users/components/UsersTable";
import { CompaniesTable } from "@/features/companies/components/CompaniesTable";
import { UserDialogs } from "@/features/users/components/UserDialogs";
import { CompanyDialogs } from "@/features/companies/components/CompanyDialogs";

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: "/login" });
    if (!isSuperAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"users" | "companies">("users");

  const users = useAdminUsers();
  const companies = useAdminCompanies();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => startTransition(() => setActiveTab(v as "users" | "companies"))}
      className="flex flex-col h-screen bg-background overflow-hidden gap-0"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
        {/* Brand + Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center justify-center size-8 rounded-md bg-primary shrink-0">
              <FileText className="size-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">SGD Helisa</p>
              <p className="text-[10px] text-muted-foreground">
                {t("dashboard.adminPanel")}
              </p>
            </div>
          </div>

          <div className="w-px h-6 bg-border shrink-0" />

          <TabsList>
            <TabsTrigger value="users">
              <Users className="size-4" />
              {t("common.users")}
            </TabsTrigger>
            <TabsTrigger value="companies">
              <Building2 className="size-4" />
              {t("companies.title")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Actions + User controls */}
        <div className="flex items-center gap-2">
          {activeTab === "users" ? (
            <Button size="sm" onClick={() => users.openCreate("super-admin")}>
              <UserPlus className="size-4" /> {t("dashboard.newUser")}
            </Button>
          ) : (
            <Button size="sm" onClick={companies.openCreate}>
              <Building2 className="size-4" /> {t("dashboard.newCompany")}
            </Button>
          )}
          <UserProfileCard variant="header" />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <TabsContent value="users" className="flex-1 overflow-auto">
        <UsersTable hook={users} />
      </TabsContent>
      <TabsContent value="companies" className="flex-1 overflow-auto">
        <CompaniesTable
          hook={companies}
          onCreateUser={(companyId) => users.openCreate("company", companyId)}
          onEditUser={users.openEdit}
          onDeleteUser={users.setDeleteUser}
          onToggleUserStatus={(u) =>
            isDeleted(u)
              ? users.restoreMutation.mutate(u.id)
              : users.deleteMutation.mutate(u.id)
          }
        />
      </TabsContent>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <UserDialogs hook={users} />
      <CompanyDialogs hook={companies} />
    </Tabs>
  );
}
