import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { UserProfileCard } from "@/features/profile/components/UserProfileCard";
import { FileText, Users, Building2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NavItem } from "@/components/ui/nav-item";
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
          <div className="flex items-center justify-center size-8 rounded-md bg-primary shrink-0">
            <FileText className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">SGD Helisa</p>
            <p className="text-[10px] text-muted-foreground">
              {t("dashboard.adminPanel")}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            {t("dashboard.management")}
          </p>
          <NavItem
            icon={<Users className="size-4" />}
            label={t("common.users")}
            active={activeTab === "users"}
            onClick={() => setActiveTab("users")}
          />
          <NavItem
            icon={<Building2 className="size-4" />}
            label={t("companies.title")}
            active={activeTab === "companies"}
            onClick={() => setActiveTab("companies")}
          />
        </nav>

        <UserProfileCard />
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "users" | "companies")}
        className="flex-1 min-w-0 overflow-hidden gap-0"
      >
        <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
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
          {activeTab === "users" ? (
            <Button size="sm" onClick={() => users.openCreate("super-admin")}>
              <UserPlus className="size-4" /> {t("dashboard.newUser")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                companies.createForm.reset();
                companies.setCreateOpen(true);
              }}
            >
              <Building2 className="size-4" /> {t("dashboard.newCompany")}
            </Button>
          )}
        </header>

        <TabsContent value="users" className="overflow-auto">
          <UsersTable hook={users} />
        </TabsContent>
        <TabsContent value="companies" className="overflow-auto">
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
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <UserDialogs hook={users} />
      <CompanyDialogs hook={companies} />
    </div>
  );
}
