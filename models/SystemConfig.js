/**
 * SystemConfig Model
 * Stores global persistent configuration flags (e.g. maintenance mode) in MongoDB.
 */

const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true, // Manages createdAt and updatedAt
  }
);

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
