/**
 * User Model
 * Defines the schema and indexes for Telegram users utilizing the bot.
 */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Speeds up lookup operations on Telegram webhook calls
    },
    username: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 10,
      min: [0, 'Balance cannot be negative.'], // Prevent negative point state
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isBanned: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    referredBy: {
      type: String,
      default: null,
    },
    referralRewardClaimed: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Virtual for getting user's full name
UserSchema.virtual('fullName').get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.username || 'Anonymous User';
});

// Compile and export the model
module.exports = mongoose.model('User', UserSchema);
