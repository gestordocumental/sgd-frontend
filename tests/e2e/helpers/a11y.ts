import { AxeBuilder } from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function checkPageA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
}
