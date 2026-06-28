/**
 * Database Connection Module
 * Handles connection setup and lifecycle events for MongoDB using Mongoose.
 */

const mongoose = require('mongoose');

/**
 * Establishes connection to the MongoDB instance.
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
  }

  // Setup connection event listeners for better monitoring
  mongoose.connection.on('connected', () => {
    console.log('Mongoose: Connected to MongoDB successfully.');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`Mongoose: Connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('Mongoose: Disconnected from MongoDB.');
  });

  try {
    // Connect using mongoose
    await mongoose.connect(uri);
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
