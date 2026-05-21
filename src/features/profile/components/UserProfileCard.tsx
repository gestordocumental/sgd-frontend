import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, type ChangeEvent } from "react";
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
  Camera,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { useAuthStore } from "@/store/authStore";
import { initials } from "@/lib/formatters";
import { useUserProfile } from "../hooks/use-user-profile";

interface UserProfileCardProps {
  variant?: "sidebar" | "header";
  onWorkflowClick?: (workflowId: string) => void;
}

export function UserProfileCard({ variant = "sidebar", onWorkflowClick }: UserProfileCardProps) {
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

  const avatarInputRef = useRef<HTMLInputElement>(null)

  const avatarMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
    },
  })

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) avatarMutation.mutate(file)
    e.target.value = ''
  }

  const avatarUrl = userDetails?.avatarUrl ?? null

  const fullName = userDetails
    ? [userDetails.firstName, userDetails.lastName].filter(Boolean).join(" ") ||
      email
    : user?.name || email;

  const contextLabel = currentCompanyId
    ? (companies.find((c) => c.id === currentCompanyId)?.name ??
      user?.companyName ??
      currentCompanyId)
    : t("dashboard.superAdmin");

  const dropdownContent = (
    <DropdownMenuContent
      side={variant === "header" ? "bottom" : "top"}
      align={variant === "header" ? "end" : "start"}
      className="w-64"
    >
      {/* ── Mi perfil + switch de contexto ─────────────────────── */}
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
          {t("profile.myProfile")}
        </DropdownMenuLabel>

        {/* Avatar con botón de cambio */}
        <div className="px-1.5 pb-2 flex justify-center">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="relative group"
            title={t('profile.changeAvatar')}
          >
            <Avatar className="size-14">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? ''} />}
              <AvatarFallback className="text-sm bg-primary/10 text-primary">
                {fullName ? initials(fullName) : (email?.[0]?.toUpperCase() ?? '?')}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="size-4 text-white" />
            </span>
          </button>
        </div>

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

        {/* Switch de contexto */}
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
              const company = companies.find((c) => c.id === id);
              return (
                <DropdownMenuItem
                  key={id}
                  onClick={() => switchToCompany(id)}
                  className="gap-2"
                >
                  <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-xs truncate">
                    {company?.name ??
                      (currentCompanyId === id
                        ? (user?.companyName ?? id)
                        : id)}
                  </span>
                  {currentCompanyId === id && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              );
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
  );

  if (variant === "header") {
    return (
      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <NotificationBell onWorkflowClick={onWorkflowClick} />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors text-left">
            <Avatar className="size-7 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? ''} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {fullName
                  ? initials(fullName)
                  : (email?.[0]?.toUpperCase() ?? "?")}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate max-w-28 hidden sm:block">
              {fullName}
            </span>
            {canSwitchContext && (
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            )}
          </DropdownMenuTrigger>
          {dropdownContent}
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={() => logoutMutation.mutate()}
          title={t("common.logout")}
          aria-label={t("common.logout")}
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-t border-border">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarChange}
      />
      {/* ── User info + context switcher ──────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 w-full rounded-lg px-1.5 py-1.5 hover:bg-accent transition-colors text-left">
          <Avatar className="size-8 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? ''} />}
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
        {dropdownContent}
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
