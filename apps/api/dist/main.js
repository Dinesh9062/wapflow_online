var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/main.ts
import "reflect-metadata";
import { All, Controller, Module, Req, Res } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import { Server } from "socket.io";
import { randomUUID as randomUUID2 } from "node:crypto";
import { z as z3 } from "zod";

// ../../packages/shared/src/index.ts
import { z as z2 } from "zod";

// ../../packages/shared/src/send-timing.ts
import { z } from "zod";
var time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
var deliverySettingsSchema = z.object({
  sendGapSeconds: z.number().int().min(10).max(3600),
  sendDailyCap: z.number().int().min(1).max(200),
  sendContactCooldownMinutes: z.number().int().min(1).max(10080),
  sendContactDailyCap: z.number().int().min(1).max(50),
  autoReplyDelaySeconds: z.number().int().min(5).max(300),
  contactLimitMode: z.enum(["auto-rule", "shared"]),
  backgroundSending: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietStart: time,
  quietEnd: time
});
var defaultDeliverySettings = { sendGapSeconds: 30, sendDailyCap: 50, sendContactCooldownMinutes: 10, sendContactDailyCap: 3, autoReplyDelaySeconds: 10, contactLimitMode: "auto-rule", backgroundSending: true, quietHoursEnabled: false, quietStart: "22:00", quietEnd: "08:00" };
var AUTO_REPLY_FRESH_MS = 3e5;
function autoReplyWait(rule, attempts, contactKey, now = Date.now()) {
  const same = attempts.filter((a) => a.contactKey === contactKey && a.at <= now), latest = Math.max(0, ...same.map((a) => a.at));
  const today = localClock(now, rule.timezone).date;
  if (same.filter((a) => localClock(a.at, rule.timezone).date === today).length >= rule.dailyCap) return { reason: "Auto reply contact daily limit", until: dayBounds(now, rule.timezone).end };
  if (latest && now < latest + rule.cooldownMinutes * 6e4) return { reason: "Auto reply contact cooldown", until: latest + rule.cooldownMinutes * 6e4 };
  return null;
}
function dayBounds(at, timezone) {
  const date = localClock(at, timezone).date;
  const boundary = (lo, hi, after) => {
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2), same = localClock(mid, timezone).date === date;
      if (after ? same : !same) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  return { start: boundary(at - 36 * 36e5, at, false), end: boundary(at, at + 36 * 36e5, true) };
}
function deliveryWait(settings, attempts, contactKey, now = Date.now(), busy = false, contactPolicy = {}) {
  const s = { ...defaultDeliverySettings, ...settings }, waits = [];
  if (busy) waits.push({ reason: "Another message is being sent", until: now + 3e4 });
  if (s.quietHoursEnabled && inWindow(now, s.timezone, [0, 1, 2, 3, 4, 5, 6], s.quietStart, s.quietEnd)) {
    let until = now - now % 6e4 + 6e4;
    for (let i = 0; i < 1620 && inWindow(until, s.timezone, [0, 1, 2, 3, 4, 5, 6], s.quietStart, s.quietEnd); i++) until += 6e4;
    waits.push({ reason: "Quiet hours", until });
  }
  const latest = Math.max(0, ...attempts.map((a) => a.at)), same = (contactPolicy.attempts || attempts).filter((a) => a.contactKey === contactKey), contactLatest = Math.max(0, ...same.map((a) => a.at));
  if (latest && now < latest + s.sendGapSeconds * 1e3) waits.push({ reason: "Message gap", until: latest + s.sendGapSeconds * 1e3 });
  if (!contactPolicy.skip && contactLatest && now < contactLatest + s.sendContactCooldownMinutes * 6e4) waits.push({ reason: "Contact cooldown", until: contactLatest + s.sendContactCooldownMinutes * 6e4 });
  const date = localClock(now, s.timezone).date, today = attempts.filter((a) => localClock(a.at, s.timezone).date === date);
  if (today.length >= s.sendDailyCap) waits.push({ reason: "Daily message limit", until: dayBounds(now, s.timezone).end });
  if (!contactPolicy.skip && same.filter((a) => localClock(a.at, s.timezone).date === date).length >= s.sendContactDailyCap) waits.push({ reason: "Contact daily limit", until: dayBounds(now, s.timezone).end });
  const wait = waits.sort((a, b) => b.until - a.until)[0];
  if (wait) wait.reasons = [...new Set(waits.map((w) => w.reason))];
  if (wait && s.quietHoursEnabled) {
    if (inWindow(wait.until, s.timezone, [0, 1, 2, 3, 4, 5, 6], s.quietStart, s.quietEnd) && !wait.reasons.includes("Quiet hours")) wait.reasons.push("Quiet hours");
    for (let i = 0; i < 1620 && inWindow(wait.until, s.timezone, [0, 1, 2, 3, 4, 5, 6], s.quietStart, s.quietEnd); i++) wait.until = wait.until - wait.until % 6e4 + 6e4;
  }
  return wait || null;
}

