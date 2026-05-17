const root = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const toastRoot = document.getElementById("toast-root");

const state = {
  user: null,
  workerOrder: null,
  dashboard: null,
  adminView: "dashboard",
  orderSearch: "",
  polling: [],
  busy: false
};

const missingReasons = [
  "Product not found",
  "Size unavailable",
  "Damaged item",
  "Waiting from warehouse",
  "Other"
];

const ar = {
  appName: "مساعد العمليات",
  statuses: {
    New: "جديد",
    Queued: "في قائمة الانتظار",
    Assigned: "مخصص",
    "Picking / Packing": "جاري الالتقاط والتغليف",
    "Ready To Ship": "جاهز للشحن",
    "Label Printed": "تمت طباعة البوليصة",
    "Product Missing": "منتج مفقود",
    "Awaiting Stock": "بانتظار توفر المخزون",
    "Stock Arrived": "وصل المخزون",
    "Returned To Queue": "أعيد إلى قائمة الانتظار",
    Escalated: "مصعد",
    Shipped: "تم الشحن",
    Cancelled: "ملغي",
    "Pending Pick": "بانتظار الالتقاط",
    Packed: "تم التغليف",
    Missing: "مفقود",
    Packing: "قيد التغليف",
    Idle: "خامل",
    Available: "متاح"
  },
  priorities: {
    Critical: "حرج",
    High: "مرتفع",
    Normal: "عادي",
    Low: "منخفض"
  },
  reasons: {
    "Product not found": "لم يتم العثور على المنتج",
    "Size unavailable": "المقاس غير متوفر",
    "Damaged item": "القطعة تالفة",
    "Waiting from warehouse": "بانتظار المستودع",
    Other: "أخرى"
  },
  events: {
    "Imported from Zid": "تم الاستيراد من زد",
    Queued: "دخل قائمة الانتظار",
    "Assigned to worker": "تم تخصيصه للعامل",
    "Packing started": "بدأ التجهيز",
    "Product marked missing": "تم تسجيل منتج مفقود",
    "Awaiting stock": "بانتظار المخزون",
    "Stock arrived": "وصل المخزون",
    "Returned to queue": "أعيد إلى قائمة الانتظار",
    "Ready to ship": "جاهز للشحن",
    "Label printed": "تمت طباعة البوليصة",
    Reassigned: "تمت إعادة التخصيص",
    Escalated: "تم التصعيد",
    Unlocked: "تم فك القفل",
    "Internal note": "ملاحظة داخلية",
    "Shipping policy created": "تم إنشاء بوليصة الشحن",
    "Auto print": "طباعة تلقائية"
  },
  names: {
    "Admin Control": "تحكم الإدارة",
    "Worker One": "العامل الأول",
    "Worker Two": "العامل الثاني",
    "Sara Alharbi": "سارة الحربي",
    "Noura Alzahrani": "نورة الزهراني",
    "Lama Alotaibi": "لمى العتيبي",
    "Maha Alqahtani": "مها القحطاني",
    "Reem Almutairi": "ريم المطيري",
    "Hessa Aldosari": "حصة الدوسري",
    "Dana Alghamdi": "دانة الغامدي",
    "Abeer Alrashid": "عبير الرشيد",
    System: "النظام"
  },
  products: {
    "Luna Satin Dress": "فستان لونا ساتان",
    "Mira Pleated Dress": "فستان ميرا بكسرات",
    "Dalia Evening Dress": "فستان داليا سهرة",
    "Aster Tulle Gown": "فستان أستر تول",
    "Noor Velvet Dress": "فستان نور مخمل",
    "Pearl Occasion Belt": "حزام بيرل للمناسبات",
    "Pearl Belt": "حزام بيرل"
  },
  shipping: {
    Aramex: "أرامكس",
    SMSA: "سمسا",
    "Local Courier": "مندوب محلي",
    "Local courier": "مندوب محلي",
    DHL: "دي إتش إل"
  },
  sizes: {
    "One size": "مقاس واحد",
    "Mixed": "متنوع",
    Multiple: "متعدد"
  },
  notes: {
    "Gift order, premium wrapping requested.": "طلب هدية، مطلوب تغليف فاخر.",
    "Customer asked for careful folding.": "العميلة طلبت طي القطع بعناية.",
    "Call before delivery.": "يرجى الاتصال قبل التوصيل.",
    "Rush order for evening event.": "طلب عاجل لمناسبة مسائية.",
    "Do not include invoice in package.": "لا ترفق الفاتورة داخل الشحنة.",
    "Please pack carefully, gift order.": "يرجى التغليف بعناية، الطلب هدية."
  }
};

const fallbackImage =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#07111f"/>
      <stop offset=".55" stop-color="#13294a"/>
      <stop offset="1" stop-color="#02050d"/>
    </linearGradient>
    <radialGradient id="r" cx=".5" cy=".3" r=".55">
      <stop stop-color="#4ee8ff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#4ee8ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="900" height="1200" fill="url(#g)"/>
  <rect width="900" height="1200" fill="url(#r)"/>
  <path d="M365 180h170l42 126-62 42 116 642H269l116-642-62-42 42-126Z" fill="#0d1f38" stroke="#4ee8ff" stroke-width="10"/>
  <path d="M382 214c28 46 108 46 136 0" fill="none" stroke="#a77cff" stroke-width="12"/>
  <text x="450" y="1090" text-anchor="middle" font-family="Arial" font-size="46" fill="#edf6ff">مساعد العمليات</text>
</svg>`);

function icon(name, size = 18) {
  return `<i data-lucide="${name}" width="${size}" height="${size}" aria-hidden="true"></i>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      state.user = null;
      stopPolling();
      renderLogin();
    }
    throw new Error(translateError(data.error || "تعذر تنفيذ الطلب."));
  }
  return data;
}

function translateError(message) {
  const errors = {
    "Request failed.": "تعذر تنفيذ الطلب.",
    "Authentication required.": "يرجى تسجيل الدخول أولًا.",
    "Invalid email or password.": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "This account is disabled.": "هذا الحساب غير مفعل.",
    "This account does not have access to that operation.": "هذا الحساب لا يملك صلاحية لهذه العملية.",
    "This order is not locked to the current worker.": "هذا الطلب غير مقفل على العامل الحالي.",
    "Select at least one missing item.": "اختر منتجًا مفقودًا واحدًا على الأقل.",
    "Select a missing reason.": "اختر سبب فقدان المنتج.",
    "Select a valid worker.": "اختر عاملًا صالحًا.",
    "Internal note cannot be empty.": "لا يمكن حفظ ملاحظة فارغة."
  };
  return errors[message] || message;
}

function refreshIcons() {
  requestAnimationFrame(() => {
    if (window.lucide) window.lucide.createIcons();
    updateLiveTimes();
  });
}

function stopPolling() {
  for (const timer of state.polling) clearInterval(timer);
  state.polling = [];
}

function startPolling() {
  stopPolling();
  state.polling.push(setInterval(updateLiveTimes, 1000));
  if (state.user?.role === "admin") {
    state.polling.push(setInterval(loadDashboard, 5000));
  }
  if (state.user?.role === "worker") {
    state.polling.push(setInterval(loadWorkerOrder, 5000));
    state.polling.push(setInterval(workerHeartbeat, 30000));
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}س ${String(m).padStart(2, "0")}د`;
  return `${m}د ${String(s).padStart(2, "0")}ث`;
}

function secondsSince(iso) {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round((Date.now() - value) / 1000));
}

function relativeTime(iso) {
  const seconds = secondsSince(iso);
  if (seconds < 60) return "الآن";
  if (seconds < 3600) return `قبل ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `قبل ${Math.floor(seconds / 3600)} ساعة`;
  return `قبل ${Math.floor(seconds / 86400)} يوم`;
}

