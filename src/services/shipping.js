const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

const AJEX_BASE_URLS = {
  stage: "https://api-aone-mw-stage.aj-ex.com",
  production: "https://api-aone-mw.aj-ex.com"
};

const AJEX_STATUS_DICTIONARY = {
  "100": { label: "Consignment Created", local_status: "Label Printed", action: "تم إنشاء الشحنة في AJEX." },
  "102": { label: "Consignment Canceled", local_status: "Cancelled", action: "تم إلغاء الشحنة في AJEX." },
  picked_up: { label: "Picked Up", local_status: "Shipped", action: "تم استلام الشحنة من شركة الشحن." },
  out_for_delivery: { label: "Out For Delivery", local_status: "Shipped", action: "الشحنة خرجت للتسليم." },
  delivered: { label: "Delivered", local_status: "Shipped", action: "تم تسليم الشحنة للعميل." },
  exception: { label: "Exception", local_status: "Escalated", action: "تحتاج متابعة من الإدارة." }
};

function deepMerge(base, value) {
  const result = { ...base };
  for (const [key, item] of Object.entries(value || {})) {
    if (item && typeof item === "object" && !Array.isArray(item) && base[key] && typeof base[key] === "object") {
      result[key] = deepMerge(base[key], item);
    } else if (item !== undefined) {
      result[key] = item;
    }
  }
  return result;
}

function defaultShippingSettings() {
  const mode = process.env.AJEX_MODE || "mock";
  const baseUrl = process.env.AJEX_API_BASE_URL || AJEX_BASE_URLS[mode] || AJEX_BASE_URLS.stage;
  return {
    provider: "AJEX",
    mode,
    auto_create_policy: true,
    auto_print_enabled: true,
    live_create_enabled: false,
    printer: {
      name: process.env.PRINTER_NAME || "Operation Assist Label Printer",
      type: "thermal_4x6",
      connection: process.env.PRINTER_CONNECTION || "windows_default",
      bridge_url: process.env.PRINTER_BRIDGE_URL || "",
      paper_size: "4x6",
      dpi: 203
    },
    credentials: {
      api_base_url: baseUrl,
      client_id: process.env.AJEX_CLIENT_ID || "",
      client_secret_saved: Boolean(process.env.AJEX_CLIENT_SECRET),
      account_number: process.env.AJEX_CUSTOMER_ACCOUNT || process.env.AJEX_ACCOUNT_NUMBER || "",
      product_code: process.env.AJEX_PRODUCT_CODE || "AJEX DCE"
    },
    service: {
      pickup_method: process.env.AJEX_PICKUP_METHOD || "COURIER_PICKUP",
      content_type: process.env.AJEX_CONTENT_TYPE || "NON_DOCUMENT",
      label_format: process.env.AJEX_LABEL_FORMAT || "PDF",
      declared_value_currency: "SAR",
      cod: false,
      incoterms: "DDP"
    },
    sender: {
      name: process.env.AJEX_PICKUP_NAME || "Hasinah Dresses Warehouse",
      phone: process.env.AJEX_PICKUP_PHONE || "0500000000",
      country: process.env.AJEX_PICKUP_COUNTRY || "Saudi Arabia",
      country_code: process.env.AJEX_PICKUP_COUNTRY_CODE || "KSA",
      city: process.env.AJEX_PICKUP_CITY || "Riyadh",
      region: process.env.AJEX_PICKUP_REGION || "Riyadh",
      district: process.env.AJEX_PICKUP_DISTRICT || "Warehouse District",
      address_line1: process.env.AJEX_PICKUP_ADDRESS1 || "Main warehouse, Riyadh",
      address_line2: process.env.AJEX_PICKUP_ADDRESS2 || "",
      postal_code: process.env.AJEX_PICKUP_POSTAL_CODE || "",
      short_address: process.env.AJEX_PICKUP_SHORT_ADDRESS || ""
    },
    package_defaults: {
      weight: Number(process.env.AJEX_DEFAULT_WEIGHT || 1),
      weight_unit: "KG",
      dimension_unit: "CM",
      height: Number(process.env.AJEX_DEFAULT_HEIGHT || 10),
      width: Number(process.env.AJEX_DEFAULT_WIDTH || 25),
      length: Number(process.env.AJEX_DEFAULT_LENGTH || 35)
    },
    updated_at: nowIso()
  };
}

