const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection
const pool = new Pool({
  user: "postgres", // change this
  host: "localhost",
  database: "Store_Management_System",
  password: "12345", // change this
  port: 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error acquiring client', err.stack);
  }
  console.log('✅ Connected to PostgreSQL database');
  release();
});

// 🌐 Change this to your frontend or public server URL if hosted
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// 📧 Approver email address
const APPROVER_EMAIL = "kishoreprojectiot@gmail.com";

// 🚀 Configure Nodemailer transporter (use Gmail app password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "kishore.rnaipl@gmail.com", // sender Gmail
    pass: "xxbwotrbsczgsvue", // 16-digit Gmail app password
  },
});

// 🧩 Helper function: Send approval email
async function sendApprovalEmail(order) {
  const acceptLink = `${BASE_URL}/api/order/${order.id}/accept`;
  const declineLink = `${BASE_URL}/api/order/${order.id}/decline`;

  const orderListHTML = order.cart
    .map(
      (item) => `
        <li style="background:#fffa93;padding:6px;margin:4px 0;border-radius:4px;">
          <b>${item.partNumber || ""}</b> - ${item.description || ""} (x${item.quantity})
        </li>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial, sans-serif;color:#222;">
      <h2>🛒 New Order Request - #${order.number}</h2>
      <p><strong>Name:</strong> ${order.userDetails.name}</p>
      <p><strong>Emp ID:</strong> ${order.userDetails.empId}</p>
      <p><strong>Department:</strong> ${order.userDetails.dept}</p>
      <p><strong>Zone:</strong> ${order.userDetails.zone}</p>
      <p><strong>Date:</strong> ${order.date}</p>
      <hr/>
      <h3>🧾 Order Items:</h3>
      <ul>${orderListHTML}</ul>
      <hr/>
      <p><b>Please review and take action below:</b></p>
      <div style="margin-top:20px;">
        <a href="${acceptLink}"
          style="padding:10px 15px;background:green;color:white;border-radius:5px;text-decoration:none;margin-right:10px;">
          ✅ Approve
        </a>
        <a href="${declineLink}"
          style="padding:10px 15px;background:red;color:white;border-radius:5px;text-decoration:none;">
          ❌ Decline
        </a>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: '"Order System 🏭" <kishore.rnaipl@gmail.com>',
    to: APPROVER_EMAIL,
    subject: `🔔 Order #${order.number} Pending Approval`,
    html,
  });

  console.log("📧 Approval email sent to:", APPROVER_EMAIL);
}

// 📦 Save delivery details to orders table (JSONB column)
app.post("/api/order/:id/deliver", async (req, res) => {
  const { deliveredItems, status } = req.body;
  console.log(`📦 Delivery request for order ${req.params.id}, status: ${status}`);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get existing delivered_items from database
    const existingOrder = await client.query(
      'SELECT delivered_items FROM orders WHERE id = $1',
      [req.params.id]
    );

    let allDeliveredItems = [];
    if (existingOrder.rows.length > 0 && existingOrder.rows[0].delivered_items) {
      allDeliveredItems = existingOrder.rows[0].delivered_items;
    }

    // Add new delivered items with timestamp
    const newDeliveredItems = deliveredItems
      .filter(item => item.deliveredQty > 0)
      .map(item => ({
        ...item,
        deliveryDate: new Date().toISOString()
      }));

    allDeliveredItems = [...allDeliveredItems, ...newDeliveredItems];

    // Update order with new status and delivered items
    await client.query(
      'UPDATE orders SET status = $1, delivered_items = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [status, JSON.stringify(allDeliveredItems), req.params.id]
    );

    await client.query('COMMIT');
    console.log(`✅ Order ${req.params.id} delivery saved with status: ${status}`);
    res.json({ success: true, message: "Delivery saved successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Error saving delivery:", err);
    res.status(500).json({ error: "Failed to save delivery details" });
  } finally {
    client.release();
  }
});

