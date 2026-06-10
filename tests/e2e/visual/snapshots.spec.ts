import { test } from '@playwright/test';
import { argosScreenshot } from '@argos-ci/playwright';
import {
  injectAdminSession,
  injectCompanySession,
  mockAdminAuthRefresh,
  mockApiFallback,
  mockAuthRefresh,
} from '../helpers/auth';

// ── Public pages ──────────────────────────────────────────────────────────────

test.describe('Visual — login', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await mockApiFallback(page);
  });

  test('login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await argosScreenshot(page, 'login');
  });
});

// ── Company dashboard ─────────────────────────────────────────────────────────

test.describe('Visual — company dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectCompanySession(page);
    await mockApiFallback(page);
    await mockAuthRefresh(page);
  });

  test('overview tab', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await argosScreenshot(page, 'company-dashboard-overview');
  });
});

// ── Admin dashboard ───────────────────────────────────────────────────────────

test.describe('Visual — admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await mockApiFallback(page);
    await mockAdminAuthRefresh(page);
  });

  test('overview tab', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await page.waitForLoadState('networkidle');
    await argosScreenshot(page, 'admin-dashboard-overview');
  });
});
