require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.get('/', (req, res) => {
  res.send('LINE bot works');
});

app.post('/webhook', line.middleware(config), (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    console.log('EVENT:');
    console.log(JSON.stringify(event, null, 2));

    // если сообщение из группы
    if (event.source.type === 'group') {
      console.log('GROUP ID:', event.source.groupId);
    }

    // текст сообщения
    if (event.type === 'message' && event.message.type === 'text') {
      console.log('MESSAGE:', event.message.text);
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
}).on('error', (err) => {
  console.log('SERVER ERROR:', err);
});