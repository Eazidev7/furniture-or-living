/* ============================================================
   Furniture or Living — store front logic
   Products/settings load from the admin-api (Supabase).
   If the API is unreachable, built-in defaults keep the shop working.
   ============================================================ */

/* ---------- Finishes (shared swatch palette) ---------- */
const FINISHES = [
  { name: "Natural Oak", wood: "#c99a6b", dark: "#a3744a" },
  { name: "Walnut",      wood: "#8a5a3b", dark: "#6b422a" },
  { name: "Wenge",       wood: "#4a3226", dark: "#33231a" },
  { name: "Matte Black", wood: "#33333a", dark: "#212126" },
  { name: "Gloss White", wood: "#f6f4ef", dark: "#ddd8cc" },
  { name: "Pearl Cream", wood: "#efe6d4", dark: "#d4c6ac" },
];

/* ---------- Fallback products (used if the API is unreachable) ---------- */
const FALLBACK_PRODUCTS = [
  { name: "Oslo Center Table",   price: 85000,  dims: "100 × 60 × 35 cm",  tag: "Best seller",  img: "images/center-table.jpg" },
  { name: "Aria Wardrobe",       price: 185000, dims: "120 × 60 × 200 cm", tag: "New",          img: "images/wardrobe.jpg" },
  { name: "Atlas Study Desk",    price: 95000,  dims: "120 × 60 × 75 cm",  tag: "",             img: "images/desk.jpg" },
  { name: "Malmö TV Console",    price: 120000, dims: "160 × 40 × 50 cm",  tag: "",             img: "images/tv-stand.jpg" },
  { name: "Vika Chest of Drawers", price: 75000, dims: "80 × 40 × 100 cm", tag: "Sale",         img: "images/drawers.jpg" },
  { name: "Natt Nightstand",     price: 38000,  dims: "45 × 40 × 55 cm",   tag: "",             img: "images/nightstand.jpg" },
];

