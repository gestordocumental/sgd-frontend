import { checkA11y } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

const WCAG_21_AA = {
  runOnly: { type: 'tag' as const, values: ['wcag2a', 'wcag2aa'] },
};

export async function checkPageA11y(page: Page): Promise<void> {
  await checkA11y(page, undefined, { axeOptions: WCAG_21_AA });
}
