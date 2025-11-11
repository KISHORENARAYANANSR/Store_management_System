const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🧠 Temporary in-memory store
let orders = {};

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

// 📦 Create new order (from frontend)
app.post("/api/order", async (req, res) => {
  const { userDetails, cart, category } = req.body;

  if (!userDetails || !cart || cart.length === 0) {
    return res.status(400).json({ error: "Invalid order data" });
  }

  const orderId = Date.now().toString();
  const orderNumber = Math.floor(1000 + Math.random() * 9000);

  // ✅ FIX: Add date field and proper structure for dashboard compatibility
  const newOrder = {
    id: orderId,
    number: orderNumber,
    date: userDetails.date || new Date().toISOString().split('T')[0],
    userDetails: {
      name: userDetails.name,
      empId: userDetails.empId,
      dept: userDetails.dept,
      zone: userDetails.zone,
      group: userDetails.group,
      date: userDetails.date || new Date().toISOString().split('T')[0],
      orderDate: userDetails.date || new Date().toISOString().split('T')[0]
    },
    cart: cart.map((item, index) => ({
      id: item.id || Date.now() + index,
      partNumber: item.partNumber,
      description: item.description,
      quantity: item.quantity
    })),
    category: category || "Unknown",
    status: "Pending",
    deliveredItems: [],
    totalAmount: 0
  };

  orders[orderId] = newOrder;
  console.log("✅ Order created:", orderId, "Total orders:", Object.keys(orders).length);

  try {
    await sendApprovalEmail(newOrder);
    res.json({ success: true, message: "✅ Order submitted for approval!" });
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    // Still save order even if email fails
    res.json({ success: true, message: "✅ Order submitted (email notification failed)" });
  }
});

// ✅ Approve order
app.get("/api/order/:id/accept", (req, res) => {
  const order = orders[req.params.id];
  if (!order) return res.send("<h2>❌ Invalid Order ID</h2>");
  if (order.status !== "Pending")
    return res.send(`<h2>⚠️ Order already ${order.status}</h2>`);

  order.status = "Approved";
  console.log(`✅ Order #${order.number} approved`);
  res.send(`
    <h2>✅ Order #${order.number} Approved Successfully!</h2>
    <p>This order is now marked as <strong>Approved</strong>.</p>
  `);
});

// ❌ Decline order
app.get("/api/order/:id/decline", (req, res) => {
  const order = orders[req.params.id];
  if (!order) return res.send("<h2>❌ Invalid Order ID</h2>");
  if (order.status !== "Pending")
    return res.send(`<h2>⚠️ Order already ${order.status}</h2>`);

  order.status = "Declined";
  console.log(`❌ Order #${order.number} declined`);
  res.send(`<h2>❌ Order #${order.number} Declined.</h2>`);
});

// 📊 Get all orders (for dashboard)
app.get("/api/orders", (req, res) => {
  const ordersList = Object.values(orders);
  console.log("📊 Dashboard requested orders. Sending:", ordersList.length, "orders");
  res.json(ordersList);
});

// 🧪 Debug endpoint to check orders
app.get("/api/debug/orders", (req, res) => {
  res.json({
    totalOrders: Object.keys(orders).length,
    orders: Object.values(orders)
  });
});

// 🌍 Start server
app.listen(5000, () => {
  console.log("✅ Server running at http://localhost:5000");
  console.log("📊 Dashboard endpoint: http://localhost:5000/api/orders");
  console.log("🧪 Debug endpoint: http://localhost:5000/api/debug/orders");
});