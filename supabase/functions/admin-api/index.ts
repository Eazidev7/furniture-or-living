// admin-api — single endpoint for the Furniture or Living storefront + admin panel.
// Public actions need no key. Admin actions require the x-admin-key header,
// checked against admin_config.admin_key. Uses the service role internally,
// so no keys are ever exposed to the browser. No external imports — plain
// fetch against PostgREST + Storage so cold starts never fail on deps.

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REST = `${URL_}/rest/v1`;
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const s = (v: unknown, max = 500) => String(v ?? "").slice(0, max).trim();

async function db(
  method: string,
  table: string,
  query = "",
  payload?: unknown,
  extra: Record<string, string> = {}
) {
  const res = await fetch(`${REST}/${table}${query ? "?" + query : ""}`, {
    method,
    headers: { ...H, Prefer: "return=representation", ...extra },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    const msg =
      (data as { message?: string })?.message || `db ${res.status}: ${text.slice(0, 200)}`;
    throw new Error(msg);
  }
  return data;
}

const ok = <T>(p: Promise<T>) =>
  p.then((d) => ({ d, e: null })).catch((e) => ({ d: null, e }));

async function adminKey(): Promise<string> {
  const { d } = await ok(
    db("GET", "admin_config", "key=eq.admin_key&select=value&limit=1")
  );
  const rows = d as { value?: string }[] | null;
  return rows?.[0]?.value ?? "";
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const err = (e: unknown) => json({ error: String((e as Error)?.message ?? e) }, 500);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const action = s(body.action, 60);

  /* ---------------- public actions ---------------- */
  if (action === "listProducts") {
    const { d, e } = await ok(
      db("GET", "products", "select=id,name,price,dims,tag,img,position&order=position")
    );
    return e ? err(e) : json({ products: d });
  }

  if (action === "getSettings") {
    const { d, e } = await ok(db("GET", "site_settings", "select=key,value"));
    if (e) return err(e);
    const rows = (d ?? []) as { key: string; value: string }[];
    return json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }

  if (action === "submitEnquiry") {
    const name = s(body.name, 120);
    const contact = s(body.contact, 120);
    const message = s(body.message, 1000);
    const product = s(body.product, 160);
    if (!name || !contact) return json({ error: "name and contact required" }, 400);
    if (body.website) return json({ ok: true }); // honeypot
    const { e } = await ok(db("POST", "enquiries", "", { name, contact, message, product }));
    return e ? err(e) : json({ ok: true });
  }

  if (action === "submitOrder") {
    const name = s(body.name, 120);
    const contact = s(body.contact, 120);
    const address = s(body.address, 300);
    const items = Array.isArray(body.items) ? (body.items as unknown[]).slice(0, 50) : [];
    if (!name || !contact || !address || !items.length)
      return json({ error: "missing order fields" }, 400);
    if (body.website) return json({ ok: true, id: "skipped" }); // honeypot
    const clean = items.map((i) => ({
      name: s((i as Record<string, unknown>).name, 160),
      finish: s((i as Record<string, unknown>).finish, 80),
      price: Math.max(0, Math.round(Number((i as Record<string, unknown>).price) || 0)),
      qty: Math.min(99, Math.max(1, Math.round(Number((i as Record<string, unknown>).qty) || 1))),
    }));
    const { d, e } = await ok(
      db("POST", "orders", "", {
        customer_name: name,
        contact,
        address,
        note: s(body.note, 500),
        payment: s(body.payment, 40) || "Pay on delivery",
        items: clean,
        total: clean.reduce((n, i) => n + i.price * i.qty, 0),
      })
    );
    if (e) return err(e);
    const rows = d as { id: string }[] | null;
    return json({ ok: true, id: rows?.[0]?.id });
  }

  /* ---------------- admin gate ---------------- */
  const key = s(req.headers.get("x-admin-key"), 200);
  const expected = await adminKey();
  if (!key || !expected || key !== expected)
    return json({ error: "unauthorized" }, 401);

  try {
    switch (action) {
      case "verify":
        return json({ ok: true });

      case "adminListProducts":
        return json({ products: await db("GET", "products", "select=*&order=position") });

      case "createProduct":
      case "updateProduct": {
        const p = {
          name: s(body.name, 160),
          price: Math.max(0, Math.round(Number(body.price) || 0)),
          dims: s(body.dims, 80),
          tag: s(body.tag, 40),
          img: s(body.img, 600),
          position: Math.round(Number(body.position) || 0),
        };
        if (!p.name) return json({ error: "name required" }, 400);
        const rows =
          action === "createProduct"
            ? await db("POST", "products", "", p)
            : await db("PATCH", "products", `id=eq.${s(body.id, 60)}`, p);
        return json({ product: (rows as unknown[])?.[0] });
      }

      case "deleteProduct":
        await db("DELETE", "products", `id=eq.${s(body.id, 60)}`);
        return json({ ok: true });

      case "uploadImage": {
        const contentType = s(body.contentType, 60) || "image/jpeg";
        const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const bytes = b64ToBytes(String(body.data ?? ""));
        if (!bytes.length) return json({ error: "empty image" }, 400);
        const up = await fetch(
          `${URL_}/storage/v1/object/product-images/${path}`,
          { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": contentType }, body: bytes }
        );
        if (!up.ok) throw new Error(`upload failed: ${(await up.text()).slice(0, 200)}`);
        return json({ url: `${URL_}/storage/v1/object/public/product-images/${path}` });
      }

      case "listEnquiries":
        return json({ enquiries: await db("GET", "enquiries", "select=*&order=created_at.desc&limit=200") });

      case "markEnquiryRead":
        await db("PATCH", "enquiries", `id=eq.${s(body.id, 60)}`, { read: Boolean(body.read) });
        return json({ ok: true });

      case "deleteEnquiry":
        await db("DELETE", "enquiries", `id=eq.${s(body.id, 60)}`);
        return json({ ok: true });

      case "listOrders":
        return json({ orders: await db("GET", "orders", "select=*&order=created_at.desc&limit=200") });

      case "updateOrderStatus": {
        const status = s(body.status, 30);
        if (!["new", "confirmed", "delivered", "cancelled"].includes(status))
          return json({ error: "bad status" }, 400);
        await db("PATCH", "orders", `id=eq.${s(body.id, 60)}`, { status });
        return json({ ok: true });
      }

      case "deleteOrder":
        await db("DELETE", "orders", `id=eq.${s(body.id, 60)}`);
        return json({ ok: true });

      case "updateSettings": {
        const settings = (body.settings ?? {}) as Record<string, unknown>;
        const rows = Object.entries(settings)
          .filter(([k]) => ["hero_image", "whatsapp", "tagline"].includes(k))
          .map(([key, value]) => ({ key, value: s(value, 600) }));
        if (!rows.length) return json({ error: "nothing to update" }, 400);
        await db("POST", "site_settings", "", rows, { Prefer: "resolution=merge-duplicates" });
        return json({ ok: true });
      }

      case "changeKey": {
        const newKey = s(body.newKey, 200);
        if (newKey.length < 8) return json({ error: "key must be 8+ chars" }, 400);
        await db("PATCH", "admin_config", "key=eq.admin_key", { value: newKey });
        return json({ ok: true });
      }

      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return err(e);
  }
});
