import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type Member = {
  email: string;
  role: "admin" | "member";
  userId?: string;
};

export const getOrCreate = query({
  args: {},
  handler: async (ctx) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error("Not authorized");

    // Prefer Clerk org id if present in identity token, else fallback to user-owned family
    // tokenIdentifier often looks like `https://<domain>|<userId>`
    const orgId = (auth as any).orgId ?? undefined;
    const ownerUserId = auth.subject;

    let family = await ctx.db
      .query("families")
      .filter((q) =>
        orgId
          ? q.eq(q.field("orgId"), orgId)
          : q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("orgId"), undefined as any))
      )
      .first();

    if (!family) {
      const name = "Family";
      const id = await ctx.db.insert("families", {
        name,
        orgId,
        ownerUserId,
        members: [] as Member[],
      });
      family = await ctx.db.get(id);
    }

    return family;
  },
});

export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error("Not authorized");
    const ownerUserId = auth.subject;
    const orgId = (auth as any).orgId ?? undefined;

    const family = await ctx.db
      .query("families")
      .filter((q) =>
        orgId
          ? q.eq(q.field("orgId"), orgId)
          : q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("orgId"), undefined as any))
      )
      .first();
    if (!family) throw new Error("Not found");
    if (family.ownerUserId !== ownerUserId) throw new Error("Not authorized");

    await ctx.db.patch(family._id, { name: args.name });
  },
});

export const addMember = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error("Not authorized");
    const ownerUserId = auth.subject;
    const orgId = (auth as any).orgId ?? undefined;

    const family = await ctx.db
      .query("families")
      .filter((q) =>
        orgId
          ? q.eq(q.field("orgId"), orgId)
          : q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("orgId"), undefined as any))
      )
      .first();
    if (!family) throw new Error("Not found");
    if (family.ownerUserId !== ownerUserId) throw new Error("Not authorized");

    const members: Member[] = family.members ?? [];
    if (members.some((m) => m.email.toLowerCase() === args.email.toLowerCase())) return;
    members.push({ email: args.email, role: "member" });
    await ctx.db.patch(family._id, { members });
  },
});

export const removeMember = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const auth = await ctx.auth.getUserIdentity();
    if (!auth) throw new Error("Not authorized");
    const ownerUserId = auth.subject;
    const orgId = (auth as any).orgId ?? undefined;

    const family = await ctx.db
      .query("families")
      .filter((q) =>
        orgId
          ? q.eq(q.field("orgId"), orgId)
          : q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("orgId"), undefined as any))
      )
      .first();
    if (!family) throw new Error("Not found");
    if (family.ownerUserId !== ownerUserId) throw new Error("Not authorized");

    const members: Member[] = (family.members ?? []).filter(
      (m) => m.email.toLowerCase() !== args.email.toLowerCase()
    );
    await ctx.db.patch(family._id, { members });
  },
});


