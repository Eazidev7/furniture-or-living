/* ============================================================
   Furniture or Living — admin panel
   All actions go through the admin-api edge function.
   Admin passkey is verified server-side and kept in sessionStorage.
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const toast = $("#toast");
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

let adminKey = sessionStorage.getItem("fol_admin_key") || "";

async function api(action, payload = {}) {
  const res = await fetch(FOL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ============================= LOGIN ============================= */
const loginView = $("#loginView");
const appView = $("#appView");
const loginErr = $("#loginErr");

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  adminKey = $("#keyInput").value.trim();
  loginErr.textContent = "";
  try {
    await api("verify");
    sessionStorage.setItem("fol_admin_key", adminKey);
    enterApp();
  } catch {
    loginErr.textContent = "Wrong passkey or server unreachable.";
  }
});

$("#logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("fol_admin_key");
  location.reload();
});

async function enterApp() {
  loginView.hidden = true;
  appView.hidden = false;
  await Promise.all([loadProducts(), loadEnquiries(), loadOrders(), loadSettings()]);
}

/* ============================= NAV ============================= */
document.querySelectorAll(".side__link[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side__link[data-view]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
    $(`#view-${btn.dataset.view}`).hidden = false;
  });
});

/* ============================= PRODUCTS ============================= */
let products = [];
let editingId = null;

async function loadProducts() {
  try {
    const { products: list } = await api("adminListProducts");
    products = list || [];
  } catch (err) {
    showToast("Couldn't load products: " + err.message);
    products = [];
  }
  renderProducts();
}

function renderProducts() {
  const rows = $("#productRows");
  if (!products.length) {
    rows.innerHTML = `<tr><td colspan="6" class="empty">No products yet — add your first one.</td></tr>`;
    return;
  }
  rows.innerHTML = products
    .map(
      (p) => `
      <tr>
        <td><img class="table__thumb" src="${p.img}" alt="" loading="lazy" /></td>
        <td><strong>${p.name}</strong></td>
        <td>₦${Number(p.price).toLocaleString("en-NG")}</td>
        <td>${p.dims || "—"}</td>
        <td>${p.tag || "—"}</td>
        <td><div class="table__actions">
          <button class="iconbtn" data-edit="${p.id}">Edit</button>
          <button class="iconbtn iconbtn--danger" data-del="${p.id}">Delete</button>
        </div></td>
      </tr>`
    )
    .join("");

  rows.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openProductModal(products.find((p) => p.id === b.dataset.edit)))
  );
  rows.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const p = products.find((x) => x.id === b.dataset.del);
      if (!confirm(`Delete "${p.name}"?`)) return;
      try {
        await api("deleteProduct", { id: p.id });
        showToast("Product deleted");
        loadProducts();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

/* ---------- product modal ---------- */
const productModal = $("#productModal");
const imgFile = $("#imgFile");
const imgPreview = $("#imgPreview");

function openProductModal(p = null) {
  editingId = p?.id ?? null;
  $("#productModalTitle").textContent = p ? "Edit product" : "Add product";
  $("#fName").value = p?.name ?? "";
  $("#fPrice").value = p?.price ?? "";
  $("#fDims").value = p?.dims ?? "";
  $("#fTag").value = p?.tag ?? "";
  $("#fImg").value = p?.img ?? "";
  imgPreview.src = p?.img || "";
  imgFile.value = "";
  productModal.hidden = false;
}
$("#addProductBtn").addEventListener("click", () => openProductModal());
$("#productClose").addEventListener("click", () => (productModal.hidden = true));
productModal.addEventListener("click", (e) => e.target === productModal && (productModal.hidden = true));

imgFile.addEventListener("change", async () => {
  const file = imgFile.files[0];
  if (!file) return;
  imgPreview.src = URL.createObjectURL(file);
  try {
    const b64 = await fileToBase64(file);
    const { url } = await api("uploadImage", { contentType: file.type, data: b64 });
    $("#fImg").value = url;
    showToast("Image uploaded");
  } catch (err) {
    showToast("Upload failed: " + err.message);
  }
});

$("#productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#productSaveBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";
  const payload = {
    id: editingId,
    name: $("#fName").value,
    price: $("#fPrice").value,
    dims: $("#fDims").value,
    tag: $("#fTag").value,
    img: $("#fImg").value,
    position: editingId ? undefined : products.length + 1,
  };
  try {
    await api(editingId ? "updateProduct" : "createProduct", payload);
    productModal.hidden = true;
    showToast(editingId ? "Product updated" : "Product added");
    loadProducts();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save product";
  }
});

