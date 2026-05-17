const { createMockZidOrders } = require("../mockZid");
const { STUCK_ORDER_MS, WORKER_INACTIVITY_WARNING_MS } = require("../config");
const {
  ensureShippingData,
  createShipmentPolicy,
  getShippingSummary
} = require("./shipping");
const {
  ensureZidIntegration,
  markManualSync,
  getZidSummary
} = require("./zid");

const ACTIVE_STATUSES = new Set(["Assigned", "Picking / Packing"]);
const QUEUE_STATUSES = new Set(["Queued", "Returned To Queue", "Stock Arrived"]);
const FINAL_STATUSES = new Set(["Label Printed", "Ready To Ship", "Shipped", "Cancelled"]);

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function secondsBetween(start, end = new Date()) {
  if (!start) return 0;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - startDate.getTime()) / 1000));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active_status: user.active_status,
    last_active_at: user.last_active_at
  };
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

function ensureRestockPlans(db) {
  if (!Array.isArray(db.restockPlans)) db.restockPlans = [];
  return db.restockPlans;
}

function userById(db, userId) {
  return db.users.find((user) => user.id === userId) || null;
}

function orderById(db, orderId) {
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) {
    const error = new Error("Order was not found.");
    error.status = 404;
    throw error;
  }
  return order;
}

