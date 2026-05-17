const { hashPassword } = require("./auth");

const productCatalog = [
  {
    product_name: "Luna Satin Dress",
    sku: "LUNA-BLK",
    sizes: ["S", "M", "L"],
    image_url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85"
  },
  {
    product_name: "Mira Pleated Dress",
    sku: "MIRA-ROS",
    sizes: ["XS", "S", "M"],
    image_url: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=85"
  },
  {
    product_name: "Dalia Evening Dress",
    sku: "DALIA-GRN",
    sizes: ["M", "L", "XL"],
    image_url: "https://images.unsplash.com/photo-1550639525-c97d455acf70?auto=format&fit=crop&w=1200&q=85"
  },
  {
    product_name: "Aster Tulle Gown",
    sku: "ASTER-IVO",
    sizes: ["S", "M", "L"],
    image_url: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=1200&q=85"
  },
  {
    product_name: "Noor Velvet Dress",
    sku: "NOOR-NVY",
    sizes: ["S", "M", "L", "XL"],
    image_url: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=85"
  },
  {
    product_name: "Pearl Occasion Belt",
    sku: "BELT-PRL",
    sizes: ["One size"],
    image_url: "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=1200&q=85"
  }
];

const customers = [
  ["Sara Alharbi", "0554412983"],
  ["Noura Alzahrani", "0503381920"],
  ["Lama Alotaibi", "0567742015"],
  ["Maha Alqahtani", "0539921742"],
  ["Reem Almutairi", "0547309911"],
  ["Hessa Aldosari", "0582926410"],
  ["Dana Alghamdi", "0576001824"],
  ["Abeer Alrashid", "0563900145"]
];

const notes = [
  "Gift order, premium wrapping requested.",
  "Customer asked for careful folding.",
  "Call before delivery.",
  "",
  "Rush order for evening event.",
  "Do not include invoice in package."
];

