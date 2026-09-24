import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { isDecoyPath } from "./trap-paths";

describe("isDecoyPath", () => {
  test.each([
    "/wp-admin",
    "/wp-admin/",
    "/wp-login.php",
    "/WP-Admin/install.php",
    "/phpmyadmin/index.php",
    "/.env",
    "/.git/config",
    "/admin",
    "/admin/login",
    "/administrator",
    "/config.php",
    "/backup.sql",
    "/api/admin/users",
    "/foo/bar.php",
  ])("%s adalah umpan", (path) => {
    expect(isDecoyPath(path)).toBe(true);
  });

  test.each([
    "/",
    "/login",
    "/dashboard",
    "/admin-lembaga-requests", // rute asli — mirip /admin tetapi BUKAN umpan
    "/materi/abc123",
    "/pdf-viewer",
    "/mushaf",
    "/administrasi-santri",
    "/tarbiyah/tahsin",
  ])("%s bukan umpan", (path) => {
    expect(isDecoyPath(path)).toBe(false);
  });

  test("tidak ada rute asli di folder app/ yang tertangkap sebagai umpan", () => {
    const routes: string[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          // Grup (...) tidak muncul di URL.
          walk(full, /^\(.*\)$/.test(name) ? prefix : `${prefix}/${name}`);
        } else if (/\.tsx?$/.test(name) && !name.startsWith("+") && !name.startsWith("_")) {
          const base = name.replace(/\.(web\.)?tsx?$/, "");
          routes.push(base === "index" ? prefix || "/" : `${prefix}/${base}`);
        }
      }
    };
    walk(join(__dirname, "..", "app"), "");
    expect(routes.length).toBeGreaterThan(20);
    const collisions = routes
      .map((r) => r.replace(/\[[^\]]+\]/g, "x"))
      .filter((r) => isDecoyPath(r));
    expect(collisions).toEqual([]);
  });
});
