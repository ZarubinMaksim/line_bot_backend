const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  lineMessageId: { type: String, unique: true },
  quoteToken: String,
  text: String,

  status: {
    type: String,
    default: "pending" // pending | done
  },

  userId: String,
  groupId: String,

  quotedMessageId: String, // reply связь

  sourceType: String, // user / group

  createdAt: {
    type: Date,
    default: Date.now
  },
  doneAt: Date,
});

module.exports = mongoose.model('Order', orderSchema);