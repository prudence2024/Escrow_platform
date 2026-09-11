#!/usr/bin/env tsx
/**
 * DealSure DEVELOPMENT seed (Phase 3, §38).
 *
 * SYNTHETIC data only — demo personas and kobo amounts. Covers one
 * representative transaction per lifecycle state so developers can click
 * through every workspace variant against a local/Turso-dev database.
 *
 * SAFETY: refuses to run when NODE_ENV=production (assertDevSeedAllowed).
 * Never wire this into application startup or production migrations.
 *
 * Usage: npm run seed:dev [-- --db <url>]
 *   Default target: TURSO_DATABASE_URL when set, else file:./dealsure-dev.db
 *   (git-ignored). Migrations are applied first (idempotent).
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "@libsql/client";
import { assertDevSeedAllowed, resolveDbConfig, type DbEnv } from "../../config/env.js";
import { openDatabase } from "../client.js";
import { runMigrations } from "../migrate.js";
import { REPO_MIGRATIONS_DIR } from "../testUtils.js";
import { newId, newPublicReference, newInviteSlug } from "../../domain/ids.js";

const SELLER = "seed-seller-0001";
const BUYER = "seed-buyer-0001";
const ADMIN = "seed-admin-0001";

async function insert(
  client: Client,
  sql: string,
  args: Array<string | number | null>,
): Promise<void> {
  await client.execute({ sql, args });
}

async function seedTx(
  client: Client,
  opts: {
    id: string;
    status: string;
    title: string;
    amountMinor: number;
    at: number;
  },
): Promise<void> {
  const { id, status, title, amountMinor, at } = opts;
  const deliveryFee = 10000;
  await insert(
    client,
    `INSERT INTO transactions
      (id, public_reference, invite_slug, transaction_origin, seller_id, buyer_id,
       title, description, category, currency, amount_minor, delivery_fee_minor,
       platform_fee_minor, total_minor, status, created_at, updated_at)
     VALUES (?, ?, ?, 'SHARE_LINK', ?, ?, ?, 'Seed fixture', 'Electronics', 'NGN',
       ?, ?, 0, ? + ?, ?, ?, ?)`,
    [
      id,
      newPublicReference("dexseed", at),
      newInviteSlug(),
      SELLER,
      BUYER,
      title,
      amountMinor,
      deliveryFee,
      amountMinor,
      deliveryFee,
      status,
      at,
      at,
    ],
  );
  await insert(
    client,
    `INSERT INTO transaction_participants (id, transaction_id, profile_id, role, email, accepted_at)
     VALUES (?, ?, ?, 'buyer', 'buyer@dealsure.dev', ?)`,
    [newId(), id, BUYER, at],
  );
  await insert(
    client,
    `INSERT INTO transaction_status_history (id, transaction_id, actor_id, from_status, to_status, reason, created_at)
     VALUES (?, ?, ?, NULL, ?, 'Seeded state', ?)`,
    [newId(), id, SELLER, status, at],
  );
}

async function seedLedgerPost(
  client: Client,
  txId: string,
  refId: string,
  memo: string,
  debitCode: string,
  creditCode: string,
  amountMinor: number,
  at: number,
): Promise<void> {
  const journalId = newId();
  await insert(
    client,
    `INSERT INTO ledger_transactions (id, ref_id, transaction_id, memo, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [journalId, refId, txId, memo, at],
  );
  const debit = await client.execute({
    sql: "SELECT id FROM ledger_accounts WHERE code = ?",
    args: [debitCode],
  });
  const credit = await client.execute({
    sql: "SELECT id FROM ledger_accounts WHERE code = ?",
    args: [creditCode],
  });
  const debitId = String((debit.rows[0] as Record<string, unknown>)["id"]);
  const creditId = String((credit.rows[0] as Record<string, unknown>)["id"]);
  await insert(
    client,
    `INSERT INTO ledger_entries (id, ledger_transaction_id, account_id, debit_minor, credit_minor, memo)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [newId(), journalId, debitId, amountMinor, `${memo} [debit]`],
  );
  await insert(
    client,
    `INSERT INTO ledger_entries (id, ledger_transaction_id, account_id, debit_minor, credit_minor, memo)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [newId(), journalId, creditId, amountMinor, `${memo} [credit]`],
  );
}

export async function runDevSeed(client: Client, env: DbEnv = process.env): Promise<string[]> {
  assertDevSeedAllowed(env);
  const at = 1780000000000; // fixed synthetic clock (deterministic fixtures)
  const created: string[] = [];

  for (const [id, email, name] of [
    [SELLER, "seller@dealsure.dev", "Seed Seller"],
    [BUYER, "buyer@dealsure.dev", "Seed Buyer"],
    [ADMIN, "admin@dealsure.dev", "Seed Admin"],
  ] as Array<[string, string, string]>) {
    await insert(
      client,
      `INSERT OR IGNORE INTO profiles (id, email, display_name, full_name, onboarded, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, email, name, name, at, at],
    );
  }
  const roles: Array<[string, string]> = [
    [SELLER, "seller"],
    [BUYER, "buyer"],
    [ADMIN, "super_admin"],
    [ADMIN, "operations_admin"],
    [ADMIN, "finance_admin"],
  ];
  for (const [profileId, role] of roles) {
    await insert(
      client,
      `INSERT OR IGNORE INTO user_roles (id, profile_id, role, granted_by, granted_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newId(), profileId, role, ADMIN, at],
    );
  }
  await insert(
    client,
    `INSERT OR IGNORE INTO terms_versions (id, version, content, effective_at)
     VALUES ('seed-terms-v1', 1, 'DealSure development terms (placeholder).', ?)`,
    [at],
  );

  const states: Array<[string, string, string, number]> = [
    ["seed-tx-draft", "DRAFT", "Seed camera (draft)", 2000000],
    ["seed-tx-awaiting", "AWAITING_PAYMENT", "Seed laptop (awaiting payment)", 3500000],
    ["seed-tx-secured", "PAYMENT_SECURED", "Seed console (secured)", 1500000],
    ["seed-tx-dispatched", "DISPATCHED", "Seed bike (dispatched)", 800000],
    ["seed-tx-delivered", "DELIVERED_PENDING_INSPECTION", "Seed watch (inspection)", 1200000],
    ["seed-tx-accepted", "ACCEPTED", "Seed chair (accepted)", 500000],
    ["seed-tx-settled", "SETTLED", "Seed phone (settled)", 2500000],
    ["seed-tx-disputed", "DISPUTED", "Seed tablet (disputed)", 1800000],
    ["seed-tx-refund-pending", "REFUND_PENDING", "Seed speaker (refund pending)", 900000],
    ["seed-tx-refunded", "REFUNDED", "Seed mixer (refunded)", 700000],
    ["seed-tx-cancelled", "CANCELLED", "Seed lamp (cancelled)", 300000],
  ];
  for (const [id, status, title, amount] of states) {
    await seedTx(client, { id, status, title, amountMinor: amount, at });
    created.push(id);
  }

  // Secured-money fixtures: payment intent + balanced ledger post.
  for (const txId of ["seed-tx-secured", "seed-tx-dispatched", "seed-tx-delivered", "seed-tx-accepted", "seed-tx-settled"]) {
    const intentId = `seed-pi-${txId}`;
    await insert(
      client,
      `INSERT OR IGNORE INTO payment_intents
        (id, transaction_id, payer_id, provider, provider_reference, amount_minor, currency, status, idempotency_key, secured_at, created_at)
       VALUES (?, ?, ?, 'mock', ?, (SELECT total_minor FROM transactions WHERE id = ?), 'NGN', 'SECURED', ?, ?, ?)`,
      [intentId, txId, BUYER, `mock_${txId}`, txId, `seed-${txId}`, at, at],
    );
  }
  await seedLedgerPost(client, "seed-tx-secured", "seed-led-secured", "Seed: funds secured", "1000", "2000", 1510000, at);
  await seedLedgerPost(client, "seed-tx-settled", "seed-led-settle", "Seed: settlement released", "2000", "1000", 2510000, at);

  // Delivery fixtures.
  const deliveryId = "seed-delivery-1";
  await insert(
    client,
    `INSERT OR IGNORE INTO deliveries (id, transaction_id, courier_name, dispatched_at, status)
     VALUES (?, 'seed-tx-dispatched', 'Seed Courier', ?, 'DISPATCHED')`,
    [deliveryId, at],
  );
  await insert(
    client,
    `INSERT OR IGNORE INTO delivery_otps (id, transaction_id, delivery_id, code_digest, context, expires_at, attempt_count, max_attempts, created_at)
     VALUES ('seed-otp-1', 'seed-tx-dispatched', ?, 'deadbeef', 'seed-context', ?, 0, 5, ?)`,
    [deliveryId, at + 600000, at],
  );

  // Dispute fixture (+ message + evidence metadata, no file bodies).
  await insert(
    client,
    `INSERT OR IGNORE INTO disputes (id, transaction_id, opened_by, category, reason, status, created_at, updated_at)
     VALUES ('seed-dispute-1', 'seed-tx-disputed', ?, 'not_as_described', 'Seed dispute', 'OPEN', ?, ?)`,
    [BUYER, at, at],
  );
  await insert(
    client,
    `INSERT OR IGNORE INTO dispute_messages (id, dispute_id, author_id, body, created_at)
     VALUES ('seed-dmsg-1', 'seed-dispute-1', ?, 'Seed case message', ?)`,
    [BUYER, at],
  );
  await insert(
    client,
    `INSERT OR IGNORE INTO dispute_evidence (id, dispute_id, uploader_id, storage_key, mime_type, size_bytes, created_at)
     VALUES ('seed-dev-1', 'seed-dispute-1', ?, 'seed/photo-1.jpg', 'image/jpeg', 12345, ?)`,
    [BUYER, at],
  );

  // Settlement + refund fixtures.
  await insert(
    client,
    `INSERT OR IGNORE INTO settlements (id, transaction_id, payee_id, amount_minor, currency, status, provider, provider_reference, created_at, completed_at)
     VALUES ('seed-settle-1', 'seed-tx-settled', ?, 2510000, 'NGN', 'PAID', 'mock', 'mock_settle_1', ?, ?)`,
    [SELLER, at, at],
  );
  await insert(
    client,
    `INSERT OR IGNORE INTO refunds (id, transaction_id, requested_by, amount_minor, currency, status, reason, provider, created_at)
     VALUES ('seed-refund-pending-1', 'seed-tx-refund-pending', ?, 910000, 'NGN', 'PENDING', 'Seed pending refund', 'mock', ?)`,
    [BUYER, at],
  );
  await insert(
    client,
    `INSERT OR IGNORE INTO refunds (id, transaction_id, requested_by, amount_minor, currency, status, reason, provider, created_at, completed_at)
     VALUES ('seed-refund-paid-1', 'seed-tx-refunded', ?, 710000, 'NGN', 'PAID', 'Seed paid refund', 'mock', ?, ?)`,
    [BUYER, at, at],
  );
  await seedLedgerPost(client, "seed-tx-refunded", "seed-led-refund", "Seed: buyer refund", "2000", "1000", 710000, at);

  await insert(
    client,
    `INSERT OR IGNORE INTO notifications (id, profile_id, transaction_id, type, title, created_at)
     VALUES ('seed-notif-1', ?, 'seed-tx-secured', 'PAYMENT_SECURED', 'Seed: payment secured', ?)`,
    [SELLER, at],
  );
  await insert(
    client,
    `INSERT OR IGNORE INTO audit_logs (id, actor_id, action, entity_type, entity_id, created_at)
     VALUES ('seed-audit-1', ?, 'SEED', 'database', 'dev-seed-v1', ?)`,
    [ADMIN, at],
  );
  return created;
}

async function main(): Promise<void> {
  assertDevSeedAllowed(process.env);
  const dbFlag = process.argv.indexOf("--db");
  const override = dbFlag >= 0 ? process.argv[dbFlag + 1] : undefined;
  const env: DbEnv = {
    ...process.env,
    ...(override !== undefined ? { TURSO_DATABASE_URL: override } : {}),
  };
  if (env.TURSO_DATABASE_URL === undefined) {
    env.TURSO_DATABASE_URL = "file:./dealsure-dev.db";
  }
  const config = resolveDbConfig(env);
  const client = await openDatabase(config);
  try {
    await runMigrations(client, REPO_MIGRATIONS_DIR);
    const created = await runDevSeed(client, env);
    console.log(JSON.stringify({ mode: config.mode, seededTransactions: created.length }));
  } finally {
    client.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(`seed:dev failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
