require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ Mongo error:', err));

// =====================
// LINE CONFIG
// =====================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const Order = require('./models/Order');
// =====================
// BASIC ROUTES
// =====================
app.get('/', (req, res) => {
  res.send('LINE bot works');
});

// тест API (для фронта)
app.get('/api/orders', (req, res) => {
  res.json([
    { id: 1, text: "B102", status: "pending" },
    { id: 2, text: "A205", status: "done" }
  ]);
});

// =====================
// LINE WEBHOOK
// =====================
const middleware = line.middleware(config);

app.post('/webhook', middleware, async (req, res) => {
  try {
    const events = req.body.events;

    for (const event of events) {

      if (event.type === 'message' && event.message.type === 'text') {

        const text = event.message.text;

        // 👉 фильтр: сохраняем только ENG сообщения
        const isEng = text.toLowerCase().includes('@eng');

        if (!isEng) {
          console.log('⛔ SKIP (not ENG):', text);
          return;
        }

        const order = await Order.create({
          lineMessageId: event.message.id,
          text: text,
          userId: event.source.userId,
          groupId: event.source.groupId || null,
          sourceType: event.source.type,
          quotedMessageId: event.message.quotedMessageId || null,
          status: "pending"
        });

        console.log('🟡 SAVED ENG:', order.text);

        // 👉 если это ответ — закрываем старый заказ
        if (event.message.quotedMessageId) {

          const parent = await Order.findOne({
            lineMessageId: event.message.quotedMessageId
          });

          if (parent) {
            parent.status = "done";
            await parent.save();

            console.log('🟢 CLOSED:', parent.text);
          }
        }
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
}).on('error', (err) => {
  console.log('SERVER ERROR:', err);
});