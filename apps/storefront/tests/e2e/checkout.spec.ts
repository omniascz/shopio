/**
 * E2E smoke test — full purchase flow.
 *
 * Pre-requisite: API running at API_URL (default localhost:4040) with seed data
 * (bob-ceramics tenant + Black Ceramic Bowl product).
 *
 * Flow: catalog → PDP → add to cart → drawer → checkout → mock confirmation
 */

import { test, expect } from '@playwright/test';

const TENANT_SLUG = 'bob-ceramics';

test.describe('Storefront — full purchase flow (mock payment mode)', () => {
  test('user can browse → add to cart → checkout → see confirmation', async ({ page }) => {
    // 1. Catalog page
    await page.goto(`/s/${TENANT_SLUG}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bob Ceramics');
    const productCard = page.getByRole('link', { name: /Black Ceramic Bowl/i }).first();
    await expect(productCard).toBeVisible();

    // 2. Product detail page
    await productCard.click();
    await expect(
      page.getByRole('heading', { level: 1, name: /Black Ceramic Bowl/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Přidat do košíku/i })).toBeVisible();

    // 3. Add to cart
    await page.getByRole('button', { name: /Přidat do košíku/i }).click();

    // 4. Drawer should open with item
    const drawer = page.getByRole('dialog', { name: /Shopping cart/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Black Ceramic Bowl/i).first()).toBeVisible();
    await expect(drawer.getByText(/Mezisoučet/i)).toBeVisible();

    // 5. Continue to checkout
    await drawer.getByRole('link', { name: /Pokračovat k pokladně/i }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { level: 1, name: /Pokladna/i })).toBeVisible();

    // 6. Fill checkout form
    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    await page.getByLabel(/E-mail/i).fill(uniqueEmail);
    await page.getByLabel(/Jméno a příjmení/i).fill('E2E Test');
    await page.getByLabel(/Ulice/i).fill('Test St 1');
    await page.getByLabel(/Město/i).fill('Praha');
    await page.getByLabel(/PSČ/i).fill('11000');
    // Country defaults to CZ — keep as-is

    // 7. Shipping: the default rate (Zásilkovna pickup) requires a pickup point —
    // pick one via the seeded fallback picker (no Packeta widget key in dev/CI).
    await page
      .getByRole('button', { name: /Vybrat výdejní místo|Hledat v seznamu/i })
      .click();
    // Seeded fallback points: Z-BOX Praha 5 — Anděl / Brno — Veveří / Ostrava
    await page.getByRole('button', { name: /Z-BOX Praha/i }).first().click();
    await expect(page.getByText(/✓ Výdejní místo:/i)).toBeVisible();

    // 8. Submit
    await page.getByRole('button', { name: /Odeslat objednávku/i }).click();

    // 9. Confirmation page (mock mode → goes directly; Stripe mode → would redirect)
    await expect(page).toHaveURL(/\/orders\/ORD-\d{4}-\d+/, { timeout: 10_000 });
    await expect(page.getByText(/Děkujeme za nákup/i)).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();
    await expect(page.getByText(/E2E Test/)).toBeVisible();
  });

  test('cart drawer reflects quantity updates', async ({ page }) => {
    await page.goto(`/s/${TENANT_SLUG}/p/black-ceramic-bowl`);
    await page.getByRole('button', { name: /Přidat do košíku/i }).click();

    const drawer = page.getByRole('dialog', { name: /Shopping cart/i });
    await expect(drawer).toBeVisible();

    // Increase qty +1
    await drawer.getByRole('button', { name: /Increase quantity/i }).click();
    await expect(drawer.locator('text=/^2$/').first()).toBeVisible();

    // Decrease qty -1 (back to 1)
    await drawer.getByRole('button', { name: /Decrease quantity/i }).click();
    await expect(drawer.locator('text=/^1$/').first()).toBeVisible();

    // Remove item
    await drawer.getByRole('button', { name: /Remove item/i }).click();
    await expect(drawer.getByText(/Váš košík je prázdný/i)).toBeVisible();
  });
});
