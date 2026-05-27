/**
 * Order Model
 * Tracks order requests, service types, points payment, files uploaded by users, and administrative completions.
 */

const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    orderId: {
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
    serviceType: {
      type: String,
      required: true,
      enum: {
        values: [
          'similarity_report',
          'ai_writing_report',
          'cv_design',
          'portfolio_design',
          'pdf_to_word',
          'translation',
          'ai_reduction',
        ],
        message: '{VALUE} is not a supported service type.',
      },
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['pending_payment', 'paid', 'in_progress', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid order status.',
      },
      default: 'paid',
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Service price cannot be negative.'],
    },
    fileId: {
      type: String, // Telegram file ID for the source file uploaded by the user
      trim: true,
    },
    wordFileId: {
      type: String, // Telegram file ID for the Word document to edit
      trim: true,
    },
    textInput: {
      type: String, // Textual context provided by user (if applicable)
      trim: true,
    },
    adminMessageId: {
      type: Number, // Reference message ID sent to admin channel (to match replies)
    },
    deliveredFileId: {
      type: String, // Telegram file ID of the completed result delivered back to the user
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Compile and export the model
module.exports = mongoose.model('Order', OrderSchema);
