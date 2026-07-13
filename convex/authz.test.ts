/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedUsers(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const santriId = await ctx.db.insert("users", {
      clerkId: "clerk_santri",
      name: "Santri A",
      email: "santri-a@example.com",
      role: "santri",
      isActive: true,
    });
    const adminId = await ctx.db.insert("users", {
      clerkId: "clerk_admin",
      name: "Admin B",
      email: "admin-b@example.com",
      role: "administrator",
      isActive: true,
    });
    return { santriId, adminId };
  });
}

describe("users.updateRole", () => {
  test("a non-admin cannot change roles", async () => {
    const t = convexTest(schema, modules);
    const { santriId } = await seedUsers(t);

    await expect(
      t
        .withIdentity({ subject: "clerk_santri" })
        .mutation(api.users.updateRole, { userId: santriId, role: "ustadz" })
    ).rejects.toThrow();
  });

  test("an administrator can change roles", async () => {
    const t = convexTest(schema, modules);
    const { santriId } = await seedUsers(t);

    await t
      .withIdentity({ subject: "clerk_admin" })
      .mutation(api.users.updateRole, { userId: santriId, role: "ustadz" });

    const updated = await t.run(async (ctx) => ctx.db.get(santriId));
    expect(updated?.role).toBe("ustadz");
  });

  test("an unauthenticated caller cannot change roles", async () => {
    const t = convexTest(schema, modules);
    const { santriId } = await seedUsers(t);

    await expect(
      t.mutation(api.users.updateRole, { userId: santriId, role: "ustadz" })
    ).rejects.toThrow();
  });
});

describe("users.updateProfile", () => {
  test("a user can update their own profile", async () => {
    const t = convexTest(schema, modules);
    const { santriId } = await seedUsers(t);

    await t
      .withIdentity({ subject: "clerk_santri" })
      .mutation(api.users.updateProfile, { userId: santriId, name: "Santri A (updated)" });

    const updated = await t.run(async (ctx) => ctx.db.get(santriId));
    expect(updated?.name).toBe("Santri A (updated)");
  });

  test("a user cannot update someone else's profile", async () => {
    const t = convexTest(schema, modules);
    const { adminId } = await seedUsers(t);

    await expect(
      t
        .withIdentity({ subject: "clerk_santri" })
        .mutation(api.users.updateProfile, { userId: adminId, name: "Hacked" })
    ).rejects.toThrow();
  });
});

describe("users.getByClerkId", () => {
  test("returns null for an unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);

    const result = await t.query(api.users.getByClerkId, { clerkId: "clerk_santri" });
    expect(result).toBeNull();
  });

  test("returns the caller's own profile", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);

    const result = await t
      .withIdentity({ subject: "clerk_santri" })
      .query(api.users.getByClerkId, { clerkId: "clerk_santri" });
    expect(result?.email).toBe("santri-a@example.com");
  });

  test("cannot fetch another user's profile by passing their clerkId", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);

    const result = await t
      .withIdentity({ subject: "clerk_santri" })
      .query(api.users.getByClerkId, { clerkId: "clerk_admin" });
    expect(result).toBeNull();
  });
});

describe("users.listAll", () => {
  test("returns nothing for an unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);

    expect(await t.query(api.users.listAll, {})).toEqual([]);
  });

  test("returns nothing for a plain santri (not staff)", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);

    const result = await t
      .withIdentity({ subject: "clerk_santri" })
      .query(api.users.listAll, {});
    expect(result).toEqual([]);
  });

  test("returns every user for an administrator", async () => {
    const t = convexTest(schema, modules);
    await seedUsers(t);

    const result = await t
      .withIdentity({ subject: "clerk_admin" })
      .query(api.users.listAll, {});
    expect(result).toHaveLength(2);
  });
});
