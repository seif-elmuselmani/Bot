/**
 * Deposit Model
 * Represents a wallet recharge request, containing the payment receipt photo,
 * amount, sender's mobile number, and current approval state.
 */

const mongoose = require('mongoose');

const DepositSchema = new mongoose.Schema(
  {
    depositId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    telegramId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Recharge amount must be greater than zero.'],
    },
    senderPhone: {
      type: String,
      required: true,
      trim: true,
    },
    receiptFileId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid deposit status.',
      },
      default: 'pending',
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Compile and export the model
module.exports = mongoose.model('Deposit', DepositSchema);
