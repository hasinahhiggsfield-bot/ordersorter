function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

const ZID_STATUS_DICTIONARY = {
  new: {
    zid_label: "New",
    arabic_label: "جديد",
    owner: "Merchant",
    operation_assist_action: "Import as Queued when dispatch is active.",
    local_status: "Queued",
    worker_flow: true
  },
  preparing: {
    zid_label: "Preparing",
    arabic_label: "قيد التحضير",
    owner: "Merchant",
    operation_assist_action: "Keep visible, but do not assign to workers yet.",
    local_status: "New",
    worker_flow: false
  },
  ready: {
    zid_label: "Ready",
    arabic_label: "جاهز",
    owner: "Merchant",
    operation_assist_action: "Create shipping policy if the order was already packed or came from shipping-only flow.",
    local_status: "Ready To Ship",
    worker_flow: false
  },
  inDelivery: {
    zid_label: "Indelivery",
    arabic_label: "قيد التوصيل",
    owner: "Partner",
    operation_assist_action: "Mark as shipped/in delivery and remove from packaging work.",
    local_status: "Shipped",
    worker_flow: false
  },
  delivered: {
    zid_label: "Delivered",
    arabic_label: "تم التوصيل",
    owner: "Partner",
    operation_assist_action: "Final successful delivery state.",
    local_status: "Shipped",
    worker_flow: false
  },
  cancelled: {
    zid_label: "Canceled",
    arabic_label: "ملغي",
    owner: "Merchant / Partner",
    operation_assist_action: "Cancel locally, unlock worker if needed, and stop shipment creation.",
    local_status: "Cancelled",
    worker_flow: false
  }
};

function defaultZidIntegration() {
  return {
    mode: "mock",
    app_installed: false,
    dispatch_orders_active: true,
    sync_products_active: true,
    store_id: "mock-store",
    manager_token_saved: false,
    authorization_saved: false,
    api_base_url: "https://api.zid.sa/v1/managers/store",
    webhook_url: "http://localhost:4310/api/zid/webhooks",
    last_activation_event: null,
    last_webhook_at: null,
    last_manual_sync_at: null,
    required_webhooks: [
      "order.create",
      "order.status.update",
      "order.ready",
      "order.canceled",
      "app.market.application.install",
      "app.market.application.uninstall",
      "app.market.dispatch_orders.activate",
      "app.market.dispatch_orders.deactivate",
      "app.market.sync_product.activate",
      "app.market.sync_product.deactivate",
      "product.create",
      "product.update",
      "product.publish",
      "product.delete"
    ],
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

function ensureZidIntegration(db) {
  if (!db.zidIntegration) db.zidIntegration = defaultZidIntegration();
  if (!Array.isArray(db.zidWebhookEvents)) db.zidWebhookEvents = [];
  return db.zidIntegration;
}

function addEvent(db, eventName, payload = {}) {
  db.zidWebhookEvents.unshift({
    id: uid("zid_evt"),
    event_name: eventName,
    payload_preview: payload,
    created_at: nowIso()
  });
}

function normalizeEventName(payload) {
  return payload.event || payload.event_name || payload.action || payload.type || "unknown";
}

function handleZidWebhook(db, payload = {}) {
  const integration = ensureZidIntegration(db);
  const eventName = normalizeEventName(payload);
  integration.last_webhook_at = nowIso();
  integration.last_activation_event = eventName;
  integration.updated_at = nowIso();

  if (eventName === "app.market.application.install") {
    integration.app_installed = true;
    integration.store_id = String(payload.store_id || payload.storeId || integration.store_id || "mock-store");
  }
  if (eventName === "app.market.application.uninstall") {
    integration.app_installed = false;
    integration.dispatch_orders_active = false;
    integration.sync_products_active = false;
  }
  if (eventName === "app.market.dispatch_orders.activate") integration.dispatch_orders_active = true;
  if (eventName === "app.market.dispatch_orders.deactivate") integration.dispatch_orders_active = false;
  if (eventName === "app.market.sync_product.activate") integration.sync_products_active = true;
  if (eventName === "app.market.sync_product.deactivate") integration.sync_products_active = false;

  addEvent(db, eventName, payload);
  return getZidSummary(db);
}

function updateZidSettings(db, patch = {}) {
  const current = ensureZidIntegration(db);
  db.zidIntegration = {
    ...current,
    ...patch,
    updated_at: nowIso()
  };
  return getZidSummary(db);
}

function simulateActivation(db, storeId = "mock-store") {
  handleZidWebhook(db, {
    event: "app.market.application.install",
    store_id: storeId
  });
  handleZidWebhook(db, {
    event: "app.market.dispatch_orders.activate",
    store_id: storeId
  });
  handleZidWebhook(db, {
    event: "app.market.sync_product.activate",
    store_id: storeId
  });
  return getZidSummary(db);
}

function markManualSync(db) {
  const integration = ensureZidIntegration(db);
  integration.last_manual_sync_at = nowIso();
  integration.updated_at = nowIso();
}

function getZidSummary(db) {
  const integration = ensureZidIntegration(db);
  return {
    integration,
    statusDictionary: ZID_STATUS_DICTIONARY,
    recentWebhookEvents: db.zidWebhookEvents.slice(0, 30)
  };
}

module.exports = {
  ZID_STATUS_DICTIONARY,
  ensureZidIntegration,
  handleZidWebhook,
  updateZidSettings,
  simulateActivation,
  markManualSync,
  getZidSummary
};