/* ---------- API helper ---------- */
async function api(action, payload = {}, key = null) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers["x-admin-key"] = key;
  const res = await fetch(FOL_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

/* ---------- Cart (persisted) ---------- */
let cart = JSON.parse(localStorage.getItem("fol_cart") || "[]");
const cartCount = document.getElementById("cartCount");

function saveCart() {
  localStorage.setItem("fol_cart", JSON.stringify(cart));
  cartCount.textContent = cart.reduce((n, i) => n + i.qty, 0);
}

function addToCart(product, finish) {
  const found = cart.find((i) => i.name === product.name && i.finish === finish);
  if (found) found.qty++;
  else
    cart.push({
      name: product.name,
      finish,
      price: Number(product.price),
      img: product.img,
      qty: 1,
    });
  saveCart();
}
saveCart(); /* paint count on load */

const toast = document.getElementById("toast");
let toastTimer;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------- Render product cards ---------- */
const grid = document.getElementById("productGrid");

function renderProducts(products) {
  grid.innerHTML = "";
  products.forEach((p, i) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.transitionDelay = `${(i % 3) * 90}ms`;

    const swatches = FINISHES.map(
      (f, j) => `
        <button class="swatch${j === 0 ? " active" : ""}" data-idx="${j}"
          style="background: linear-gradient(135deg, ${f.wood}, ${f.dark})"
          aria-label="${f.name} finish" title="${f.name}"></button>`
    ).join("");

    card.innerHTML = `
      <div class="card__art">
        ${p.tag ? `<span class="card__tag">${p.tag}</span>` : ""}
        <img class="finish-0" src="${p.img}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="card__body">
        <h3 class="card__name">${p.name}</h3>
        <div class="card__meta">
          <span class="card__price">₦${Number(p.price).toLocaleString("en-NG")}</span>
          <span class="card__dims">${p.dims}</span>
        </div>
        <div class="picker">
          <span class="picker__label">Finish — <span class="picker__value">${FINISHES[0].name}</span></span>
          <div class="swatches">${swatches}</div>
        </div>
        <div class="card__actions">
          <button class="card__enquire">Enquire</button>
          <button class="card__add">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add to cart
          </button>
        </div>
      </div>`;

    /* swatch picking — swaps the finish filter on the photo */
    const label = card.querySelector(".picker__value");
    const img = card.querySelector(".card__art img");
    card.querySelectorAll(".swatch").forEach((sw) => {
      sw.addEventListener("click", () => {
        const idx = Number(sw.dataset.idx);
        img.className = `finish-${idx}`;
        label.textContent = FINISHES[idx].name;
        card.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
        sw.classList.add("active");
      });
    });

    /* per-product enquire → prefill the modal */
    card.querySelector(".card__enquire").addEventListener("click", () =>
      openEnquiry(p.name)
    );

    /* add to cart */
    const addBtn = card.querySelector(".card__add");
    addBtn.addEventListener("click", () => {
      addToCart(p, label.textContent);
      cartCount.classList.remove("pop");
      void cartCount.offsetWidth;
      cartCount.classList.add("pop");
      showToast(`${p.name} (${label.textContent}) added to cart`);
      addBtn.classList.add("added");
      addBtn.innerHTML = "Added ✓";
      setTimeout(() => {
        addBtn.classList.remove("added");
        addBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add to cart`;
      }, 1400);
    });

    grid.appendChild(card);
    io.observe(card);
  });
}

/* ---------- Scroll reveal ---------- */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("shown")),
  { threshold: 0.15 }
);

/* ---------- Hero assembly: build slices, then run animation ---------- */
const stage = document.getElementById("stage");
const stagePhoto = document.getElementById("stagePhoto");
const replayBtn = document.getElementById("replayBtn");

const SLICES = 6;
for (let i = 0; i < SLICES; i++) {
  const s = document.createElement("div");
  s.className = "slice";
  stagePhoto.appendChild(s);
}

function setHeroImage(url) {
  if (!url) return;
  stagePhoto.querySelectorAll(".slice").forEach(
    (sl) => (sl.style.backgroundImage = `url("${url}")`)
  );
}

function assemble() {
  stage.classList.remove("assembled");
  void stage.offsetWidth; /* force reflow so animations restart */
  stage.classList.add("assembled");
}

requestAnimationFrame(() => requestAnimationFrame(assemble));
replayBtn.addEventListener("click", assemble);

/* ---------- Enquiry modal ---------- */
const modal = document.getElementById("enquiryModal");
const enquiryForm = document.getElementById("enquiryForm");
const enquiryProduct = document.getElementById("enquiryProduct");

function openEnquiry(product = "") {
  enquiryProduct.value = product;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeEnquiry() {
  modal.hidden = true;
  document.body.style.overflow = "";
}
document.getElementById("enquiryClose").addEventListener("click", closeEnquiry);
modal.addEventListener("click", (e) => e.target === modal && closeEnquiry());
document.addEventListener("keydown", (e) => e.key === "Escape" && closeEnquiry());

enquiryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(enquiryForm);
  const btn = enquiryForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    await api("submitEnquiry", {
      name: fd.get("name"),
      contact: fd.get("contact"),
      product: fd.get("product"),
      message: fd.get("message"),
      website: fd.get("website"), // honeypot
    });
    enquiryForm.reset();
    closeEnquiry();
    showToast("Enquiry sent — we'll be in touch shortly!");
  } catch {
    showToast("Couldn't send right now — please WhatsApp us instead.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send enquiry";
  }
});

document.getElementById("enquireBtn").addEventListener("click", () => openEnquiry());
document.getElementById("cartBtn").addEventListener("click", () => {
  window.location.href = "checkout.html";
});

/* ---------- Boot: load live data, fall back gracefully ---------- */
(async () => {
  try {
    const [{ products }, { settings }] = await Promise.all([
      api("listProducts"),
      api("getSettings"),
    ]);
    renderProducts(products?.length ? products : FALLBACK_PRODUCTS);
    if (settings?.hero_image) setHeroImage(settings.hero_image);
    if (settings?.tagline)
      document.querySelector(".footer__tag").textContent = settings.tagline;
  } catch {
    renderProducts(FALLBACK_PRODUCTS);
  }
})();