/* ============================= ENQUIRIES ============================= */
async function loadEnquiries() {
  let list = [];
  try {
    ({ enquiries: list } = await api("listEnquiries"));
  } catch (err) {
    showToast("Couldn't load enquiries: " + err.message);
  }
  const unread = list.filter((q) => !q.read).length;
  const badge = $("#enqBadge");
  badge.hidden = !unread;
  badge.textContent = unread;

  const rows = $("#enquiryRows");
  if (!list.length) {
    rows.innerHTML = `<tr><td colspan="6" class="empty">No enquiries yet.</td></tr>`;
    return;
  }
  rows.innerHTML = list
    .map(
      (q) => `
      <tr class="${q.read ? "" : "unread"}">
        <td>${new Date(q.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</td>
        <td><strong>${q.name}</strong></td>
        <td>${q.contact}</td>
        <td>${q.product || "—"}</td>
        <td>${q.message || "—"}</td>
        <td><div class="table__actions">
          <button class="iconbtn" data-read="${q.id}">${q.read ? "Unread" : "Read"}</button>
          <button class="iconbtn iconbtn--danger" data-del="${q.id}">Delete</button>
        </div></td>
      </tr>`
    )
    .join("");

  rows.querySelectorAll("[data-read]").forEach((b) =>
    b.addEventListener("click", async () => {
      const q = list.find((x) => x.id === b.dataset.read);
      await api("markEnquiryRead", { id: q.id, read: !q.read }).catch((e) => showToast(e.message));
      loadEnquiries();
    })
  );
  rows.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this enquiry?")) return;
      await api("deleteEnquiry", { id: b.dataset.del }).catch((e) => showToast(e.message));
      loadEnquiries();
    })
  );
}

/* ============================= ORDERS ============================= */
async function loadOrders() {
  let list = [];
  try {
    ({ orders: list } = await api("listOrders"));
  } catch (err) {
    showToast("Couldn't load orders: " + err.message);
  }
  const fresh = list.filter((o) => o.status === "new").length;
  const badge = $("#ordBadge");
  badge.hidden = !fresh;
  badge.textContent = fresh;

  const rows = $("#orderRows");
  if (!list.length) {
    rows.innerHTML = `<tr><td colspan="8" class="empty">No orders yet.</td></tr>`;
    return;
  }
  rows.innerHTML = list
    .map((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const itemTxt = items.map((i) => `${i.qty}× ${i.name}${i.finish ? ` (${i.finish})` : ""}`).join(", ");
      return `
      <tr class="${o.status === "new" ? "unread" : ""}">
        <td>${new Date(o.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</td>
        <td><strong>${o.customer_name}</strong><br><small>${o.address || ""}</small></td>
        <td>${o.contact}</td>
        <td title="${itemTxt}">${items.reduce((n, i) => n + (i.qty || 1), 0)} item(s)</td>
        <td><strong>₦${Number(o.total).toLocaleString("en-NG")}</strong></td>
        <td>${o.payment || "—"}</td>
        <td>
          <select class="status" data-status="${o.id}">
            ${["new", "confirmed", "delivered", "cancelled"].map((st) => `<option ${st === o.status ? "selected" : ""}>${st}</option>`).join("")}
          </select>
        </td>
        <td><div class="table__actions">
          <button class="iconbtn iconbtn--danger" data-del="${o.id}">Delete</button>
        </div></td>
      </tr>`;
    })
    .join("");

  rows.querySelectorAll("[data-status]").forEach((sel) =>
    sel.addEventListener("change", async () => {
      await api("updateOrderStatus", { id: sel.dataset.status, status: sel.value }).catch((e) => showToast(e.message));
      loadOrders();
    })
  );
  rows.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this order?")) return;
      await api("deleteOrder", { id: b.dataset.del }).catch((e) => showToast(e.message));
      loadOrders();
    })
  );
}

/* ============================= SETTINGS ============================= */
async function loadSettings() {
  try {
    const { settings } = await api("getSettings");
    $("#heroPreview").src = settings?.hero_image || "images/hero.jpg";
    $("#setWhatsapp").value = settings?.whatsapp || "";
    $("#setTagline").value = settings?.tagline || "";
  } catch { /* settings stay default */ }
}

$("#heroFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $("#heroPreview").src = URL.createObjectURL(file);
  try {
    const b64 = await fileToBase64(file);
    const { url } = await api("uploadImage", { contentType: file.type, data: b64 });
    await api("updateSettings", { settings: { hero_image: url } });
    showToast("Hero image updated");
  } catch (err) {
    showToast("Upload failed: " + err.message);
  }
});

$("#saveSettingsBtn").addEventListener("click", async () => {
  try {
    await api("updateSettings", {
      settings: { whatsapp: $("#setWhatsapp").value, tagline: $("#setTagline").value },
    });
    showToast("Settings saved");
  } catch (err) {
    showToast(err.message);
  }
});

$("#changeKeyBtn").addEventListener("click", async () => {
  const newKey = $("#newKey").value.trim();
  if (newKey.length < 8) return showToast("Passkey must be at least 8 characters");
  if (!confirm("Change the admin passkey? You'll need it next login.")) return;
  try {
    await api("changeKey", { newKey });
    adminKey = newKey;
    sessionStorage.setItem("fol_admin_key", newKey);
    $("#newKey").value = "";
    showToast("Passkey changed");
  } catch (err) {
    showToast(err.message);
  }
});

/* ---------- auto-login if a session key exists ---------- */
if (adminKey) {
  api("verify")
    .then(enterApp)
    .catch(() => sessionStorage.removeItem("fol_admin_key"));
}
