/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminPengajian from "../adminPengajian.js";
import type * as appConfig from "../appConfig.js";
import type * as materi from "../materi.js";
import type * as ngajiAi from "../ngajiAi.js";
import type * as quiz from "../quiz.js";
import type * as talaqi from "../talaqi.js";
import type * as tilawah from "../tilawah.js";
import type * as users from "../users.js";
import type * as ustadz from "../ustadz.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminPengajian: typeof adminPengajian;
  appConfig: typeof appConfig;
  materi: typeof materi;
  ngajiAi: typeof ngajiAi;
  quiz: typeof quiz;
  talaqi: typeof talaqi;
  tilawah: typeof tilawah;
  users: typeof users;
  ustadz: typeof ustadz;
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