function nowIso() {
  return new Date().toISOString();
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function pick(array, index) {
  return array[index % array.length];
}

function createOrder(number, overrides = {}) {
  const customer = pick(customers, number);
  const createdAt = overrides.created_at || hoursAgo((number % 36) + 1);
  const itemCount = overrides.itemCount || (number % 3 === 0 ? 2 : 1);
  const orderId = overrides.id || id("ord");
  const order = {
    id: orderId,
    zid_order_id: `ZID-${number}`,
    order_number: `#${number}`,
    customer_name: customer[0],
    customer_phone: customer[1],
    status: overrides.status || "Queued",
    status_tag: overrides.status_tag || "",
    priority: overrides.priority || (number % 7 === 0 ? "High" : "Normal"),
    assigned_worker_id: overrides.assigned_worker_id || null,
    created_at: createdAt,
    updated_at: overrides.updated_at || nowIso(),
    imported_at: overrides.imported_at || hoursAgo((number % 24) + 1),
    customer_notes: overrides.customer_notes ?? pick(notes, number),
    shipping_city: pick(["Riyadh", "Jeddah", "Dammam", "Makkah"], number),
    shipping_method: pick(["Aramex", "SMSA", "Local Courier", "DHL"], number),
    assigned_at: overrides.assigned_at || null,
    packing_started_at: overrides.packing_started_at || null,
    ready_at: overrides.ready_at || null,
    label_printed_at: overrides.label_printed_at || null,
    missing_at: overrides.missing_at || null,
    completed_by_worker_id: overrides.completed_by_worker_id || null,
    label: overrides.label || null,
    internal_notes: overrides.internal_notes || [],
    lock_version: 0
  };

  const items = Array.from({ length: itemCount }, (_, offset) => {
    const product = pick(productCatalog, number + offset);
    const size = pick(product.sizes, number + offset);
    return {
      id: id("item"),
      order_id: orderId,
      product_name: product.product_name,
      image_url: product.image_url,
      sku: `${product.sku}-${size.replace(/\s+/g, "").toUpperCase()}`,
      size,
      quantity: offset === 0 && number % 5 === 0 ? 2 : 1,
      status: overrides.itemStatus || "Pending Pick",
      missing_reason: "",
      missing_note: "",
      missing_reported_by: null,
      missing_reported_at: null
    };
  });

  return { order, items };
}

function createSeedDatabase() {
  const adminId = "usr_admin";
  const worker1Id = "usr_worker_1";
  const worker2Id = "usr_worker_2";
  const importedAt = hoursAgo(6);
  const worker1Started = new Date(Date.now() - 12 * 60 * 1000).toISOString();
  const worker2Started = new Date(Date.now() - 56 * 60 * 1000).toISOString();
  const readyAt = hoursAgo(2);
  const missingAt = hoursAgo(7);

  const users = [
    {
      id: adminId,
      name: "Admin Control",
      email: "admin@operation.local",
      password_hash: hashPassword("Admin123!"),
      role: "admin",
      active_status: true,
      last_active_at: nowIso()
    },
    {
      id: worker1Id,
      name: "Worker One",
      email: "worker1@operation.local",
      password_hash: hashPassword("Worker123!"),
      role: "worker",
      active_status: true,
      last_active_at: new Date(Date.now() - 90 * 1000).toISOString()
    },
    {
      id: worker2Id,
      name: "Worker Two",
      email: "worker2@operation.local",
      password_hash: hashPassword("Worker123!"),
      role: "worker",
      active_status: true,
      last_active_at: new Date(Date.now() - 56 * 60 * 1000).toISOString()
    }
  ];

  const orderSets = [
    createOrder(6101, { created_at: hoursAgo(31), imported_at: importedAt, priority: "High" }),
    createOrder(6102, { created_at: hoursAgo(5), imported_at: importedAt, priority: "Normal", itemCount: 2 }),
    createOrder(6103, { created_at: hoursAgo(2), imported_at: importedAt, priority: "Normal" }),
    createOrder(6104, {
      status: "Picking / Packing",
      assigned_worker_id: worker1Id,
      assigned_at: worker1Started,
      packing_started_at: worker1Started,
      created_at: hoursAgo(4),
      imported_at: importedAt,
      priority: "High"
    }),
    createOrder(6105, {
      status: "Picking / Packing",
      assigned_worker_id: worker2Id,
      assigned_at: worker2Started,
      packing_started_at: worker2Started,
      created_at: hoursAgo(28),
      imported_at: hoursAgo(26),
      priority: "High"
    }),
    createOrder(6106, {
      status: "Label Printed",
      status_tag: "Ready To Ship",
      ready_at: readyAt,
      label_printed_at: readyAt,
      completed_by_worker_id: worker1Id,
      created_at: hoursAgo(9),
      imported_at: hoursAgo(8),
      itemStatus: "Packed",
      label: {
        label_id: "LBL-6106",
        carrier: "Aramex",
        tracking_number: "ARX6106LOCAL",
        generated_at: readyAt
      }
    }),
    createOrder(6107, {
      status: "Awaiting Stock",
      status_tag: "Product Missing",
      missing_at: missingAt,
      created_at: hoursAgo(32),
      imported_at: hoursAgo(30),
      priority: "Critical",
      itemStatus: "Missing"
    })
  ];

  const orders = orderSets.map((set) => set.order);
  const orderItems = orderSets.flatMap((set) => set.items);
  const missingOrder = orders.find((order) => order.order_number === "#6107");
  for (const item of orderItems.filter((item) => item.order_id === missingOrder.id)) {
    item.missing_reason = "Size unavailable";
    item.missing_note = "Shelf has label, but no physical stock in M/L bins.";
    item.missing_reported_by = worker2Id;
    item.missing_reported_at = missingAt;
  }

  const orderEvents = [];
  for (const order of orders) {
    orderEvents.push({
      id: id("evt"),
      order_id: order.id,
      user_id: null,
      event_type: "Imported from Zid",
      message: `${order.order_number} imported into Operation Assist.`,
      created_at: order.imported_at
    });
    if (["Queued", "Picking / Packing"].includes(order.status)) {
      orderEvents.push({
        id: id("evt"),
        order_id: order.id,
        user_id: null,
        event_type: "Queued",
        message: `${order.order_number} entered the packaging queue.`,
        created_at: order.imported_at
      });
    }
  }

  for (const order of orders.filter((item) => item.assigned_worker_id)) {
    orderEvents.push({
      id: id("evt"),
      order_id: order.id,
      user_id: order.assigned_worker_id,
      event_type: "Assigned to worker",
      message: `${order.order_number} locked to ${users.find((user) => user.id === order.assigned_worker_id).name}.`,
      created_at: order.assigned_at
    });
    orderEvents.push({
      id: id("evt"),
      order_id: order.id,
      user_id: order.assigned_worker_id,
      event_type: "Packing started",
      message: "Worker opened the forced order task.",
      created_at: order.packing_started_at
    });
  }

  const readyOrder = orders.find((order) => order.order_number === "#6106");
  orderEvents.push({
    id: id("evt"),
    order_id: readyOrder.id,
    user_id: worker1Id,
    event_type: "Ready to ship",
    message: "All products packed and verified.",
    created_at: readyAt
  });
  orderEvents.push({
    id: id("evt"),
    order_id: readyOrder.id,
    user_id: worker1Id,
    event_type: "Label printed",
    message: "Shipping label LBL-6106 generated.",
    created_at: readyAt
  });

  orderEvents.push({
    id: id("evt"),
    order_id: missingOrder.id,
    user_id: worker2Id,
    event_type: "Product marked missing",
    message: "Missing stock reported for Size unavailable.",
    created_at: missingAt
  });
  orderEvents.push({
    id: id("evt"),
    order_id: missingOrder.id,
    user_id: null,
    event_type: "Awaiting stock",
    message: "Order moved out of active packaging flow.",
    created_at: missingAt
  });

  return {
    meta: {
      created_at: nowIso(),
      last_sync_at: importedAt,
      next_zid_number: 6108,
      zid_mode: "mock"
    },
    users,
    orders,
    orderItems,
    orderEvents,
    workerStats: [
      {
        user_id: worker1Id,
        date: new Date().toISOString().slice(0, 10),
        completed_orders: 4,
        average_completion_time: 398,
        missing_reports: 1
      },
      {
        user_id: worker2Id,
        date: new Date().toISOString().slice(0, 10),
        completed_orders: 3,
        average_completion_time: 430,
        missing_reports: 2
      }
    ]
  };
}

function createMockZidOrders(startNumber, count = 1) {
  return Array.from({ length: count }, (_, index) => {
    const number = startNumber + index;
    const priority = index === 0 && number % 2 === 0 ? "High" : "Normal";
    return createOrder(number, {
      status: "Queued",
      imported_at: nowIso(),
      created_at: new Date(Date.now() - (index + 1) * 9 * 60 * 1000).toISOString(),
      priority,
      itemCount: number % 4 === 0 ? 2 : 1
    });
  });
}

module.exports = {
  createSeedDatabase,
  createMockZidOrders
};