function dateTime(iso) {
  if (!iso) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function updateLiveTimes() {
  document.querySelectorAll("[data-timer-start]").forEach((node) => {
    node.textContent = formatDuration(secondsSince(node.dataset.timerStart));
  });
  document.querySelectorAll("[data-relative-time]").forEach((node) => {
    node.textContent = relativeTime(node.dataset.relativeTime);
  });
}

function imageTag(src, alt, className = "") {
  return `<img class="${className}" src="${escapeAttr(src || fallbackImage)}" alt="${escapeAttr(displayText(alt))}" onerror="this.onerror=null;this.src='${fallbackImage}'" loading="lazy">`;
}

function displayText(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value);
  return ar.statuses[text] || ar.priorities[text] || ar.reasons[text] || ar.events[text] || ar.names[text] || ar.products[text] || ar.shipping[text] || ar.sizes[text] || ar.notes[text] || text;
}

function displayUser(user) {
  return displayText(user?.name || "");
}

function displayStatus(value) {
  return ar.statuses[value] || displayText(value);
}

function displayPriority(value) {
  return ar.priorities[value] || displayText(value);
}

function displayReason(value) {
  return ar.reasons[value] || displayText(value);
}

function displaySize(value) {
  return ar.sizes[value] || displayText(value);
}

function displayEventType(value) {
  return ar.events[value] || displayText(value);
}

function displayMessage(message, orderNumber = "") {
  const text = String(message || "");
  if (!text) return "";
  if (text.includes("imported into Operation Assist")) return `تم استيراد ${orderNumber} إلى مساعد العمليات.`;
  if (text.includes("imported from mock Zid sync")) return `تم استيراد ${orderNumber} من مزامنة زد التجريبية.`;
  if (text.includes("entered the packaging queue")) return `دخل ${orderNumber} إلى قائمة التجهيز.`;
  if (text.includes("locked to")) return `تم قفل ${orderNumber} على العامل.`;
  if (text.includes("Worker opened the forced order task")) return "فتح العامل مهمة الطلب المخصصة.";
  if (text.includes("All products verified")) return "تم التحقق من جميع المنتجات وتسجيل مدة الإنجاز.";
  if (text.includes("All products packed and verified")) return "تم تغليف جميع المنتجات والتحقق منها.";
  if (text.includes("Shipping label")) return "تم إنشاء بوليصة الشحن.";
  if (text.includes("mock AWB")) return "تم إنشاء بوليصة شحن تجريبية من AJEX.";
  if (text.includes("Mock auto-print completed")) return "تم تنفيذ طباعة تلقائية تجريبية بدون الاتصال بطابعة فعلية.";
  if (text.includes("Printed Mock")) return "تم تسجيل طباعة تجريبية على الطابعة الافتراضية.";
  if (text.includes("reported missing")) {
    return text
      .replace("reported missing", "تم تسجيله كمفقود")
      .replace("Product not found", ar.reasons["Product not found"])
      .replace("Size unavailable", ar.reasons["Size unavailable"])
      .replace("One size", "مقاس واحد")
      .replace("Local test: shelf bin checked, item not found.", "اختبار محلي: تم فحص رف التخزين ولم يتم العثور على القطعة.");
  }
  if (text.includes("Order moved out of active packaging flow")) return "خرج الطلب من مسار التغليف النشط بانتظار المخزون.";
  if (text.includes("Admin confirmed replacement stock arrived")) return "أكدت الإدارة وصول المخزون البديل.";
  if (text.includes("available for automatic reassignment")) return "أصبح الطلب متاحًا لإعادة التخصيص تلقائيًا بأولوية أعلى.";
  if (text.includes("Admin returned the order")) return "أعادت الإدارة الطلب إلى التخصيص التلقائي.";
  if (text.includes("Admin escalated")) return "قامت الإدارة بتصعيد الطلب المتأخر.";
  if (text.includes("reassigned to")) return "تمت إعادة تخصيص الطلب إلى عامل.";
  if (text.includes("unlocked")) return "تم فك قفل الطلب وإعادته إلى قائمة الانتظار.";
  return displayText(text);
}

function statusClass(value) {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("critical") || lower.includes("missing") || lower.includes("stuck")) return "critical";
  if (lower.includes("awaiting") || lower.includes("delayed") || lower.includes("queue")) return "warn";
  if (lower.includes("ready") || lower.includes("printed") || lower.includes("available")) return "ready";
  if (lower.includes("high")) return "high";
  return "";
}

function badge(label, extra = "") {
  return `<span class="badge ${statusClass(label)} ${extra}">${escapeHtml(displayText(label))}</span>`;
}

function orderBadges(order) {
  const badges = [
    badge(order.status),
    order.status_tag ? badge(order.status_tag, "missing") : "",
    badge(order.priority, order.priority === "Critical" ? "pulse" : ""),
    order.delayed ? badge("متأخر", "delayed pulse") : "",
    order.potentially_stuck ? badge("معرض للتعطل", "stuck pulse") : ""
  ];
  return badges.filter(Boolean).join("");
}

