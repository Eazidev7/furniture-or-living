/* ============================================================
   Furniture or Living — checkout
   Cart lives in localStorage (fol_cart). Order submits via admin-api.
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

let cart = JSON.parse(localStorage.getItem("fol_cart") || "[]");
const naira = (n) => `₦${Number(n).toLocaleString("en-NG")}`;

function renderCart() {
  const empty = $("#emptyState");
  const grid = $("#checkoutGrid");
  if (!cart.length) {
    empty.hidden = false;
    grid.hidden = true;
    return;
  }
  empty.hidden = true;
  grid.hidden = false;

  $("#orderItems").innerHTML = cart
    .map(
      (i, idx) => `
      <div class="item">
        <img class="item__img" src="${i.img}" alt="" />
        <div>
          <div class="item__name">${i.name}</div>
          <div class="item__finish">${i.finish}</div>
          <div class="item__price">${naira(i.price)} each</div>
        </div>
        <div class="item__right">
          <span class="item__line">${naira(i.price * i.qty)}</span>
          <div class="qty">
            <button data-dec="${idx}" aria-label="Decrease">−</button>
            <span>${i.qty}</span>
            <button data-inc="${idx}" aria-label="Increase">+</button>
          </div>
          <button class="item__remove" data-rm="${idx}">remove</button>
        </div>
      </div>`
    )
    .join("");

  const total = cart.reduce((n, i) => n + i.price * i.qty, 0);
  $("#subTotal").textContent = naira(total);
  $("#grandTotal").textContent = naira(total);

  $("#orderItems").querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", () => { cart[b.dataset.inc].qty++; persist(); })
  );
  $("#orderItems").querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = cart[b.dataset.dec];
      i.qty = Math.max(1, i.qty - 1);
      persist();
    })
  );
  $("#orderItems").querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      cart.splice(Number(b.dataset.rm), 1);
      persist();
    })
  );
}

function persist() {
  localStorage.setItem("fol_cart", JSON.stringify(cart));
  renderCart();
}

/* ---------- place order ---------- */
$("#orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const btn = $("#placeOrderBtn");
  btn.disabled = true;
  btn.textContent = "Placing order…";
  try {
    const { id } = await api("submitOrder", {
      name: fd.get("name"),
      contact: fd.get("contact"),
      address: fd.get("address"),
      note: fd.get("note"),
      payment: fd.get("payment"),
      items: cart,
      total: cart.reduce((n, i) => n + i.price * i.qty, 0),
      website: fd.get("website"), // honeypot
    });
    cart = [];
    persist();
    $("#checkoutGrid").hidden = true;
    $("#emptyState").hidden = true;
    $("#successState").hidden = false;
    $("#orderRef").textContent = "#" + String(id).slice(0, 8).toUpperCase();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    showToast("Couldn't place the order — please try again or WhatsApp us.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Place order";
  }
});

async function api(action, payload = {}) {
  const res = await fetch(FOL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

renderCart();