function hydrateOrder(db, order) {
  const assignedWorker = userById(db, order.assigned_worker_id);
  const completedWorker = userById(db, order.completed_by_worker_id);
  const items = db.orderItems.filter((item) => item.order_id === order.id);
  const events = db.orderEvents
    .filter((event) => event.order_id === order.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((event) => ({
      ...event,
      user: publicUser(userById(db, event.user_id))
    }));
  const now = new Date();
  const processing_seconds = secondsBetween(order.packing_started_at, now);
  const age_seconds = secondsBetween(order.created_at, now);
  const lastActive = assignedWorker?.last_active_at;
  const worker_idle_seconds = secondsBetween(lastActive, now);
  const stuckByInactivity = Boolean(order.assigned_worker_id && worker_idle_seconds * 1000 > WORKER_INACTIVITY_WARNING_MS);
  const stuckByDuration = Boolean(order.assigned_worker_id && ACTIVE_STATUSES.has(order.status) && processing_seconds * 1000 > STUCK_ORDER_MS);

  return {
    ...order,
    items,
    events,
    assigned_worker: publicUser(assignedWorker),
    completed_by_worker: publicUser(completedWorker),
    item_count: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
    processing_seconds,
    age_seconds,
    delayed: age_seconds > 24 * 60 * 60 && !FINAL_STATUSES.has(order.status),
    potentially_stuck: stuckByInactivity || stuckByDuration,
    stuck_reason: stuckByDuration ? "Processing longer than threshold" : stuckByInactivity ? "Worker inactive too long" : ""
  };
}

function missingRemainingQuantity(item) {
  if (item.status !== "Missing") return 0;
  if (Number.isFinite(Number(item.missing_remaining_quantity))) return Math.max(0, Number(item.missing_remaining_quantity));
  return Math.max(0, Number(item.quantity || 0));
}

function missingProductKey(item) {
  return String(item.sku || item.product_name || "unknown").trim();
}

function getMissingProductProfiles(db) {
  const plans = ensureRestockPlans(db);
  const missingOrders = db.orders.filter((order) => order.status_tag === "Product Missing" || order.status === "Product Missing" || order.status === "Awaiting Stock" || order.status === "Escalated");
  const profiles = new Map();

  for (const order of missingOrders) {
    const items = db.orderItems.filter((item) => item.order_id === order.id && item.status === "Missing" && missingRemainingQuantity(item) > 0);
    for (const item of items) {
      const key = missingProductKey(item);
      if (!profiles.has(key)) {
        profiles.set(key, {
          id: encodeURIComponent(key),
          sku: key,
          product_name: item.product_name,
          image_url: item.image_url,
          total_quantity: 0,
          sizes: [],
          orders: [],
          reasons: [],
          oldest_missing_at: item.missing_reported_at || order.missing_at || order.created_at,
          plan: plans.find((plan) => plan.sku === key) || null
        });
      }
      const profile = profiles.get(key);
      const quantity = missingRemainingQuantity(item);
      profile.total_quantity += quantity;
      const sizeKey = String(item.size || "Unknown");
      let size = profile.sizes.find((entry) => entry.size === sizeKey);
      if (!size) {
        size = { size: sizeKey, quantity: 0, order_count: 0, item_ids: [] };
        profile.sizes.push(size);
      }
      size.quantity += quantity;
      size.order_count += 1;
      size.item_ids.push(item.id);
      if (!profile.orders.some((entry) => entry.id === order.id)) {
        profile.orders.push({
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          created_at: order.created_at,
          missing_at: order.missing_at,
          priority: order.priority
        });
      }
      if (item.missing_reason && !profile.reasons.includes(item.missing_reason)) profile.reasons.push(item.missing_reason);
      if (new Date(item.missing_reported_at || order.missing_at || order.created_at) < new Date(profile.oldest_missing_at)) {
        profile.oldest_missing_at = item.missing_reported_at || order.missing_at || order.created_at;
      }
    }
  }

  return [...profiles.values()]
    .map((profile) => ({
      ...profile,
      sizes: profile.sizes.sort((a, b) => a.size.localeCompare(b.size)),
      orders: profile.orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }))
    .sort((a, b) => new Date(a.oldest_missing_at) - new Date(b.oldest_missing_at));
}

function assertWorkerOwns(order, userId) {
  if (order.assigned_worker_id !== userId || !ACTIVE_STATUSES.has(order.status)) {
    const error = new Error("This order is not locked to the current worker.");
    error.status = 403;
    throw error;
  }
}

function sortedQueue(db) {
  const priorityScore = { Critical: 5, High: 4, Normal: 2, Low: 1 };
  return db.orders
    .filter((order) => QUEUE_STATUSES.has(order.status) && !order.assigned_worker_id)
    .sort((a, b) => {
      const aManual = Number.isFinite(Number(a.queue_rank));
      const bManual = Number.isFinite(Number(b.queue_rank));
      if (aManual && bManual && Number(a.queue_rank) !== Number(b.queue_rank)) return Number(a.queue_rank) - Number(b.queue_rank);
      if (aManual !== bManual) return aManual ? -1 : 1;
      const aAgeBoost = secondsBetween(a.created_at) > 24 * 60 * 60 ? 5 : 0;
      const bAgeBoost = secondsBetween(b.created_at) > 24 * 60 * 60 ? 5 : 0;
      const aScore = (priorityScore[a.priority] || 2) + aAgeBoost;
      const bScore = (priorityScore[b.priority] || 2) + bAgeBoost;
      if (aScore !== bScore) return bScore - aScore;
      return new Date(a.created_at) - new Date(b.created_at);
    });
}

function reorderQueue(db, actorId, orderIds = []) {
  const validIds = Array.isArray(orderIds) ? orderIds.map(String) : [];
  const queued = db.orders.filter((order) => QUEUE_STATUSES.has(order.status) && !order.assigned_worker_id);
  const queuedIds = new Set(queued.map((order) => order.id));
  const seen = new Set();
  let rank = 1;

  for (const id of validIds) {
    if (!queuedIds.has(id) || seen.has(id)) continue;
    const order = orderById(db, id);
    order.queue_rank = rank++;
    order.manual_queue_priority = true;
    order.updated_at = nowIso();
    seen.add(id);
  }

  for (const order of queued) {
    if (seen.has(order.id)) continue;
    order.queue_rank = rank++;
    order.manual_queue_priority = true;
    order.updated_at = nowIso();
  }

  if (validIds.length) {
    addEvent(db, validIds[0], actorId, "Queue reordered", "Admin manually updated the waiting queue order.");
  }
  return sortedQueue(db).map((order) => hydrateOrder(db, order));
}

function updateWorkerActivity(db, userId) {
  const user = userById(db, userId);
  if (user) user.last_active_at = nowIso();
}

function assignNextOrderToWorker(db, workerId, actorId = workerId) {
  const worker = userById(db, workerId);
  if (!worker || worker.role !== "worker" || !worker.active_status) {
    const error = new Error("Worker account is not available.");
    error.status = 400;
    throw error;
  }

  updateWorkerActivity(db, workerId);

  const existing = db.orders.find((order) => order.assigned_worker_id === workerId && ACTIVE_STATUSES.has(order.status));
  if (existing) return hydrateOrder(db, existing);

  const nextOrder = sortedQueue(db)[0];
  if (!nextOrder) return null;

  const now = nowIso();
  nextOrder.status = "Picking / Packing";
  nextOrder.status_tag = "";
  nextOrder.assigned_worker_id = workerId;
  nextOrder.assigned_at = now;
  nextOrder.packing_started_at = now;
  nextOrder.updated_at = now;
  nextOrder.lock_version += 1;

  addEvent(db, nextOrder.id, actorId, "Assigned to worker", `${nextOrder.order_number} locked to ${worker.name}.`);
  addEvent(db, nextOrder.id, workerId, "Packing started", "Worker opened the forced order task.");
  return hydrateOrder(db, nextOrder);
}

function workerCurrent(db, workerId) {
  return assignNextOrderToWorker(db, workerId);
}

function statRecord(db, workerId) {
  const date = todayKey();
  let record = db.workerStats.find((item) => item.user_id === workerId && item.date === date);
  if (!record) {
    record = {
      user_id: workerId,
      date,
      completed_orders: 0,
      average_completion_time: 0,
      missing_reports: 0
    };
    db.workerStats.push(record);
  }
  return record;
}

function recordCompletion(db, workerId, durationSeconds) {
  const stat = statRecord(db, workerId);
  const totalBefore = stat.average_completion_time * stat.completed_orders;
  stat.completed_orders += 1;
  stat.average_completion_time = Math.round((totalBefore + durationSeconds) / stat.completed_orders);
}

function recordMissing(db, workerId) {
  const stat = statRecord(db, workerId);
  stat.missing_reports += 1;
}

function completeOrder(db, workerId, orderId) {
  const order = orderById(db, orderId);
  assertWorkerOwns(order, workerId);
  const now = nowIso();
  const durationSeconds = secondsBetween(order.packing_started_at);
  const label = {
    label_id: `LBL-${order.order_number.replace(/[^\d]/g, "")}-${Date.now().toString(36).toUpperCase()}`,
    carrier: order.shipping_method,
    tracking_number: `OA${order.order_number.replace(/[^\d]/g, "")}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    generated_at: now
  };

  for (const item of db.orderItems.filter((line) => line.order_id === order.id)) {
    item.status = "Packed";
  }

  order.status = "Ready To Ship";
  order.status_tag = "";
  order.ready_at = now;
  order.updated_at = now;
  addEvent(db, order.id, workerId, "Ready to ship", `All products verified in ${durationSeconds} seconds.`);

  order.status = "Label Printed";
  order.status_tag = "Ready To Ship";
  order.label_printed_at = now;
  order.label = label;
  order.completed_by_worker_id = workerId;
  order.assigned_worker_id = null;
  order.assigned_at = null;
  addEvent(db, order.id, workerId, "Label printed", `Shipping label ${label.label_id} generated for ${order.shipping_method}.`);
  const shippingSettings = ensureShippingData(db);
  const shippingResult = shippingSettings.auto_create_policy
    ? createShipmentPolicy(db, order, workerId, { autoPrint: shippingSettings.auto_print_enabled })
    : null;
  recordCompletion(db, workerId, durationSeconds);

  const nextOrder = assignNextOrderToWorker(db, workerId);
  return {
    completed: hydrateOrder(db, order),
    label: order.label,
    shipping: shippingResult,
    nextOrder
  };
}

function reportMissing(db, workerId, orderId, payload) {
  const order = orderById(db, orderId);
  assertWorkerOwns(order, workerId);
  const itemIds = Array.isArray(payload.itemIds) ? payload.itemIds : [];
  const reason = String(payload.reason || "").trim();
  const note = String(payload.note || "").trim();

  if (!itemIds.length) {
    const error = new Error("Select at least one missing item.");
    error.status = 400;
    throw error;
  }
  if (!reason) {
    const error = new Error("Select a missing reason.");
    error.status = 400;
    throw error;
  }

  const items = db.orderItems.filter((item) => item.order_id === order.id && itemIds.includes(item.id));
  if (items.length !== itemIds.length) {
    const error = new Error("One or more selected items do not belong to this order.");
    error.status = 400;
    throw error;
  }

  const now = nowIso();
  for (const item of items) {
    item.status = "Missing";
    item.missing_reason = reason;
    item.missing_note = note;
    item.missing_reported_by = workerId;
    item.missing_reported_at = now;
    item.missing_remaining_quantity = Number(item.quantity || 0);
  }

  const skuList = items.map((item) => `${item.sku} ${item.size}`).join(", ");
  order.status = "Product Missing";
  order.status_tag = "";
  order.missing_at = now;
  order.updated_at = now;
  addEvent(db, order.id, workerId, "Product marked missing", `${skuList} reported missing: ${reason}.${note ? ` ${note}` : ""}`);

  order.status = "Awaiting Stock";
  order.status_tag = "Product Missing";
  order.assigned_worker_id = null;
  order.assigned_at = null;
  addEvent(db, order.id, null, "Awaiting stock", "Order moved out of active packaging flow.");
  recordMissing(db, workerId);

  const nextOrder = assignNextOrderToWorker(db, workerId);
  return {
    missingOrder: hydrateOrder(db, order),
    nextOrder
  };
}

function syncFromZid(db, actorId = null, count = 1) {
  const zid = ensureZidIntegration(db);
  if (!zid.dispatch_orders_active) return [];
  const startNumber = db.meta.next_zid_number || 7000;
  const imported = createMockZidOrders(startNumber, count);
  for (const { order, items } of imported) {
    db.orders.push(order);
    db.orderItems.push(...items);
    addEvent(db, order.id, actorId, "Imported from Zid", `${order.order_number} imported from ${db.meta.zid_mode || "mock"} Zid sync.`);
    addEvent(db, order.id, null, "Queued", `${order.order_number} entered the packaging queue.`);
  }
  db.meta.next_zid_number = startNumber + count;
  db.meta.last_sync_at = nowIso();
  markManualSync(db);
  assignQueuedToAvailableWorkers(db, actorId);
  return imported.map(({ order }) => hydrateOrder(db, order));
}

function assignQueuedToAvailableWorkers(db, actorId = null) {
  const workers = db.users.filter((user) => {
    const isActiveWorker = user.role === "worker" && user.active_status;
    const hasRecentHeartbeat = secondsBetween(user.last_active_at) * 1000 <= WORKER_INACTIVITY_WARNING_MS;
    const hasOrder = db.orders.some((order) => order.assigned_worker_id === user.id && ACTIVE_STATUSES.has(order.status));
    return isActiveWorker && hasRecentHeartbeat && !hasOrder;
  });

  for (const worker of workers) {
    if (!sortedQueue(db).length) break;
    assignNextOrderToWorker(db, worker.id, actorId || worker.id);
  }
}

function countByStatus(db, predicate) {
  return db.orders.filter(predicate).length;
}

function workerSnapshot(db, worker) {
  const current = db.orders.find((order) => order.assigned_worker_id === worker.id && ACTIVE_STATUSES.has(order.status));
  const stat = statRecord(db, worker.id);
  const idleSeconds = current ? 0 : secondsBetween(worker.last_active_at);
  return {
    ...publicUser(worker),
    current_order: current ? hydrateOrder(db, current) : null,
    processing_seconds: current ? secondsBetween(current.packing_started_at) : 0,
    orders_completed_today: stat.completed_orders,
    average_completion_time: stat.average_completion_time,
    missing_reports: stat.missing_reports,
    idle_seconds: idleSeconds,
    status: current ? "Packing" : idleSeconds > WORKER_INACTIVITY_WARNING_MS / 1000 ? "Idle" : "Available"
  };
}

function getDashboard(db) {
  ensureShippingData(db);
  ensureZidIntegration(db);
  ensureRestockPlans(db);
  const hydratedOrders = db.orders.map((order) => hydrateOrder(db, order));
  const activeOrders = hydratedOrders.filter((order) => ACTIVE_STATUSES.has(order.status));
  const missingOrders = hydratedOrders.filter((order) => order.status_tag === "Product Missing" || order.status === "Product Missing" || order.status === "Awaiting Stock" || order.status === "Escalated");
  const stuckOrders = activeOrders.filter((order) => order.potentially_stuck);

  return {
    meta: db.meta,
    metrics: {
      new_orders: countByStatus(db, (order) => order.status === "New"),
      queued_orders: countByStatus(db, (order) => QUEUE_STATUSES.has(order.status)),
      assigned_orders: activeOrders.length,
      currently_packing: countByStatus(db, (order) => order.status === "Picking / Packing"),
      ready_to_ship: countByStatus(db, (order) => order.status === "Ready To Ship" || order.status === "Label Printed"),
      product_missing: missingOrders.length,
      awaiting_stock: countByStatus(db, (order) => order.status === "Awaiting Stock"),
      delayed_orders: hydratedOrders.filter((order) => order.delayed).length,
      older_than_24h: hydratedOrders.filter((order) => order.age_seconds > 24 * 60 * 60).length
    },
    queue: sortedQueue(db).map((order) => hydrateOrder(db, order)),
    workers: db.users.filter((user) => user.role === "worker").map((worker) => workerSnapshot(db, worker)),
    missingOrders,
    missingProductProfiles: getMissingProductProfiles(db),
    stuckOrders,
    orders: hydratedOrders.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    recentEvents: db.orderEvents
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 30)
      .map((event) => ({
        ...event,
        order: db.orders.find((order) => order.id === event.order_id) || null,
        user: publicUser(userById(db, event.user_id))
      })),
    shipping: getShippingSummary(db),
    zid: getZidSummary(db)
  };
}

function stockArrived(db, orderId, actorId) {
  const order = orderById(db, orderId);
  const now = nowIso();
  order.status = "Stock Arrived";
  order.status_tag = "";
  order.updated_at = now;
  addEvent(db, order.id, actorId, "Stock arrived", "Admin confirmed replacement stock arrived.");

  for (const item of db.orderItems.filter((line) => line.order_id === order.id && line.status === "Missing")) {
    item.status = "Pending Pick";
  }

  order.status = "Returned To Queue";
  order.assigned_worker_id = null;
  order.assigned_at = null;
  order.packing_started_at = null;
  order.priority = order.priority === "Critical" ? "Critical" : "High";
  order.updated_at = nowIso();
  addEvent(db, order.id, actorId, "Returned to queue", "Order is available for automatic reassignment with higher priority.");
  assignQueuedToAvailableWorkers(db, actorId);
  return hydrateOrder(db, order);
}

function findRestockProfile(db, sku) {
  return getMissingProductProfiles(db).find((profile) => profile.sku === sku || profile.id === sku || profile.id === encodeURIComponent(sku));
}

function confirmProductOrdered(db, sku, actorId, payload = {}) {
  const profile = findRestockProfile(db, sku);
  if (!profile) {
    const error = new Error("Missing product profile was not found.");
    error.status = 404;
    throw error;
  }
  const plans = ensureRestockPlans(db);
  let plan = plans.find((entry) => entry.sku === profile.sku);
  const now = nowIso();
  if (!plan) {
    plan = { id: uid("restock"), sku: profile.sku, created_at: now };
    plans.push(plan);
  }
  plan.product_name = profile.product_name;
  plan.image_url = profile.image_url;
  plan.factory_name = String(payload.factoryName || payload.factory_name || "").trim();
  plan.due_date = String(payload.dueDate || payload.due_date || "").trim();
  plan.note = String(payload.note || "").trim();
  plan.status = "Ordered";
  plan.ordered_at = now;
  plan.ordered_by = actorId;
  plan.updated_at = now;
  for (const order of profile.orders) {
    addEvent(db, order.id, actorId, "Restock ordered", `${profile.sku} ordered from ${plan.factory_name || "factory"}${plan.due_date ? `, due ${plan.due_date}` : ""}.`);
  }
  return findRestockProfile(db, profile.sku);
}

function receiveProductStock(db, sku, actorId, payload = {}) {
  const profile = findRestockProfile(db, sku);
  if (!profile) {
    const error = new Error("Missing product profile was not found.");
    error.status = 404;
    throw error;
  }
  const arrivals = Array.isArray(payload.arrivals) ? payload.arrivals : [];
  const arrivalBySize = new Map();
  for (const entry of arrivals) {
    const size = String(entry.size || "").trim();
    const quantity = Math.max(0, Number(entry.quantity || 0));
    if (size && quantity) arrivalBySize.set(size, (arrivalBySize.get(size) || 0) + quantity);
  }
  if (!arrivalBySize.size) {
    const error = new Error("Enter at least one arrived size quantity.");
    error.status = 400;
    throw error;
  }

  const releasedOrderIds = new Set();
  const touchedOrderIds = new Set();
  for (const [size, arrivedQuantity] of arrivalBySize.entries()) {
    let remainingArrival = arrivedQuantity;
    const items = db.orderItems
      .filter((item) => item.status === "Missing" && missingProductKey(item) === profile.sku && String(item.size || "Unknown") === size && missingRemainingQuantity(item) > 0)
      .sort((a, b) => {
        const orderA = orderById(db, a.order_id);
        const orderB = orderById(db, b.order_id);
        return new Date(orderA.created_at) - new Date(orderB.created_at);
      });

    for (const item of items) {
      if (remainingArrival <= 0) break;
      const needed = missingRemainingQuantity(item);
      const used = Math.min(needed, remainingArrival);
      const newRemaining = needed - used;
      item.missing_remaining_quantity = newRemaining;
      item.arrived_quantity = Number(item.arrived_quantity || 0) + used;
      item.last_arrived_at = nowIso();
      remainingArrival -= used;
      touchedOrderIds.add(item.order_id);
      if (newRemaining <= 0) {
        item.status = "Pending Pick";
        item.missing_remaining_quantity = 0;
      }
    }
  }

  for (const orderId of touchedOrderIds) {
    const order = orderById(db, orderId);
    const stillMissing = db.orderItems.some((item) => item.order_id === orderId && item.status === "Missing" && missingRemainingQuantity(item) > 0);
    addEvent(db, orderId, actorId, "Stock arrived", `${profile.sku} stock arrival was confirmed by size.`);
    if (!stillMissing) {
      order.status = "Returned To Queue";
      order.status_tag = "";
      order.assigned_worker_id = null;
      order.assigned_at = null;
      order.packing_started_at = null;
      order.priority = "Critical";
      order.updated_at = nowIso();
      addEvent(db, orderId, actorId, "Returned to queue", "All missing sizes arrived. FIFO priority set for first ordered, first shipped.");
      releasedOrderIds.add(orderId);
    } else {
      order.status = "Awaiting Stock";
      order.status_tag = "Product Missing";
      order.updated_at = nowIso();
      addEvent(db, orderId, actorId, "Awaiting stock", "Partial stock arrived. Remaining size quantity is still missing.");
    }
  }

  const plans = ensureRestockPlans(db);
  const plan = plans.find((entry) => entry.sku === profile.sku);
  if (plan) {
    plan.status = findRestockProfile(db, profile.sku) ? "Partially Arrived" : "Arrived";
    plan.received_at = nowIso();
    plan.received_by = actorId;
    plan.updated_at = nowIso();
  }

  assignQueuedToAvailableWorkers(db, actorId);
  return {
    profile: findRestockProfile(db, profile.sku) || null,
    releasedOrders: [...releasedOrderIds].map((orderId) => hydrateOrder(db, orderById(db, orderId)))
  };
}

function unlockOrder(db, orderId, actorId) {
  const order = orderById(db, orderId);
  const previousWorker = userById(db, order.assigned_worker_id);
  order.assigned_worker_id = null;
  order.assigned_at = null;
  order.packing_started_at = null;
  order.status = "Returned To Queue";
  order.status_tag = "";
  order.priority = order.priority === "Normal" ? "High" : order.priority;
  order.updated_at = nowIso();
  addEvent(db, order.id, actorId, "Unlocked", `Order unlocked${previousWorker ? ` from ${previousWorker.name}` : ""} and returned to queue.`);
  assignQueuedToAvailableWorkers(db, actorId);
  return hydrateOrder(db, order);
}

function returnToQueue(db, orderId, actorId) {
  const order = orderById(db, orderId);
  order.assigned_worker_id = null;
  order.assigned_at = null;
  order.packing_started_at = null;
  order.status = "Returned To Queue";
  order.status_tag = "";
  order.updated_at = nowIso();
  addEvent(db, order.id, actorId, "Returned to queue", "Admin returned the order to automatic assignment.");
  assignQueuedToAvailableWorkers(db, actorId);
  return hydrateOrder(db, order);
}

function reassignOrder(db, orderId, workerId, actorId) {
  const worker = userById(db, workerId);
  if (!worker || worker.role !== "worker") {
    const error = new Error("Select a valid worker.");
    error.status = 400;
    throw error;
  }
  const busyOrder = db.orders.find((order) => order.assigned_worker_id === workerId && ACTIVE_STATUSES.has(order.status) && order.id !== orderId);
  if (busyOrder) {
    const error = new Error(`${worker.name} already has an active order.`);
    error.status = 409;
    throw error;
  }

  const order = orderById(db, orderId);
  const now = nowIso();
  order.assigned_worker_id = workerId;
  order.assigned_at = now;
  order.packing_started_at = now;
  order.status = "Picking / Packing";
  order.status_tag = "";
  order.updated_at = now;
  order.lock_version += 1;
  addEvent(db, order.id, actorId, "Reassigned", `${order.order_number} reassigned to ${worker.name}.`);
  addEvent(db, order.id, workerId, "Packing started", "Order opened by admin override.");
  return hydrateOrder(db, order);
}

function addInternalNote(db, orderId, actorId, note) {
  const order = orderById(db, orderId);
  const cleanNote = String(note || "").trim();
  if (!cleanNote) {
    const error = new Error("Internal note cannot be empty.");
    error.status = 400;
    throw error;
  }
  order.internal_notes.push({ id: uid("note"), user_id: actorId, note: cleanNote, created_at: nowIso() });
  order.updated_at = nowIso();
  addEvent(db, order.id, actorId, "Internal note", cleanNote);
  return hydrateOrder(db, order);
}

function escalateOrder(db, orderId, actorId) {
  const order = orderById(db, orderId);
  order.status = "Escalated";
  order.status_tag = order.status_tag || (order.missing_at ? "Product Missing" : "");
  order.priority = "Critical";
  order.updated_at = nowIso();
  addEvent(db, order.id, actorId, "Escalated", "Admin escalated this delayed order.");
  return hydrateOrder(db, order);
}

module.exports = {
  ACTIVE_STATUSES,
  QUEUE_STATUSES,
  publicUser,
  hydrateOrder,
  updateWorkerActivity,
  workerCurrent,
  completeOrder,
  reportMissing,
  syncFromZid,
  assignQueuedToAvailableWorkers,
  reorderQueue,
  getDashboard,
  stockArrived,
  unlockOrder,
  returnToQueue,
  reassignOrder,
  addInternalNote,
  escalateOrder,
  confirmProductOrdered,
  receiveProductStock
};