function toast(title, message = "") {
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ""}`;
  toastRoot.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function openModal(html) {
  modalRoot.innerHTML = `<div class="modal-backdrop" onclick="if(event.target === this) App.closeModal()">${html}</div>`;
  refreshIcons();
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function renderLogin() {
  root.innerHTML = `
    <main class="login-shell">
      <section class="login-hero">
        <span class="eyebrow">${icon("radar")} تحكم تجهيز مرتبط بزد</span>
        <h1>مساعد العمليات</h1>
        <p>نظام تشغيل خفيف للمستودع مخصص لتجهيز الفساتين، يوزع الطلبات تلقائيًا، يتابع المنتجات المفقودة، ويعرض حالة التشغيل لحظيًا.</p>
        <div class="login-stats">
          <div class="login-stat"><strong>05د</strong><span>فاصل مزامنة زد التجريبية</span></div>
          <div class="login-stat"><strong>1:1</strong><span>طلب واحد مقفل لكل عامل</span></div>
          <div class="login-stat"><strong>24س</strong><span>نافذة تصعيد التأخير</span></div>
        </div>
      </section>
      <section class="login-panel">
        <div class="panel-heading">
          <div>
            <h2>تسجيل الدخول</h2>
            <span>اختر الحساب لتحديد صلاحيات المستخدم.</span>
          </div>
          <div class="brand-mark"></div>
        </div>
        <form id="login-form">
          <div class="field">
            <label for="email">البريد الإلكتروني</label>
            <input class="input" id="email" name="email" autocomplete="username" value="admin@operation.local">
          </div>
          <div class="field">
            <label for="password">كلمة المرور</label>
            <input class="input" id="password" name="password" type="password" autocomplete="current-password" value="Admin123!">
          </div>
          <button class="btn btn-primary btn-wide" id="login-submit" type="submit" data-action="login">${icon("log-in")} دخول النظام</button>
          <div class="login-message" id="login-message" role="status"></div>
        </form>
        <div class="quick-accounts">
          ${quickAccount("الإدارة", "admin@operation.local", "Admin123!", "shield")}
          ${quickAccount("العامل الأول", "worker1@operation.local", "Worker123!", "scan-line")}
          ${quickAccount("العامل الثاني", "worker2@operation.local", "Worker123!", "scan-line")}
        </div>
      </section>
    </main>
  `;
  document.getElementById("login-form").addEventListener("submit", login);
  document.getElementById("login-submit").addEventListener("click", login);
  document.querySelectorAll("[data-account]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("email").value = button.dataset.email;
      document.getElementById("password").value = button.dataset.password;
    });
  });
  refreshIcons();
}

function quickAccount(label, email, password, iconName = "scan-line") {
  return `
    <button class="btn btn-ghost quick-account" type="button" data-account="${escapeAttr(label)}" data-email="${escapeAttr(email)}" data-password="${escapeAttr(password)}">
      <span>${icon(iconName)} ${escapeHtml(label)}</span>
      <small>${escapeHtml(email)}</small>
    </button>
  `;
}

async function login(event) {
  event?.preventDefault();
  event?.stopPropagation();
  const formElement = document.getElementById("login-form");
  if (!formElement) return;
  const submitButton = document.getElementById("login-submit");
  const message = document.getElementById("login-message");
  if (submitButton?.disabled) return;
  const form = new FormData(formElement);
  try {
    if (message) message.textContent = "جاري تسجيل الدخول...";
    if (submitButton) submitButton.disabled = true;
    const data = await api("/api/auth/login", {
      method: "POST",
      body: {
        email: form.get("email"),
        password: form.get("password")
      }
    });
    state.user = data.user;
    toast("تم تسجيل الدخول", displayUser(state.user));
    await enterRole();
  } catch (error) {
    if (message) message.textContent = error.message;
    toast("فشل تسجيل الدخول", error.message);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  state.workerOrder = null;
  state.dashboard = null;
  stopPolling();
  renderLogin();
}

async function enterRole() {
  startPolling();
  if (state.user.role === "worker") {
    await loadWorkerOrder();
  } else {
    await loadDashboard();
  }
}

async function workerHeartbeat() {
  if (state.user?.role !== "worker") return;
  await api("/api/worker/heartbeat", { method: "POST" }).catch(() => {});
}

async function loadWorkerOrder() {
  if (state.user?.role !== "worker" || state.busy) return;
  try {
    const data = await api("/api/worker/current");
    const nextId = data.order?.id || null;
    const oldId = state.workerOrder?.id || null;
    state.workerOrder = data.order;
    renderWorker();
    if (nextId && oldId && nextId !== oldId) toast("تم تخصيص الطلب التالي", data.order.order_number);
  } catch (error) {
    toast("تعذرت مزامنة العامل", error.message);
  }
}

function renderTopbar(modeLabel) {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <strong>مساعد العمليات</strong>
          <span>${escapeHtml(modeLabel)}</span>
        </div>
      </div>
      <div class="top-actions">
        <div class="worker-name">
          <strong>${escapeHtml(displayUser(state.user))}</strong>
          <span>${escapeHtml(state.user.email)}</span>
        </div>
        <button class="btn btn-ghost" onclick="App.logout()">${icon("log-out")} خروج</button>
      </div>
    </header>
  `;
}

function renderWorker() {
  const order = state.workerOrder;
  if (!order) {
    root.innerHTML = `
      <main class="worker-shell">
        ${renderTopbar("شاشة مهمة العامل")}
        <section class="standby-panel">
          <div class="brand-mark"></div>
          <h1>وضع الانتظار</h1>
          <p>لا يوجد طلب في قائمة الانتظار الآن. سيظهر الطلب التالي تلقائيًا بعد المزامنة.</p>
          <button class="btn btn-primary" onclick="App.loadWorkerOrder()">${icon("refresh-cw")} تحقق الآن</button>
        </section>
      </main>
    `;
    refreshIcons();
    return;
  }

  const heroItem = order.items[0] || {};
  root.innerHTML = `
    <main class="worker-shell">
      ${renderTopbar("مهمة عامل إجبارية")}
      <section class="worker-task">
        <div class="product-stage">
          ${imageTag(heroItem.image_url, heroItem.product_name || order.order_number, "hero-image")}
          <div class="image-overlay">
            <div>
              <h2>${escapeHtml(displayText(heroItem.product_name || "منتج الطلب"))}</h2>
              <p>${escapeHtml(heroItem.sku || "")} ${heroItem.size ? `/${escapeHtml(displaySize(heroItem.size))}` : ""}</p>
            </div>
            <div class="timer-card">
              <small>وقت التجهيز</small>
              <strong data-timer-start="${escapeAttr(order.packing_started_at)}">${formatDuration(order.processing_seconds)}</strong>
            </div>
          </div>
        </div>

        <div class="task-panel">
          <section class="task-header">
            <div class="task-title">
              <div>
                <span class="eyebrow">${icon("lock-keyhole")} مقفل على ${escapeHtml(displayUser(state.user))}</span>
                <h1>${escapeHtml(order.order_number)}</h1>
              </div>
              <div class="timer-card">
                <small>عمر الطلب</small>
                <strong>${formatDuration(order.age_seconds)}</strong>
              </div>
            </div>
            <div class="status-row">${orderBadges(order)}</div>
          </section>

          <section class="order-focus">
            <div class="meta-grid">
              ${metaTile("SKU", heroItem.sku || "متعدد")}
              ${metaTile("المقاس", displaySize(heroItem.size) || "متنوع")}
              ${metaTile("الكمية", String(order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)))}
              ${metaTile("عدد القطع في الطلب", String(order.item_count))}
              ${metaTile("العميل", displayText(order.customer_name) || "غير متوفر")}
              ${metaTile("الشحن", displayText(order.shipping_method) || "غير متوفر")}
            </div>
          </section>

          <section class="notes-panel">
            <h3>ملاحظات العميل</h3>
            <p>${escapeHtml(displayText(order.customer_notes) || "لا توجد ملاحظات من العميل.")}</p>
          </section>

          <section class="items-panel">
            <h3>المنتجات</h3>
            <div class="item-list">
              ${order.items.map(renderWorkerItem).join("")}
            </div>
          </section>
        </div>
      </section>
      <div class="action-dock">
        <div class="action-dock-inner">
          <button class="btn btn-primary btn-large" onclick="App.confirmReady()">${icon("printer")} الطلب جاهز / طباعة بوليصة الشحن</button>
          <button class="btn btn-danger btn-large" onclick="App.openMissingFlow()">${icon("circle-alert")} منتج مفقود</button>
        </div>
      </div>
    </main>
  `;
  refreshIcons();
}

