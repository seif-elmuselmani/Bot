const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Gift = require('./models/Gift');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB for migration");
    
    // Migrate Love Gifts
    const loveDbPath = path.join(__dirname, '..', '1', 'Server', 'db.json');
    if (fs.existsSync(loveDbPath)) {
        const loveData = JSON.parse(fs.readFileSync(loveDbPath, 'utf8'));
        // loveData is an object mapping ids to gifts
        for (const [id, gift] of Object.entries(loveData)) {
            const exists = await Gift.findOne({ id: gift.id });
            if (!exists) {
                const fixUrl = (url) => {
                    if (!url) return url;
                    if (Array.isArray(url)) return url.map(fixUrl);
                    if (url.includes('/uploads/')) {
                        return '/love/uploads' + url.split('/uploads')[1];
                    }
                    if (url.startsWith('uploads/')) {
                        return '/love/' + url;
                    }
                    return url;
                };

                await Gift.create({
                    id: gift.id,
                    type: 'love',
                    introTitle: gift.texts?.introTitle,
                    messageBody: gift.texts?.messageBody,
                    collageMainPhoto: fixUrl(gift.assets?.flowerImage), 
                    messageTagPhoto: fixUrl(gift.assets?.envelopeIcon),
                    messagePhotos: [],
                    heartPhotos: [],
                    flowerPhotos: [],
                    music: fixUrl(gift.assets?.music)
                });
                console.log("Migrated love gift:", gift.id);
            }
        }
    }

    // Migrate Grad Gifts
    const gradDbPath = path.join(__dirname, '..', '2', 'Server', 'db.json');
    if (fs.existsSync(gradDbPath)) {
        const gradData = JSON.parse(fs.readFileSync(gradDbPath, 'utf8'));
        for (const [id, gift] of Object.entries(gradData)) {
            const exists = await Gift.findOne({ id: gift.id });
            if (!exists) {
                const fixUrl = (url) => {
                    if (!url) return url;
                    if (Array.isArray(url)) return url.map(fixUrl);
                    if (url.includes('/uploads/')) {
                        return '/grad/uploads' + url.split('/uploads')[1];
                    }
                    if (url.startsWith('uploads/')) {
                        return '/grad/' + url;
                    }
                    return url;
                };

                await Gift.create({
                    id: gift.id,
                    type: 'grad',
                    theme: gift.theme || 'gold',
                    texts: gift.texts,
                    polaroidPhoto: fixUrl(gift.assets?.polaroidPhoto),
                    filmStripPhotos: fixUrl(gift.assets?.filmPhotos) || [],
                    photoboothPhotos: fixUrl(gift.assets?.pbPhotos) || [],
                    voiceNote: fixUrl(gift.assets?.voiceNote),
                    music: fixUrl(gift.assets?.music)
                });
                console.log("Migrated grad gift:", gift.id);
            }
        }
    }

    console.log("Migration complete!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Migration error:", err);
    process.exit(1);
  });
