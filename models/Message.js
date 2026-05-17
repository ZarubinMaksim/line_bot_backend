const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  lineMessageId: String,
  orderId: mongoose.Schema.Types.ObjectId,

  text: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', MessageSchema);