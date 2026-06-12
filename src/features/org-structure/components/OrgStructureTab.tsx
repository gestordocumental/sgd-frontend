import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure';
import type { useTypologies } from '@/features/doc-governance/hooks/use-typologies';
import { TypologyDialogs } from '@/features/doc-governance/components/TypologyDialogs';
import { OrgStructureDialogs } from './OrgStructureDialogs';
import { DepartamentosTabContent } from './tabs/DepartamentosTabContent';
import { AreasTabContent } from './tabs/AreasTabContent';
import { CargosTabContent } from './tabs/CargosTabContent';
import { TypologyTabContent } from './tabs/TypologyTabContent';

type OrgStructureHook = ReturnType<typeof useOrgStructure>;
type TypologiesHook = ReturnType<typeof useTypologies>;

interface OrgStructureTabProps {
  hook: OrgStructureHook;
  typologiesHook: TypologiesHook;
  canWrite?: boolean;
}

export function OrgStructureTab({ hook, typologiesHook, canWrite = false }: OrgStructureTabProps) {
  const { t } = useTranslation();
  return (
    <main className="p-6 space-y-6">
      <Tabs defaultValue="departamentos">
        <TabsList>
          <TabsTrigger value="departamentos">{t('orgStructure.departamentos')}</TabsTrigger>
          <TabsTrigger value="areas">{t('orgStructure.areas')}</TabsTrigger>
          <TabsTrigger value="cargos">{t('orgStructure.cargos')}</TabsTrigger>
          <TabsTrigger value="typology">{t('docGovernance.table.title')}</TabsTrigger>
        </TabsList>

        <DepartamentosTabContent hook={hook} canWrite={canWrite} />
        <AreasTabContent hook={hook} canWrite={canWrite} />
        <CargosTabContent hook={hook} canWrite={canWrite} />
        <TypologyTabContent typologiesHook={typologiesHook} canWrite={canWrite} />
      </Tabs>

      <TypologyDialogs hook={typologiesHook} />
      <OrgStructureDialogs hook={hook} />
    </main>
  );
}
