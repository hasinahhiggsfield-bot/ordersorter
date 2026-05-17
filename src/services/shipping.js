function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function defaultShippingSettings() {
  return {
    provider: "AJEX",
    mode: "mock",
    auto_create_policy: true,
    auto_print_enabled: true,
    printer: {
      name: "Operation Assist Label Printer",
      type: "thermal_4x6",
      connection: "mock",
      paper_size: "4x6",
      dpi: 203
    },
    credentials: {
      account_number: "AJEX-DEMO-001",
      api_base_url: "https://sandbox-api.aj-ex.com",
      client_id: "demo-client-id",
      client_secret_saved: false
    },
    sender: {
      name: "Hasinah Dresses Warehouse",
      phone: "0500000000",
      city: "Riyadh",
      address: "Main warehouse, Riyadh"
    },
    updated_at: nowIso()
  };
}

function ensureShippingData(db) {
  if (!db.shippingSettings) db.shippingSettings = defaultShippingSettings();
  if (!Array.isArray(db.shippingPolicies)) db.shippingPolicies = [];
  if (!Array.isArray(db.printJobs)) db.printJobs = [];
  return db.shippingSettings;
}

function addEvent(db, orderId, userId, eventType, message) {
  db.orderEvents.push({
    id: uid("evt"),
    order_id: orderId,
    user_id: userId || null,
    event_type: eventType,
    message,
    created_at: nowIso()
  });
}

function orderItems(db, orderId) {
  return db.orderItems.filter((item) => item.order_id === orderId);
}