// 📦 Save collection history to orders table (JSONB column)
app.post("/api/order/:id/collection", async (req, res) => {
  const { collectedBy, collectionType } = req.body;
  console.log(`👤 Collection request for order ${req.params.id}: ${collectionType} by ${collectedBy}`);
  const client = await pool.connect();
  
  try {
    // Get existing collection_history from database
    const existingOrder = await client.query(
      'SELECT collection_history FROM orders WHERE id = $1',
      [req.params.id]
    );

    let collectionHistory = [];
    if (existingOrder.rows.length > 0 && existingOrder.rows[0].collection_history) {
      collectionHistory = existingOrder.rows[0].collection_history;
    }

    // Add new collection entry
    const newCollection = {
      collectedBy: collectedBy,
      type: collectionType,
      timestamp: new Date().toLocaleString()
    };

    collectionHistory.push(newCollection);

    // Update order with new collection history
    await client.query(
      'UPDATE orders SET collection_history = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(collectionHistory), req.params.id]
    );

    console.log(`✅ Collection recorded for order ${req.params.id}: ${collectionType} by ${collectedBy}`);
    res.json({ success: true, collection: newCollection });
  } catch (err) {
    console.error("❌ Error saving collection:", err);
    res.status(500).json({ error: "Failed to save collection history" });
  } finally {
    client.release();
  }
});

// 📦 Create new order (from frontend)
app.post("/api/order", async (req, res) => {
  const { userDetails, cart, category } = req.body;

  if (!userDetails || !cart || cart.length === 0) {
    return res.status(400).json({ error: "Invalid order data" });
  }

  const orderId = Date.now().toString();
  const orderNumber = Math.floor(1000 + Math.random() * 9000);
  const orderDate = userDetails.date || new Date().toISOString().split('T')[0];

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert order with empty JSONB arrays for delivered_items and collection_history
    const orderQuery = `
      INSERT INTO orders (id, order_number, order_date, user_name, emp_id, department, zone, user_group, category, status, delivered_items, collection_history)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    
    await client.query(orderQuery, [
      orderId,
      orderNumber,
      orderDate,
      userDetails.name,
      userDetails.empId,
      userDetails.dept,
      userDetails.zone,
      userDetails.group,
      category || "Unknown",
      "Pending",
      JSON.stringify([]), // Empty delivered_items
      JSON.stringify([])  // Empty collection_history
    ]);

    // Insert order items
    const itemQuery = `
      INSERT INTO order_items (order_id, part_number, description, quantity)
      VALUES ($1, $2, $3, $4)
    `;

    for (const item of cart) {
      await client.query(itemQuery, [
        orderId,
        item.partNumber,
        item.description,
        item.quantity
      ]);
    }

    await client.query('COMMIT');

    // Create order object for email
    const newOrder = {
      id: orderId,
      number: orderNumber,
      date: orderDate,
      userDetails: {
        name: userDetails.name,
        empId: userDetails.empId,
        dept: userDetails.dept,
        zone: userDetails.zone,
        group: userDetails.group,
        date: orderDate
      },
      cart: cart.map((item, index) => ({
        id: item.id || Date.now() + index,
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity
      })),
      category: category || "Unknown",
      status: "Pending"
    };

    console.log("✅ Order saved to database:", orderId);

    try {
      await sendApprovalEmail(newOrder);
      res.json({ success: true, message: "✅ Order submitted for approval!" });
    } catch (err) {
      console.error("❌ Email sending failed:", err);
      res.json({ success: true, message: "✅ Order submitted (email notification failed)" });
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Database error:", err);
    res.status(500).json({ error: "Failed to save order" });
  } finally {
    client.release();
  }
});

// ✅ Approve order
app.get("/api/order/:id/accept", async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['Approved', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.send("<h2>❌ Invalid Order ID</h2>");
    }

    const order = result.rows[0];
    
    console.log(`✅ Order #${order.order_number} approved`);
    res.send(`
      <h2>✅ Order #${order.order_number} Approved Successfully!</h2>
      <p>This order is now marked as <strong>Approved</strong>.</p>
      <p><a href="${BASE_URL}">Return to Dashboard</a></p>
    `);
  } catch (err) {
    console.error("❌ Database error:", err);
    res.send("<h2>❌ Error updating order</h2>");
  } finally {
    client.release();
  }
});

