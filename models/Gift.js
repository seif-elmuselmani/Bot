const mongoose = require('mongoose');

const GiftSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    type: { type: String, enum: ['love', 'grad'], required: true },
    theme: { type: String, default: 'default' },
    
    // Love specific fields
    introTitle: { type: String },
    messageBody: { type: String },
    collageMainPhoto: { type: String }, // URL
    messageTagPhoto: { type: String }, // URL
    messagePhotos: [{ type: String }], // Array of URLs
    heartPhotos: [{ type: String }], // Array of URLs
    flowerPhotos: [{ type: String }], // Array of URLs
    
    // Grad specific fields
    texts: {
        message1Title: String,
        message1Body: String,
        message2Title: String,
        message2Body: String
    },
    polaroidPhoto: { type: String }, // URL
    filmStripPhotos: [{ type: String }], // Array of URLs
    photoboothPhotos: [{ type: String }], // Array of URLs
    voiceNote: { type: String }, // URL
    
    // Common fields
    music: { type: String }, // URL
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gift', GiftSchema);
