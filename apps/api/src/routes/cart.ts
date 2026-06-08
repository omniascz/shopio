/**
 * Cart + checkout endpoints (storefront, public — anonymous session via cookie).
 *
 * Per `11-cart.md` + `12-checkout.md` + `16-order-management.md`.
 *
 * MVP simplifications:
 * - Anonymous-only carts (customer accounts Fáze 1 wave 2)
 * - No payment gateway integration (mock status='pending')
 * - No tax, shipping, discount computation (zero placeholders)
 * - No stock reservation (decrement on order placement, optimistic)
 *
 * Endpoints (all under /api/{date}/storefront/{tenantSlug}/):
 *   GET    /cart                        — get/create cart for current session
 *   POST   /cart/items                  — add (or increment) variant
 *   PATCH  /cart/items/{itemPubId}      — update qty
 *   DELETE /cart/items/{itemPubId}      — remove
 *   POST   /checkout                    — atomic order placement
 *   GET    /orders/{orderNumber}        — order confirmation (public; orderNumber acts as bearer)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { schema, withTenant } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import { createCheckoutSession, isStripeEnabled } from '../lib/stripe';
import { initiatePayment, selectCheckoutProvider, buildSpayd } from '../lib/payments';
import type { SelectedProvider } from '../lib/payments';
import QRCode from 'qrcode';
import { renderOrderPlacedEmail, sendEmail, type OrderEmailContext } from '../lib/email';
import { computeTax, qualifiesForReverseCharge, serializeBreakdown, type TaxResult } from '../lib/tax';
import { resolveRates } from '../lib/tax-resolver';
import type { CartShippingMetrics } from '../lib/shipping';
import {
  resolveShippingOptions,
  resolveOptionById,
  searchPickupPoints,
  getPickupPoint,
} from '../lib/shipping-resolver';
import {
  UNPAID_RESERVATION_TTL_HOURS,
  availableQuantity,
  clearReservationExpiry,
  reserveStock,
} from '../lib/inventory';
import { getLoyaltyBalance, grantEarnedCredit, redeemCredit } from '../lib/loyalty';
import { findByCode as findGiftCard, isRedeemable as giftCardRedeemable, redeem as redeemGiftCard } from '../lib/gift-cards';
import { issueInvoiceForOrder } from '../lib/invoices';
import { sendOrderPaidEmail } from '../lib/order-emails';
import { CouponError, computeDiscount, distributeDiscount, validateCoupon } from '../lib/coupons';
import { buildCompanySnapshot } from '../lib/companies';
import { getOrCreateChannel } from '../lib/channels';
import { recordCommissions } from '../lib/marketplace';
import { emitWebhookEvent } from '../lib/webhooks-out';
import { resolveCustomer } from './customer-auth';

const CART_COOKIE_NAME = 'shopio_cart_session';
const CART_COOKIE_TTL_DAYS = 30;
const CART_EXPIRY_DAYS = 30;

const AddItemBody = z.object({
  variantId: z.string(), // pub_id "prv_..." or UUID
  quantity: z.number().int().min(1).max(99).default(1),
});

const UpdateItemBody = z.object({
  quantity: z.number().int().min(0).max(99), // 0 = remove
});

const CheckoutBody = z.object({
  // Email/name/address are optional only when a logged-in customer supplies a
  // `savedAddressId` (express checkout) — the server fills them from the book +
  // account. A runtime guard rejects a checkout that ends up missing them.
  customerEmail: z.string().email().toLowerCase().optional(),
  customerName: z.string().min(1).max(255).optional(),
  customerPhone: z.string().max(40).optional(),
  shippingAddress: z
    .object({
      line1: z.string().min(1).max(200),
      line2: z.string().max(200).optional(),
      city: z.string().min(1).max(100),
      postalCode: z.string().min(1).max(20),
      countryCode: z.string().length(2),
      state: z.string().max(100).optional(),
    })
    .optional(),
  /** Express checkout: use a saved address (per `18`) instead of an inline one.
   * Only honoured for the logged-in owner of that address. */
  savedAddressId: z.string().max(40).optional(),
  customerNote: z.string().max(2000).optional(),
  /** Chosen payment method. `'invoice'` = B2B NET terms (only honoured when the
   * logged-in customer's company has merchant-granted NET terms). Otherwise a
   * configured payment provider code (`cod`, `bank_transfer`, `gopay`, …); when
   * omitted the highest-priority enabled provider is used (per `13 §4.4`). */
  paymentMethod: z.string().max(40).optional(),
  /** B2B optional purchase-order reference. */
  purchaseOrderNumber: z.string().max(120).optional(),
  /** Pay the whole order with store credit (per `19`), when the balance covers
   * it. Partial redemption (credit + gateway) is a follow-up. */
  useStoreCredit: z.boolean().default(false),
  /** Gift card code applied as a tender (per `10` RULE-PRICING-014). When the
   * card's balance covers the whole order it settles at placement (no gateway);
   * partial redemption (gift card + gateway) is a follow-up. */
  giftCardCode: z.string().max(40).optional(),
  /** Selected shipping rate (from GET /shipping/rates). Optional in MVP. */
  shippingRateId: z.string().optional(),
  /** Selected pickup point for pickup_point services. The full address fields are
   * optional — present when chosen via the Packeta widget (point not in our cache),
   * absent when chosen from the seeded fallback picker (looked up server-side). */
  pickupPoint: z
    .object({
      carrierCode: z.string().min(1).max(40).default('zasilkovna'),
      externalId: z.string().min(1).max(120),
      name: z.string().max(200).optional(),
      street: z.string().max(200).optional(),
      city: z.string().max(120).optional(),
      postalCode: z.string().max(20).optional(),
      countryCode: z.string().length(2).optional(),
    })
    .optional(),
});

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerCartRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db, config } = opts;
  const rlsDb = getRlsDb(config);
  const isProd = config.NODE_ENV === 'production';

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/cart
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/cart',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getOrCreateCart(db, tenant.id, sessionId, tenant.defaultCurrency);
      const items = await listCartItems(db, cart.id);
      return reply.send({ data: await buildCartPayload(db, tenant, cart, items) });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/cart/items
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/cart/items',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const parsed = AddItemBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const { variantId, quantity } = parsed.data;

      // Resolve variant — tenant-scoped
      const variant = await resolveVariant(db, tenant.id, variantId);
      if (!variant) return notFound(reply, 'variant');

      if (availableQuantity(variant) < quantity && !variant.allowBackorder) {
        return reply.code(409).send({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock for requested quantity',
            available: availableQuantity(variant),
          },
        });
      }

      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getOrCreateCart(db, tenant.id, sessionId, tenant.defaultCurrency);

      // Upsert item (per `RULE-CART-003`: merge by (cart, variant))
      const [existing] = await db
        .select({
          id: schema.cartItems.id,
          quantity: schema.cartItems.quantity,
        })
        .from(schema.cartItems)
        .where(
          and(eq(schema.cartItems.cartId, cart.id), eq(schema.cartItems.variantId, variant.id)),
        )
        .limit(1);

      let resultItemId: string;
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (availableQuantity(variant) < newQty && !variant.allowBackorder) {
          return reply.code(409).send({
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: 'Adding this would exceed available stock',
              available: availableQuantity(variant),
              already_in_cart: existing.quantity,
            },
          });
        }
        await db
          .update(schema.cartItems)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(eq(schema.cartItems.id, existing.id));
        resultItemId = existing.id;
      } else {
        const [inserted] = await db
          .insert(schema.cartItems)
          .values({
            tenantId: tenant.id,
            cartId: cart.id,
            pubId: generatePubId('cti'),
            variantId: variant.id,
            productId: variant.productId,
            quantity,
            unitPriceAmount: variant.priceAmount,
            unitPriceCurrency: variant.priceCurrency,
            titleSnapshot: `${variant.productTitle} — ${variant.variantTitle}`,
          })
          .returning({ id: schema.cartItems.id });
        resultItemId = inserted!.id;
      }

      // Touch cart updated_at
      await db
        .update(schema.carts)
        .set({ updatedAt: new Date() })
        .where(eq(schema.carts.id, cart.id));

      const items = await listCartItems(db, cart.id);
      return reply.code(201).send({
        data: { ...(await buildCartPayload(db, tenant, cart, items)), added_item_id: resultItemId },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/cart/reorder/{orderNumber} — 1-click buy-again
  // (per `18` returning-customer). Repopulates the active cart with a past
  // order's still-purchasable lines; reports any that are gone / out of stock.
  // Owner-scoped: the logged-in customer must own the order (id or account email).
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string; orderNumber: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/cart/reorder/:orderNumber',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const customer = await resolveCustomer(rlsDb, req, tenant.id);
      if (!customer) {
        return reply.code(401).send({ error: { code: 'NOT_LOGGED_IN', message: 'Přihlaste se' } });
      }

      const order = await withTenant(rlsDb, tenant.id, async (tx) => {
        const [o] = await tx
          .select({ id: schema.orders.id, customerId: schema.orders.customerId, email: schema.orders.customerEmail })
          .from(schema.orders)
          .where(
            and(
              eq(schema.orders.tenantId, tenant.id),
              eq(schema.orders.orderNumber, req.params.orderNumber),
            ),
          )
          .limit(1);
        return o ?? null;
      });
      // Ownership: account id match OR same verified account email (guest order).
      if (!order || (order.customerId !== customer.id && order.email !== customer.email)) {
        return notFound(reply, 'order');
      }

      const orderLines = await withTenant(rlsDb, tenant.id, (tx) =>
        tx
          .select({ variantId: schema.orderItems.variantId, quantity: schema.orderItems.quantity })
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, order.id)),
      );

      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getOrCreateCart(db, tenant.id, sessionId, tenant.defaultCurrency);

      const skipped: { variant_id: string; reason: string }[] = [];
      let addedLines = 0;
      for (const line of orderLines) {
        if (!line.variantId) continue;
        const variant = await resolveVariant(db, tenant.id, line.variantId);
        if (!variant) {
          skipped.push({ variant_id: line.variantId, reason: 'unavailable' });
          continue;
        }
        const [existing] = await db
          .select({ id: schema.cartItems.id, quantity: schema.cartItems.quantity })
          .from(schema.cartItems)
          .where(and(eq(schema.cartItems.cartId, cart.id), eq(schema.cartItems.variantId, variant.id)))
          .limit(1);
        const desired = (existing?.quantity ?? 0) + line.quantity;
        const cap = variant.allowBackorder ? desired : Math.min(desired, availableQuantity(variant));
        if (cap <= 0) {
          skipped.push({ variant_id: variant.id, reason: 'out_of_stock' });
          continue;
        }
        if (existing) {
          await db
            .update(schema.cartItems)
            .set({ quantity: cap, updatedAt: new Date() })
            .where(eq(schema.cartItems.id, existing.id));
        } else {
          await db.insert(schema.cartItems).values({
            tenantId: tenant.id,
            cartId: cart.id,
            pubId: generatePubId('cti'),
            variantId: variant.id,
            productId: variant.productId,
            quantity: cap,
            unitPriceAmount: variant.priceAmount,
            unitPriceCurrency: variant.priceCurrency,
            titleSnapshot: `${variant.productTitle} — ${variant.variantTitle}`,
          });
        }
        if (cap < line.quantity) skipped.push({ variant_id: variant.id, reason: 'reduced_to_stock' });
        addedLines++;
      }

      await db
        .update(schema.carts)
        .set({ updatedAt: new Date() })
        .where(eq(schema.carts.id, cart.id));

      const items = await listCartItems(db, cart.id);
      return reply.send({
        data: {
          ...(await buildCartPayload(db, tenant, cart, items)),
          reorder: { added_lines: addedLines, skipped },
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /storefront/{tenantSlug}/cart/items/{itemPubId}
  // ---------------------------------------------------------------------------
  app.patch<{ Params: { tenantSlug: string; itemPubId: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/cart/items/:itemPubId',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const parsed = UpdateItemBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getActiveCart(db, tenant.id, sessionId);
      if (!cart) return notFound(reply, 'cart');

      // Locate item
      const [item] = await db
        .select({
          id: schema.cartItems.id,
          variantId: schema.cartItems.variantId,
        })
        .from(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.cartId, cart.id),
            eq(schema.cartItems.pubId, req.params.itemPubId),
          ),
        )
        .limit(1);
      if (!item) return notFound(reply, 'cart_item');

      if (parsed.data.quantity === 0) {
        await db.delete(schema.cartItems).where(eq(schema.cartItems.id, item.id));
      } else {
        // Stock check
        const variant = await resolveVariant(db, tenant.id, item.variantId);
        if (!variant) return notFound(reply, 'variant');
        if (availableQuantity(variant) < parsed.data.quantity && !variant.allowBackorder) {
          return reply.code(409).send({
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: 'Not enough stock for requested quantity',
              available: availableQuantity(variant),
            },
          });
        }
        await db
          .update(schema.cartItems)
          .set({ quantity: parsed.data.quantity, updatedAt: new Date() })
          .where(eq(schema.cartItems.id, item.id));
      }

      await db
        .update(schema.carts)
        .set({ updatedAt: new Date() })
        .where(eq(schema.carts.id, cart.id));

      const items = await listCartItems(db, cart.id);
      return reply.send({ data: await buildCartPayload(db, tenant, cart, items) });
    },
  );

  // ---------------------------------------------------------------------------
  // DELETE /storefront/{tenantSlug}/cart/items/{itemPubId}
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { tenantSlug: string; itemPubId: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/cart/items/:itemPubId',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getActiveCart(db, tenant.id, sessionId);
      if (!cart) return notFound(reply, 'cart');

      const result = await db
        .delete(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.cartId, cart.id),
            eq(schema.cartItems.pubId, req.params.itemPubId),
          ),
        )
        .returning({ id: schema.cartItems.id });

      if (result.length === 0) return notFound(reply, 'cart_item');

      await db
        .update(schema.carts)
        .set({ updatedAt: new Date() })
        .where(eq(schema.carts.id, cart.id));

      const items = await listCartItems(db, cart.id);
      return reply.send({ data: await buildCartPayload(db, tenant, cart, items) });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/cart/coupon  — apply a coupon code
  // DELETE /storefront/{tenantSlug}/cart/coupon — remove it
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/cart/coupon',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const parsed = z.object({ code: z.string().min(1).max(60) }).safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getActiveCart(db, tenant.id, sessionId);
      if (!cart) return notFound(reply, 'cart');
      const items = await listCartItems(db, cart.id);
      const goodsGross = items.reduce((s, it) => s + it.unitPriceAmount * BigInt(it.quantity), 0n);

      const customer = await resolveCustomer(rlsDb, req, tenant.id);
      try {
        const { coupon } = await validateCoupon(db, {
          tenantId: tenant.id,
          code: parsed.data.code,
          goodsGross,
          customerId: customer?.id ?? null,
        });
        await db
          .update(schema.carts)
          .set({ couponCode: coupon.code, updatedAt: new Date() })
          .where(eq(schema.carts.id, cart.id));
        const fresh = { ...cart, couponCode: coupon.code };
        return reply.send({ data: await buildCartPayload(db, tenant, fresh, items) });
      } catch (err) {
        if (err instanceof CouponError) {
          return reply.code(422).send({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/cart/coupon',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getActiveCart(db, tenant.id, sessionId);
      if (!cart) return notFound(reply, 'cart');
      await db
        .update(schema.carts)
        .set({ couponCode: null, updatedAt: new Date() })
        .where(eq(schema.carts.id, cart.id));
      const items = await listCartItems(db, cart.id);
      return reply.send({
        data: await buildCartPayload(db, tenant, { ...cart, couponCode: null }, items),
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/shipping/rates
  // Priced shipping options for the current cart + ship-to country.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string }; Querystring: { country?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/shipping/rates',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const country = (req.query.country ?? tenant.countryCode).toUpperCase();
      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getActiveCart(db, tenant.id, sessionId);
      const items = cart ? await listCartItems(db, cart.id) : [];
      const metrics = cartMetrics(items);

      const options = await resolveShippingOptions(db, tenant.id, country, metrics);

      // Packeta widget key: tenant provider config first (set in admin
      // settings), platform env as fallback; otherwise the storefront uses
      // the seeded pickup-point picker (see /shipping/pickup-points).
      const [provider] = await db
        .select({ options: schema.shippingProviderConfigs.options })
        .from(schema.shippingProviderConfigs)
        .where(
          and(
            eq(schema.shippingProviderConfigs.tenantId, tenant.id),
            eq(schema.shippingProviderConfigs.carrierCode, 'zasilkovna'),
            eq(schema.shippingProviderConfigs.isEnabled, true),
          ),
        )
        .limit(1);
      const widgetKey =
        ((provider?.options ?? {}) as { api_key?: string }).api_key ?? config.PACKETA_API_KEY;

      return reply.send({
        data: {
          country,
          options,
          pickup_widget: widgetKey ? { provider: 'packeta', api_key: widgetKey } : null,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/shipping/pickup-points?carrier=&q=&country=
  // Fallback pickup-point search from the cached number book.
  // ---------------------------------------------------------------------------
  app.get<{
    Params: { tenantSlug: string };
    Querystring: { carrier?: string; q?: string; country?: string };
  }>('/api/2026-05-20/storefront/:tenantSlug/shipping/pickup-points', async (req, reply) => {
    const tenant = await resolveTenant(db, req.params.tenantSlug);
    if (!tenant) return notFound(reply, 'tenant');
    const carrier = req.query.carrier ?? 'zasilkovna';
    const country = (req.query.country ?? tenant.countryCode).toUpperCase();
    const points = await searchPickupPoints(db, carrier, country, req.query.q);
    return reply.send({ data: { points } });
  });

  // ---------------------------------------------------------------------------
  // POST /storefront/{tenantSlug}/checkout
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantSlug: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/checkout',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const parsed = CheckoutBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);
      const input = parsed.data;

      const sessionId = ensureSession(req, reply, isProd);
      const cart = await getActiveCart(db, tenant.id, sessionId);
      if (!cart) {
        return reply.code(404).send({
          error: { code: 'CART_NOT_FOUND', message: 'No active cart' },
        });
      }

      const items = await listCartItems(db, cart.id);
      if (items.length === 0) {
        return reply.code(422).send({
          error: { code: 'CART_EMPTY', message: 'Cannot checkout empty cart' },
        });
      }

      // Logged-in customer (per `18`) — links the order to the account and
      // remembers the shipping address for the next checkout. Guest stays fine.
      const customer = await resolveCustomer(rlsDb, req, tenant.id);

      // Express checkout (per `18`): resolve a saved address for the logged-in
      // owner, then fill any omitted contact fields from the book + account.
      let savedAddr: typeof schema.customerAddresses.$inferSelect | null = null;
      if (input.savedAddressId) {
        if (!customer) {
          return reply.code(401).send({
            error: { code: 'NOT_LOGGED_IN', message: 'Uložené adresy vyžadují přihlášení' },
          });
        }
        savedAddr = await withTenant(rlsDb, tenant.id, async (tx) => {
          const [row] = await tx
            .select()
            .from(schema.customerAddresses)
            .where(
              and(
                eq(schema.customerAddresses.tenantId, tenant.id),
                eq(schema.customerAddresses.customerId, customer.id),
                eq(schema.customerAddresses.pubId, input.savedAddressId!),
              ),
            )
            .limit(1);
          return row ?? null;
        });
        if (!savedAddr) {
          return reply.code(404).send({
            error: { code: 'ADDRESS_NOT_FOUND', message: 'Uložená adresa nenalezena' },
          });
        }
      }

      // Normalized checkout identity — saved address > inline body > account.
      const shipAddress = savedAddr
        ? {
            line1: savedAddr.line1,
            line2: savedAddr.line2 ?? undefined,
            city: savedAddr.city,
            postalCode: savedAddr.postalCode,
            countryCode: savedAddr.countryCode,
            state: savedAddr.state ?? undefined,
          }
        : input.shippingAddress;
      const customerEmail = input.customerEmail ?? customer?.email;
      const customerName =
        input.customerName ?? savedAddr?.recipientName ?? customer?.fullName ?? undefined;
      const customerPhone = input.customerPhone ?? savedAddr?.phone ?? customer?.phone ?? undefined;
      if (!shipAddress || !customerEmail || !customerName) {
        return reply.code(422).send({
          error: {
            code: 'MISSING_CHECKOUT_FIELDS',
            message: 'Chybí doručovací adresa, jméno nebo e-mail',
          },
        });
      }

      // B2B (per `21`): if the customer belongs to a company, the order is
      // billed to that company. Pay-on-invoice (NET terms) is offered only
      // when the merchant has granted it for that company.
      let company: typeof schema.companies.$inferSelect | null = null;
      if (customer?.companyId) {
        const [c] = await db
          .select()
          .from(schema.companies)
          .where(
            and(
              eq(schema.companies.id, customer.companyId),
              eq(schema.companies.tenantId, tenant.id),
            ),
          )
          .limit(1);
        company = c ?? null;
      }
      const wantsNetTerms = input.paymentMethod === 'invoice';
      if (wantsNetTerms && !(company && company.netTermsEnabled)) {
        return reply.code(422).send({
          error: {
            code: 'NET_TERMS_NOT_AVAILABLE',
            message: 'Platba na fakturu není pro tento účet povolena',
          },
        });
      }
      const useNetTerms = wantsNetTerms && company !== null && company.netTermsEnabled;

      // Resolve the payment provider (per `13 §4.4`). NET-terms orders skip
      // online payment entirely. Otherwise pick the requested provider code if
      // enabled, else the highest-priority enabled provider for this currency.
      // Falls back to null → legacy env-Stripe / mock path below (back-compat).
      let selectedProvider: SelectedProvider | null = null;
      if (!useNetTerms) {
        const requested =
          input.paymentMethod && input.paymentMethod !== 'invoice'
            ? input.paymentMethod
            : undefined;
        selectedProvider = await selectCheckoutProvider(
          rlsDb,
          config,
          tenant.id,
          cart.currency,
          requested,
        );
        if (requested && !selectedProvider) {
          return reply.code(422).send({
            error: {
              code: 'PAYMENT_METHOD_UNAVAILABLE',
              message: `Platební metoda '${requested}' není dostupná`,
            },
          });
        }
      }
      const paymentMethodValue = useNetTerms
        ? 'invoice'
        : selectedProvider
          ? selectedProvider.config.providerCode
          : isStripeEnabled(config)
            ? 'stripe'
            : 'mock';

      // Shipping selection — resolve + price the chosen rate against the cart
      // metrics + ship-to country (per `14 §5`). Validate pickup point if required.
      const country = shipAddress.countryCode.toUpperCase();
      const metrics = cartMetrics(items);
      let shippingOption = null;
      let pickupSnapshot: Record<string, unknown> | null = null;
      if (input.shippingRateId) {
        shippingOption = await resolveOptionById(
          db,
          tenant.id,
          country,
          input.shippingRateId,
          metrics,
        );
        if (!shippingOption) {
          return reply.code(422).send({
            error: { code: 'SHIPPING_RATE_INVALID', message: 'Selected shipping is unavailable' },
          });
        }
        if (shippingOption.requires_pickup_point) {
          if (!input.pickupPoint) {
            return reply.code(422).send({
              error: {
                code: 'PICKUP_POINT_REQUIRED',
                message: 'This shipping method requires a pickup point',
              },
            });
          }
          // Prefer the cached number book; fall back to the widget-provided
          // snapshot for real points not in our cache.
          const cached = await getPickupPoint(
            db,
            input.pickupPoint.carrierCode,
            input.pickupPoint.externalId,
          );
          if (cached) {
            pickupSnapshot = { carrier_code: input.pickupPoint.carrierCode, ...cached };
          } else if (input.pickupPoint.name && input.pickupPoint.city) {
            pickupSnapshot = {
              carrier_code: input.pickupPoint.carrierCode,
              external_id: input.pickupPoint.externalId,
              name: input.pickupPoint.name,
              street: input.pickupPoint.street ?? null,
              city: input.pickupPoint.city,
              postal_code: input.pickupPoint.postalCode ?? null,
              country_code: input.pickupPoint.countryCode ?? country,
            };
          } else {
            return notFound(reply, 'pickup_point');
          }
        }
      }
      const shippingGross = shippingOption ? BigInt(shippingOption.amount) : 0n;

      const grossGoods = items.reduce(
        (sum, it) => sum + it.unitPriceAmount * BigInt(it.quantity),
        0n,
      );

      // Coupon (per `10`): re-validate the cart's code, compute the discount,
      // and distribute it across lines so the VAT base reflects the lowered
      // selling price (EU rule). Invalid-at-checkout → 422 so the customer
      // can remove it. No coupon → zero discount.
      let validatedCoupon: typeof schema.coupons.$inferSelect | null = null;
      let goodsDiscount = 0n;
      let shippingDiscount = 0n;
      if (cart.couponCode) {
        try {
          const res = await validateCoupon(db, {
            tenantId: tenant.id,
            code: cart.couponCode,
            goodsGross: grossGoods,
            customerId: customer?.id ?? null,
          });
          validatedCoupon = res.coupon;
          const d = computeDiscount(res.coupon, { goodsGross: grossGoods, shippingGross });
          goodsDiscount = d.goodsDiscount;
          shippingDiscount = d.shippingDiscount;
        } catch (err) {
          if (err instanceof CouponError) {
            return reply.code(422).send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      }
      const lineDiscounts = distributeDiscount(
        items.map((it) => it.unitPriceAmount * BigInt(it.quantity)),
        goodsDiscount,
      );
      const discountByRef = new Map(items.map((it, i) => [it.pubId, lineDiscounts[i] ?? 0n]));
      const effectiveShipping = shippingGross - shippingDiscount;

      // VAT computation — place of supply = ship-to country (per `15 §4` STAGE 1),
      // falling back to the tenant home country. Discount lowers each line's
      // taxable amount; shipping is taxed on the post-discount charge.
      const rates = await resolveRates(db, tenant.id, country, tenant.countryCode);
      // EU B2B reverse charge (per `15 §4` + `21`): zero-rate when the buyer is
      // a company VAT-registered in another EU member state.
      const buyerCountry =
        (company?.billingAddress as { countryCode?: string } | null)?.countryCode ?? null;
      const reverseCharge = qualifiesForReverseCharge({
        supplierCountry: tenant.countryCode,
        buyerCountry,
        buyerHasVatId: Boolean(company?.vatId),
      });
      const tax = computeTax({
        lines: items.map((it) => ({
          ref: it.pubId,
          amount: it.unitPriceAmount * BigInt(it.quantity) - (discountByRef.get(it.pubId) ?? 0n),
          taxClassCode: it.taxClassCode,
        })),
        shippingAmount: effectiveShipping,
        shippingTaxClass: tenant.shippingTaxClass,
        rates,
        priceIncludesTax: tenant.priceIncludesTax,
        reverseCharge,
      });
      const taxByRef = new Map(tax.lines.map((l) => [l.ref, l]));
      const totalDiscount = goodsDiscount + shippingDiscount;

      // Source channel (per `22`) — web storefront.
      const webChannel = await getOrCreateChannel(db, tenant.id, 'web');

      // Store-credit redemption (per `19`) — full coverage only in this slice:
      // when the customer opts in and their balance covers the whole order, the
      // order is settled by credit at placement (no gateway). Set inside the tx.
      const loyaltySettings = (tenant.settings ?? {}) as {
        loyalty?: { enabled?: boolean };
      };
      const loyaltyEnabled = Boolean(loyaltySettings.loyalty?.enabled);
      let paidByCredit = false;
      // Gift-card full-coverage settlement (per `10` RULE-PRICING-014). Resolved
      // inside the tx; the card id is captured so we can debit its ledger.
      let paidByGiftCard = false;
      let giftCardId: string | null = null;

      // Atomic: revalidate stock + decrement + create order + clear cart.
      // RLS-enforced (per `30`): placement runs under the tenant GUC.
      try {
        const result = await withTenant(rlsDb, tenant.id, async (tx) => {
          // Lock variants + re-fetch latest stock
          const variantIds = items.map((i) => i.variantId);
          const freshVariants = await tx
            .select({
              id: schema.productVariants.id,
              productId: schema.productVariants.productId,
              pubId: schema.productVariants.pubId,
              sku: schema.productVariants.sku,
              title: schema.productVariants.title,
              priceAmount: schema.productVariants.priceAmount,
              priceCurrency: schema.productVariants.priceCurrency,
              stockOnHand: schema.productVariants.stockOnHand,
              stockReserved: schema.productVariants.stockReserved,
              allowBackorder: schema.productVariants.allowBackorder,
            })
            .from(schema.productVariants)
            .where(inArray(schema.productVariants.id, variantIds))
            .for('update');

          const variantMap = new Map(freshVariants.map((v) => [v.id, v]));

          // Availability check (per `09-inventory.md`: available = on hand − reserved)
          for (const it of items) {
            const v = variantMap.get(it.variantId);
            if (!v) {
              throw new CheckoutError(
                'VARIANT_GONE',
                `Variant ${it.variantId} no longer available`,
              );
            }
            if (availableQuantity(v) < it.quantity && !v.allowBackorder) {
              throw new CheckoutError(
                'INSUFFICIENT_STOCK',
                `Insufficient stock for ${v.title}: available ${availableQuantity(v)}, requested ${it.quantity}`,
              );
            }
          }

          // Fetch product titles for snapshot
          const productIds = Array.from(new Set(items.map((i) => i.productId)));
          const productTitles = await tx
            .select({ id: schema.products.id, title: schema.products.title })
            .from(schema.products)
            .where(inArray(schema.products.id, productIds));
          const productTitleMap = new Map(productTitles.map((p) => [p.id, p.title]));

          // Generate order number (sequential per tenant per year)
          const orderNumber = await generateOrderNumber(tx, tenant.id);

          // Totals — VAT-inclusive B2C model: subtotal + shipping are gross,
          // discount lowers the payable; total = subtotal − discount + shipping.
          // Reverse charge zero-rates VAT → the buyer pays the ex-VAT amount
          // (the tax engine already stripped VAT into post-discount net gross).
          const total = reverseCharge
            ? tax.totals.grossAmount
            : grossGoods - goodsDiscount + effectiveShipping;

          // Decide store-credit settlement: only when opted in, the customer is
          // logged in, loyalty is on, NOT a NET-terms order, and the balance
          // covers the full total (partial redemption is a follow-up).
          if (
            input.useStoreCredit &&
            customer &&
            loyaltyEnabled &&
            !useNetTerms &&
            total > 0n
          ) {
            const balance = await getLoyaltyBalance(tx, tenant.id, customer.id);
            if (balance >= total) paidByCredit = true;
          }
          const now = new Date();

          // Gift card as a tender (full coverage only in this slice). Takes
          // precedence only when store credit didn't already settle the order.
          if (!paidByCredit && input.giftCardCode && !useNetTerms && total > 0n) {
            const card = await findGiftCard(tx, tenant.id, input.giftCardCode);
            if (
              card &&
              card.currency === cart.currency &&
              giftCardRedeemable(card, now) &&
              card.balance >= total
            ) {
              paidByGiftCard = true;
              giftCardId = card.id;
            }
          }

          // Insert order
          const [order] = await tx
            .insert(schema.orders)
            .values({
              tenantId: tenant.id,
              pubId: generatePubId('ord'),
              orderNumber,
              customerId: customer?.id ?? null,
              customerEmail,
              customerName,
              customerPhone: customerPhone ?? null,
              shippingAddress: shipAddress,
              billingAddress: shipAddress,
              currency: cart.currency,
              subtotalAmount: grossGoods,
              discountAmount: totalDiscount,
              couponCode: validatedCoupon?.code ?? null,
              shippingAmount: effectiveShipping,
              shippingMethod: shippingOption
                ? {
                    rate_id: shippingOption.rate_id,
                    carrier_code: shippingOption.carrier_code,
                    service_code: shippingOption.service_code,
                    display_name: shippingOption.display_name,
                    amount: shippingOption.amount,
                  }
                : null,
              pickupPoint: pickupSnapshot,
              taxAmount: tax.totals.taxAmount,
              priceIncludesTax: tenant.priceIncludesTax,
              taxBreakdown: serializeBreakdown(tax.breakdown),
              totalAmount: total,
              status: paidByCredit || paidByGiftCard ? 'paid' : 'pending_payment',
              statusEnteredAt: now,
              paymentStatus: paidByCredit || paidByGiftCard ? 'paid' : 'pending',
              paidAt: paidByCredit || paidByGiftCard ? now : null,
              paymentMethod: paidByCredit
                ? 'store_credit'
                : paidByGiftCard
                  ? 'gift_card'
                  : paymentMethodValue,
              // B2B (per `21`): bill the company + record NET terms / PO ref.
              companyId: company?.id ?? null,
              companySnapshot: company ? buildCompanySnapshot(company) : null,
              purchaseOrderNumber: input.purchaseOrderNumber ?? null,
              paymentTermsDays: useNetTerms ? company!.netTermsDays : null,
              dueAt: useNetTerms
                ? new Date(Date.now() + company!.netTermsDays * 24 * 60 * 60 * 1000)
                : null,
              channelKind: 'storefront_web',
              channelId: webChannel?.id ?? null,
              customerLocale: tenant.defaultLocale,
              customerNote: input.customerNote ?? null,
            })
            .returning();

          if (!order) throw new CheckoutError('ORDER_INSERT_FAILED', 'Could not create order');

          // Insert line items
          await tx.insert(schema.orderItems).values(
            items.map((it) => {
              const v = variantMap.get(it.variantId)!;
              const lineGross = it.unitPriceAmount * BigInt(it.quantity);
              const lt = taxByRef.get(it.pubId);
              return {
                tenantId: tenant.id,
                orderId: order.id,
                pubId: generatePubId('oit'),
                variantId: v.id,
                productId: v.productId,
                productTitleSnapshot: productTitleMap.get(v.productId) ?? 'Unknown product',
                variantTitleSnapshot: v.title,
                skuSnapshot: v.sku,
                quantity: it.quantity,
                unitPriceAmount: it.unitPriceAmount,
                unitPriceCurrency: it.unitPriceCurrency,
                // net base; tax + gross snapshot from the engine (post-discount)
                lineSubtotalAmount: lt?.baseAmount ?? lineGross,
                lineDiscountAmount: discountByRef.get(it.pubId) ?? 0n,
                taxClassCode: lt?.taxClassCode ?? it.taxClassCode,
                taxRateBasisPoints: lt?.taxRateBasisPoints ?? 0,
                lineTaxAmount: lt?.taxAmount ?? 0n,
                lineTotalAmount: lineGross - (discountByRef.get(it.pubId) ?? 0n),
              };
            }),
          );

          // Reserve stock (per `09-inventory.md`): the hold expires for unpaid
          // orders (sweeper cancels them); payment clears the TTL; the physical
          // decrement happens at shipment handover (`sale` movement).
          await reserveStock(tx, {
            tenantId: tenant.id,
            orderId: order.id,
            lines: items.map((it) => ({ variantId: it.variantId, quantity: it.quantity })),
            expiresAt: new Date(Date.now() + UNPAID_RESERVATION_TTL_HOURS * 60 * 60 * 1000),
          });

          // Store-credit settlement (per `19`): debit the credit ledger + hold
          // the reservation indefinitely (the order is already paid).
          if (paidByCredit && customer) {
            await redeemCredit(tx, {
              tenantId: tenant.id,
              customerId: customer.id,
              orderId: order.id,
              amount: total,
              currency: cart.currency,
            });
            await clearReservationExpiry(tx, order.id);
          }

          // Gift-card settlement (per `10` RULE-PRICING-014): debit the card's
          // ledger + hold the reservation indefinitely (the order is paid).
          if (paidByGiftCard && giftCardId) {
            const applied = await redeemGiftCard(tx, tenant.id, giftCardId, total, now, {
              type: 'order',
              id: order.id,
            });
            if (applied < total) {
              // Balance changed between read and debit — abort the placement.
              throw new CheckoutError('GIFT_CARD_BALANCE_CHANGED', 'Gift card balance changed');
            }
            await clearReservationExpiry(tx, order.id);
          }

          // Record coupon redemption + bump usage atomically (per `10` RULE-PRICING-010)
          if (validatedCoupon && totalDiscount > 0n) {
            await tx.insert(schema.couponRedemptions).values({
              tenantId: tenant.id,
              couponId: validatedCoupon.id,
              orderId: order.id,
              customerId: customer?.id ?? null,
              amountSaved: totalDiscount,
              currency: cart.currency,
            });
            await tx
              .update(schema.coupons)
              .set({
                usageCount: dsql`${schema.coupons.usageCount} + 1`,
                updatedAt: new Date(),
              })
              .where(eq(schema.coupons.id, validatedCoupon.id));
          }

          // Convert cart
          await tx
            .update(schema.carts)
            .set({ status: 'converted', statusEnteredAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.carts.id, cart.id));

          // Marketplace (per `25`): record commission for vendor-owned lines.
          await recordCommissions(tx, tenant.id, order.id);

          return order;
        });

        app.log.info(
          { orderId: result.id, tenantId: tenant.id, customerEmail },
          'checkout.order_placed',
        );

        // Outbound webhook (per `28`): order.placed
        emitWebhookEvent(db, tenant.id, 'order.placed', {
          order_number: result.orderNumber,
          status: result.status,
          payment_status: result.paymentStatus,
          total: { amount: result.totalAmount.toString(), currency: result.currency },
          customer_email: result.customerEmail,
          placed_at: result.placedAt,
        });

        // Remember the shipping address on the account (best-effort)
        if (customer) {
          void db
            .update(schema.customers)
            .set({ defaultAddress: shipAddress, updatedAt: new Date() })
            .where(eq(schema.customers.id, customer.id))
            .catch(() => {});
        }

        // Send order-placed email (best-effort, non-blocking)
        void (async () => {
          try {
            const emailCtx: OrderEmailContext = {
              tenantName: tenant.displayName,
              tenantSlug: tenant.slug,
              storefrontBaseUrl: config.SHOPIO_BASE_URL,
              orderNumber: result.orderNumber,
              customerName: result.customerName,
              customerEmail: result.customerEmail,
              shippingAddress: shipAddress,
              items: items.map((it) => ({
                productTitle: it.titleSnapshot.split(' — ')[0] ?? it.titleSnapshot,
                variantTitle: it.titleSnapshot.split(' — ')[1] ?? '',
                sku: null,
                quantity: it.quantity,
                lineTotalMinor: it.unitPriceAmount * BigInt(it.quantity),
              })),
              currency: result.currency,
              totalMinor: result.totalAmount,
              ...(shippingOption && {
                shippingMinor: shippingGross,
                shippingLabel: shippingOption.display_name,
              }),
              ...(pickupSnapshot?.name
                ? { pickupPointName: String(pickupSnapshot.name) }
                : {}),
              placedAt: result.placedAt,
            };
            const { subject, text, html } = renderOrderPlacedEmail(emailCtx);
            await sendEmail(config, {
              to: result.customerEmail,
              subject,
              text,
              html,
            });
            app.log.info({ orderId: result.id }, 'checkout.email_sent');
          } catch (err) {
            app.log.error({ err, orderId: result.id }, 'checkout.email_failed');
          }
        })();

        // Payment initiation (per `13 §4.4`). Resolution order:
        //   1. NET-terms (B2B) → skip online payment entirely.
        //   2. A configured payment provider (COD / bank transfer / gateway) →
        //      create a `payments` row + (for gateways) a redirect URL.
        //   3. Legacy fallback: env-Stripe Checkout session, else mock.
        let paymentUrl: string | null = null;
        let offlineProvider = false;
        if (paidByCredit || paidByGiftCard) {
          // Settled entirely by store credit or a gift card — run the paid side
          // effects (invoice, email, loyalty earn, outbound webhook), best-effort.
          try {
            await issueInvoiceForOrder(db, tenant.id, result.id);
          } catch (err) {
            app.log.error({ err, orderId: result.id }, 'checkout.credit_invoice_failed');
          }
          await grantEarnedCredit(db, tenant.id, result.id, app.log).catch(() => {});
          await sendOrderPaidEmail({ db, config, log: app.log }, result.id).catch(() => {});
          emitWebhookEvent(db, tenant.id, 'order.paid', {
            order_number: result.orderNumber,
            status: 'paid',
            payment_status: 'paid',
            total: { amount: result.totalAmount.toString(), currency: result.currency },
            customer_email: result.customerEmail,
            paid_at: new Date(),
          });
        } else if (selectedProvider) {
          try {
            const storefrontBase = config.SHOPIO_BASE_URL;
            const init = await initiatePayment({
              rlsDb,
              tenantId: tenant.id,
              selected: selectedProvider,
              input: {
                orderId: result.id,
                customerId: customer?.id ?? null,
                orderPubId: result.pubId,
                orderNumber: result.orderNumber,
                tenantPubId: tenant.pubId,
                customerEmail: result.customerEmail,
                currency: result.currency,
                amountMinor: result.totalAmount,
                items: items.map((it) => ({
                  title: it.titleSnapshot,
                  quantity: it.quantity,
                  unitAmountMinor: it.unitPriceAmount,
                })),
                shippingAmountMinor: shippingGross,
                shippingLabel: shippingOption?.display_name ?? 'Doprava',
                returnUrl: `${storefrontBase}/s/${tenant.slug}/orders/${result.orderNumber}?email=${encodeURIComponent(result.customerEmail)}`,
                cancelUrl: `${storefrontBase}/s/${tenant.slug}/checkout?cancelled=1`,
                notificationUrl: `${config.SHOPIO_API_URL}/api/2026-05-20/webhooks/payments/${selectedProvider.config.providerCode}/${tenant.pubId}`,
              },
            });
            paymentUrl = init.redirectUrl;
            offlineProvider = init.offline;
            app.log.info(
              { orderId: result.id, provider: selectedProvider.config.providerCode, offline: init.offline },
              'checkout.payment_initiated',
            );
          } catch (err) {
            app.log.error({ err, orderId: result.id }, 'checkout.payment_initiation_failed');
            return reply.code(502).send({
              error: {
                code: 'PAYMENT_PROVIDER_ERROR',
                message: 'Order placed but payment provider unavailable. Contact support.',
                order_number: result.orderNumber,
              },
            });
          }
        } else if (isStripeEnabled(config) && !useNetTerms) {
          try {
            const storefrontBase = config.SHOPIO_BASE_URL;
            const session = await createCheckoutSession(config, {
              orderId: result.pubId,
              orderNumber: result.orderNumber,
              tenantPubId: tenant.pubId,
              customerEmail: result.customerEmail,
              currency: result.currency,
              items: items.map((it) => ({
                title: it.titleSnapshot,
                quantity: it.quantity,
                unitAmountMinor: it.unitPriceAmount,
              })),
              shippingAmountMinor: shippingGross,
              shippingLabel: shippingOption?.display_name ?? 'Doprava',
              successUrl: `${storefrontBase}/s/${tenant.slug}/orders/${result.orderNumber}?email=${encodeURIComponent(result.customerEmail)}&session_id={CHECKOUT_SESSION_ID}`,
              cancelUrl: `${storefrontBase}/s/${tenant.slug}/checkout?cancelled=1`,
            });
            paymentUrl = session.paymentUrl;

            // Stash Stripe session id on order for webhook correlation
            await db
              .update(schema.orders)
              .set({
                metadata: dsql`${schema.orders.metadata} || ${JSON.stringify({
                  stripe_checkout_session_id: session.sessionId,
                })}::jsonb`,
                updatedAt: new Date(),
              })
              .where(eq(schema.orders.id, result.id));

            app.log.info(
              { orderId: result.id, stripeSessionId: session.sessionId },
              'checkout.stripe_session_created',
            );
          } catch (err) {
            app.log.error({ err, orderId: result.id }, 'checkout.stripe_session_failed');
            // Order is already placed — surface error so client can retry payment
            return reply.code(502).send({
              error: {
                code: 'PAYMENT_PROVIDER_ERROR',
                message: 'Order placed but payment provider unavailable. Contact support.',
                order_number: result.orderNumber,
              },
            });
          }
        }

        return reply.code(201).send({
          data: {
            order: {
              id: result.pubId,
              number: result.orderNumber,
              status: result.status,
              payment_status: result.paymentStatus,
              payment_method: result.paymentMethod,
              total: {
                amount: result.totalAmount.toString(),
                currency: result.currency,
              },
              placed_at: result.placedAt,
              due_at: result.dueAt,
              payment_terms_days: result.paymentTermsDays,
              customer_email: result.customerEmail,
              confirmation_url: `/s/${tenant.slug}/orders/${result.orderNumber}?email=${encodeURIComponent(result.customerEmail)}`,
            },
            payment_url: paymentUrl,
            next_step: paidByCredit
              ? 'Zaplaceno věrnostním kreditem — objednávka je uhrazena.'
              : paidByGiftCard
                ? 'Zaplaceno dárkovou kartou — objednávka je uhrazena.'
                : useNetTerms
                ? 'B2B NET order — pay by bank transfer before due_at; merchant marks paid on receipt.'
                : paymentUrl
                  ? 'Redirect customer to payment_url to complete payment'
                  : offlineProvider
                    ? `Offline payment (${result.paymentMethod}) — order placed; payment collected on delivery / bank transfer.`
                    : 'MVP mock mode — order placed with payment_status=pending. Set STRIPE_SECRET_KEY to enable real payments.',
          },
        });
      } catch (err) {
        if (err instanceof CheckoutError) {
          return reply.code(err.code === 'INSUFFICIENT_STOCK' ? 409 : 422).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/orders/{orderNumber}/qr.png?email= — QR Platba
  // (SPAYD QR code for bank-transfer / QR-platba orders). Anti-enum via ?email=.
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string; orderNumber: string }; Querystring: { email?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/orders/:orderNumber/qr.png',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');
      const [order] = await db
        .select()
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tenantId, tenant.id),
            eq(schema.orders.orderNumber, req.params.orderNumber),
          ),
        )
        .limit(1);
      if (!order) return notFound(reply, 'order');
      const providedEmail = req.query.email?.toLowerCase();
      if (!providedEmail || providedEmail !== order.customerEmail.toLowerCase()) {
        return notFound(reply, 'order');
      }
      const iban = (
        ((tenant.settings ?? {}) as { invoicing?: { bank_account_iban?: string } }).invoicing
          ?.bank_account_iban ?? ''
      ).trim();
      if (!iban) return notFound(reply, 'iban');

      const spayd = buildSpayd({
        iban,
        amountMinor: order.totalAmount,
        currency: order.currency,
        variableSymbol: order.orderNumber,
        message: `Objednavka ${order.orderNumber}`,
      });
      const png = await QRCode.toBuffer(spayd, { type: 'png', margin: 1, width: 320 });
      return reply
        .header('content-type', 'image/png')
        .header('cache-control', 'public, max-age=3600')
        .send(png);
    },
  );

  // ---------------------------------------------------------------------------
  // GET /storefront/{tenantSlug}/orders/{orderNumber}
  // (anonymous access — orderNumber acts as bearer; require ?email= match for safety)
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantSlug: string; orderNumber: string }; Querystring: { email?: string } }>(
    '/api/2026-05-20/storefront/:tenantSlug/orders/:orderNumber',
    async (req, reply) => {
      const tenant = await resolveTenant(db, req.params.tenantSlug);
      if (!tenant) return notFound(reply, 'tenant');

      const [order] = await db
        .select()
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tenantId, tenant.id),
            eq(schema.orders.orderNumber, req.params.orderNumber),
          ),
        )
        .limit(1);
      if (!order) return notFound(reply, 'order');

      // Anti-enumeration: require ?email= match (Fáze 1 wave 2 — replace s magic link)
      const providedEmail = req.query.email?.toLowerCase();
      if (!providedEmail || providedEmail !== order.customerEmail.toLowerCase()) {
        return reply.code(404).send({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
      }

      const items = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id))
        .orderBy(asc(schema.orderItems.createdAt));

      return reply.send({
        data: {
          id: order.pubId,
          number: order.orderNumber,
          customer_email: order.customerEmail,
          customer_name: order.customerName,
          shipping_address: order.shippingAddress,
          status: order.status,
          payment_status: order.paymentStatus,
          payment_method: order.paymentMethod,
          totals: {
            subtotal: { amount: order.subtotalAmount.toString(), currency: order.currency },
            shipping: { amount: order.shippingAmount.toString(), currency: order.currency },
            tax: { amount: order.taxAmount.toString(), currency: order.currency },
            total: { amount: order.totalAmount.toString(), currency: order.currency },
          },
          tax_included: order.priceIncludesTax,
          tax_breakdown: order.taxBreakdown,
          shipping_method: order.shippingMethod,
          pickup_point: order.pickupPoint,
          placed_at: order.placedAt,
          items: items.map((it) => ({
            id: it.pubId,
            variant_id: it.variantId, // for re-order / subscription
            product_title: it.productTitleSnapshot,
            variant_title: it.variantTitleSnapshot,
            sku: it.skuSnapshot,
            quantity: it.quantity,
            unit_price: {
              amount: it.unitPriceAmount.toString(),
              currency: it.unitPriceCurrency,
            },
            line_total: {
              amount: it.lineTotalAmount.toString(),
              currency: it.unitPriceCurrency,
            },
          })),
        },
      });
    },
  );
}

// =============================================================================
// Helpers
// =============================================================================

class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function resolveTenant(db: AppDb, slug: string) {
  const [t] = await db
    .select({
      id: schema.tenants.id,
      pubId: schema.tenants.pubId,
      slug: schema.tenants.slug,
      displayName: schema.tenants.displayName,
      defaultLocale: schema.tenants.defaultLocale,
      defaultCurrency: schema.tenants.defaultCurrency,
      countryCode: schema.tenants.countryCode,
      priceIncludesTax: schema.tenants.priceIncludesTax,
      shippingTaxClass: schema.tenants.shippingTaxClass,
      settings: schema.tenants.settings,
      status: schema.tenants.status,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .limit(1);
  if (!t || t.status !== 'active') return null;
  return t;
}

interface ResolvedVariant {
  id: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  priceAmount: bigint;
  priceCurrency: string;
  stockOnHand: number;
  stockReserved: number;
  allowBackorder: boolean;
}

async function resolveVariant(
  db: AppDb,
  tenantId: string,
  variantId: string,
): Promise<ResolvedVariant | null> {
  const isPubId = variantId.startsWith('prv_');
  const [v] = await db
    .select({
      id: schema.productVariants.id,
      productId: schema.productVariants.productId,
      productTitle: schema.products.title,
      variantTitle: schema.productVariants.title,
      priceAmount: schema.productVariants.priceAmount,
      priceCurrency: schema.productVariants.priceCurrency,
      stockOnHand: schema.productVariants.stockOnHand,
      stockReserved: schema.productVariants.stockReserved,
      allowBackorder: schema.productVariants.allowBackorder,
      productStatus: schema.products.status,
    })
    .from(schema.productVariants)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariants.productId))
    .where(
      and(
        eq(schema.productVariants.tenantId, tenantId),
        isPubId
          ? eq(schema.productVariants.pubId, variantId)
          : eq(schema.productVariants.id, variantId),
      ),
    )
    .limit(1);
  if (!v || v.productStatus !== 'active') return null;
  return {
    id: v.id,
    productId: v.productId,
    productTitle: v.productTitle,
    variantTitle: v.variantTitle,
    priceAmount: v.priceAmount,
    priceCurrency: v.priceCurrency,
    stockOnHand: v.stockOnHand,
    stockReserved: v.stockReserved,
    allowBackorder: v.allowBackorder,
  };
}

async function getOrCreateCart(
  db: AppDb,
  tenantId: string,
  sessionId: string,
  currency: string,
): Promise<typeof schema.carts.$inferSelect> {
  const existing = await getActiveCart(db, tenantId, sessionId);
  if (existing) return existing;

  const [cart] = await db
    .insert(schema.carts)
    .values({
      tenantId,
      pubId: generatePubId('crt'),
      sessionId,
      currency,
      expiresAt: new Date(Date.now() + CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning();
  return cart!;
}

async function getActiveCart(
  db: AppDb,
  tenantId: string,
  sessionId: string,
): Promise<typeof schema.carts.$inferSelect | null> {
  const [cart] = await db
    .select()
    .from(schema.carts)
    .where(
      and(
        eq(schema.carts.tenantId, tenantId),
        eq(schema.carts.sessionId, sessionId),
        eq(schema.carts.status, 'active'),
      ),
    )
    .limit(1);
  return cart ?? null;
}

/** Cart weight + gross subtotal for the shipping rate calculator. */
function cartMetrics(items: Awaited<ReturnType<typeof listCartItems>>): CartShippingMetrics {
  let weight = 0;
  let subtotal = 0n;
  for (const it of items) {
    weight += (it.weightGrams ?? 0) * it.quantity;
    subtotal += it.unitPriceAmount * BigInt(it.quantity);
  }
  return { totalWeightGrams: weight, subtotalAmount: subtotal };
}

async function listCartItems(db: AppDb, cartId: string) {
  return db
    .select({
      id: schema.cartItems.id,
      pubId: schema.cartItems.pubId,
      variantId: schema.cartItems.variantId,
      productId: schema.cartItems.productId,
      quantity: schema.cartItems.quantity,
      unitPriceAmount: schema.cartItems.unitPriceAmount,
      unitPriceCurrency: schema.cartItems.unitPriceCurrency,
      titleSnapshot: schema.cartItems.titleSnapshot,
      taxClassCode: schema.products.taxClassCode,
      weightGrams: schema.productVariants.weightGrams,
      variantPubId: schema.productVariants.pubId,
      variantSku: schema.productVariants.sku,
      productPubId: schema.products.pubId,
      productSlug: schema.products.slug,
      primaryImageUrl: dsql<string | null>`(
        SELECT url FROM ${schema.productMedia}
        WHERE ${schema.productMedia.productId} = ${schema.cartItems.productId}
          AND ${schema.productMedia.position} = 0
        LIMIT 1
      )`,
    })
    .from(schema.cartItems)
    .innerJoin(schema.productVariants, eq(schema.productVariants.id, schema.cartItems.variantId))
    .innerJoin(schema.products, eq(schema.products.id, schema.cartItems.productId))
    .where(eq(schema.cartItems.cartId, cartId))
    .orderBy(asc(schema.cartItems.addedAt));
}

/**
 * Resolve VAT rates for the tenant's home country and serialize the cart with a
 * tax estimate. The real place of supply (ship-to country) is only known at
 * checkout — the cart shows the domestic estimate.
 */
async function buildCartPayload(
  db: AppDb,
  tenant: { id: string; countryCode: string; priceIncludesTax: boolean },
  cart: typeof schema.carts.$inferSelect,
  items: Awaited<ReturnType<typeof listCartItems>>,
) {
  const goodsGross = items.reduce((s, it) => s + it.unitPriceAmount * BigInt(it.quantity), 0n);

  // Coupon preview (goods discount only — shipping isn't known in the cart yet).
  // Silently drop a now-invalid code so the cart still renders.
  let discount = 0n;
  let appliedCode: string | null = null;
  let couponKind: string | null = null;
  if (cart.couponCode && items.length > 0) {
    try {
      const { coupon } = await validateCoupon(db, {
        tenantId: tenant.id,
        code: cart.couponCode,
        goodsGross,
      });
      appliedCode = coupon.code;
      couponKind = coupon.kind;
      discount = computeDiscount(coupon, { goodsGross, shippingGross: 0n }).goodsDiscount;
    } catch {
      // invalid now → show no discount; checkout will surface the reason
      appliedCode = cart.couponCode;
    }
  }

  let tax: TaxResult | null = null;
  if (items.length > 0) {
    const lineDiscounts = distributeDiscount(
      items.map((it) => it.unitPriceAmount * BigInt(it.quantity)),
      discount,
    );
    const rates = await resolveRates(db, tenant.id, tenant.countryCode, tenant.countryCode);
    tax = computeTax({
      lines: items.map((it, i) => ({
        ref: it.pubId,
        amount: it.unitPriceAmount * BigInt(it.quantity) - (lineDiscounts[i] ?? 0n),
        taxClassCode: it.taxClassCode,
      })),
      rates,
      priceIncludesTax: tenant.priceIncludesTax,
    });
  }
  return serializeCart(cart, items, tax, tenant.priceIncludesTax, {
    discount,
    appliedCode,
    kind: couponKind,
  });
}

function serializeCart(
  cart: typeof schema.carts.$inferSelect,
  items: Awaited<ReturnType<typeof listCartItems>>,
  tax: TaxResult | null,
  priceIncludesTax: boolean,
  coupon: { discount: bigint; appliedCode: string | null; kind: string | null },
) {
  let subtotal = 0n;
  for (const it of items) {
    subtotal += it.unitPriceAmount * BigInt(it.quantity);
  }
  const total = subtotal - coupon.discount;
  return {
    id: cart.pubId,
    status: cart.status,
    currency: cart.currency,
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    // subtotal = gross sum (what the customer pays when prices are VAT-inclusive)
    subtotal: { amount: subtotal.toString(), currency: cart.currency },
    coupon_code: coupon.appliedCode,
    coupon_kind: coupon.kind,
    discount: { amount: coupon.discount.toString(), currency: cart.currency },
    total: { amount: total.toString(), currency: cart.currency },
    tax_included: priceIncludesTax,
    tax: { amount: (tax?.totals.taxAmount ?? 0n).toString(), currency: cart.currency },
    net_subtotal: {
      amount: (tax?.totals.taxableAmount ?? subtotal).toString(),
      currency: cart.currency,
    },
    tax_breakdown: tax ? serializeBreakdown(tax.breakdown) : [],
    items: items.map((it) => ({
      id: it.pubId,
      variant_id: it.variantPubId,
      product_id: it.productPubId,
      product_slug: it.productSlug,
      sku: it.variantSku,
      title: it.titleSnapshot,
      quantity: it.quantity,
      unit_price: { amount: it.unitPriceAmount.toString(), currency: it.unitPriceCurrency },
      line_total: {
        amount: (it.unitPriceAmount * BigInt(it.quantity)).toString(),
        currency: it.unitPriceCurrency,
      },
      primary_image_url: it.primaryImageUrl,
    })),
  };
}

function ensureSession(req: FastifyRequest, reply: FastifyReply, isProd: boolean): string {
  const existing = req.cookies[CART_COOKIE_NAME];
  if (existing && /^[a-f0-9-]{16,128}$/i.test(existing)) return existing;
  const sessionId = randomBytes(24).toString('hex');
  reply.setCookie(CART_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: CART_COOKIE_TTL_DAYS * 24 * 60 * 60,
  });
  return sessionId;
}

function notFound(reply: any, kind: string) {
  return reply.code(404).send({
    error: { code: `${kind.toUpperCase()}_NOT_FOUND`, message: `${kind} not found` },
  });
}

function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      field_errors: error.flatten().fieldErrors,
    },
  });
}

async function generateOrderNumber(
  tx: { select: AppDb['select']; execute: AppDb['execute'] },
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  // Advisory lock serializes concurrent checkouts for the tenant so COUNT+1
  // can't collide on uq_orders_order_number.
  await tx.execute(dsql`SELECT pg_advisory_xact_lock(hashtext(${`ord:${tenantId}:${year}`}))`);
  const result = await tx
    .select({ count: dsql<number>`COUNT(*)::int` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, tenantId),
        dsql`EXTRACT(YEAR FROM ${schema.orders.placedAt}) = ${year}`,
      ),
    );
  const seq = (result[0]?.count ?? 0) + 1;
  return `ORD-${year}-${String(seq).padStart(8, '0')}`;
}