// ❌ Decline order
app.get("/api/order/:id/decline", async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['Rejected', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.send("<h2>❌ Invalid Order ID</h2>");
    }

    const order = result.rows[0];
    
    console.log(`❌ Order #${order.order_number} declined`);
    res.send(`<h2>❌ Order #${order.order_number} Declined.</h2>`);
  } catch (err) {
    console.error("❌ Database error:", err);
    res.send("<h2>❌ Error updating order</h2>");
  } finally {
    client.release();
  }
});

// 📊 Get all orders (for dashboard) - WITH DETAILED LOGGING
app.get("/api/orders", async (req, res) => {
  console.log("📊 Dashboard requesting orders...");
  const client = await pool.connect();
  
  try {
    // First check if order_items table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'order_items'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("⚠️ order_items table does not exist!");
      // If table doesn't exist, just get orders without items
      const simpleQuery = await client.query('SELECT * FROM orders ORDER BY created_at DESC');
      
      const ordersList = simpleQuery.rows.map(row => ({
        id: row.id,
        number: row.order_number,
        date: row.order_date,
        userDetails: {
          name: row.user_name,
          empId: row.emp_id,
          dept: row.department,
          zone: row.zone,
          group: row.user_group,
          date: row.order_date
        },
        cart: [],
        deliveredItems: row.delivered_items || [],
        collectionHistory: row.collection_history || [],
        category: row.category,
        status: row.status,
        totalAmount: row.total_amount
      }));
      
      console.log(`✅ Returning ${ordersList.length} orders (without items)`);
      return res.json(ordersList);
    }

    // If order_items exists, use the full query
    const ordersQuery = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'partNumber', oi.part_number,
                   'description', oi.description,
                   'quantity', oi.quantity
                 ) ORDER BY oi.id
               ) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
             ) as cart
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    const result = await client.query(ordersQuery);
    console.log(`📦 Found ${result.rows.length} orders in database`);
    
    // Transform the data to match your frontend format
    const ordersList = result.rows.map(row => {
      const order = {
        id: row.id,
        number: row.order_number,
        date: row.order_date,
        userDetails: {
          name: row.user_name,
          empId: row.emp_id,
          dept: row.department,
          zone: row.zone,
          group: row.user_group,
          date: row.order_date
        },
        cart: Array.isArray(row.cart) ? row.cart.filter(item => item.partNumber) : [],
        deliveredItems: row.delivered_items || [],
        collectionHistory: row.collection_history || [],
        category: row.category,
        status: row.status,
        totalAmount: row.total_amount
      };
      
      console.log(`   Order ${order.number}: ${order.status}, ${order.cart.length} items, ${order.deliveredItems.length} deliveries, ${order.collectionHistory.length} collections`);
      return order;
    });

    console.log(`✅ Returning ${ordersList.length} orders to dashboard`);
    res.json(ordersList);
  } catch (err) {
    console.error("❌ Database error in /api/orders:", err);
    console.error("Error details:", err.message);
    res.status(500).json({ error: "Failed to fetch orders", details: err.message });
  } finally {
    client.release();
  }
});

// 🧪 Debug endpoint to check orders
app.get("/api/debug/orders", async (req, res) => {
  const client = await pool.connect();
  
  try {
    const countResult = await client.query('SELECT COUNT(*) FROM orders');
    const ordersResult = await client.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10');
    
    // Check if columns exist
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
    `);
    
    res.json({
      totalOrders: parseInt(countResult.rows[0].count),
      recentOrders: ordersResult.rows,
      columns: columnsResult.rows
    });
  } catch (err) {
    console.error("❌ Database error:", err);
    res.status(500).json({ error: "Failed to fetch debug info" });
  } finally {
    client.release();
  }
});

// 🌍 Start server
app.listen(5000, () => {
  console.log("✅ Server running at http://localhost:5000");
  console.log("📊 Dashboard endpoint: http://localhost:5000/api/orders");
  console.log("🧪 Debug endpoint: http://localhost:5000/api/debug/orders");
  console.log("💡 Test in browser: http://localhost:5000/api/orders");
});