// ../../packages/shared/src/index.ts
var contactSchema = z2.object({ key: z2.string().min(3).max(160), name: z2.string().min(1).max(150), type: z2.enum(["individual", "group", "unknown"]) });
var repeatWeekdays = z2.array(z2.number().int().min(0).max(6)).max(7).transform((days) => [...new Set(days)].sort()).optional();
function validateRecurrence(v, ctx) {
  if (v.repeat !== "weekdays") return;
  if (!v.repeatWeekdays?.length) {
    ctx.addIssue({ code: "custom", path: ["repeatWeekdays"], message: "Choose at least one custom weekday" });
    return;
  }
  try {
    if (!v.repeatWeekdays.includes(localClock(Date.parse(v.dueAt), v.timezone).day)) ctx.addIssue({ code: "custom", path: ["dueAt"], message: "Choose the first date on a selected weekday" });
  } catch {
  }
}
var repeatSchema = z2.enum(["none", "daily", "weekly", "custom", "weekdays"]);
var followupSchema = z2.object({ contact: contactSchema, messageKey: z2.string().max(200).optional(), subject: z2.object({ name: z2.string().min(1).max(150), key: z2.string().max(160).optional() }).optional(), note: z2.string().min(1).max(2e3), dueAt: z2.iso.datetime(), priority: z2.enum(["low", "normal", "high"]).default("normal"), reminderMinutes: z2.number().int().min(0).max(10080).default(0), repeat: repeatSchema.default("none"), repeatWeekdays, repeatDays: z2.number().int().min(1).max(365).default(1), timezone: z2.string().default("Asia/Kolkata") }).superRefine(validateRecurrence);
var scheduleSchema = z2.object({ followupId: z2.uuid().optional(), contact: contactSchema, messageKey: z2.string().max(200).optional(), body: z2.string().min(1).max(4e3), dueAt: z2.iso.datetime(), repeat: repeatSchema.default("none"), repeatWeekdays, repeatDays: z2.number().int().min(1).max(365).default(1), timezone: z2.string().default("Asia/Kolkata"), consent: z2.literal(true) }).superRefine(validateRecurrence);
var ruleSchema = z2.object({ name: z2.string().min(1).max(100), trigger: z2.enum(["keyword", "first", "outside-hours", "unanswered", "contact"]), keywords: z2.array(z2.string().min(1).max(100)).max(20).default([]), response: z2.string().min(1).max(4e3), days: z2.array(z2.number().int().min(0).max(6)).min(1), start: z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z2.string().default("Asia/Kolkata"), cooldownMinutes: z2.number().int().min(1).max(10080).default(30), dailyCap: z2.number().int().min(1).max(50).default(3), delayMinutes: z2.number().int().min(1).max(1440).default(5), contactKeys: z2.array(z2.string()).default([]), excludedKeys: z2.array(z2.string()).default([]), allowGroups: z2.boolean().default(false), enabled: z2.boolean().default(false) }).superRefine((r, ctx) => {
  if (r.enabled && r.trigger === "keyword" && !r.keywords.length) ctx.addIssue({ code: "custom", path: ["keywords"], message: "Keyword rule ke liye kam se kam ek keyword chahiye" });
  if (r.enabled && r.trigger === "contact" && !r.contactKeys.length) ctx.addIssue({ code: "custom", path: ["contactKeys"], message: "Contact-specific rule mein contact ko checkbox se select karein" });
});
var defaultSettings = { ...defaultDeliverySettings, timezone: "Asia/Kolkata", graceMinutes: 30, awaitingReplyMode: "outgoing", notifications: true, autoPaused: true, excludedKeys: [], workingStart: "09:00", workingEnd: "18:00", workingDays: [1, 2, 3, 4, 5], apiUrl: "http://localhost:4000", accountNamespace: "default", dateOrder: "DMY", ownPhone: "", autoReadUnread: true, mentionAliases: [] };
var initialState = { followups: [], schedules: [], rules: [], notes: {}, settings: defaultSettings, license: null };
var cleanContactName = (s) => s.replace(/[\u200e\u200f]/g, "").replace(/^\s*\d[\d,]*\s+unread messages?\s*/i, "").replace(/\s+/g, " ").trim();
var canonicalName = (s) => cleanContactName(s).replace(/\s*\((?:you|आप)\)\s*$/i, "").trim();
function sameReminderRecipient(a, b) {
  return a.key.split("|")[0] === b.key.split("|")[0] && (a.type === "unknown" || b.type === "unknown" || a.type === b.type) && (a.key === b.key || (a.key.includes("|local:") || b.key.includes("|local:")) && canonicalName(a.name) === canonicalName(b.name));
}
function localClock(at, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), minute: Number(p.hour) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` };
}
var minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
function inWindow(at, tz, days, start, end) {
  const c = localClock(at, tz), a = minutes(start), b = minutes(end);
  if (a === b) return days.includes(c.day);
  if (a < b) return days.includes(c.day) && c.minute >= a && c.minute < b;
  return days.includes(c.day) && c.minute >= a || days.includes((c.day + 6) % 7) && c.minute < b;
}
function ruleMatches(r, c, m, settings, first, now = Date.now()) {
  if (c.self || !r.enabled || settings.autoPaused || m.direction !== "in" || !c.verified || settings.excludedKeys.includes(c.key) || r.excludedKeys.includes(c.key)) return false;
  if (c.type === "group" && (!r.allowGroups || !r.contactKeys.includes(c.key))) return false;
  if (r.contactKeys.length && !r.contactKeys.includes(c.key)) return false;
  if (!inWindow(now, r.timezone, r.days, r.start, r.end)) return false;
  if (r.trigger === "keyword") return r.keywords.some((x) => m.body.toLocaleLowerCase().includes(x.toLocaleLowerCase()));
  if (r.trigger === "first") return first;
  if (r.trigger === "outside-hours") return !inWindow(now, settings.timezone, settings.workingDays, settings.workingStart, settings.workingEnd);
  return r.trigger === "contact" || r.trigger === "unanswered";
}
function nextOccurrence(iso, repeat, custom, tz, now = Date.now(), weekdays = []) {
  if (repeat === "none") return null;
  if (repeat === "weekdays" && !weekdays.some((d) => Number.isInteger(d) && d >= 0 && d <= 6)) throw Error("Custom weekdays are missing");
  const step = repeat === "weekly" ? 7 : repeat === "daily" || repeat === "weekdays" ? 1 : custom;
  let n = Date.parse(iso);
  for (let count = 0; count < 1e5; count++) {
    const before = localClock(n, tz);
    let target = n + step * 864e5;
    const after = localClock(target, tz);
    let diff = before.minute - after.minute;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    target += diff * 6e4;
    n = target;
    if (n > now && (repeat !== "weekdays" || weekdays.includes(localClock(n, tz).day))) return new Date(n).toISOString();
  }
  throw Error("Repeat date is too old");
}
function licenseStatus(user, now = Date.now()) {
  const lifetime = user.subscriptionStatus === "lifetime";
  const trial = user.trialEnd.getTime() > now;
  const paid = Boolean(user.periodEnd && user.periodEnd.getTime() > now && ["active", "cancelled", "pending"].includes(user.subscriptionStatus));
  return { premium: !user.disabled && (lifetime || trial || paid), status: user.disabled ? "disabled" : lifetime ? "lifetime" : paid ? "paid" : trial ? "trial" : "expired", trialEnd: user.trialEnd.toISOString(), daysLeft: Math.max(0, Math.ceil((user.trialEnd.getTime() - now) / 864e5)), price: 1e3 };
}
function canClaim(status, dueAt, now = Date.now()) {
  return ["queued", "ready", "needs-whatsapp-open"].includes(status) && dueAt.getTime() <= now;
}

// src/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
function encryptionKey() {
  const k = process.env.DATA_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(k)) throw Object.assign(Error("DATA_ENCRYPTION_KEY must be 64 hex characters"), { code: "DATA_KEY_CONFIG" });
  return Buffer.from(k, "hex");
}
function decryptionKeys() {
  const previous = (process.env.DATA_ENCRYPTION_PREVIOUS_KEYS || "").split(/[\s,]+/).filter(Boolean);
  if (previous.length > 8 || previous.some((k) => !/^[a-f0-9]{64}$/i.test(k))) throw Object.assign(Error("DATA_ENCRYPTION_PREVIOUS_KEYS must contain at most 8 comma-separated 64-hex keys"), { code: "DATA_KEY_CONFIG" });
  return [...new Map([encryptionKey(), ...previous.map((k) => Buffer.from(k, "hex"))].map((k) => [k.toString("hex"), k])).values()];
}
function seal(data) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return { encrypted: Buffer.concat([iv, c.getAuthTag(), body]).toString("base64") };
}
function unseal(data) {
  if (typeof data?.encrypted !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.encrypted)) throw Object.assign(Error("Encrypted record format missing or invalid"), { code: "DATA_RECORD_FORMAT" });
  const b = Buffer.from(data.encrypted, "base64");
  if (b.length < 29) throw Object.assign(Error("Encrypted record is incomplete"), { code: "DATA_RECORD_FORMAT" });
  for (const key of decryptionKeys()) {
    let plain;
    try {
      const c = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
      c.setAuthTag(b.subarray(12, 28));
      plain = Buffer.concat([c.update(b.subarray(28)), c.final()]);
    } catch {
      continue;
    }
    try {
      return JSON.parse(plain.toString());
    } catch {
      throw Object.assign(Error("Encrypted record contains invalid JSON"), { code: "DATA_RECORD_FORMAT" });
    }
  }
  throw Object.assign(Error("Record cannot be authenticated with configured keys"), { code: "DATA_KEY_MISMATCH" });
}
function verifyWebhook(raw, signature, secret2) {
  const expected = createHmac("sha256", secret2).update(raw).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// src/billing.ts
import { randomUUID } from "node:crypto";
var fail = (message, status = 400) => Object.assign(Error(message), { status });
function checkoutUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && ["rzp.io", "razorpay.com"].includes(u.hostname);
  } catch {
    return false;
  }
}
var creating = /* @__PURE__ */ new Map();
async function createLifetimePayment(db2, provider, u) {
  if (u.subscriptionStatus === "lifetime") return { alreadyPaid: true };
  const flight = creating.get(u.id);
  if (flight) return flight;
  const promise = db2.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id + "|lifetime-checkout"}))`;
    if ((await tx.user.findUniqueOrThrow({ where: { id: u.id } })).subscriptionStatus === "lifetime") return { alreadyPaid: true };
    let row = await tx.lifetimePayment.findFirst({ where: { userId: u.id, status: "created", expiresAt: { gt: new Date(Date.now() + 6e4) } }, orderBy: { createdAt: "desc" } });
    if (row?.checkoutUrl && checkoutUrl(row.checkoutUrl)) return { paymentId: row.id, checkoutUrl: row.checkoutUrl, amount: 1e3, currency: "INR", plan: "lifetime" };
    if (!row) row = await tx.lifetimePayment.create({ data: { userId: u.id, referenceId: randomUUID(), expiresAt: new Date(Date.now() + 864e5) } });
    const link = await provider("/payment_links", { amount: 1e5, currency: "INR", accept_partial: false, reference_id: row.referenceId, expire_by: Math.floor(row.expiresAt.getTime() / 1e3), description: "Wapflow Connect lifetime access \u2014 one-time \u20B91,000", notify: { sms: false, email: false }, reminder_enable: false, notes: { user_id: u.id, reference_id: row.referenceId, plan: "lifetime" } });
    if (!/^plink_[A-Za-z0-9]+$/.test(link.id || "") || link.amount !== 1e5 || link.currency !== "INR" || link.reference_id !== row.referenceId || !checkoutUrl(link.short_url)) throw fail("Payment provider returned an invalid checkout", 502);
    await tx.lifetimePayment.update({ where: { id: row.id }, data: { providerId: link.id, providerOrderId: link.order_id || null, checkoutUrl: link.short_url } });
    await tx.audit.create({ data: { userId: u.id, action: "lifetime-checkout-created", target: link.id, result: "INR 1000 once" } });
    return { paymentId: row.id, checkoutUrl: link.short_url, amount: 1e3, currency: "INR", plan: "lifetime" };
  }, { timeout: 25e3, maxWait: 25e3 });
  creating.set(u.id, promise);
  try {
    return await promise;
  } finally {
    if (creating.get(u.id) === promise) creating.delete(u.id);
  }
}
async function reconcileLifetimePayment(db2, provider, row, event) {
  if (!row.providerId) throw fail("Checkout is still being created. Retry shortly.", 409);
  const link = await provider("/payment_links/" + encodeURIComponent(row.providerId));
  if (link.id !== row.providerId || link.reference_id !== row.referenceId || link.amount !== row.amount || link.currency !== row.currency || row.amount !== 1e5 || row.currency !== "INR" || link.accept_partial === true) throw fail("Payment checkout verification failed", 409);
  const candidate = (link.payments || []).find((p) => p.payment_id === row.paymentId) || [...link.payments || []].reverse().find((p) => p.status === "captured" && p.amount === 1e5);
  let paid = false, refunded = false, payment;
  if (candidate) {
    payment = await provider("/payments/" + encodeURIComponent(candidate.payment_id));
    if (payment.id !== candidate.payment_id || !link.order_id || payment.order_id !== link.order_id || payment.amount !== 1e5 || payment.currency !== "INR") throw fail("Payment amount or order verification failed", 409);
    refunded = payment.status === "refunded" || Number(payment.amount_refunded) > 0;
    paid = !refunded && link.status === "paid" && link.amount_paid === 1e5 && payment.status === "captured" && payment.captured === true;
  }
  let status = refunded ? "refunded" : paid ? "paid" : ["expired", "cancelled"].includes(link.status) ? link.status : "created";
  await db2.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.userId + "|lifetime-entitlement"}))`;
    const current = await tx.lifetimePayment.findUniqueOrThrow({ where: { id: row.id } });
    if (current.status === "refunded") {
      status = "refunded";
      paid = false;
      refunded = true;
    }
    await tx.lifetimePayment.update({ where: { id: row.id }, data: { status, providerOrderId: link.order_id || null, ...payment ? { paymentId: payment.id } : {}, ...paid ? { paidAt: row.paidAt || /* @__PURE__ */ new Date() } : {} } });
    if (paid) await tx.user.update({ where: { id: row.userId }, data: { subscriptionStatus: "lifetime", periodEnd: null } });
    if (refunded && !await tx.lifetimePayment.count({ where: { userId: row.userId, status: "paid" } })) await tx.user.updateMany({ where: { id: row.userId, subscriptionStatus: "lifetime" }, data: { subscriptionStatus: "lifetime-refunded", periodEnd: null } });
    if (event) await tx.webhook.upsert({ where: { id: event.id }, create: { id: event.id, event: event.name, providerId: row.providerId }, update: {} });
    if (status !== current.status) await tx.audit.create({ data: { userId: row.userId, action: "lifetime-payment-verified", target: row.providerId, result: status } });
  });
  let legacyRenewalPending = false;
  if (paid) {
    const current = await db2.lifetimePayment.findUniqueOrThrow({ where: { id: row.id } }), owner = await db2.user.findUniqueOrThrow({ where: { id: row.userId } });
    if (owner.providerId && !current.legacyCancelled) {
      try {
        const legacy = await provider("/subscriptions/" + encodeURIComponent(owner.providerId));
        if (!["cancelled", "completed", "expired"].includes(legacy.status)) await provider("/subscriptions/" + encodeURIComponent(owner.providerId) + "/cancel", { cancel_at_cycle_end: 1 });
        await db2.lifetimePayment.update({ where: { id: row.id }, data: { legacyCancelled: true } });
      } catch {
        legacyRenewalPending = true;
        await db2.audit.create({ data: { userId: row.userId, action: "legacy-renewal-cancel-pending", target: owner.providerId, result: "Retry legacy cancellation from Billing" } });
      }
    }
  }
  return { status, plan: "lifetime", amount: 1e3, legacyRenewalPending };
}

// src/errors.ts
function errorResponse(error) {
  const code = error?.code;
  if (code === "P1000") return { status: 503, error: "Database login failed. Check DATABASE_URL username/password; existing Docker database passwords are not changed by editing .env." };
  if (["P1001", "P1002", "P1017"].includes(code)) return { status: 503, error: "Database unavailable. Start PostgreSQL and check DATABASE_URL host/port." };
  if (["P2021", "P2022"].includes(code)) return { status: 503, error: "Database schema is outdated. Run npm run db:generate and npm run db:migrate in the source folder." };
  if (code === "P2002") return { status: 409, error: "This record already exists. Refresh and try again." };
  if (error?.status) return { status: error.status, error: error.message };
  return { status: 500, error: "Server could not complete this request. Check the API log with the request ID." };
}
function readRecord(read, warnings, label) {
  try {
    return read();
  } catch (error) {
    warnings.push(error.code === "DATA_RECORD_FORMAT" ? label + " has an unsupported legacy or damaged encrypted format. It is preserved; changing .env does not repair its format." : error.code === "DATA_KEY_CONFIG" ? label + " cannot be read: check encryption-key configuration in the server .env." : label + " could not be decrypted. Preserve existing data and restore the original DATA_ENCRYPTION_KEY from your previous .env, or include an available original key in DATA_ENCRYPTION_PREVIOUS_KEYS.");
    return null;
  }
}

// src/delivery.ts
async function deliveryHistory(client, userId, now = Date.now()) {
  const since = new Date(now - 8 * 864e5);
  const [audits, rows, busy] = await Promise.all([
    client.audit.findMany({ where: { userId, action: "send-start", at: { gte: since } }, orderBy: { at: "desc" } }),
    client.schedule.findMany({ where: { userId, OR: [{ leaseAt: { gte: since } }, { sentAt: { gte: since } }] }, select: { id: true, kind: true, contactKey: true, leaseAt: true, sentAt: true } }),
    client.schedule.findFirst({ where: { userId, status: "sending" }, select: { id: true } })
  ]);
  const audited = new Set(audits.map((a) => a.target)), autoIds = new Set(rows.filter((x) => x.kind === "auto").map((x) => x.id));
  const attempts = audits.map((a) => ({ at: a.at.getTime(), contactKey: a.result }));
  const autoAttempts = audits.filter((a) => autoIds.has(a.target)).map((a) => ({ at: a.at.getTime(), contactKey: a.result }));
  const scheduledAttempts = audits.filter((a) => !autoIds.has(a.target)).map((a) => ({ at: a.at.getTime(), contactKey: a.result }));
  for (const row of rows.filter((x) => !audited.has(x.id))) {
    const attempt = { at: (row.leaseAt || row.sentAt).getTime(), contactKey: row.contactKey };
    attempts.push(attempt);
    if (row.kind === "auto") autoAttempts.push(attempt);
    else scheduledAttempts.push(attempt);
  }
  return { attempts, autoAttempts, scheduledAttempts, busy: !!busy };
}
function jobWait(job, settings, rules, history, now = Date.now()) {
  const separate = settings.contactLimitMode !== "shared", contactPolicy = separate ? job.kind === "auto" ? { skip: true } : { attempts: history.scheduledAttempts || history.attempts } : {};
  const global = deliveryWait(settings, history.attempts, job.contactKey, now, history.busy, contactPolicy), rule = job.kind === "auto" ? rules.find((r) => r.id === job.ruleId) : null;
  const local = rule ? autoReplyWait(rule, history.autoAttempts, job.contactKey, now) : null;
  const weekdayMode = job.kind === "scheduled" && job.repeat === "weekdays";
  const calendar = (at) => {
    if (!weekdayMode) return null;
    const days = job.repeatWeekdays || [], tz = job.timezone || settings.timezone;
    if (days.includes(localClock(at, tz).day)) return null;
    const due = job.dueAt instanceof Date ? job.dueAt.toISOString() : job.dueAt || new Date(now).toISOString();
    return { reason: "Outside selected weekdays", until: Date.parse(nextOccurrence(due, "weekdays", 1, tz, at, days)) };
  };
  const dateWait = calendar(now), wait = [global, local, dateWait].filter((w) => !!w).sort((a, b) => b.until - a.until)[0];
  if (wait) {
    const reasons = [...global?.reasons || [global?.reason], local?.reason, dateWait?.reason].filter((r) => !!r);
    for (let i = 0; i < (weekdayMode ? 16 : 1); i++) {
      const later = [deliveryWait(settings, history.attempts, job.contactKey, wait.until, false, contactPolicy), calendar(wait.until)].filter((w) => !!w);
      reasons.push(...later.flatMap((w) => w.reasons || [w.reason]));
      const until = Math.max(wait.until, ...later.map((w) => w.until));
      if (until === wait.until) break;
      wait.until = until;
    }
    wait.reasons = [...new Set(reasons)];
  }
  return wait || null;
}
function decorateJob(job, row, settings, rules, history, now = Date.now()) {
  if (!["queued", "ready", "needs-whatsapp-open"].includes(job.status)) return job;
  const at = Math.max(now, row.dueAt.getTime()), wait = jobWait({ ...row, repeat: job.repeat, repeatWeekdays: job.repeatWeekdays, timezone: job.timezone, dueAt: job.dueAt }, settings, rules, { ...history, busy: history.busy && at < now + 3e4 }, at);
  return { ...job, error: job.error?.startsWith("Waiting:") ? void 0 : job.error, waitReason: wait?.reason, waitReasons: wait?.reasons, waitUntil: wait ? new Date(wait.until).toISOString() : void 0, expiresAt: row.kind === "auto" ? new Date(row.dueAt.getTime() + AUTO_REPLY_FRESH_MS).toISOString() : void 0 };
}
function deliveryInfo(settings, history, now = Date.now()) {
  const date = localClock(now, settings.timezone).date, quietActive = !!settings.quietHoursEnabled && inWindow(now, settings.timezone, [0, 1, 2, 3, 4, 5, 6], settings.quietStart || "22:00", settings.quietEnd || "08:00");
  const quiet = quietActive ? deliveryWait(settings, [], "", now) : null;
  return { checkedAt: new Date(now).toISOString(), timezone: settings.timezone, todayAttempts: history.attempts.filter((a) => localClock(a.at, settings.timezone).date === date).length, dailyLimit: settings.sendDailyCap || 50, resetAt: new Date(dayBounds(now, settings.timezone).end).toISOString(), quietActive, quietUntil: quiet ? new Date(quiet.until).toISOString() : void 0 };
}

// src/main.ts
var db = new PrismaClient();
var secret = process.env.JWT_SECRET || "";
if (secret.length < 32 || secret.includes("REPLACE")) throw Error("Set a random JWT_SECRET with at least 32 characters");
encryptionKey();
var io;
var fail2 = (message, status = 400) => Object.assign(new Error(message), { status });
var obj = (x) => x && typeof x === "object" ? x : {};
function validateRuleSelection(r, u) {
  if (r.contactKeys.some((k) => r.excludedKeys.includes(k) || (obj(u.settings).excludedKeys || []).includes(k))) throw fail2("Selected contact also excluded. Remove it from the rule or Settings exclusion list.");
}
var deviceSchema = z3.string().uuid();
var settingsSchema = z3.object({ timezone: z3.string().refine((t) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: t });
    return true;
  } catch {
    return false;
  }
}), graceMinutes: z3.number().int().min(0).max(10080), awaitingReplyMode: z3.enum(["outgoing", "incoming"]), notifications: z3.boolean(), autoPaused: z3.boolean(), excludedKeys: z3.array(z3.string()).max(500), workingStart: z3.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), workingEnd: z3.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), workingDays: z3.array(z3.number().int().min(0).max(6)), accountNamespace: z3.string().min(1).max(80), mentionAliases: z3.array(z3.string().min(1).max(100)).max(20), dateOrder: z3.enum(["DMY", "MDY"]), ownPhone: z3.string().max(20).refine((v) => !v || /^\+?\d{8,15}$/.test(v), "Use country code and digits"), autoReadUnread: z3.boolean() }).extend(deliverySettingsSchema.shape).partial();
var limits = /* @__PURE__ */ new Map();
function limit(key, max) {
  const now = Date.now();
  for (const [k, v2] of limits) if (v2.reset < now) limits.delete(k);
  const v = limits.get(key) || { count: 0, reset: now + 6e4 };
  v.count++;
  limits.set(key, v);
  if (v.count > max) throw Object.assign(fail2("Too many requests. Retrying after " + Math.ceil((v.reset - now) / 1e3) + " seconds.", 429), { retryAfter: Math.ceil((v.reset - now) / 1e3) });
}
async function auth(token) {
  let p;
  try {
    p = jwt.verify(token, secret);
  } catch {
    throw fail2("Sign in again", 401);
  }
  let u;
  try {
    u = await db.user.findUnique({ where: { id: p.sub } });
  } catch (e) {
    if (e.code !== "P1017") throw e;
    u = await db.user.findUnique({ where: { id: p.sub } });
  }
  if (!u || u.disabled || p.v !== u.tokenVersion) throw fail2("Sign in again", 401);
  return u;
}
async function premium(u, feature) {
  const fresh = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!licenseStatus(fresh).premium) throw fail2("Trial ended. INR 1000 one-time lifetime access required.", 402);
  const flag = await db.featureFlag.findUnique({ where: { id: "global" } });
  if (feature && flag && !flag[feature]) throw fail2("Feature temporarily paused by support", 503);
}
function changed(id) {
  io?.to(id).emit("changed");
}
async function audit(userId, action, target, result) {
  await db.audit.create({ data: { userId, action, target, result } });
}
async function contact(userId, c) {
  const t = contactSchema.parse(c);
  await db.contact.upsert({ where: { userId_key: { userId, key: t.key } }, update: { name: t.name, type: t.type }, create: { userId, ...t } });
}
function scheduleOut(x) {
  return { ...unseal(x.data), id: x.id, dueAt: x.dueAt.toISOString(), status: x.status, sentAt: x.sentAt?.toISOString(), error: x.status === "sent" ? void 0 : x.error || void 0, kind: x.kind, incomingKey: x.incomingKey || void 0, attempt: x.attempt };
}
function followupOut(x) {
  return { ...unseal(x.data), id: x.id, status: x.status, notified: x.notified };
}
async function state(u) {
  const [f, s, r, c, flags, conversations, payments, history] = await Promise.all([db.followup.findMany({ where: { userId: u.id }, orderBy: { dueAt: "asc" } }), db.schedule.findMany({ where: { userId: u.id }, orderBy: { dueAt: "asc" } }), db.autoRule.findMany({ where: { userId: u.id } }), db.contact.findMany({ where: { userId: u.id } }), db.featureFlag.findUnique({ where: { id: "global" } }), db.conversation.findMany({ where: { userId: u.id } }), db.lifetimePayment.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 5 }), deliveryHistory(db, u.id)]);
  const warnings = [];
  const decode = (rows, fn, label) => rows.map((x) => readRecord(() => fn(x), warnings, label)).filter(Boolean);
  const notes = {};
  for (const x of c.filter((x2) => x2.note)) {
    const note = readRecord(() => unseal(JSON.parse(x.note)), warnings, "Private note");
    if (note) notes[x.key] = note.text;
  }
  const settings = { ...defaultSettings, ...obj(u.settings) }, rules = decode(r, (x) => ({ ...unseal(x.data), id: x.id }), "Auto rule");
  const jobs = decode(s, (x) => decorateJob(scheduleOut(x), x, settings, rules, history), "Schedule");
  return { ...initialState, serverVersion: "1.4.13", delivery: deliveryInfo(settings, history), autoJobs: jobs.filter((x) => x.kind === "auto" && ["queued", "ready", "sending", "needs-whatsapp-open"].includes(x.status)).concat(jobs.filter((x) => x.kind === "auto" && !["queued", "ready", "sending", "needs-whatsapp-open"].includes(x.status)).slice(-30)), billing: { legacyRenewal: !!u.providerId && !payments.some((p) => p.status === "paid" && p.legacyCancelled), lastPayment: payments[0]?.status }, conversations: conversations.map((cv) => {
    const contact2 = c.find((x) => x.key === cv.key);
    const outgoing = cv.lastOutgoingAt?.getTime() || 0, incoming = cv.lastIncomingAt?.getTime() || 0;
    return { key: cv.key, name: contact2?.name || "Unknown", type: contact2?.type || "unknown", lastDirection: outgoing > incoming ? "out" : incoming ? "in" : "unknown", lastAt: Math.max(outgoing, incoming), unread: 0, mention: false, preview: "", verified: true };
  }), followups: decode(f, followupOut, "Follow-up"), schedules: jobs.filter((x) => x.kind === "scheduled"), rules, notes, dataWarnings: [...new Set(warnings)], settings, license: licenseStatus(u), user: { name: u.name, email: u.email }, flags: flags ? { scheduling: flags.scheduling, autoReply: flags.autoReply } : { scheduling: true, autoReply: true } };
}
async function dispatch(req) {
  const path = req.path.replace(/\/$/, "") || "/", method = req.method, b = obj(req.body);
  if (path === "/health" || path === "/" && method === "GET") return { ok: true, version: "1.4.13" };
  if (path === "/auth/register" && method === "POST") {
    limit(`auth:${req.ip}`, 10);
    const v = z3.object({ name: z3.string().min(2).max(100), email: z3.email().max(254), password: z3.string().min(12).max(128) }).parse(b);
    const email = v.email.trim().toLowerCase();
    if (await db.user.findUnique({ where: { email } })) throw fail2("Email already registered", 409);
    const u2 = await db.user.create({ data: { name: v.name, email, passwordHash: await bcrypt.hash(v.password, 12), trialEnd: new Date(Date.now() + 14 * 864e5) } }).catch((e) => {
      if (e.code === "P2002") throw fail2("Email already registered", 409);
      throw e;
    });
    return { token: jwt.sign({ sub: u2.id, v: u2.tokenVersion }, secret, { expiresIn: "7d" }), state: await state(u2) };
  }
  if (path === "/auth/login" && method === "POST") {
    limit(`auth:${req.ip}`, 10);
    const v = z3.object({ email: z3.email(), password: z3.string().max(128) }).parse(b);
    const u2 = await db.user.findUnique({ where: { email: v.email.trim().toLowerCase() } });
    if (!u2 || u2.disabled || !await bcrypt.compare(v.password, u2.passwordHash)) throw fail2("Email or password incorrect", 401);
    return { token: jwt.sign({ sub: u2.id, v: u2.tokenVersion }, secret, { expiresIn: "7d" }), state: await state(u2) };
  }
  if (path === "/webhooks/razorpay" && method === "POST") {
    const raw = req.rawBody, sig = req.header("x-razorpay-signature") || "", hookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (!hookSecret || !raw || !verifyWebhook(raw, sig, hookSecret)) throw fail2("Invalid webhook signature", 401);
    const event = z3.string().parse(b.event), entity = b.payload?.subscription?.entity;
    const id = req.header("x-razorpay-event-id");
    if (!id) throw fail2("Missing webhook identity");
    const link = b.payload?.payment_link?.entity, payment = b.payload?.payment?.entity, refund = b.payload?.refund?.entity;
    if (!entity) {
      if (!["payment_link.paid", "payment.captured", "refund.processed"].includes(event)) return { ok: true, ignored: true };
      const row = link?.id ? await db.lifetimePayment.findUnique({ where: { providerId: link.id } }) : refund?.payment_id ? await db.lifetimePayment.findUnique({ where: { paymentId: refund.payment_id } }) : payment?.order_id ? await db.lifetimePayment.findFirst({ where: { providerOrderId: payment.order_id } }) : null;
      if (!row) {
        if (event === "payment_link.paid") throw fail2("Checkout is not linked yet. Retry shortly.", 409);
        return { ok: true, ignored: true };
      }
      const result = await reconcileLifetimePayment(db, razorpay, row, { id, name: event });
      changed(row.userId);
      return { ok: true, ...result };
    }
    if (!entity.id) throw fail2("Missing webhook identity");
    const mapped = await db.user.findUnique({ where: { providerId: entity.id } });
    if (!mapped) throw fail2("Subscription not linked. Retry later.", 409);
    const current = await razorpay(`/subscriptions/${encodeURIComponent(entity.id)}`);
    const end = current.current_end ? new Date(current.current_end * 1e3) : null;
    try {
      await db.$transaction(async (tx) => {
        await tx.webhook.create({ data: { id, event, providerId: entity.id } });
        if (!mapped.subscriptionStatus.startsWith("lifetime")) await tx.user.update({ where: { id: mapped.id }, data: { subscriptionStatus: current.status, periodEnd: end } });
        await tx.audit.create({ data: { userId: mapped.id, action: "payment-webhook", target: entity.id, result: event } });
      });
    } catch (e) {
      if (e.code !== "P2002") throw e;
    }
    changed(mapped.id);
    return { ok: true };
  }
  const u = await auth((req.header("authorization") || "").replace(/^Bearer /, ""));
  limit(`user:${u.id}:${method === "GET" ? "read" : "write"}`, method === "GET" ? 240 : 120);
  if (path === "/auth/logout" && method === "POST") {
    await db.user.update({ where: { id: u.id }, data: { tokenVersion: { increment: 1 } } });
    return { ok: true };
  }
  if (path === "/state" && method === "GET") return state(u);
  if (path === "/license/status" && method === "GET") return licenseStatus(u);
  if (path === "/settings" && method === "PATCH") {
    const v = settingsSchema.parse(b);
    const merged = { ...defaultSettings, ...obj(u.settings), ...v };
    if (merged.quietHoursEnabled && merged.quietStart === merged.quietEnd) throw fail2("Quiet hours start and end must be different");
    if (!(Object.keys(v).length === 1 && v.autoPaused === true)) await premium(u);
    await db.user.update({ where: { id: u.id }, data: { settings: { ...obj(u.settings), ...v } } });
    changed(u.id);
    return { ok: true };
  }
  if (path === "/notes" && method === "POST") {
    await premium(u);
    await contact(u.id, b.contact);
    const text = z3.string().max(4e3).parse(b.text);
    await db.contact.update({ where: { userId_key: { userId: u.id, key: b.contact.key } }, data: { note: JSON.stringify(seal({ text })) } });
    changed(u.id);
    return { ok: true };
  }
  if (path === "/followups" && method === "GET") return (await state(u)).followups;
  if (path === "/followups" && method === "POST") {
    await premium(u);
    const v = followupSchema.parse(b);
    validTimezone(v.timezone);
    await contact(u.id, v.contact);
    const x = await db.followup.create({ data: { userId: u.id, data: seal(v), dueAt: new Date(v.dueAt), reminderAt: new Date(Date.parse(v.dueAt) - v.reminderMinutes * 6e4) } });
    changed(u.id);
    return followupOut(x);
  }
  if (path.startsWith("/followups/") && method === "PATCH") {
    const id = path.split("/")[2], x = await db.followup.findFirst({ where: { id, userId: u.id } });
    if (!x) throw fail2("Follow-up not found", 404);
    const status = z3.enum(["pending", "snoozed", "done", "cancelled"]).parse(b.status || x.status);
    let v = unseal(x.data);
    if (b.contact !== void 0 || b.timezone !== void 0 || b.subject !== void 0 || b.messageKey !== void 0 || b.dueAt || b.note !== void 0 || b.priority || b.reminderMinutes !== void 0 || b.repeat || b.repeatDays || b.repeatWeekdays) {
      await premium(u);
      v = followupSchema.parse({ ...v, ...b });
      validTimezone(v.timezone);
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id + "|followup:" + id}))`;
      const update = await tx.followup.updateMany({ where: { id, userId: u.id, status: x.status, dueAt: x.dueAt }, data: { data: seal(v), status, dueAt: new Date(v.dueAt), reminderAt: new Date(Date.parse(v.dueAt) - v.reminderMinutes * 6e4), notified: status === "snoozed" || b.dueAt ? false : x.notified } });
      if (!update.count) throw fail2("Follow-up changed on another device; refresh", 409);
      if (["done", "cancelled"].includes(status)) {
        const queued = await tx.schedule.findMany({ where: { userId: u.id, kind: "scheduled", status: { in: ["queued", "ready", "needs-whatsapp-open"] } } });
        const ids = queued.filter((j) => readRecord(() => unseal(j.data).followupId === id, [], "Reminder")).map((j) => j.id);
        if (ids.length) await tx.schedule.updateMany({ where: { id: { in: ids }, userId: u.id, status: { in: ["queued", "ready", "needs-whatsapp-open"] } }, data: { status: "cancelled", error: "Follow-up completed or cancelled" } });
      }
      if (status === "done" && x.status !== "done") {
        const n = nextOccurrence(v.dueAt, v.repeat, v.repeatDays, v.timezone, Date.now(), v.repeatWeekdays);
        if (n) {
          const nv = { ...v, dueAt: n };
          await tx.followup.create({ data: { userId: u.id, data: seal(nv), dueAt: new Date(n), reminderAt: new Date(Date.parse(n) - v.reminderMinutes * 6e4) } });
        }
      }
    });
    changed(u.id);
    return { ok: true, followups: (await db.followup.findMany({ where: { userId: u.id }, orderBy: { dueAt: "asc" } })).map((x2) => readRecord(() => followupOut(x2), [], "Follow-up")).filter(Boolean) };
  }
  if (path === "/scheduled-messages" && method === "GET") return (await state(u)).schedules;
  if (path === "/scheduled-messages" && method === "POST") {
    await premium(u, "scheduling");
    const v = scheduleSchema.parse(b);
    validTimezone(v.timezone);
    if (Date.parse(v.dueAt) <= Date.now()) throw fail2("Choose a future time");
    await contact(u.id, v.contact);
    const x = await db.$transaction(async (tx) => {
      if (v.followupId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id + "|followup:" + v.followupId}))`;
        const f = await tx.followup.findFirst({ where: { id: v.followupId, userId: u.id } });
        if (!f) throw fail2("Follow-up not found", 404);
        if (!["pending", "snoozed"].includes(f.status)) throw fail2("This follow-up is already completed or cancelled", 409);
        if (!sameReminderRecipient(unseal(f.data).contact, v.contact)) throw fail2("Follow-up reminder target mismatch", 409);
        if (v.repeat !== "none") throw fail2("A follow-up reminder sends once. Each new follow-up occurrence needs its own authorization.");
        const idempotencyKey = `followup:${u.id}:${f.id}`;
        const existing = await tx.schedule.findUnique({ where: { idempotencyKey } });
        if (existing) return existing;
        return tx.schedule.create({ data: { userId: u.id, data: seal(v), contactKey: v.contact.key, dueAt: new Date(v.dueAt), idempotencyKey } });
      }
      return tx.schedule.create({ data: { userId: u.id, data: seal(v), contactKey: v.contact.key, dueAt: new Date(v.dueAt), idempotencyKey: randomUUID2() } });
    });
    changed(u.id);
    return scheduleOut(x);
  }
  if (path.startsWith("/scheduled-messages/") && method === "PATCH") {
    const id = path.split("/")[2], x = await db.schedule.findFirst({ where: { id, userId: u.id } });
    if (!x) throw fail2("Schedule not found", 404);
    if (["sending", "sent"].includes(x.status)) throw fail2("This schedule cannot be changed", 409);
    if (b.action === "cancel") {
      const update2 = await db.schedule.updateMany({ where: { id, userId: u.id, status: x.status, attempt: x.attempt }, data: { status: "cancelled" } });
      if (!update2.count) throw fail2("Schedule is already claimed or changed; refresh", 409);
      changed(u.id);
      return { ok: true };
    }
    await premium(u, "scheduling");
    if (["unknown", "failed"].includes(x.status) && b.confirmNotSent !== true) throw fail2("Check WhatsApp first and confirm the message was not sent", 409);
    const original = unseal(x.data), v = scheduleSchema.parse({ ...original, ...b });
    if (v.followupId !== original.followupId) throw fail2("Reminder association cannot be changed");
    if (v.followupId && !sameReminderRecipient(original.contact, v.contact)) throw fail2("Follow-up reminder target mismatch", 409);
    if (v.followupId && v.repeat !== "none") throw fail2("A follow-up reminder sends once");
    validTimezone(v.timezone);
    if (Date.parse(v.dueAt) <= Date.now()) throw fail2("Choose a future time");
    const update = await db.schedule.updateMany({ where: { id, userId: u.id, status: x.status, attempt: x.attempt }, data: { data: seal(v), contactKey: v.contact.key, status: "queued", error: null, dueAt: new Date(v.dueAt), leaseToken: null } });
    if (!update.count) throw fail2("Schedule is already claimed or changed; refresh", 409);
    changed(u.id);
    return { ok: true };
  }
  if (path === "/auto-reply-rules" && method === "GET") return (await state(u)).rules;
  if (path === "/auto-reply-rules" && method === "POST") {
    await premium(u, "autoReply");
    const v = ruleSchema.parse(b);
    validateRuleSelection(v, u);
    validTimezone(v.timezone);
    const x = await db.autoRule.create({ data: { userId: u.id, data: seal(v) } });
    changed(u.id);
    return { ...v, id: x.id };
  }
  if (path.startsWith("/auto-reply-rules/")) {
    await premium(u, "autoReply");
    const id = path.split("/")[2], x = await db.autoRule.findFirst({ where: { id, userId: u.id } });
    if (!x) throw fail2("Rule not found", 404);
    if (method === "DELETE") await db.autoRule.delete({ where: { id } });
    else if (method === "PATCH") {
      const v = ruleSchema.parse({ ...unseal(x.data), ...b });
      validateRuleSelection(v, u);
      validTimezone(v.timezone);
      await db.autoRule.update({ where: { id }, data: { data: seal(v) } });
    } else throw fail2("Method not allowed", 405);
    changed(u.id);
    return { ok: true };
  }
  if (path === "/events/conversation-state" && method === "POST") {
    await premium(u);
    const v = z3.object({ contact: contactSchema, message: z3.object({ key: z3.string().min(1).max(200), direction: z3.enum(["in", "out"]), at: z3.number().int().positive() }), live: z3.boolean().default(false) }).parse(b);
    await contact(u.id, v.contact);
    const where = { userId_key: { userId: u.id, key: v.contact.key } };
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id + "|" + v.contact.key}))`;
      const old = await tx.conversation.findUnique({ where });
      const incoming = old?.lastIncomingAt?.getTime() || 0, outgoing = old?.lastOutgoingAt?.getTime() || 0;
      if (v.message.at > Date.now() + 6e4) throw fail2("Message time invalid");
      if (v.message.direction === "in" && old?.lastIncomingKey === v.message.key) return { ok: true, first: false, at: incoming };
      const previous = v.message.direction === "in" ? incoming : outgoing;
      if (!v.live && v.message.at <= previous) return { ok: true, first: false, at: previous };
      if (v.live && v.message.at < Date.now() - 12e4) throw fail2("Live event is too old; open the latest messages");
      const at = v.live ? Math.max(v.message.at, incoming + 1, outgoing + 1) : v.message.at;
      const data = v.message.direction === "in" ? { lastIncomingKey: v.message.key, lastIncomingAt: new Date(at) } : { lastOutgoingAt: new Date(at) };
      await tx.conversation.upsert({ where, create: { userId: u.id, key: v.contact.key, ...data }, update: data });
      if (v.message.direction === "out" && at >= incoming) await tx.schedule.updateMany({ where: { userId: u.id, contactKey: v.contact.key, kind: "auto", status: { in: ["queued", "ready", "needs-whatsapp-open"] } }, data: { status: "cancelled", error: "Manual reply observed" } });
      if (v.message.direction === "in") await tx.schedule.updateMany({ where: { userId: u.id, contactKey: v.contact.key, kind: "auto", incomingKey: { not: v.message.key }, status: { in: ["queued", "ready", "needs-whatsapp-open"] } }, data: { status: "cancelled", error: "Replaced by newer incoming message" } });
      return { ok: true, first: !old?.lastIncomingAt && v.message.direction === "in", at };
    });
  }
  if (path === "/auto/prepare" && method === "POST") {
    await premium(u, "autoReply");
    const v = z3.object({ contact: contactSchema, message: z3.object({ key: z3.string().min(1).max(200), body: z3.string().min(1).max(4e3), at: z3.number().int().positive() }), first: z3.boolean().default(false) }).parse(b);
    const settings = { ...defaultSettings, ...obj(u.settings) };
    if (settings.autoPaused) return { queued: false, reason: "paused" };
    const c = { ...v.contact, unread: 0, mention: false, lastDirection: "in", lastAt: v.message.at, preview: "", verified: true };
    const m = { ...v.message, contactKey: c.key, direction: "in" };
    const rules = (await db.autoRule.findMany({ where: { userId: u.id } })).map((x) => readRecord(() => ({ ...unseal(x.data), id: x.id }), [], "Auto rule")).filter((x) => !!x);
    const rule = rules.find((r) => ruleMatches(r, c, m, settings, v.first));
    if (!rule) return { queued: false, reason: settings.excludedKeys.includes(c.key) || rules.some((r) => r.contactKeys.includes(c.key) && r.excludedKeys.includes(c.key)) ? "excluded" : "no-matching-rule" };
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id + "|" + c.key}))`;
      const cv = await tx.conversation.findUnique({ where: { userId_key: { userId: u.id, key: c.key } } });
      if (!cv || cv.lastIncomingKey !== m.key || cv.lastOutgoingAt && cv.lastOutgoingAt.getTime() >= m.at) return { queued: false, reason: "incoming-answered-or-changed" };
      const now = Date.now(), idempotencyKey = `auto:${u.id}:${m.key}`;
      const existing = await tx.schedule.findUnique({ where: { idempotencyKey } });
      if (existing) return { queued: ["queued", "ready", "sending", "needs-whatsapp-open"].includes(existing.status), reason: ["queued", "ready", "sending", "needs-whatsapp-open"].includes(existing.status) ? "queued" : "already-handled", dueAt: existing.dueAt.toISOString(), id: existing.id };
      if (now - m.at > 12e4 || m.at > now + 6e4) return { queued: false, reason: "old-message-time" };
      const history = await deliveryHistory(tx, u.id, now), dueAt = new Date(now + (rule.trigger === "unanswered" ? Math.max(rule.delayMinutes * 6e4, (settings.autoReplyDelaySeconds || 10) * 1e3) : (settings.autoReplyDelaySeconds || 10) * 1e3));
      const wait = jobWait({ kind: "auto", contactKey: c.key, ruleId: rule.id }, settings, [rule], { ...history, busy: false }, dueAt.getTime());
      if (wait && wait.until >= dueAt.getTime() + AUTO_REPLY_FRESH_MS) {
        const today = localClock(now, rule.timezone).date, used = history.autoAttempts.filter((a) => a.contactKey === c.key && localClock(a.at, rule.timezone).date === today).length;
        return { queued: false, reason: wait.reasons?.includes("Auto reply contact daily limit") ? "rule-daily-cap" : wait.reasons?.includes("Auto reply contact cooldown") ? "rule-cooldown" : "delivery-limit", ruleId: rule.id, retryAt: new Date(wait.until).toISOString(), blockers: wait.reasons, detail: `${(wait.reasons || [wait.reason]).join("; ")}. Auto attempts to this contact: ${used}/${rule.dailyCap} today. Next eligible: ${new Date(wait.until).toLocaleString("en-IN", { timeZone: settings.timezone })} (${settings.timezone}). A NEW incoming message is required then; this old reply will not be replayed.` };
      }
      const data = { contact: v.contact, body: rule.response, dueAt: dueAt.toISOString(), repeat: "none", repeatDays: 1, timezone: rule.timezone, consent: true };
      const created = await tx.schedule.create({ data: { userId: u.id, data: seal(data), contactKey: v.contact.key, dueAt, kind: "auto", incomingKey: m.key, ruleId: rule.id, idempotencyKey } });
      return { queued: true, reason: "queued", id: created.id, dueAt: dueAt.toISOString(), waitReason: wait?.reason, waitReasons: wait?.reasons, waitUntil: wait ? new Date(wait.until).toISOString() : void 0 };
    });
  }
  if (path === "/jobs/ready" && method === "GET") {
    await premium(u);
    const now = Date.now();
    await db.schedule.updateMany({ where: { userId: u.id, kind: "auto", status: { in: ["queued", "ready", "needs-whatsapp-open"] }, dueAt: { lt: new Date(now - AUTO_REPLY_FRESH_MS) } }, data: { status: "cancelled", error: "Automatic reply expired. A new incoming message is required." } });
    const [jobs, history, ruleRows] = await Promise.all([db.schedule.findMany({ where: { userId: u.id, status: { in: ["queued", "ready", "needs-whatsapp-open"] }, dueAt: { lte: new Date(now) } }, orderBy: { dueAt: "asc" } }), deliveryHistory(db, u.id, now), db.autoRule.findMany({ where: { userId: u.id } })]);
    const settings = { ...defaultSettings, ...obj(u.settings) }, rules = ruleRows.map((x) => readRecord(() => ({ ...unseal(x.data), id: x.id }), [], "Auto rule")).filter((x) => !!x);
    return jobs.map((x) => readRecord(() => decorateJob(scheduleOut(x), x, settings, rules, history, now), [], "Schedule")).filter((x) => !!x).sort((a, b2) => Number(!!a.waitUntil) - Number(!!b2.waitUntil)).slice(0, 20);
  }
  if (path === "/jobs/claim" && method === "POST") {
    const id = z3.string().uuid().parse(b.id), deviceId = deviceSchema.parse(b.deviceId);
    const x = await db.schedule.findFirst({ where: { id, userId: u.id } });
    if (!x) throw fail2("Job missing", 404);
    await premium(u, x.kind === "auto" ? "autoReply" : "scheduling");
    const v = unseal(x.data);
    if (b.contactKey !== v.contact.key) throw fail2("Target identity mismatch", 409);
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"send:" + u.id}))`;
      const job = await tx.schedule.findFirst({ where: { id, userId: u.id } }), now = Date.now();
      if (!job || !canClaim(job.status, job.dueAt, now)) throw fail2("Already claimed or not due", 409);
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: u.id } }), settings = { ...defaultSettings, ...obj(fresh.settings) };
      if (!licenseStatus(fresh).premium) throw fail2("Active trial or lifetime access required", 402);
      const data = unseal(job.data);
      if (settings.excludedKeys.includes(job.contactKey)) throw fail2("Contact excluded in Settings. Message not sent.", 409);
      if (data.followupId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id + "|followup:" + data.followupId}))`;
        const f = await tx.followup.findFirst({ where: { id: data.followupId, userId: u.id } });
        if (!f || !["pending", "snoozed"].includes(f.status) || !sameReminderRecipient(unseal(f.data).contact, data.contact)) {
          await tx.schedule.update({ where: { id }, data: { status: "cancelled", error: "Follow-up completed or cancelled" } });
          return { cancelled: true };
        }
      }
      let ruleData;
      if (job.kind === "auto") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id + "|" + job.contactKey}))`;
        const rule = await tx.autoRule.findFirst({ where: { id: job.ruleId || "", userId: u.id } }), cv = await tx.conversation.findUnique({ where: { userId_key: { userId: u.id, key: job.contactKey } } });
        ruleData = rule ? { ...unseal(rule.data), id: rule.id } : void 0;
        const invalid = settings.autoPaused || !ruleData?.enabled || ruleData.excludedKeys.includes(job.contactKey) || !inWindow(now, ruleData.timezone, ruleData.days, ruleData.start, ruleData.end) || ruleData.trigger === "outside-hours" && inWindow(now, settings.timezone, settings.workingDays, settings.workingStart, settings.workingEnd) || !cv || cv.lastIncomingKey !== job.incomingKey || !!(cv.lastOutgoingAt && cv.lastIncomingAt && cv.lastOutgoingAt >= cv.lastIncomingAt);
        if (invalid || now >= job.dueAt.getTime() + AUTO_REPLY_FRESH_MS) {
          const error = invalid ? "Auto reply paused, answered or superseded" : "Automatic reply expired. A new incoming message is required.";
          await tx.schedule.updateMany({ where: { id, userId: u.id, status: job.status, attempt: job.attempt }, data: { status: "cancelled", error } });
          return { cancelled: true, error };
        }
      }
      const history = await deliveryHistory(tx, u.id, now), wait = jobWait({ ...job, repeat: data.repeat, repeatWeekdays: data.repeatWeekdays, timezone: data.timezone, dueAt: data.dueAt }, settings, ruleData ? [ruleData] : [], history, now);
      if (wait && job.kind === "auto" && wait.until >= job.dueAt.getTime() + AUTO_REPLY_FRESH_MS) {
        const error = `Auto reply not sent: ${(wait.reasons || [wait.reason]).join("; ")}. A new incoming message is required after ${new Date(wait.until).toLocaleString("en-IN", { timeZone: settings.timezone })} (${settings.timezone}).`;
        await tx.schedule.updateMany({ where: { id, userId: u.id, status: job.status, attempt: job.attempt }, data: { status: "cancelled", error } });
        return { cancelled: true, error };
      }
      if (wait) {
        const error = `Waiting: ${(wait.reasons || [wait.reason]).join("; ")}. Next attempt after ${new Date(wait.until).toLocaleString("en-IN", { timeZone: settings.timezone, hour12: true })} (${settings.timezone}).`;
        const paused = await tx.schedule.updateMany({ where: { id, userId: u.id, status: job.status, attempt: job.attempt, dueAt: job.dueAt }, data: { status: "needs-whatsapp-open", error } });
        if (!paused.count) throw fail2("Job changed before timing check; refresh", 409);
        return { wait, error };
      }
      const leaseToken = randomUUID2();
      const updated = await tx.schedule.updateMany({ where: { id, userId: u.id, status: job.status, attempt: job.attempt, dueAt: job.dueAt }, data: { status: "sending", error: null, leaseToken, leaseAt: new Date(now), deviceId, attempt: { increment: 1 } } });
      if (!updated.count) throw fail2("Job changed before claim; refresh", 409);
      const claimed = await tx.schedule.findUniqueOrThrow({ where: { id } });
      await tx.audit.create({ data: { userId: u.id, action: "send-start", target: id, result: job.contactKey, at: new Date(now) } });
      return { job: scheduleOut(claimed), leaseToken };
    });
    if ("wait" in result && result.wait) throw Object.assign(fail2(result.error, 409), { retryAfter: Math.max(1, Math.ceil((result.wait.until - Date.now()) / 1e3)) });
    if ("cancelled" in result) throw fail2(result.error || "Follow-up completed or cancelled", 409);
    changed(u.id);
    return result;
  }
  if (path === "/jobs/complete" && method === "POST") {
    const v = z3.object({ id: z3.string().uuid(), leaseToken: z3.string().uuid(), status: z3.enum(["sent", "failed", "unknown"]), error: z3.string().max(500).optional() }).parse(b);
    await db.$transaction(async (tx) => {
      const x = await tx.schedule.findFirst({ where: { id: v.id, userId: u.id, status: "sending", leaseToken: v.leaseToken } });
      if (!x) throw fail2("Lease expired", 409);
      await tx.schedule.update({ where: { id: x.id }, data: { status: v.status, sentAt: v.status === "sent" ? /* @__PURE__ */ new Date() : null, error: v.status === "sent" ? null : v.error || null } });
      if (v.status === "sent") {
        const d = unseal(x.data), n = nextOccurrence(d.dueAt, d.repeat, d.repeatDays, d.timezone, Date.now(), d.repeatWeekdays);
        if (n) await tx.schedule.create({ data: { userId: u.id, data: seal({ ...d, dueAt: n }), contactKey: d.contact.key, dueAt: new Date(n), idempotencyKey: `repeat:${x.id}:${n}` } });
      }
      await tx.audit.create({ data: { userId: u.id, action: "send-result", target: x.id, result: v.status } });
    });
    changed(u.id);
    return { ok: true };
  }
  if (path === "/jobs/unavailable" && method === "POST") {
    const id = z3.string().uuid().parse(b.id);
    await db.schedule.updateMany({ where: { id, userId: u.id, status: { in: ["queued", "ready", "needs-whatsapp-open"] } }, data: { status: "needs-whatsapp-open", error: b.reason === void 0 ? "Keep WhatsApp active; the extension will find your verified target automatically." : z3.string().min(1).max(400).parse(b.reason) } });
    return { ok: true };
  }
  if (path === "/extension/heartbeat" && method === "POST") {
    const id = deviceSchema.parse(b.deviceId);
    const owned = await db.device.findUnique({ where: { id } });
    if (owned && owned.userId !== u.id) throw fail2("Device already belongs to another user", 409);
    await db.device.upsert({ where: { id }, create: { id, userId: u.id, version: typeof b.version === "string" ? b.version.slice(0, 20) : "1.4.13", health: obj(b.health) }, update: { lastSeen: /* @__PURE__ */ new Date(), version: typeof b.version === "string" ? b.version.slice(0, 20) : "1.4.13", health: obj(b.health) } });
    return { ok: true };
  }
  if (path === "/reminders/due" && method === "GET") {
    if (!licenseStatus(u).premium) return [];
    return (await db.followup.findMany({ where: { userId: u.id, status: { in: ["pending", "snoozed"] }, reminderAt: { lte: /* @__PURE__ */ new Date() } } })).map((x) => readRecord(() => followupOut(x), [], "Follow-up")).filter(Boolean);
  }
  if (path === "/billing/create-payment" && method === "POST") {
    limit("checkout:" + u.id, 6);
    return createLifetimePayment(db, razorpay, u);
  }
  if (path === "/billing/create-subscription") throw fail2("Update the extension: billing is INR 1000 once for lifetime access.", 410);
  if (path === "/billing/check" && method === "POST") {
    limit("payment-check:" + u.id, 6);
    const row = await db.lifetimePayment.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
    if (!row) return { status: u.subscriptionStatus === "lifetime" ? "paid" : "no-payment", plan: "lifetime" };
    const result = await reconcileLifetimePayment(db, razorpay, row);
    changed(u.id);
    return result;
  }
  if (path === "/billing/cancel" && method === "POST") {
    if (!u.providerId) throw fail2("No subscription");
    await razorpay(`/subscriptions/${u.providerId}/cancel`, { cancel_at_cycle_end: 1 });
    await db.lifetimePayment.updateMany({ where: { userId: u.id, status: "paid" }, data: { legacyCancelled: true } });
    return { ok: true };
  }
  if (path.startsWith("/admin")) {
    if (!u.admin) throw fail2("Admin access required", 403);
    if (path === "/admin/overview" && method === "GET") {
      const users = await db.user.findMany({ select: { id: true, email: true, name: true, trialEnd: true, periodEnd: true, subscriptionStatus: true, disabled: true, supportNote: true, createdAt: true } });
      return { users: users.map((x) => ({ ...x, license: licenseStatus(x) })), devices: await db.device.findMany({ orderBy: { lastSeen: "desc" }, take: 100 }), audit: await db.audit.findMany({ orderBy: { at: "desc" }, take: 100 }), payments: await db.lifetimePayment.findMany({ orderBy: { createdAt: "desc" }, take: 100 }), webhooks: await db.webhook.findMany({ orderBy: { createdAt: "desc" }, take: 100 }), flags: await db.featureFlag.findUnique({ where: { id: "global" } }) };
    }
    if (path === "/admin/flags" && method === "PATCH") {
      const v = z3.object({ scheduling: z3.boolean(), autoReply: z3.boolean() }).parse(b);
      await db.featureFlag.upsert({ where: { id: "global" }, create: { id: "global", ...v }, update: v });
      await audit(u.id, "feature-flags", "global", JSON.stringify(v));
      return { ok: true };
    }
    if (path.startsWith("/admin/users/") && method === "PATCH") {
      const id = path.split("/")[3], v = z3.object({ disabled: z3.boolean().optional(), supportNote: z3.string().max(2e3).optional() }).refine((x) => x.disabled !== void 0 || x.supportNote !== void 0).parse(b);
      if (id === u.id && v.disabled) throw fail2("Cannot disable your own admin");
      await db.user.update({ where: { id }, data: { ...v, ...v.disabled !== void 0 ? { tokenVersion: { increment: 1 } } : {} } });
      await audit(u.id, "user-support", id, v.disabled !== void 0 ? v.disabled ? "disabled" : "restored" : "support-note-updated");
      return { ok: true };
    }
  }
  throw fail2("Endpoint not found", 404);
}
function validTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    throw fail2("Invalid timezone");
  }
}
async function razorpay(path, body) {
  const key = process.env.RAZORPAY_KEY_ID, s = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !s) throw fail2("Set Razorpay test/live keys on server", 503);
  const r = await fetch((process.env.NODE_ENV === "test" && process.env.QA_RAZORPAY_URL || "https://api.razorpay.com/v1") + path, { method: body ? "POST" : "GET", headers: { Authorization: "Basic " + Buffer.from(key + ":" + s).toString("base64"), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : void 0, signal: AbortSignal.timeout(15e3) });
  const j = await r.json();
  if (!r.ok) throw fail2(j.error?.description || "Payment provider unavailable", 502);
  return j;
}
var ApiController = class {
  async handle(req, res) {
    try {
      res.json(await dispatch(req));
    } catch (e) {
      if (e instanceof z3.ZodError) return res.status(400).json({ error: e.issues.map((x) => x.path.join(".") + ": " + x.message).join("; ") });
      const result = errorResponse(e), requestId = randomUUID2();
      if (result.status === 429) res.setHeader("Retry-After", String(e.retryAfter || 60));
      if (result.status >= 500) console.error("API failure", { requestId, path: req.path, code: e.code || "UNCLASSIFIED", name: e.name || "Error" });
      return res.status(result.status).json({ ...result, requestId, ...e.retryAfter ? { retryAfter: e.retryAfter } : {} });
    }
  }
};
__decorateClass([
  All("{*path}"),
  __decorateParam(0, Req()),
  __decorateParam(1, Res())
], ApiController.prototype, "handle", 1);
ApiController = __decorateClass([
  Controller()
], ApiController);
var ApiModule = class {
};
ApiModule = __decorateClass([
  Module({ controllers: [ApiController] })
], ApiModule);
var app = await NestFactory.create(ApiModule, { rawBody: true });
app.use(helmet());
if (process.env.TRUST_PROXY === "loopback") app.getHttpAdapter().getInstance().set("trust proxy", "loopback");
var origins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174").split(",");
app.enableCors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || /^chrome-extension:\/\/[a-p]{32}$/.test(origin)), credentials: false });
await app.listen(Number(process.env.PORT || 4e3), "0.0.0.0");
io = new Server(app.getHttpServer(), { cors: { origin: origins } });
io.use(async (socket, next) => {
  try {
    const u = await auth(socket.handshake.auth.token || "");
    socket.data.userId = u.id;
    next();
  } catch {
    next(Error("Unauthorized"));
  }
});
io.on("connection", (socket) => socket.join(socket.data.userId));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  await app.close();
  await db.$disconnect();
  process.exit(0);
});