function labelHtml(order, items, policy, settings) {
  const rows = items
    .map((item) => `<tr><td>${item.sku}</td><td>${item.size}</td><td>${item.quantity}</td></tr>`)
    .join("");
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${policy.awb_number}</title>
  <style>
    body{font-family:Arial,Tahoma,sans-serif;margin:0;background:#fff;color:#111}
    .label{width:384px;min-height:576px;padding:18px;border:2px solid #111;box-sizing:border-box}
    .top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:12px}
    h1{font-size:28px;margin:0}.awb{font-size:18px;font-weight:700;margin-top:8px}
    .barcode{height:72px;margin:16px 0;background:repeating-linear-gradient(90deg,#111 0 3px,#fff 3px 7px,#111 7px 9px,#fff 9px 14px)}
    .block{border:1px solid #111;margin-top:12px;padding:10px}.block strong{display:block;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}td,th{border:1px solid #111;padding:5px}
    .footer{margin-top:12px;font-size:12px;text-align:center}
  </style>
</head>
<body>
  <main class="label">
    <div class="top"><h1>${settings.provider}</h1><div>${settings.mode.toUpperCase()}</div></div>
    <div class="awb">${policy.awb_number}</div>
    <div class="barcode"></div>
    <div class="block"><strong>الطلب</strong>${order.order_number}</div>
    <div class="block"><strong>المستلم</strong>${order.customer_name}<br>${order.customer_phone || ""}<br>${order.shipping_city || ""}</div>
    <div class="block"><strong>المرسل</strong>${settings.sender.name}<br>${settings.sender.phone}<br>${settings.sender.city}</div>
    <table><thead><tr><th>SKU</th><th>المقاس</th><th>الكمية</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">بوليصة تجريبية غير متصلة بشركة الشحن</div>
  </main>
</body>
</html>`;
}

function makeLabelDataUrl(order, items, policy, settings) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(labelHtml(order, items, policy, settings))}`;
}

function createPrintJob(db, policy, order, actorId, source = "auto") {
  const settings = ensureShippingData(db);
  const job = {
    id: uid("print"),
    policy_id: policy.id,
    order_id: order.id,
    order_number: order.order_number,
    printer_name: settings.printer.name,
    printer_type: settings.printer.type,
    connection: settings.printer.connection,
    status: settings.auto_print_enabled ? "Printed Mock" : "Queued",
    source,
    attempts: settings.auto_print_enabled ? 1 : 0,
    requested_by: actorId || null,
    requested_at: nowIso(),
    printed_at: settings.auto_print_enabled ? nowIso() : null,
    message: settings.auto_print_enabled
      ? "Mock auto-print completed. No physical printer was contacted."
      : "Auto-print is disabled. Job is queued for manual test printing."
  };
  db.printJobs.unshift(job);
  addEvent(db, order.id, actorId, "Auto print", `${job.status}: ${job.printer_name}.`);
  return job;
}

function createShipmentPolicy(db, order, actorId = null, options = {}) {
  const settings = ensureShippingData(db);
  const existing = db.shippingPolicies.find((policy) => policy.order_id === order.id && policy.status !== "Cancelled");
  if (existing && !options.force) {
    const printJob = options.autoPrint ? createPrintJob(db, existing, order, actorId, "reprint") : null;
    return { policy: existing, printJob, reused: true };
  }

  const items = orderItems(db, order.id);
  const number = order.order_number.replace(/[^\d]/g, "");
  const policy = {
    id: uid("pol"),
    order_id: order.id,
    order_number: order.order_number,
    provider: settings.provider,
    mode: settings.mode,
    awb_number: `AJX-MOCK-${number}-${Date.now().toString(36).toUpperCase()}`,
    tracking_number: `AJX${number}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: "Created Mock",
    label_format: settings.printer.paper_size,
    label_url: "",
    payload_preview: {
      sender: settings.sender,
      receiver: {
        name: order.customer_name,
        phone: order.customer_phone,
        city: order.shipping_city,
        address: order.shipping_address || "Imported from Zid"
      },
      pieces: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
      reference: order.order_number,
      service: "DOMESTIC_STANDARD"
    },
    created_by: actorId || null,
    created_at: nowIso()
  };
  policy.label_url = makeLabelDataUrl(order, items, policy, settings);
  db.shippingPolicies.unshift(policy);
  order.label = {
    ...(order.label || {}),
    label_id: policy.awb_number,
    carrier: settings.provider,
    tracking_number: policy.tracking_number,
    generated_at: policy.created_at,
    mock_policy_id: policy.id
  };
  addEvent(db, order.id, actorId, "Shipping policy created", `${settings.provider} mock AWB ${policy.awb_number} created.`);
  const printJob = options.autoPrint ? createPrintJob(db, policy, order, actorId, "auto") : null;
  return { policy, printJob, reused: false };
}

function getShippingSummary(db) {
  const settings = ensureShippingData(db);
  return {
    settings,
    policies: db.shippingPolicies.slice(0, 50),
    printJobs: db.printJobs.slice(0, 50),
    metrics: {
      policies_created: db.shippingPolicies.length,
      printed_mock: db.printJobs.filter((job) => job.status === "Printed Mock").length,
      queued_prints: db.printJobs.filter((job) => job.status === "Queued").length,
      failed_prints: db.printJobs.filter((job) => job.status === "Failed").length
    }
  };
}

function updateShippingSettings(db, patch, actorId = null) {
  const current = ensureShippingData(db);
  const next = {
    ...current,
    ...patch,
    printer: {
      ...current.printer,
      ...(patch.printer || {})
    },
    credentials: {
      ...current.credentials,
      ...(patch.credentials || {})
    },
    sender: {
      ...current.sender,
      ...(patch.sender || {})
    },
    updated_at: nowIso(),
    updated_by: actorId || null
  };
  db.shippingSettings = next;
  return getShippingSummary(db);
}

function testPrint(db, actorId = null) {
  const settings = ensureShippingData(db);
  const order = db.orders[0];
  if (!order) {
    const error = new Error("No order is available for test print.");
    error.status = 400;
    throw error;
  }
  const result = createShipmentPolicy(db, order, actorId, { autoPrint: true, force: true });
  result.printJob.source = "test";
  result.printJob.message = `Test print sent to ${settings.printer.name}. Mock only; no physical printer was contacted.`;
  return {
    ...getShippingSummary(db),
    lastPolicy: result.policy,
    lastPrintJob: result.printJob
  };
}

module.exports = {
  ensureShippingData,
  createShipmentPolicy,
  getShippingSummary,
  updateShippingSettings,
  testPrint
};
