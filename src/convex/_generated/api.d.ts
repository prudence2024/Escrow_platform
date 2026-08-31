/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as config from "../config.js";
import type * as crons from "../crons.js";
import type * as delivery from "../delivery.js";
import type * as disputes from "../disputes.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as lib from "../lib.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as payments_providers from "../payments/providers.js";
import type * as profile from "../profile.js";
import type * as settlement from "../settlement.js";
import type * as transactions from "../transactions.js";
import type * as transactions_state from "../transactions/state.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  config: typeof config;
  crons: typeof crons;
  delivery: typeof delivery;
  disputes: typeof disputes;
  github: typeof github;
  http: typeof http;
  jobs: typeof jobs;
  lib: typeof lib;
  notifications: typeof notifications;
  payments: typeof payments;
  "payments/providers": typeof payments_providers;
  profile: typeof profile;
  settlement: typeof settlement;
  transactions: typeof transactions;
  "transactions/state": typeof transactions_state;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
