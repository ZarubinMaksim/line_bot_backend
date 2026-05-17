require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const line = require('@line/bot-sdk');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// =====================
// SOCKET
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
// MODELS
// =====================
const Order = require('./models/Order');
const Message = require('./models/Message');

// =====================
// CORS
// =====================
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
// LINE CONFIG
// =====================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const middleware = line.middleware(config);

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

// =====================
// BASIC ROUTE
// =====================
app.get('/', (req, res) => {
  res.send('LINE bot works');
});

// =====================
// WEBHOOK
// =====================
app.post('/webhook', middleware, async (req, res) => {

  try {

    const events = req.body.events;

    for (const event of events) {

      console.log('EVENT:', event);

      if (
        event.type !== 'message' ||
        event.message.type !== 'text'
      ) continue;

      const textRaw = event.message.text;
      const text = textRaw.toLowerCase();

      const isEng = ['@eng', '-hk'].some(tag =>
        text.includes(tag)
      );

      const isReply = !!event.message.quotedMessageId;

      const isDone = text.includes('done');

      // =====================
      // CREATE REQUEST
      // =====================
      if (isEng) {

        const createdOrder = await Order.create({
          lineMessageId: event.message.id,
          quoteToken: event.message.quoteToken,
          text: textRaw,
          userId: event.source.userId,
          groupId: event.source.groupId || null,
          quotedMessageId: event.message.quotedMessageId || null,
          status: "pending"
        });

        // SAVE ORIGINAL MESSAGE
        await Message.create({
          lineMessageId: event.message.id,
          orderId: createdOrder._id,
          text: textRaw
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

      // =====================
      // DONE LOGIC
      // =====================
      if (isReply && isDone) {

        console.log('🟢 DONE REPLY');

        // FIND MESSAGE THAT WAS REPLIED TO
        const message = await Message.findOne({
          lineMessageId: event.message.quotedMessageId
        });

        console.log('FOUND MESSAGE:', message);

        if (message) {

          // FIND ORIGINAL ORDER
          const parent = await Order.findById(message.orderId);

          console.log('FOUND ORDER:', parent);

          if (parent) {

            parent.status = "done";

            await parent.save();

            console.log('✅ ORDER COMPLETED');

            io.emit('order:update', {
              id: parent._id.toString(),
              status: "done"
            });
          }
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
// IMPORTANT
// MUST BE AFTER WEBHOOK
// =====================
app.use(express.json());

// =====================
// API
// =====================
app.get('/api/orders', async (req, res) => {

  const orders = await Order.find()
    .sort({ createdAt: -1 });

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

app.get('/api/orders/:id/history', async (req, res) => {
  try {
console.log('HISTORY ORDER ID:', req.params.id);

    const messages = await Message.find({
      orderId: req.params.id
    }).sort({ createdAt: 1 });

    res.json(messages);
    console.log('MESSAGES:', messages);

  } catch (err) {

    console.log(err);

    res.sendStatus(500);
  }
});

// =====================
// SEND FOLLOW-UP
// =====================
app.post('/api/reply', async (req, res) => {

  try {

    console.log('REQ BODY:', req.body);

    const order = await Order.findById(req.body.orderId);

    console.log('FOUND ORDER:', order);

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    const response = await client.pushMessage({
      to: order.userId,
      messages: [
        {
          type: 'text',
          text: req.body.text,
          quoteToken: order.quoteToken
        }
      ]
    });

    console.log('LINE RESPONSE:', response);

    // SAVE FOLLOW-UP MESSAGE
    if (response.sentMessages?.[0]?.id) {

      await Message.create({
        lineMessageId: response.sentMessages[0].id,
        orderId: order._id,
        text: req.body.text
      });

      console.log('💾 FOLLOW-UP MESSAGE SAVED');
    }

    res.sendStatus(200);

  } catch (err) {

    console.log('REPLY ERROR:', err);

    res.sendStatus(500);
  }
});

// =====================
// START
// =====================
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});