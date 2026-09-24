// Alat audit keamanan — internal, hanya bisa dijalankan dari CLI/dashboard:
//
//   npx convex run security:auditAdministrators
//
// Dipakai setelah perbaikan celah upsertUser (client dulu bisa mengirim email
// admin sembarang dan otomatis menjadi administrator): periksa apakah ada akun
// administrator yang tidak Anda kenal, lalu turunkan lewat updateRole.
import { internalQuery } from "./_generated/server";
import { ADMIN_EMAILS } from "./authz";

export const auditAdministrators = internalQuery({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "administrator"))
      .take(500);

    // Administrator yang sedang "berganti tampilan" memiliki role lain tetapi
    // emailnya tetap ADMIN_EMAILS — sertakan lewat index email.
    const byEmail = [];
    for (const email of ADMIN_EMAILS) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .take(20);
      byEmail.push(...rows);
    }

    const seen = new Map<string, (typeof admins)[number]>();
    for (const u of [...admins, ...byEmail]) seen.set(u._id, u);

    return [...seen.values()].map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      clerkId: u.clerkId,
      role: u.role,
      emailIsInAdminList: ADMIN_EMAILS.includes(u.email.toLowerCase()),
      createdAt: new Date(u._creationTime).toISOString(),
    }));
  },
});