function ensureShippingData(db) {
  db.shippingSettings = deepMerge(defaultShippingSettings(), db.shippingSettings || {});
  if (db.shippingSettings.credentials?.api_base_url === "https://sandbox-api.aj-ex.com") {
    db.shippingSettings.credentials.api_base_url = AJEX_BASE_URLS.stage;
  }
  if (!Array.isArray(db.shippingPolicies)) db.shippingPolicies = [];
  if (!Array.isArray(db.printJobs)) db.printJobs = [];
  if (!db.ajexTokenCache) db.ajexTokenCache = null;
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

function getBaseUrl(settings) {
  return settings.credentials.api_base_url || AJEX_BASE_URLS[settings.mode] || AJEX_BASE_URLS.stage;
}

function buildAjexAddress(source, fallbackName) {
  return {
    name: source.name || fallbackName || "Operation Assist",
    phone: source.phone || "0500000000",
    alternatePhone: source.alternate_phone || "",
    country: source.country || "Saudi Arabia",
    countryCode: source.country_code || "KSA",
    city: source.city || "Riyadh",
    region: source.region || source.city || "Riyadh",
    district: source.district || "Imported from Zid",
    postalCode: source.postal_code || "",
    addressLine1: source.address_line1 || source.address || "Imported from Zid",
    addressLine2: source.address_line2 || "",
    email: source.email || "",
    shortAddress: source.short_address || "",
    addressType: source.address_type || "FREE_TEXT"
  };
}

function itemValue(item) {
  return Number(item.unit_price || item.price || 150) || 150;
}

function buildAjexPayload(order, items, settings) {
  const packageDefaults = settings.package_defaults || {};
  const pieces = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const declaredValue = items.reduce((total, item) => total + itemValue(item) * Number(item.quantity || 0), 0);
  const referenceNumber = String(order.zid_order_id || order.order_number || order.id).replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 40);
  return {
    referenceNumber,
    customerAccount: settings.credentials.account_number,
    productCode: settings.credentials.product_code || "AJEX DCE",
    pickupMethod: settings.service.pickup_method || "COURIER_PICKUP",
    contentType: settings.service.content_type || "NON_DOCUMENT",
    declaredValue: Number(declaredValue.toFixed(2)),
    declaredValueCurrency: settings.service.declared_value_currency || "SAR",
    cod: Boolean(settings.service.cod),
    codAmount: settings.service.cod ? declaredValue : 0,
    incoterms: settings.service.incoterms || "DDP",
    insured: false,
    labelFormat: settings.service.label_format || "PDF",
    pickupAddress: buildAjexAddress(settings.sender || {}, settings.sender?.name),
    deliveryAddress: buildAjexAddress(
      {
        name: order.customer_name,
        phone: order.customer_phone,
        city: order.shipping_city,
        region: order.shipping_region || order.shipping_city,
        district: order.shipping_district,
        address_line1: order.shipping_address,
        short_address: order.shipping_short_address,
        email: order.customer_email
      },
      order.customer_name
    ),
    packages: [
      {
        sequence: 1,
        weight: Number(packageDefaults.weight || 1),
        weightUnit: packageDefaults.weight_unit || "KG",
        dimensionUnit: packageDefaults.dimension_unit || "CM",
        height: Number(packageDefaults.height || 10),
        width: Number(packageDefaults.width || 25),
        length: Number(packageDefaults.length || 35),
        referenceNumber
      }
    ],
    items: items.map((item) => ({
      description: item.product_name,
      quantity: Number(item.quantity || 1),
      unitPrice: itemValue(item),
      currency: settings.service.declared_value_currency || "SAR",
      sku: item.sku,
      packageSequence: 1,
      imageUrl: item.image_url || ""
    })),
    customFields: {
      invoiceNumber: order.order_number,
      invoiceDate: order.created_at || order.imported_at || nowIso()
    },
    operationAssist: {
      order_id: order.id,
      order_number: order.order_number,
      item_count: pieces
    }
  };
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

function ensurePrintDirectory() {
  const dir = path.join(os.tmpdir(), "operation-assist-labels");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeLabelFile(order, items, policy, settings) {
  const safeNumber = String(order.order_number || policy.awb_number).replace(/[^a-zA-Z0-9-_]/g, "");
  const filePath = path.join(ensurePrintDirectory(), `${safeNumber}-${policy.id}.html`);
  fs.writeFileSync(filePath, labelHtml(order, items, policy, settings), "utf8");
  return filePath;
}

function sendToWindowsPrinter(filePath, printerName = "") {
  const escapedFile = filePath.replace(/'/g, "''");
  const escapedPrinter = String(printerName || "").replace(/'/g, "''");
  const printCommand = escapedPrinter
    ? `Start-Process -FilePath '${escapedFile}' -Verb PrintTo -ArgumentList '${escapedPrinter}' -WindowStyle Hidden`
    : `Start-Process -FilePath '${escapedFile}' -Verb Print -WindowStyle Hidden`;
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", printCommand],
    { windowsHide: true, detached: true, stdio: "ignore" }
  );
  child.unref();
}

function dispatchPrint(settings, order, items, policy) {
  if (!settings.auto_print_enabled) {
    return {
      status: "Queued",
      attempts: 0,
      printed_at: null,
      message: "Auto-print is disabled. Job is queued for manual test printing."
    };
  }

  if (settings.printer.connection === "mock") {
    return {
      status: "Printed Mock",
      attempts: 1,
      printed_at: nowIso(),
      message: "Mock auto-print completed. No physical printer was contacted."
    };
  }

  const label_file = writeLabelFile(order, items, policy, settings);

  if (settings.printer.connection === "windows_default") {
    sendToWindowsPrinter(label_file);
    return {
      status: "Sent To Windows Printer",
      attempts: 1,
      printed_at: nowIso(),
      label_file,
      message: "Print command sent to the Windows default printer. Make sure the label printer is set as the default printer."
    };
  }

  if (settings.printer.connection === "windows_named") {
    sendToWindowsPrinter(label_file, settings.printer.name);
    return {
      status: "Sent To Named Printer",
      attempts: 1,
      printed_at: nowIso(),
      label_file,
      message: `Print command sent to ${settings.printer.name}.`
    };
  }

  return {
    status: "Queued",
    attempts: 0,
    printed_at: null,
    label_file,
    message: "Printer connection is not supported yet. Use windows_default, windows_named, or mock."
  };
}

function requireAjexLiveSettings(settings) {
  const missing = [];
  if (!settings.credentials.client_id) missing.push("AJEX_CLIENT_ID / clientId");
  if (!process.env.AJEX_CLIENT_SECRET) missing.push("AJEX_CLIENT_SECRET / clientSecret");
  if (!settings.credentials.account_number) missing.push("AJEX_CUSTOMER_ACCOUNT / customerAccount");
  if (!settings.credentials.product_code) missing.push("AJEX_PRODUCT_CODE / productCode");
  if (!settings.sender.name) missing.push("pickup sender name");
  if (!settings.sender.phone) missing.push("pickup sender phone");
  if (!settings.sender.city) missing.push("pickup city");
  if (!settings.sender.region) missing.push("pickup region");
  if (!settings.sender.district) missing.push("pickup district");
  if (!settings.sender.address_line1) missing.push("pickup addressLine1");
  if (missing.length) {
    const error = new Error(`AJEX live connection is missing: ${missing.join(", ")}.`);
    error.status = 400;
    throw error;
  }
}

async function getAjexAccessToken(db, settings) {
  const cached = db.ajexTokenCache;
  if (cached?.access_token && cached?.expires_at && new Date(cached.expires_at).getTime() > Date.now() + 30000) {
    return cached.access_token;
  }
  const tokenResponse = await requestAjexToken(settings, process.env.AJEX_CLIENT_SECRET);
  const token = tokenResponse.access_token || tokenResponse.data?.access_token;
  if (!token) {
    const error = new Error("AJEX did not return an access_token.");
    error.status = 502;
    error.ajex = tokenResponse;
    throw error;
  }
  const expiresInSeconds = Number(tokenResponse.expires_in || tokenResponse.data?.expires_in || 300);
  db.ajexTokenCache = {
    access_token: token,
    token_type: tokenResponse.token_type || tokenResponse.data?.token_type || "Bearer",
    expires_at: new Date(Date.now() + Math.max(60, expiresInSeconds - 30) * 1000).toISOString(),
    received_at: nowIso()
  };
  return token;
}

function createPrintJob(db, policy, order, actorId, source = "auto") {
  const settings = ensureShippingData(db);
  const items = orderItems(db, order.id);
  const printResult = dispatchPrint(settings, order, items, policy);
  const job = {
    id: uid("print"),
    policy_id: policy.id,
    order_id: order.id,
    order_number: order.order_number,
    printer_name: settings.printer.name,
    printer_type: settings.printer.type,
    connection: settings.printer.connection,
    status: printResult.status,
    source,
    attempts: printResult.attempts,
    requested_by: actorId || null,
    requested_at: nowIso(),
    printed_at: printResult.printed_at,
    label_url: policy.label_url,
    label_file: printResult.label_file || null,
    message: printResult.message
  };
  db.printJobs.unshift(job);
  addEvent(db, order.id, actorId, "Auto print", `${job.status}: ${job.printer_name}.`);
  return job;
}

async function createShipmentPolicy(db, order, actorId = null, options = {}) {
  const settings = ensureShippingData(db);
  const existing = db.shippingPolicies.find((policy) => policy.order_id === order.id && policy.status !== "Cancelled");
  if (existing && !options.force) {
    const printJob = options.autoPrint ? createPrintJob(db, existing, order, actorId, "reprint") : null;
    return { policy: existing, printJob, reused: true };
  }

  const items = orderItems(db, order.id);
  const number = order.order_number.replace(/[^\d]/g, "");
  const ajexPayload = buildAjexPayload(order, items, settings);
  const liveReady = settings.mode !== "mock" && settings.live_create_enabled;
  let ajexResponse = null;
  let ajexData = null;
  if (liveReady) {
    requireAjexLiveSettings(settings);
    const accessToken = await getAjexAccessToken(db, settings);
    ajexResponse = await createAjexOrder(settings, ajexPayload, accessToken);
    ajexData = ajexResponse.data || ajexResponse;
  }
  const policy = {
    id: uid("pol"),
    order_id: order.id,
    order_number: order.order_number,
    provider: settings.provider,
    mode: settings.mode,
    awb_number: liveReady ? ajexData.trackingId || ajexData.referenceNumber || `AJEX-${number}` : `AJX-MOCK-${number}-${Date.now().toString(36).toUpperCase()}`,
    tracking_number: liveReady ? ajexData.trackingId || "" : `AJX${number}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: liveReady ? "Created In AJEX" : "Created Mock",
    label_format: settings.service.label_format || settings.printer.paper_size,
    label_url: "",
    api_endpoints: {
      auth: `${getBaseUrl(settings)}/auth/api/v1/token`,
      create_order: `${getBaseUrl(settings)}/mwo/api/v1/orders`,
      print_order: `${getBaseUrl(settings)}/mwo/api/v1/print/{trackingId}`,
      tracking: `${getBaseUrl(settings)}/mwt/api/v1/tracking/{trackingId}`,
      cancel: `${getBaseUrl(settings)}/mwo/api/v1/orders/cancel`
    },
    ajex_response: ajexResponse,
    payload_preview: ajexPayload,
    created_by: actorId || null,
    created_at: nowIso()
  };
  policy.label_url = liveReady && ajexData.waybillFileUrl ? ajexData.waybillFileUrl : makeLabelDataUrl(order, items, policy, settings);
  db.shippingPolicies.unshift(policy);
  order.label = {
    ...(order.label || {}),
    label_id: policy.awb_number,
    carrier: settings.provider,
    tracking_number: policy.tracking_number,
    generated_at: policy.created_at,
    mock_policy_id: policy.id
  };
  const eventMessage = liveReady
    ? `${settings.provider} live shipment created in AJEX with tracking ${policy.tracking_number || policy.awb_number}.`
    : `${settings.provider} mock AWB ${policy.awb_number} created.`;
  addEvent(db, order.id, actorId, "Shipping policy created", eventMessage);
  const printJob = options.autoPrint ? createPrintJob(db, policy, order, actorId, "auto") : null;
  return { policy, printJob, reused: false };
}

function getShippingSummary(db) {
  const settings = ensureShippingData(db);
  return {
    settings,
    policies: db.shippingPolicies.slice(0, 50),
    printJobs: db.printJobs.slice(0, 50),
    ajex: {
      base_urls: AJEX_BASE_URLS,
      status_dictionary: AJEX_STATUS_DICTIONARY,
      required_credentials: [
        "clientId",
        "clientSecret",
        "customerAccount",
        "productCode",
        "pickupAddress",
        "defaultPackage"
      ],
      live_ready:
        settings.mode !== "mock" &&
        settings.live_create_enabled &&
        Boolean(settings.credentials.client_id) &&
        Boolean(process.env.AJEX_CLIENT_SECRET) &&
        Boolean(settings.credentials.account_number) &&
        Boolean(settings.credentials.product_code),
      endpoints: {
        auth: `${getBaseUrl(settings)}/auth/api/v1/token`,
        create_order: `${getBaseUrl(settings)}/mwo/api/v1/orders`,
        print_order: `${getBaseUrl(settings)}/mwo/api/v1/print/{trackingId}`,
        tracking: `${getBaseUrl(settings)}/mwt/api/v1/tracking/{trackingId}`,
        update_address: `${getBaseUrl(settings)}/mwo/api/v1/orders/destination-address`,
        cancel: `${getBaseUrl(settings)}/mwo/api/v1/orders/cancel`
      }
    },
    metrics: {
      policies_created: db.shippingPolicies.length,
      printed_mock: db.printJobs.filter((job) => job.status === "Printed Mock" || job.status.startsWith("Sent To")).length,
      queued_prints: db.printJobs.filter((job) => job.status === "Queued").length,
      failed_prints: db.printJobs.filter((job) => job.status === "Failed").length
    }
  };
}

function updateShippingSettings(db, patch, actorId = null) {
  const current = ensureShippingData(db);
  const next = deepMerge(current, {
    ...patch,
    updated_at: nowIso(),
    updated_by: actorId || null
  });
  if (next.mode !== "mock") {
    next.credentials.api_base_url = next.credentials.api_base_url || AJEX_BASE_URLS[next.mode] || AJEX_BASE_URLS.stage;
  }
  db.shippingSettings = next;
  return getShippingSummary(db);
}

async function testPrint(db, actorId = null) {
  const settings = ensureShippingData(db);
  const order = db.orders[0];
  if (!order) {
    const error = new Error("No order is available for test print.");
    error.status = 400;
    throw error;
  }
  const result = await createShipmentPolicy(db, order, actorId, { autoPrint: true, force: true });
  result.printJob.source = "test";
  result.printJob.message =
    settings.printer.connection === "mock"
      ? `Test print sent to ${settings.printer.name}. Mock only; no physical printer was contacted.`
      : `Test print command sent through ${settings.printer.connection}. Check the Windows print queue and printer paper.`;
  return {
    ...getShippingSummary(db),
    lastPolicy: result.policy,
    lastPrintJob: result.printJob
  };
}

async function ajexRequest(settings, path, options = {}) {
  const response = await fetch(`${getBaseUrl(settings)}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.status === "ERROR" || data.status === "BAD_REQUEST") {
    const error = new Error(data.msg || `AJEX request failed with ${response.status}`);
    error.status = 502;
    error.ajex = data;
    throw error;
  }
  return data;
}

async function requestAjexToken(settings, clientSecret) {
  return ajexRequest(settings, "/auth/api/v1/token", {
    method: "POST",
    body: JSON.stringify({
      clientId: settings.credentials.client_id,
      clientSecret
    })
  });
}

async function createAjexOrder(settings, payload, accessToken) {
  return ajexRequest(settings, "/mwo/api/v1/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload)
  });
}

async function printAjexOrder(settings, trackingId, accessToken) {
  return ajexRequest(settings, `/mwo/api/v1/print/${encodeURIComponent(trackingId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

async function trackAjexOrder(settings, trackingId, accessToken) {
  return ajexRequest(settings, `/mwt/api/v1/tracking/${encodeURIComponent(trackingId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

async function cancelAjexOrders(settings, trackingIds, accessToken) {
  return ajexRequest(settings, "/mwo/api/v1/orders/cancel", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ trackingIds })
  });
}

module.exports = {
  ensureShippingData,
  createShipmentPolicy,
  getShippingSummary,
  updateShippingSettings,
  testPrint,
  buildAjexPayload,
  requestAjexToken,
  createAjexOrder,
  printAjexOrder,
  trackAjexOrder,
  cancelAjexOrders
};
