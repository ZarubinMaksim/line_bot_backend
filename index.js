require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();
app.use(express.json());

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.get('/', (req, res) => {
  res.send('LINE bot works');
});

// =====================
// ORDERS API
// =====================
app.get('/api/orders', (req, res) => {
  res.json([
    { id: "1", text: "B102", status: "new" },
    { id: "2", text: "A205", status: "done" }
  ]);
});

// =====================
// LINE WEBHOOK
// =====================
app.post('/webhook', line.middleware(config), (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    console.log('EVENT:');
    console.log(JSON.stringify(event, null, 2));

    if (event.source.type === 'group') {
      console.log('GROUP ID:', event.source.groupId);
    }

    if (event.type === 'message' && event.message.type === 'text') {
      console.log('MESSAGE:', event.message.text);
    }
  }

  res.sendStatus(200);
});

// =====================
// START SERVER
// =====================
app.listen(3001, () => {
  console.log('Server started on port 3001');
});