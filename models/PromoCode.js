/**
 * PromoCode Model
 * Represents promotional coupon codes that users can redeem to add points to their wallet.
 * Stores maximum usage bounds and an array of telegramIds who have claimed it.
 */

const mongoose = require('mongoose');

const PromoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true, // Forces all promo codes to be stored as uppercase
      index: true,
    },
    rewardPoints: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Reward points cannot be negative.'],
    },
    maxUses: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Maximum usage must be at least 1.'],
    },
    usedBy: [
      {
        type: String, // Array of Telegram user IDs who have claimed this code
        index: true,
      },
    ],
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Virtual to check if promo code has uses remaining
PromoCodeSchema.virtual('isValid').get(function () {
  return this.usedBy.length < this.maxUses;
});

// Compile and export the model
module.exports = mongoose.model('PromoCode', PromoCodeSchema);
