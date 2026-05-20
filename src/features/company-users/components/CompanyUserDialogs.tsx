import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import type { useCompanyUsers } from "@/features/company-users/hooks/use-company-users";

type CompanyUsersHook = ReturnType<typeof useCompanyUsers>;

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

interface CompanyUserDialogsProps {
  hook: CompanyUsersHook;
  companyName: string | undefined;
  companyId: string;
}

export function CompanyUserDialogs({
  hook,
  companyName,
  companyId,
}: CompanyUserDialogsProps) {
  const {
    createUserOpen,
    setCreateUserOpen,
    invitedUser,
    setInvitedUser,
    editUser,
    setEditUser,
    deleteUser,
    setDeleteUser,
    createForm,
    editForm,
    createMutation,
    editMutation,
    deleteMutation,
    roles,
    departamentos,
    areas,
    cargos,
    selectedDeptId,
    setSelectedDeptId,
    selectedAreaId,
    setSelectedAreaId,
    editAreas,
    editCargos,
    editSelectedDeptId,
    setEditSelectedDeptId,
    editSelectedAreaId,
    setEditSelectedAreaId,
  } = hook;
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const invitationUrl = invitedUser?.invitationUrl ?? '';

  const handleCopy = () => {
    void navigator.clipboard.writeText(invitationUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {/* ── Invitación enviada / reenviada ────────────────────────── */}
      <Dialog
        open={!!invitedUser}
        onOpenChange={(o) => {
          if (!o) {
            setInvitedUser(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
              {invitedUser?.invitationResent
                ? t('users.dialogs.invitationResent.title')
                : t('users.dialogs.invitationSent.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              {invitedUser?.invitationResent
                ? t('users.dialogs.invitationResent.description', { email: invitedUser?.email })
                : t('users.dialogs.invitationSent.description', { email: invitedUser?.email })}
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('users.dialogs.invitationSent.linkLabel')}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={invitationUrl}
                  className="text-xs font-mono bg-muted/50 truncate"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={handleCopy}
                  title={t('users.dialogs.invitationSent.copyTitle')}
                >
                  {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/60">
              {t('users.dialogs.invitationSent.expiry')}
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => { setInvitedUser(null); setCopied(false); }}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Crear usuario ─────────────────────────────────────────── */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("users.dialogs.newUserTitle", { companyName })}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((values) =>
              createMutation.mutate({
                ...values,
                isSuperAdmin: false,
                orgId: companyId,
              }),
            )}
            className="space-y-4 pt-2"
          >
            <FormField
              id="cu-email"
              label={t("common.email")}
              error={createForm.formState.errors.email?.message}
            >
              <Input
                id="cu-email"
                type="email"
                placeholder={t("users.dialogs.emailPlaceholder")}
                {...createForm.register("email")}
              />
            </FormField>

            {/* ── Org-structure ──────────────────────────────────── */}
            <FormField id="cu-dept" label={t("orgStructure.departamento")}>
              <select
                id="cu-dept"
                className={selectCls}
                value={selectedDeptId}
                {...createForm.register("departamentoId")}
                onChange={(e) => {
                  createForm.setValue(
                    "departamentoId",
                    e.target.value || undefined,
                  );
                  createForm.setValue("areaId", undefined);
                  createForm.setValue("cargoId", undefined);
                  setSelectedDeptId(e.target.value);
                  setSelectedAreaId("");
                }}
              >
                <option value="">{t("orgStructure.selectDepartamento")}</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="cu-area" label={t("orgStructure.area")}>
              <select
                id="cu-area"
                className={selectCls}
                disabled={!selectedDeptId}
                value={selectedAreaId}
                {...createForm.register("areaId")}
                onChange={(e) => {
                  createForm.setValue("areaId", e.target.value || undefined);
                  createForm.setValue("cargoId", undefined);
                  setSelectedAreaId(e.target.value);
                }}
              >
                <option value="">{t("orgStructure.selectArea")}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="cu-cargo" label={t("orgStructure.cargos")}>
              <select
                id="cu-cargo"
                className={selectCls}
                disabled={!selectedAreaId}
                {...createForm.register("cargoId")}
                onChange={(e) =>
                  createForm.setValue("cargoId", e.target.value || undefined)
                }
              >
                <option value="">{t("orgStructure.selectCargo")}</option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            {/* ── Rol ────────────────────────────────────────────── */}
            <FormField
              id="cu-role"
              label={t("common.role")}
              error={createForm.formState.errors.roleId?.message}
            >
              <select
                id="cu-role"
                className={selectCls}
                {...createForm.register("roleId")}
              >
                <option value="">
                  {t("users.dialogs.roleSelectPlaceholder")}
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </FormField>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateUserOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending || !createForm.formState.isValid
                }
              >
                {createMutation.isPending
                  ? t("common.creating")
                  : t("users.dialogs.createButton")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Editar usuario ────────────────────────────────────────── */}
      <Dialog
        open={!!editUser}
        onOpenChange={(o) => {
          if (!o) setEditUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.dialogs.editTitle")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((values) => {
              if (!editUser) return;
              editMutation.mutate({ id: editUser.id, dto: values });
            })}
            className="space-y-4 pt-2"
          >
            <FormField
              id="eu-firstName"
              label={t("users.dialogs.firstNameLabel")}
              error={editForm.formState.errors.firstName?.message}
            >
              <Input
                id="eu-firstName"
                placeholder={t("users.dialogs.firstNamePlaceholder")}
                {...editForm.register("firstName")}
              />
            </FormField>
            <FormField
              id="eu-lastName"
              label={t("users.dialogs.lastNameLabel")}
              error={editForm.formState.errors.lastName?.message}
            >
              <Input
                id="eu-lastName"
                placeholder={t("users.dialogs.lastNamePlaceholder")}
                {...editForm.register("lastName")}
              />
            </FormField>
            <FormField
              id="eu-idNumber"
              label={t("users.dialogs.idNumberLabel")}
              error={editForm.formState.errors.idNumber?.message}
            >
              <Input
                id="eu-idNumber"
                placeholder={t("users.dialogs.idNumberPlaceholder")}
                {...editForm.register("idNumber")}
              />
            </FormField>

            {/* ── Org-structure ──────────────────────────────────── */}
            <FormField id="eu-dept" label={t("orgStructure.departamento")}>
              <select
                id="eu-dept"
                className={selectCls}
                value={editSelectedDeptId}
                {...editForm.register("departamentoId")}
                onChange={(e) => {
                  editForm.setValue(
                    "departamentoId",
                    e.target.value || undefined,
                  );
                  editForm.setValue("areaId", undefined);
                  editForm.setValue("cargoId", undefined);
                  setEditSelectedDeptId(e.target.value);
                  setEditSelectedAreaId("");
                }}
              >
                <option value="">{t("orgStructure.selectDepartamento")}</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="eu-area" label={t("orgStructure.area")}>
              <select
                id="eu-area"
                className={selectCls}
                disabled={!editSelectedDeptId}
                value={editSelectedAreaId}
                {...editForm.register("areaId")}
                onChange={(e) => {
                  editForm.setValue("areaId", e.target.value || undefined);
                  editForm.setValue("cargoId", undefined);
                  setEditSelectedAreaId(e.target.value);
                }}
              >
                <option value="">{t("orgStructure.selectArea")}</option>
                {editAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="eu-cargo" label={t("orgStructure.cargos")}>
              <select
                id="eu-cargo"
                className={selectCls}
                disabled={!editSelectedAreaId}
                {...editForm.register("cargoId")}
                onChange={(e) =>
                  editForm.setValue("cargoId", e.target.value || undefined)
                }
              >
                <option value="">{t("orgStructure.selectCargo")}</option>
                {editCargos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUser(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending || !editForm.formState.isValid}
              >
                {editMutation.isPending
                  ? t("common.saving")
                  : t("common.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar usuario ──────────────────────────────────────── */}
      <Dialog
        open={!!deleteUser}
        onOpenChange={(o) => {
          if (!o) setDeleteUser(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("users.dialogs.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("users.dialogs.deleteConfirmCompanyPre")}{" "}
            <span className="font-medium text-foreground">
              {deleteUser?.firstName}
            </span>
            {t("users.dialogs.deleteConfirmCompanyPost")}
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              {deleteMutation.isPending
                ? t("common.deleting")
                : t("users.dialogs.deleteButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
