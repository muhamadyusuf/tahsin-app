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
import type * as ceramahVideo from "../ceramahVideo.js";
import type * as dzikir from "../dzikir.js";
import type * as http from "../http.js";
import type * as iotDevices from "../iotDevices.js";
import type * as kelas from "../kelas.js";
import type * as kelasPertemuan from "../kelasPertemuan.js";
import type * as lkmJoinRequest from "../lkmJoinRequest.js";
import type * as materi from "../materi.js";
import type * as meeting from "../meeting.js";
import type * as mushafProgress from "../mushafProgress.js";
import type * as ngajiAi from "../ngajiAi.js";
import type * as quiz from "../quiz.js";
import type * as quranPages from "../quranPages.js";
import type * as recordings from "../recordings.js";
import type * as recordingsNode from "../recordingsNode.js";
import type * as sambungAyat from "../sambungAyat.js";
import type * as santri from "../santri.js";
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
  ceramahVideo: typeof ceramahVideo;
  dzikir: typeof dzikir;
  http: typeof http;
  iotDevices: typeof iotDevices;
  kelas: typeof kelas;
  kelasPertemuan: typeof kelasPertemuan;
  lkmJoinRequest: typeof lkmJoinRequest;
  materi: typeof materi;
  meeting: typeof meeting;
  mushafProgress: typeof mushafProgress;
  ngajiAi: typeof ngajiAi;
  quiz: typeof quiz;
  quranPages: typeof quranPages;
  recordings: typeof recordings;
  recordingsNode: typeof recordingsNode;
  sambungAyat: typeof sambungAyat;
  santri: typeof santri;
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
