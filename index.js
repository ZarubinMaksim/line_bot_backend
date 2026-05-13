require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

// =====================
// LINE CONFIG
// =====================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

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

    console.log('🔥 WEBHOOK HIT');
    console.log('Events count:', events.length);

    for (const event of events) {
      console.log('----------------------');
      console.log(JSON.stringify(event, null, 2));

      // только текстовые сообщения
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text;

        console.log('💬 MESSAGE:', text);

        // источник
        if (event.source.type === 'user') {
          console.log('👤 PRIVATE CHAT');
        }

        if (event.source.type === 'group') {
          console.log('👥 GROUP CHAT');
          console.log('GROUP ID:', event.source.groupId);
        }

        console.log('USER ID:', event.source.userId);
      }
    }

    // ВАЖНО: LINE всегда должен получить 200
    res.sendStatus(200);

  } catch (err) {
    console.error('💥 WEBHOOK ERROR:', err);

    // даже при ошибке LINE должен получить 200
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