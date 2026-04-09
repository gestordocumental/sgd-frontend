import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  ChevronsUpDown,
  Building2,
  ShieldCheck,
  Check,
  MapPin,
  Phone,
  Hash,
  Briefcase,
  CreditCard,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { initials } from "@/lib/formatters";
import { useUserProfile } from "../hooks/use-user-profile";

export function UserProfileCard() {
  const navigate = useNavigate();
  const { clearAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const {
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
  } = useUserProfile();

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.clear();
      clearAuth();
      navigate({ to: "/login" });
    },
  });

  const fullName = userDetails
    ? [userDetails.firstName, userDetails.lastName].filter(Boolean).join(" ") ||
      email
    : user?.name || email;

  const contextLabel = currentCompanyId
    ? (companies.find((c) => c.id === currentCompanyId)?.name ??
      user?.companyName ??
      currentCompanyId)
    : t("dashboard.superAdmin");

  return (
    <div className="px-3 py-3 border-t border-border">
      {/* ── User info + context switcher ──────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 w-full rounded-lg px-1.5 py-1.5 hover:bg-accent transition-colors text-left">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {fullName
                ? initials(fullName)
                : (email?.[0]?.toUpperCase() ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate leading-tight">
              {fullName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight">
              {contextLabel}
            </p>
          </div>
          {canSwitchContext && (
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="w-64">
          {/* ── Mi perfil + switch de contexto ─────────────────────── */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
              {t("profile.myProfile")}
            </DropdownMenuLabel>

            {/* Datos del usuario */}
            <div className="px-1.5 pb-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <User className="size-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium truncate flex-1">
                  {fullName ?? t("common.user")}
                </span>
                {isSuperAdmin && !currentCompanyId && (
                  <span className="shrink-0 text-[10px] px-1 rounded-sm font-medium bg-primary/10 text-primary">
                    {t("dashboard.superAdmin")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Hash className="size-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  {email}
                </span>
              </div>
              {userDetails?.position && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {userDetails.position}
                  </span>
                </div>
              )}
              {userDetails?.idNumber && (
                <div className="flex items-center gap-1.5">
                  <CreditCard className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {userDetails.idNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Switch de contexto — dentro de la misma sección */}
            {canSwitchContext && (
              <>
                <div className="mx-1.5 my-1 h-px bg-border" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-0.5">
                  {t("profile.switchContext")}
                </p>

                {hasSuperAdminToken && (
                  <DropdownMenuItem
                    onClick={switchToSuperAdmin}
                    className="gap-2"
                  >
                    <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-xs">
                      {t("dashboard.superAdmin")}
                    </span>
                    {!currentCompanyId && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                )}

                {companyIds.map((id) => {
                  const company = companies.find((c) => c.id === id)
                  return (
                    <DropdownMenuItem
                      key={id}
                      onClick={() => switchToCompany(id)}
                      className="gap-2"
                    >
                      <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-xs truncate">
                        {company?.name ?? (currentCompanyId === id ? (user?.companyName ?? id) : id)}
                      </span>
                      {currentCompanyId === id && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </>
            )}
          </DropdownMenuGroup>

          {/* ── Información de la empresa activa ───────────────────── */}
          {currentCompany && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
                  {t("companyInfo.title")}
                </DropdownMenuLabel>
                <div className="px-1.5 py-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate flex-1">
                      {currentCompany.name}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] px-1 rounded-sm font-medium ${currentCompany.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}
                    >
                      {currentCompany.status === "active"
                        ? t("common.active")
                        : t("common.inactive")}
                    </span>
                  </div>
                  {currentCompany.nit && (
                    <div className="flex items-center gap-1.5">
                      <Hash className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {currentCompany.nit}
                      </span>
                    </div>
                  )}
                  {currentCompany.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground leading-tight">
                        {currentCompany.address}
                      </span>
                    </div>
                  )}
                  {currentCompany.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {currentCompany.phone}
                      </span>
                    </div>
                  )}
                </div>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Bottom actions ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-1.5 px-1">
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={() => logoutMutation.mutate()}
          title={t("common.logout")}
          aria-label={t("common.logout")}
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
