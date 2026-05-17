require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const line = require('@line/bot-sdk');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// =====================
// SOCKET FIX
// =====================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

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

const cors = require('cors');

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://lghrequests.com"
  ],
  credentials: true
}));

// =====================
// LINE CONFIG зззз
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

// =====================
// API
// =====================
app.get('/api/orders', async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });

  res.json(
    orders.map(o => ({
      id: o._id.toString(),
      text: o.text,
      status: o.status,
      groupId: o.groupId,
      createdAt: o.createdAt
    }))
  );
});

app.post('/api/reply', async (req, res) => {
  console.log('YA TUT')
  const order = await Order.findById(req.body.orderId);

  await client.pushMessage(order.userId, {
    type: 'text',
    text: req.body.text,
    quoteToken: order.lineMessageId
  });

  res.sendStatus(200);
});

// =====================
// WEBHOOK
// =====================
app.post('/webhook', middleware, async (req, res) => {
  try {
    const events = req.body.events;

    for (const event of events) {

      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const textRaw = event.message.text;
      const text = textRaw.toLowerCase();

      const isEng = ['@eng', '-hk'].some(tag => text.includes(tag));
      const isReply = !!event.message.quotedMessageId;
      const isDone = text.includes('done');

      // =========================
      // 1. CREATE REQUEST (ВСЕГДА если @eng)
      // =========================
      let createdOrder = null;

      if (isEng) {

        createdOrder = await Order.create({
          lineMessageId: event.message.id,
          text: textRaw,
          userId: event.source.userId,
          groupId: event.source.groupId || null,
          quotedMessageId: event.message.quotedMessageId || null,
          status: "pending"
        });

        console.log('🟡 NEW REQUEST:', createdOrder);

        io.emit('order:new', {
          id: createdOrder._id.toString(),
          text: createdOrder.text,
          status: createdOrder.status,
          groupId: createdOrder.groupId,
          quotedMessageId: createdOrder.quotedMessageId,
          createdAt: createdOrder.createdAt
        });
      }

      // =========================
      // 2. UPDATE STATUS (DONE)
      // =========================
      if (isReply && isDone) {

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