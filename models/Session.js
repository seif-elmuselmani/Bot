/**
 * Session Model
 * Stores user wizard states persistently in MongoDB.
 * Sessions expire automatically after 7 days of inactivity.
 */

const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    data: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Create a TTL (Time-To-Live) index to automatically delete sessions after 7 days (604800 seconds)
SessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('Session', SessionSchema);