function metaTile(label, value) {
  return `<div class="meta-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderWorkerItem(item) {
  return `
    <article class="item-card">
      ${imageTag(item.image_url, item.product_name)}
      <div>
        <h4>${escapeHtml(displayText(item.product_name))}</h4>
        <p>${escapeHtml(item.sku)} / ${escapeHtml(displaySize(item.size))}</p>
        <div class="item-tags">
          ${badge(`الكمية ${item.quantity}`)}
          ${badge(item.status)}
        </div>
      </div>
    </article>
  `;
}

function confirmReady() {
  const order = state.workerOrder;
  if (!order) return;
  openModal(`
    <section class="modal-card">
      <span class="eyebrow">${icon("check-check")} التحقق النهائي</span>
      <h2>هل تم تغليف جميع المنتجات والتحقق منها؟</h2>
      <p class="muted">سيتم نقل ${escapeHtml(order.order_number)} إلى جاهز للشحن، ثم محاكاة طباعة البوليصة، وتسجيل مدة الإنجاز، وتخصيص الطلب التالي.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="App.submitReady()">${icon("printer")} تأكيد وطباعة</button>
      </div>
    </section>
  `);
}

async function submitReady() {
  if (!state.workerOrder) return;
  state.busy = true;
  try {
    const data = await api(`/api/worker/orders/${encodeURIComponent(state.workerOrder.id)}/ready`, {
      method: "POST",
      body: { confirmed: true }
    });
    closeModal();
    toast("تمت طباعة البوليصة", `${data.completed.order_number} / ${data.label.tracking_number}`);
    state.workerOrder = data.nextOrder;
    renderWorker();
  } catch (error) {
    toast("تعذر إنهاء الطلب", error.message);
  } finally {
    state.busy = false;
  }
}

function openMissingFlow() {
  const order = state.workerOrder;
  if (!order) return;
  openModal(`
    <section class="modal-card wide">
      <span class="eyebrow">${icon("package-x")} بلاغ منتج مفقود</span>
      <h2>${escapeHtml(order.order_number)}</h2>
      <div class="missing-select-list">
        ${order.items
          .map(
            (item) => `
          <label class="selectable-item">
            <input type="checkbox" name="missing-item" value="${escapeAttr(item.id)}">
            ${imageTag(item.image_url, item.product_name)}
            <span>
              <strong>${escapeHtml(displayText(item.product_name))}</strong>
              <span class="muted">${escapeHtml(item.sku)} / ${escapeHtml(displaySize(item.size))} / الكمية ${escapeHtml(item.quantity)}</span>
            </span>
          </label>
        `
          )
          .join("")}
      </div>
      <div class="field">
        <label for="missing-reason">السبب</label>
        <select id="missing-reason" class="select">
          <option value="">اختر السبب</option>
          ${missingReasons.map((reason) => `<option value="${escapeAttr(reason)}">${escapeHtml(displayReason(reason))}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="missing-note">ملاحظة اختيارية</label>
        <textarea id="missing-note" class="textarea" placeholder="الرف، البِن، تفاصيل التلف، أو متابعة المستودع"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">إلغاء</button>
        <button class="btn btn-danger" onclick="App.submitMissing()">${icon("send")} إرسال البلاغ</button>
      </div>
    </section>
  `);
}

async function submitMissing() {
  if (!state.workerOrder) return;
  const itemIds = [...modalRoot.querySelectorAll('input[name="missing-item"]:checked')].map((input) => input.value);
  const reason = modalRoot.querySelector("#missing-reason")?.value || "";
  const note = modalRoot.querySelector("#missing-note")?.value || "";
  state.busy = true;
  try {
    const data = await api(`/api/worker/orders/${encodeURIComponent(state.workerOrder.id)}/missing`, {
      method: "POST",
      body: { itemIds, reason, note }
    });
    closeModal();
    toast("تم تسجيل بلاغ المفقود", `${data.missingOrder.order_number} نُقل إلى انتظار المخزون`);
    state.workerOrder = data.nextOrder;
    renderWorker();
  } catch (error) {
    toast("تعذر إرسال بلاغ المفقود", error.message);
  } finally {
    state.busy = false;
  }
}

async function loadDashboard() {
  if (state.user?.role !== "admin") return;
  try {
    state.dashboard = await api("/api/admin/dashboard");
    renderAdmin();
  } catch (error) {
    toast("تعذرت مزامنة لوحة التحكم", error.message);
  }
}

function renderAdmin() {
  const data = state.dashboard;
  if (!data) {
    root.innerHTML = `<main class="admin-shell">${renderSidebar()}<section class="admin-main">${renderTopbar("مركز تحكم الإدارة")}<div class="admin-content"><div class="empty-state">جاري تحميل التشغيل المباشر...</div></div></section></main>`;
    refreshIcons();
    return;
  }

  root.innerHTML = `
    <main class="admin-shell">
      ${renderSidebar()}
      <section class="admin-main">
        ${renderTopbar("مركز تحكم الإدارة")}
        <div class="admin-content">
          ${renderAdminView()}
        </div>
      </section>
    </main>
  `;
  const search = document.getElementById("order-search");
  if (search) {
    search.value = state.orderSearch;
    search.addEventListener("input", (event) => {
      state.orderSearch = event.target.value;
      renderAdmin();
    });
  }
  refreshIcons();
}

function renderSidebar() {
  const nav = [
    ["dashboard", "layout-dashboard", "لوحة التحكم"],
    ["missing", "package-x", "المفقودات"],
    ["workers", "users", "العاملون"],
    ["orders", "list-checks", "الطلبات"],
    ["shipping", "printer", "الشحن والطباعة"],
    ["zid", "radio-tower", "ربط زد"]
  ];
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <strong>مساعد العمليات</strong>
          <span>نظام تشغيل المستودع</span>
        </div>
      </div>
      <nav class="nav-list">
        ${nav
          .map(
            ([id, iconName, label]) => `
          <button class="btn nav-btn ${state.adminView === id ? "active" : ""}" type="button" aria-label="${escapeAttr(label)}" data-admin-view="${escapeAttr(id)}">
            ${icon(iconName)} <span>${label}</span>
          </button>`
          )
          .join("")}
      </nav>
    </aside>
  `;
}

function setAdminView(view) {
  state.adminView = view;
  renderAdmin();
}

function renderAdminView() {
  if (state.adminView === "missing") return renderMissingCenter();
  if (state.adminView === "workers") return renderWorkerMonitoring();
  if (state.adminView === "orders") return renderOrdersView();
  if (state.adminView === "shipping") return renderShippingView();
  if (state.adminView === "zid") return renderZidView();
  return renderDashboardView();
}

function renderDashboardView() {
  const { metrics, queue, workers, recentEvents } = state.dashboard;
  return `
    <section class="section-heading">
      <div>
        <span class="eyebrow">${icon("activity")} تشغيل مباشر</span>
        <h1>مركز التحكم</h1>
        <p>آخر مزامنة مع زد <span data-relative-time="${escapeAttr(state.dashboard.meta.last_sync_at)}">${relativeTime(state.dashboard.meta.last_sync_at)}</span></p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-primary" onclick="App.syncNow()">${icon("refresh-cw")} مزامنة الآن</button>
        <button class="btn btn-ghost" onclick="App.loadDashboard()">${icon("rotate-cw")} تحديث</button>
      </div>
    </section>

    <section class="metric-grid">
      ${metric("طلبات جديدة", metrics.new_orders, "inbox")}
      ${metric("في قائمة الانتظار", metrics.queued_orders, "list-ordered")}
      ${metric("طلبات مخصصة", metrics.assigned_orders, "lock")}
      ${metric("قيد التجهيز الآن", metrics.currently_packing, "scan-line")}
      ${metric("جاهزة للشحن", metrics.ready_to_ship, "truck")}
      ${metric("منتجات مفقودة", metrics.product_missing, "package-x", metrics.product_missing ? "danger" : "")}
      ${metric("بانتظار المخزون", metrics.awaiting_stock, "warehouse", metrics.awaiting_stock ? "danger" : "")}
      ${metric("متأخرة أكثر من 24س", metrics.older_than_24h, "timer", metrics.older_than_24h ? "danger" : "")}
    </section>

    <section class="admin-grid">
      <div class="admin-section">
        <h2>مسارات العمل</h2>
        <div class="flow-lanes">
          ${lane("أولوية الانتظار", queue.slice(0, 3))}
          ${lane("العاملون", workers.map((worker) => worker.current_order).filter(Boolean))}
          ${lane("نقص المخزون", state.dashboard.missingOrders.slice(0, 3))}
          ${lane("خطر التعطل", state.dashboard.stuckOrders.slice(0, 3))}
        </div>
      </div>
      <div class="admin-section">
        <h2>سجل النشاط</h2>
        <div class="timeline">
          ${recentEvents.map(renderTimelineEvent).join("") || `<div class="empty-state">لا توجد أحداث بعد.</div>`}
        </div>
      </div>
    </section>
  `;
}

function metric(label, value, iconName, extra = "") {
  return `
    <article class="metric-card ${extra}">
      ${icon(iconName, 22)}
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function lane(title, orders) {
  return `
    <div class="flow-lane">
      <strong>${escapeHtml(title)}</strong>
      ${
        orders.length
          ? orders
              .map(
                (order) => `
          <button class="mini-order btn-ghost" onclick="App.viewOrder('${escapeAttr(order.id)}')">
            <strong>${escapeHtml(order.order_number)}</strong>
            <span>${escapeHtml(displayStatus(order.status))} / ${escapeHtml(displayPriority(order.priority))}</span>
          </button>
        `
              )
              .join("")
          : `<div class="mini-order"><span>لا يوجد</span></div>`
      }
    </div>
  `;
}

function renderTimelineEvent(event) {
  return `
    <article class="timeline-row">
      <strong>${escapeHtml(displayEventType(event.event_type))} ${event.order ? `/ ${escapeHtml(event.order.order_number)}` : ""}</strong>
      <span>${escapeHtml(displayMessage(event.message, event.order?.order_number || ""))}</span>
      <span>${event.user ? escapeHtml(displayUser(event.user)) : "النظام"} / <span data-relative-time="${escapeAttr(event.created_at)}">${relativeTime(event.created_at)}</span></span>
    </article>
  `;
}

function renderMissingCenter() {
  const missingOrders = state.dashboard.missingOrders;
  return `
    <section class="section-heading">
      <div>
        <span class="eyebrow">${icon("package-x")} مركز المنتجات المفقودة</span>
        <h1>بانتظار المخزون</h1>
        <p>${missingOrders.length} طلب تحت متابعة المخزون.</p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-primary" onclick="App.syncNow()">${icon("refresh-cw")} مزامنة الآن</button>
      </div>
    </section>
    ${
      missingOrders.length
        ? `<section class="missing-grid">${missingOrders.map((order) => renderMissingCard(order, true)).join("")}</section>`
        : `<div class="empty-state">لا توجد منتجات مفقودة بانتظار المتابعة الآن.</div>`
    }
  `;
}

function firstMissingItem(order) {
  return order.items.find((item) => item.status === "Missing") || order.items[0] || {};
}

function renderMissingCard(order, full = false) {
  const item = firstMissingItem(order);
  return `
    <article class="missing-card ${full ? "full" : ""}">
      ${imageTag(item.image_url, item.product_name)}
      <div>
        <div class="status-row">${orderBadges(order)}</div>
        <h3>${escapeHtml(order.order_number)} / ${escapeHtml(displayText(item.product_name || "منتج مفقود"))}</h3>
        <p>${escapeHtml(item.sku || "")} / ${escapeHtml(displaySize(item.size) || "")} / الكمية ${escapeHtml(item.quantity || "")}</p>
        <p>${escapeHtml(displayReason(item.missing_reason) || "لم يتم تحديد السبب")}</p>
        <p>أبلغ عنه ${escapeHtml(userName(item.missing_reported_by))} / <span data-relative-time="${escapeAttr(item.missing_reported_at || order.missing_at)}">${relativeTime(item.missing_reported_at || order.missing_at)}</span></p>
        <p>العميل ${escapeHtml(displayText(order.customer_name) || "غير متوفر")}</p>
        <div class="card-actions">
          <button class="btn btn-primary" onclick="App.stockArrived('${escapeAttr(order.id)}')">${icon("package-check")} وصل المخزون</button>
          <button class="btn btn-ghost" onclick="App.returnToQueue('${escapeAttr(order.id)}')">${icon("undo-2")} إرجاع</button>
          <button class="btn btn-ghost" onclick="App.openReassign('${escapeAttr(order.id)}')">${icon("user-cog")} إعادة تخصيص</button>
          <button class="btn btn-ghost" onclick="App.openNote('${escapeAttr(order.id)}')">${icon("notebook-pen")} ملاحظة</button>
          <button class="btn btn-warning" onclick="App.escalate('${escapeAttr(order.id)}')">${icon("triangle-alert")} تصعيد</button>
          <button class="btn btn-ghost" onclick="App.viewOrder('${escapeAttr(order.id)}')">${icon("history")} السجل</button>
        </div>
      </div>
    </article>
  `;
}

function userName(userId) {
  if (state.user?.id === userId) return state.user.name;
  const user = state.dashboard?.workers?.find((worker) => worker.id === userId);
  return displayText(user?.name || "النظام");
}

function renderWorkerMonitoring() {
  const { workers, stuckOrders } = state.dashboard;
  return `
    <section class="section-heading">
      <div>
        <span class="eyebrow">${icon("users")} مراقبة العاملين</span>
        <h1>نشاط العاملين</h1>
        <p>تم رصد ${stuckOrders.length} طلب معرض للتعطل.</p>
      </div>
    </section>
    <section class="worker-grid">
      ${workers.map(renderWorkerCard).join("")}
    </section>
    <section class="admin-section" style="margin-top:16px">
      <h2>إدارة الطلبات المتعثرة</h2>
      <div class="orders-list">
        ${
          stuckOrders.length
            ? stuckOrders.map((order) => renderOrderRow(order, true)).join("")
            : `<div class="empty-state">لا توجد طلبات متعثرة.</div>`
        }
      </div>
    </section>
  `;
}

function renderWorkerCard(worker) {
  const current = worker.current_order;
  return `
    <article class="worker-card">
      <div class="status-row">
        ${badge(worker.status, worker.status === "Idle" ? "warn pulse" : worker.status === "Packing" ? "" : "available")}
      </div>
      <h3>${escapeHtml(displayText(worker.name))}</h3>
      <p>${current ? `${escapeHtml(current.order_number)} / ${escapeHtml(displayStatus(current.status))}` : "لا يوجد طلب مقفل نشط"}</p>
      <div class="timer-card">
        <small>${current ? "قيد التجهيز" : "خامل"}</small>
        <strong ${current ? `data-timer-start="${escapeAttr(current.packing_started_at)}"` : ""}>${formatDuration(current ? current.processing_seconds : worker.idle_seconds)}</strong>
      </div>
      <div class="meta-grid" style="margin-top:14px">
        ${metaTile("منجزة اليوم", worker.orders_completed_today)}
        ${metaTile("المتوسط", formatDuration(worker.average_completion_time))}
        ${metaTile("بلاغات مفقود", worker.missing_reports)}
        ${metaTile("آخر نشاط", relativeTime(worker.last_active_at))}
      </div>
      ${current ? `<div class="card-actions" style="margin-top:14px">
        <button class="btn btn-ghost" onclick="App.viewOrder('${escapeAttr(current.id)}')">${icon("history")} السجل</button>
        <button class="btn btn-warning" onclick="App.unlock('${escapeAttr(current.id)}')">${icon("unlock")} فك القفل</button>
      </div>` : ""}
    </article>
  `;
}

function renderOrdersView() {
  const search = state.orderSearch.trim().toLowerCase();
  const orders = state.dashboard.orders.filter((order) => {
    const haystack = `${order.order_number} ${order.customer_name} ${displayText(order.customer_name)} ${order.status} ${displayStatus(order.status)} ${order.priority} ${displayPriority(order.priority)} ${order.items.map((item) => `${item.sku} ${item.product_name} ${displayText(item.product_name)}`).join(" ")}`.toLowerCase();
    return haystack.includes(search);
  });
  return `
    <section class="section-heading">
      <div>
        <span class="eyebrow">${icon("list-checks")} إدارة حالات الطلبات</span>
        <h1>الطلبات</h1>
        <p>كل طلب مستورد له حالة واضحة وسجل نشاط كامل.</p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-primary" onclick="App.syncNow()">${icon("refresh-cw")} مزامنة الآن</button>
      </div>
    </section>
    <div class="table-tools">
      <input class="input search" id="order-search" placeholder="ابحث برقم الطلب، العميل، SKU، الحالة">
      <button class="btn btn-ghost" onclick="App.loadDashboard()">${icon("rotate-cw")} تحديث</button>
    </div>
    <section class="orders-list">
      ${orders.map((order) => renderOrderRow(order)).join("") || `<div class="empty-state">لا توجد طلبات مطابقة للبحث.</div>`}
    </section>
  `;
}

function renderShippingView() {
  const shipping = state.dashboard.shipping || {};
  const settings = shipping.settings || {};
  const printer = settings.printer || {};
  const credentials = settings.credentials || {};
  const sender = settings.sender || {};
  const metrics = shipping.metrics || {};
  return `
    <section class="section-heading">
      <div>
        <span class="eyebrow">${icon("printer")} الشحن والطباعة التلقائية</span>
        <h1>ربط AJEX التجريبي</h1>
        <p>هذه بيئة اختبار فقط: يتم إنشاء AWB وبوليصة وطباعة mock بدون الاتصال بشركة الشحن أو الطابعة.</p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-primary" onclick="App.testShippingPrint()">${icon("printer-check")} اختبار الطباعة</button>
        <button class="btn btn-ghost" onclick="App.loadDashboard()">${icon("rotate-cw")} تحديث</button>
      </div>
    </section>

    <section class="metric-grid">
      ${metric("مزود الشحن", settings.provider || "AJEX", "truck")}
      ${metric("وضع الربط", settings.mode === "mock" ? "تجريبي" : settings.mode, "plug")}
      ${metric("البوالص المنشأة", metrics.policies_created || 0, "file-text")}
      ${metric("طباعة تجريبية", metrics.printed_mock || 0, "printer")}
    </section>

    <section class="admin-grid">
      <div class="admin-section">
        <h2>إعدادات الربط التجريبية</h2>
        <div class="shipping-form">
          ${settingsField("provider", "شركة الشحن", settings.provider || "AJEX")}
          ${settingsField("api_base_url", "رابط API التجريبي", credentials.api_base_url || "")}
          ${settingsField("account_number", "رقم الحساب", credentials.account_number || "")}
          ${settingsField("printer_name", "اسم الطابعة", printer.name || "")}
          ${settingsField("paper_size", "مقاس الملصق", printer.paper_size || "4x6")}
          ${settingsField("sender_name", "اسم المرسل", sender.name || "")}
          ${settingsField("sender_phone", "هاتف المرسل", sender.phone || "")}
          ${settingsField("sender_city", "مدينة المرسل", sender.city || "")}
          <label class="toggle-row">
            <input type="checkbox" id="ship-auto-policy" ${settings.auto_create_policy ? "checked" : ""}>
            <span>إنشاء بوليصة تلقائيًا عند جاهزية الطلب</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" id="ship-auto-print" ${settings.auto_print_enabled ? "checked" : ""}>
            <span>تسجيل طباعة تلقائية تجريبية بعد إنشاء البوليصة</span>
          </label>
          <button class="btn btn-primary" onclick="App.saveShippingSettings()">${icon("save")} حفظ الإعدادات</button>
        </div>
      </div>
      <div class="admin-section">
        <h2>كود الطابعة الجاهز لاحقًا</h2>
        <div class="code-panel">
          <code>PrinterAdapter.connect()</code>
          <code>PrinterAdapter.printLabel(policy.label_url)</code>
          <code>AJEX.createShipment(payload)</code>
          <code>AJEX.getLabel(awb_number)</code>
        </div>
        <p class="muted">حاليًا كل هذه الدوال mock. عند وصول بيانات AJEX الحقيقية نستبدل adapter فقط ونبقي تدفق الطلب كما هو.</p>
      </div>
    </section>

    <section class="admin-grid">
      <div class="admin-section">
        <h2>آخر البوالص</h2>
        <div class="orders-list">
          ${(shipping.policies || []).slice(0, 12).map(renderPolicyRow).join("") || `<div class="empty-state">لا توجد بوالص بعد.</div>`}
        </div>
      </div>
      <div class="admin-section">
        <h2>سجل الطباعة</h2>
        <div class="timeline">
          ${(shipping.printJobs || []).slice(0, 16).map(renderPrintJob).join("") || `<div class="empty-state">لا توجد محاولات طباعة بعد.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderZidView() {
  const zid = state.dashboard.zid || {};
  const integration = zid.integration || {};
  const dictionary = zid.statusDictionary || {};
  const events = zid.recentWebhookEvents || [];
  return `
    <section class="section-heading">
      <div>
        <span class="eyebrow">${icon("radio-tower")} ربط زد وتفعيل التطبيق</span>
        <h1>مزامنة زد</h1>
        <p>هذه شاشة اختبار لتدفق app activation والـwebhooks وقاموس حالات الطلبات قبل الربط الحقيقي.</p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-primary" onclick="App.simulateZidActivation()">${icon("plug-zap")} تفعيل تجريبي</button>
        <button class="btn btn-ghost" onclick="App.loadDashboard()">${icon("rotate-cw")} تحديث</button>
      </div>
    </section>

    <section class="metric-grid">
      ${metric("حالة التطبيق", integration.app_installed ? "مفعل" : "غير مفعل", "badge-check", integration.app_installed ? "" : "danger")}
      ${metric("إرسال الطلبات", integration.dispatch_orders_active ? "نشط" : "متوقف", "send")}
      ${metric("مزامنة المنتجات", integration.sync_products_active ? "نشطة" : "متوقفة", "package-search")}
      ${metric("آخر Webhook", integration.last_webhook_at ? relativeTime(integration.last_webhook_at) : "لا يوجد", "activity")}
    </section>

    <section class="admin-grid">
      <div class="admin-section">
        <h2>إعدادات زد التجريبية</h2>
        <div class="shipping-form">
          ${settingsField("zid_store_id", "Store ID", integration.store_id || "")}
          ${settingsField("zid_api_base_url", "Merchant API Base URL", integration.api_base_url || "")}
          ${settingsField("zid_webhook_url", "Webhook URL", integration.webhook_url || "")}
          <label class="toggle-row">
            <input type="checkbox" id="zid-dispatch-active" ${integration.dispatch_orders_active ? "checked" : ""}>
            <span>تفعيل استقبال الطلبات وإدخالها لمسار التغليف</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" id="zid-products-active" ${integration.sync_products_active ? "checked" : ""}>
            <span>تفعيل مزامنة المنتجات والصور والمقاسات</span>
          </label>
          <button class="btn btn-primary" onclick="App.saveZidSettings()">${icon("save")} حفظ إعدادات زد</button>
        </div>
      </div>
      <div class="admin-section">
        <h2>Webhooks المطلوبة</h2>
        <div class="code-panel">
          ${(integration.required_webhooks || []).map((name) => `<code>${escapeHtml(name)}</code>`).join("")}
        </div>
      </div>
    </section>

    <section class="admin-grid">
      <div class="admin-section">
        <h2>قاموس حالات زد</h2>
        <div class="orders-list">
          ${Object.entries(dictionary).map(([key, value]) => renderZidStatusRow(key, value)).join("")}
        </div>
      </div>
      <div class="admin-section">
        <h2>آخر أحداث زد</h2>
        <div class="timeline">
          ${events.map((event) => `<article class="timeline-row"><strong>${escapeHtml(event.event_name)}</strong><span>${dateTime(event.created_at)}</span></article>`).join("") || `<div class="empty-state">لا توجد أحداث زد بعد.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderZidStatusRow(key, value) {
  return `
    <article class="order-row">
      <div>
        <h3>${escapeHtml(value.arabic_label)}</h3>
        <p>${escapeHtml(key)} / ${escapeHtml(value.zid_label)}</p>
      </div>
      <div>
        <div class="order-row-meta">
          ${badge(value.local_status)}
          ${badge(value.worker_flow ? "يدخل مسار العامل" : "لا يدخل مسار العامل")}
        </div>
        <p>${escapeHtml(value.operation_assist_action)}</p>
      </div>
      <div><span class="badge">${escapeHtml(value.owner)}</span></div>
    </article>
  `;
}

function settingsField(id, label, value) {
  return `
    <div class="field">
      <label for="ship-${id}">${escapeHtml(label)}</label>
      <input class="input" id="ship-${id}" value="${escapeAttr(value)}">
    </div>
  `;
}

function renderPolicyRow(policy) {
  return `
    <article class="order-row">
      <div>
        <h3>${escapeHtml(policy.order_number)}</h3>
        <p>${escapeHtml(policy.provider)} / ${escapeHtml(policy.mode === "mock" ? "تجريبي" : policy.mode)}</p>
      </div>
      <div>
        <div class="order-row-meta">
          ${badge(policy.status)}
          ${badge(policy.awb_number)}
        </div>
        <p>${escapeHtml(policy.tracking_number)} / ${dateTime(policy.created_at)}</p>
      </div>
      <div class="order-actions">
        <button class="btn btn-ghost" onclick="App.previewPolicy('${escapeAttr(policy.id)}')">${icon("eye")} معاينة</button>
      </div>
    </article>
  `;
}

function renderPrintJob(job) {
  return `
    <article class="timeline-row">
      <strong>${escapeHtml(job.order_number)} / ${escapeHtml(job.status === "Printed Mock" ? "تمت الطباعة التجريبية" : job.status)}</strong>
      <span>${escapeHtml(job.printer_name)} / ${escapeHtml(job.connection)}</span>
      <span>${escapeHtml(job.message)} / ${dateTime(job.requested_at)}</span>
    </article>
  `;
}

function renderOrderRow(order, management = false) {
  return `
    <article class="order-row">
      <div>
        <h3>${escapeHtml(order.order_number)}</h3>
        <p>${escapeHtml(displayText(order.customer_name) || "لا يوجد عميل")}</p>
      </div>
      <div>
        <div class="order-row-meta">${orderBadges(order)}</div>
        <p>${escapeHtml(order.items.map((item) => `${item.sku} ${displaySize(item.size)} × ${item.quantity}`).join(" / "))}</p>
      </div>
      <div class="order-actions">
        <button class="btn btn-ghost" onclick="App.viewOrder('${escapeAttr(order.id)}')">${icon("history")} السجل</button>
        ${management || order.potentially_stuck ? `<button class="btn btn-warning" onclick="App.unlock('${escapeAttr(order.id)}')">${icon("unlock")} فك القفل</button>` : ""}
        <button class="btn btn-ghost" onclick="App.openReassign('${escapeAttr(order.id)}')">${icon("user-cog")} إعادة تخصيص</button>
        <button class="btn btn-ghost" onclick="App.openNote('${escapeAttr(order.id)}')">${icon("notebook-pen")} ملاحظة</button>
        ${order.delayed ? `<button class="btn btn-warning" onclick="App.escalate('${escapeAttr(order.id)}')">${icon("triangle-alert")} تصعيد</button>` : ""}
      </div>
    </article>
  `;
}

async function syncNow() {
  try {
    const data = await api("/api/admin/sync", { method: "POST" });
    toast("اكتملت مزامنة زد", `تم استيراد ${data.imported.length} طلب تجريبي`);
    await loadDashboard();
  } catch (error) {
    toast("فشلت المزامنة", error.message);
  }
}

async function adminPost(path, title, message = "") {
  try {
    await api(path, { method: "POST" });
    toast(title, message);
    await loadDashboard();
  } catch (error) {
    toast(`فشل: ${title}`, error.message);
  }
}

async function saveShippingSettings() {
  const body = {
    provider: document.getElementById("ship-provider")?.value || "AJEX",
    auto_create_policy: Boolean(document.getElementById("ship-auto-policy")?.checked),
    auto_print_enabled: Boolean(document.getElementById("ship-auto-print")?.checked),
    credentials: {
      api_base_url: document.getElementById("ship-api_base_url")?.value || "",
      account_number: document.getElementById("ship-account_number")?.value || ""
    },
    printer: {
      name: document.getElementById("ship-printer_name")?.value || "Operation Assist Label Printer",
      paper_size: document.getElementById("ship-paper_size")?.value || "4x6",
      connection: "mock"
    },
    sender: {
      name: document.getElementById("ship-sender_name")?.value || "",
      phone: document.getElementById("ship-sender_phone")?.value || "",
      city: document.getElementById("ship-sender_city")?.value || ""
    }
  };
  try {
    const shipping = await api("/api/admin/shipping/settings", {
      method: "POST",
      body
    });
    state.dashboard.shipping = shipping;
    toast("تم حفظ إعدادات الشحن", "الإعدادات تجريبية ولن تتصل بأي خدمة خارجية.");
    renderAdmin();
  } catch (error) {
    toast("تعذر حفظ إعدادات الشحن", error.message);
  }
}

async function testShippingPrint() {
  try {
    const shipping = await api("/api/admin/shipping/test-print", { method: "POST" });
    state.dashboard.shipping = shipping;
    toast("تم اختبار الطباعة", "تم إنشاء بوليصة وطباعة mock بدون استخدام طابعة فعلية.");
    renderAdmin();
  } catch (error) {
    toast("فشل اختبار الطباعة", error.message);
  }
}

async function saveZidSettings() {
  try {
    const zid = await api("/api/admin/zid/settings", {
      method: "POST",
      body: {
        store_id: document.getElementById("ship-zid_store_id")?.value || "mock-store",
        api_base_url: document.getElementById("ship-zid_api_base_url")?.value || "",
        webhook_url: document.getElementById("ship-zid_webhook_url")?.value || "",
        dispatch_orders_active: Boolean(document.getElementById("zid-dispatch-active")?.checked),
        sync_products_active: Boolean(document.getElementById("zid-products-active")?.checked)
      }
    });
    state.dashboard.zid = zid;
    toast("تم حفظ إعدادات زد", "الإعدادات محفوظة في وضع الاختبار.");
    renderAdmin();
  } catch (error) {
    toast("تعذر حفظ إعدادات زد", error.message);
  }
}

async function simulateZidActivation() {
  try {
    const storeId =
      document.getElementById("ship-zid_store_id")?.value ||
      state.dashboard?.zid?.integration?.store_id ||
      "mock-store";
    const zid = await api("/api/admin/zid/simulate-activation", {
      method: "POST",
      body: { storeId }
    });
    state.dashboard.zid = zid;
    toast("تم تفعيل زد تجريبياً", "تم تسجيل install و dispatch_orders و sync_product.");
    renderAdmin();
  } catch (error) {
    toast("تعذر تفعيل زد", error.message);
  }
}

function previewPolicy(policyId) {
  const policy = state.dashboard?.shipping?.policies?.find((item) => item.id === policyId);
  if (!policy?.label_url) {
    toast("لا توجد معاينة", "لم يتم إنشاء رابط بوليصة لهذا السجل.");
    return;
  }
  openModal(`
    <section class="modal-card wide">
      <span class="eyebrow">${icon("file-text")} معاينة بوليصة تجريبية</span>
      <h2>${escapeHtml(policy.awb_number)}</h2>
      <iframe class="label-frame" src="${escapeAttr(policy.label_url)}" title="Shipping label preview"></iframe>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="window.open('${escapeAttr(policy.label_url)}', '_blank')">${icon("external-link")} فتح في نافذة</button>
        <button class="btn btn-ghost" onclick="App.closeModal()">إغلاق</button>
      </div>
    </section>
  `);
}

function stockArrived(orderId) {
  adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/stock-arrived`, "وصل المخزون", "تمت إعادة الطلب إلى قائمة الانتظار");
}

function returnToQueue(orderId) {
  adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/return-to-queue`, "أعيد إلى قائمة الانتظار");
}

function unlock(orderId) {
  adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/unlock`, "تم فك قفل الطلب", "يمكن للتخصيص التلقائي استعادته");
}

function escalate(orderId) {
  adminPost(`/api/admin/orders/${encodeURIComponent(orderId)}/escalate`, "تم تصعيد الطلب", "تم رفع الأولوية إلى حرج");
}

function openReassign(orderId) {
  const workers = state.dashboard.workers;
  openModal(`
    <section class="modal-card">
      <span class="eyebrow">${icon("user-cog")} إعادة تخصيص الطلب</span>
      <h2>اختر العامل</h2>
      <div class="field">
        <label for="reassign-worker">العامل</label>
        <select class="select" id="reassign-worker">
          ${workers.map((worker) => `<option value="${escapeAttr(worker.id)}">${escapeHtml(displayText(worker.name))} / ${escapeHtml(displayStatus(worker.status))}</option>`).join("")}
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="App.submitReassign('${escapeAttr(orderId)}')">${icon("send")} إعادة تخصيص</button>
      </div>
    </section>
  `);
}

async function submitReassign(orderId) {
  const workerId = modalRoot.querySelector("#reassign-worker")?.value;
  try {
    await api(`/api/admin/orders/${encodeURIComponent(orderId)}/reassign`, {
      method: "POST",
      body: { workerId }
    });
    closeModal();
    toast("تمت إعادة تخصيص الطلب");
    await loadDashboard();
  } catch (error) {
    toast("فشلت إعادة التخصيص", error.message);
  }
}

function openNote(orderId) {
  openModal(`
    <section class="modal-card">
      <span class="eyebrow">${icon("notebook-pen")} ملاحظة داخلية</span>
      <h2>إضافة ملاحظة</h2>
      <div class="field">
        <label for="admin-note">الملاحظة</label>
        <textarea class="textarea" id="admin-note" placeholder="إجراء المستودع، سياق العميل، أو تفاصيل التصعيد"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="App.submitNote('${escapeAttr(orderId)}')">${icon("send")} حفظ الملاحظة</button>
      </div>
    </section>
  `);
}

async function submitNote(orderId) {
  const note = modalRoot.querySelector("#admin-note")?.value || "";
  try {
    await api(`/api/admin/orders/${encodeURIComponent(orderId)}/note`, {
      method: "POST",
      body: { note }
    });
    closeModal();
    toast("تم حفظ الملاحظة");
    await loadDashboard();
  } catch (error) {
    toast("تعذر حفظ الملاحظة", error.message);
  }
}

async function viewOrder(orderId) {
  try {
    const data = await api(`/api/admin/orders/${encodeURIComponent(orderId)}`);
    const order = data.order;
    const first = order.items[0] || {};
    openModal(`
      <section class="modal-card wide">
        <span class="eyebrow">${icon("history")} ${escapeHtml(order.order_number)}</span>
        <h2>${escapeHtml(displayStatus(order.status))} ${order.status_tag ? `/ ${escapeHtml(displayStatus(order.status_tag))}` : ""}</h2>
        <div class="order-detail-grid">
          <div>
            ${imageTag(first.image_url, first.product_name, "detail-cover")}
            <div class="status-row">${orderBadges(order)}</div>
            <div class="meta-grid" style="margin-top:14px">
              ${metaTile("العميل", displayText(order.customer_name) || "غير متوفر")}
              ${metaTile("الهاتف", order.customer_phone || "غير متوفر")}
              ${metaTile("مخصص إلى", displayUser(order.assigned_worker) || "لا أحد")}
              ${metaTile("تاريخ الاستيراد", dateTime(order.imported_at))}
            </div>
            <div class="item-list" style="margin-top:14px">
              ${order.items.map(renderWorkerItem).join("")}
            </div>
          </div>
          <div>
            <h3>السجل الزمني</h3>
            <div class="timeline">
              ${order.events.map(renderTimelineEvent).join("")}
            </div>
            <h3 style="margin-top:18px">الملاحظات الداخلية</h3>
            <div class="timeline">
              ${
                order.internal_notes?.length
                  ? order.internal_notes
                      .slice()
                      .reverse()
                      .map((note) => `<article class="timeline-row"><strong>${escapeHtml(userName(note.user_id))}</strong><span>${escapeHtml(note.note)}</span><span>${dateTime(note.created_at)}</span></article>`)
                      .join("")
                  : `<div class="empty-state">لا توجد ملاحظات داخلية.</div>`
              }
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="App.openNote('${escapeAttr(order.id)}')">${icon("notebook-pen")} ملاحظة</button>
          <button class="btn btn-ghost" onclick="App.openReassign('${escapeAttr(order.id)}')">${icon("user-cog")} إعادة تخصيص</button>
          <button class="btn btn-ghost" onclick="App.closeModal()">إغلاق</button>
        </div>
      </section>
    `);
  } catch (error) {
    toast("تعذر عرض تفاصيل الطلب", error.message);
  }
}

async function bootstrap() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  state.workerOrder = null;
  state.dashboard = null;
  stopPolling();
  renderLogin();
}

window.App = {
  login,
  closeModal,
  logout,
  loadWorkerOrder,
  confirmReady,
  submitReady,
  openMissingFlow,
  submitMissing,
  setAdminView,
  loadDashboard,
  syncNow,
  saveShippingSettings,
  testShippingPrint,
  saveZidSettings,
  simulateZidActivation,
  previewPolicy,
  stockArrived,
  returnToQueue,
  unlock,
  escalate,
  openReassign,
  submitReassign,
  openNote,
  submitNote,
  viewOrder
};

document.addEventListener("click", (event) => {
  const target = event.target.closest?.('[data-action="login"]');
  if (!target) return;
  login(event);
});

document.addEventListener("click", (event) => {
  const target = event.target.closest?.("[data-admin-view]");
  if (!target) return;
  event.preventDefault();
  setAdminView(target.dataset.adminView);
});

bootstrap();
