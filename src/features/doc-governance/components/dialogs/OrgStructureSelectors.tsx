import { useTranslation } from 'react-i18next'
import { FormField } from '@/components/ui/form-field'
import { selectClass, type TypologiesHook } from './typology-dialog-shared'

export function OrgStructureSelectors({ hook }: { hook: TypologiesHook }) {
  const { t } = useTranslation()
  const {
    form,
    departamentos,
    formAreas,
    formCargos,
    formDeptId,
    formAreaId,
    handleFormDeptChange,
    handleFormAreaChange,
  } = hook
  return (
    <>
      <FormField
        id="typo-dept"
        label={t('docGovernance.form.departmentLabel')}
        error={form.formState.errors.departamentoId?.message}
      >
        <select
          id="typo-dept"
          aria-label={t('docGovernance.form.departmentLabel')}
          className={selectClass}
          value={formDeptId}
          onChange={(e) => handleFormDeptChange(e.target.value)}
        >
          <option value="">{t('docGovernance.form.selectDepartment')}</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </FormField>

      <FormField id="typo-area" label={t('docGovernance.form.areaLabel')}>
        <select
          id="typo-area"
          aria-label={t('docGovernance.form.areaLabel')}
          className={selectClass}
          value={formAreaId}
          disabled={!formDeptId}
          onChange={(e) => handleFormAreaChange(e.target.value)}
        >
          <option value="">{t('docGovernance.form.noArea')}</option>
          {formAreas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FormField>

      {/* cargoId has no dependent fields so form.register is sufficient;
          dept/area use manual onChange because changing them cascades resets on sibling selects */}
      <FormField id="typo-cargo" label={t('docGovernance.form.positionLabel')}>
        <select
          id="typo-cargo"
          aria-label={t('docGovernance.form.positionLabel')}
          className={selectClass}
          disabled={!formAreaId}
          {...form.register('cargoId')}
        >
          <option value="">{t('docGovernance.form.noPosition')}</option>
          {formCargos.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </FormField>
    </>
  )
}
