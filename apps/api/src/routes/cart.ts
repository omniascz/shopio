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
import { schema } from '@shopio/db';
import { generatePubId } from '@shopio/authz';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import { createCheckoutSession, isStripeEnabled } from '../lib/stripe';
import { renderOrderPlacedEmail, sendEmail, type OrderEmailContext } from '../lib/email';
import { computeTax, serializeBreakdown, type TaxResult } from '../lib/tax';
import { resolveRates } from '../lib/tax-resolver';
import type { CartShippingMetrics } from '../lib/shipping';
import {
  resolveShippingOptions,
  resolveOptionById,
  searchPickupPoints,
  getPickupPoint,
} from '../lib/shipping-resolver';

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
  customerEmail: z.string().email().toLowerCase(),
  customerName: z.string().min(1).max(255),
  customerPhone: z.string().max(40).optional(),
  shippingAddress: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    countryCode: z.string().length(2),
    state: z.string().max(100).optional(),
  }),
  customerNote: z.string().max(2000).optional(),
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

      if (variant.stockOnHand < quantity && !variant.allowBackorder) {
        return reply.code(409).send({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock for requested quantity',
            available: variant.stockOnHand,
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
        if (variant.stockOnHand < newQty && !variant.allowBackorder) {
          return reply.code(409).send({
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: 'Adding this would exceed available stock',
              available: variant.stockOnHand,
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
        if (variant.stockOnHand < parsed.data.quantity && !variant.allowBackorder) {
          return reply.code(409).send({
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: 'Not enough stock for requested quantity',
              available: variant.stockOnHand,
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
      return reply.send({
        data: {
          country,
          options,
          // Packeta widget when configured; otherwise storefront uses the
          // seeded pickup-point picker (see /shipping/pickup-points).
          pickup_widget: config.PACKETA_API_KEY
            ? { provider: 'packeta', api_key: config.PACKETA_API_KEY }
            : null,
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

      // Shipping selection — resolve + price the chosen rate against the cart
      // metrics + ship-to country (per `14 §5`). Validate pickup point if required.
      const country = input.shippingAddress.countryCode.toUpperCase();
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

      // VAT computation — place of supply = ship-to country (per `15 §4` STAGE 1),
      // falling back to the tenant home country. Shipping is taxed as a line via the
      // tenant's shipping_tax_class. Pure; rate lookup is read-only so it runs before
      // the placement transaction.
      const rates = await resolveRates(db, tenant.id, country, tenant.countryCode);
      const tax = computeTax({
        lines: items.map((it) => ({
          ref: it.pubId,
          amount: it.unitPriceAmount * BigInt(it.quantity),
          taxClassCode: it.taxClassCode,
        })),
        shippingAmount: shippingGross,
        shippingTaxClass: tenant.shippingTaxClass,
        rates,
        priceIncludesTax: tenant.priceIncludesTax,
      });
      const taxByRef = new Map(tax.lines.map((l) => [l.ref, l]));
      const grossGoods = items.reduce(
        (sum, it) => sum + it.unitPriceAmount * BigInt(it.quantity),
        0n,
      );

      // Atomic: revalidate stock + decrement + create order + clear cart
      try {
        const result = await db.transaction(async (tx) => {
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
              allowBackorder: schema.productVariants.allowBackorder,
            })
            .from(schema.productVariants)
            .where(inArray(schema.productVariants.id, variantIds))
            .for('update');

          const variantMap = new Map(freshVariants.map((v) => [v.id, v]));

          // Stock check
          for (const it of items) {
            const v = variantMap.get(it.variantId);
            if (!v) {
              throw new CheckoutError(
                'VARIANT_GONE',
                `Variant ${it.variantId} no longer available`,
              );
            }
            if (v.stockOnHand < it.quantity && !v.allowBackorder) {
              throw new CheckoutError(
                'INSUFFICIENT_STOCK',
                `Insufficient stock for ${v.title}: available ${v.stockOnHand}, requested ${it.quantity}`,
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

          // Totals — VAT-inclusive B2C model: subtotal + shipping are gross line
          // items, tax is the VAT *contained* (shown "z toho DPH"), total = sum.
          const total = grossGoods + shippingGross; // == tax.totals.grossAmount

          // Insert order
          const [order] = await tx
            .insert(schema.orders)
            .values({
              tenantId: tenant.id,
              pubId: generatePubId('ord'),
              orderNumber,
              customerEmail: input.customerEmail,
              customerName: input.customerName,
              customerPhone: input.customerPhone ?? null,
              shippingAddress: input.shippingAddress,
              billingAddress: input.shippingAddress,
              currency: cart.currency,
              subtotalAmount: grossGoods,
              shippingAmount: shippingGross,
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
              status: 'pending_payment',
              paymentStatus: 'pending',
              paymentMethod: isStripeEnabled(config) ? 'stripe' : 'mock',
              channelKind: 'storefront_web',
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
                // net base; tax + gross snapshot from the engine
                lineSubtotalAmount: lt?.baseAmount ?? lineGross,
                taxClassCode: lt?.taxClassCode ?? it.taxClassCode,
                taxRateBasisPoints: lt?.taxRateBasisPoints ?? 0,
                lineTaxAmount: lt?.taxAmount ?? 0n,
                lineTotalAmount: lineGross,
              };
            }),
          );

          // Decrement stock (per `09-inventory.md` simple version — no reservation system yet)
          for (const it of items) {
            await tx
              .update(schema.productVariants)
              .set({
                stockOnHand: dsql`${schema.productVariants.stockOnHand} - ${it.quantity}`,
                updatedAt: new Date(),
              })
              .where(eq(schema.productVariants.id, it.variantId));
          }

          // Convert cart
          await tx
            .update(schema.carts)
            .set({ status: 'converted', statusEnteredAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.carts.id, cart.id));

          return order;
        });

        app.log.info(
          { orderId: result.id, tenantId: tenant.id, customerEmail: input.customerEmail },
          'checkout.order_placed',
        );

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
              shippingAddress: input.shippingAddress,
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

        // Stripe Checkout Session — if configured. Otherwise mock path.
        let paymentUrl: string | null = null;
        if (isStripeEnabled(config)) {
          try {
            const storefrontBase = config.SHOPIO_BASE_URL;
            const session = await createCheckoutSession(config, {
              orderId: result.pubId,
              orderNumber: result.orderNumber,
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
              customer_email: result.customerEmail,
              confirmation_url: `/s/${tenant.slug}/orders/${result.orderNumber}?email=${encodeURIComponent(result.customerEmail)}`,
            },
            payment_url: paymentUrl,
            next_step: paymentUrl
              ? 'Redirect customer to payment_url to complete payment'
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
  let tax: TaxResult | null = null;
  if (items.length > 0) {
    const rates = await resolveRates(db, tenant.id, tenant.countryCode, tenant.countryCode);
    tax = computeTax({
      lines: items.map((it) => ({
        ref: it.pubId,
        amount: it.unitPriceAmount * BigInt(it.quantity),
        taxClassCode: it.taxClassCode,
      })),
      rates,
      priceIncludesTax: tenant.priceIncludesTax,
    });
  }
  return serializeCart(cart, items, tax, tenant.priceIncludesTax);
}

function serializeCart(
  cart: typeof schema.carts.$inferSelect,
  items: Awaited<ReturnType<typeof listCartItems>>,
  tax: TaxResult | null,
  priceIncludesTax: boolean,
) {
  let subtotal = 0n;
  for (const it of items) {
    subtotal += it.unitPriceAmount * BigInt(it.quantity);
  }
  return {
    id: cart.pubId,
    status: cart.status,
    currency: cart.currency,
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    // subtotal = gross sum (what the customer pays when prices are VAT-inclusive)
    subtotal: { amount: subtotal.toString(), currency: cart.currency },
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
  tx: { select: AppDb['select'] },
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  // Count orders this tenant this year + 1 (simple, race-OK for MVP since tx-scoped)
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
