require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const line = require('@line/bot-sdk');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// =====================
// SOCKET (FIXED)
// =====================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

// лог подключения сокета
io.on('connection', (socket) => {
  console.log('🟢 SOCKET CONNECTED:', socket.id);
});

// =====================
// MONGO
// =====================
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ Mongo error:', err));

// =====================
// MODEL
// =====================
const Order = require('./models/Order');

// =====================
// LINE CONFIG
// =====================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const middleware = line.middleware(config);

// =====================
// ROUTES
// =====================
app.get('/', (req, res) => {
  res.send('LINE bot works');
});

// ORDERS API
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    res.json(
      orders.map(o => ({
        id: o._id.toString(),
        text: o.text,
        status: o.status,
        userId: o.userId,
        groupId: o.groupId,
        createdAt: o.createdAt
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// =====================
// WEBHOOK
// =====================
app.post('/webhook', middleware, async (req, res) => {
  try {
    const events = req.body.events;

    for (const event of events) {

      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text = event.message.text;

      if (!text.toLowerCase().includes('@eng')) {
        console.log('⛔ SKIP:', text);
        continue;
      }

      // =====================
      // CREATE ORDER
      // =====================
      const order = await Order.create({
        lineMessageId: event.message.id,
        text,
        userId: event.source.userId,
        groupId: event.source.groupId || null,
        sourceType: event.source.type,
        quotedMessageId: event.message.quotedMessageId || null,
        status: "pending"
      });

      console.log('🟡 SAVED:', order.text);

      // 🔥 REALTIME NEW
      io.emit('order:new', {
        id: order._id.toString(),
        text: order.text,
        status: order.status
      });

      // =====================
      // DONE LOGIC
      // =====================
      if (event.message.quotedMessageId) {

        const parent = await Order.findOne({
          lineMessageId: event.message.quotedMessageId
        });

        if (parent) {
          parent.status = "done";
          await parent.save();

          console.log('🟢 DONE:', parent.text);

          io.emit('order:update', {
            id: parent._id.toString(),
            status: "done"
          });
        }
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error('WEBHOOK ERROR:', err);
    res.sendStatus(200);
  }
});

// =====================
// START
// =====================
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});