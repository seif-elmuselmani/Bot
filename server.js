const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
const { uploadStream } = require('./src/config/cloudinary');
const Gift = require('./models/Gift');

const app = express();
app.use(cors());
app.use(express.json());

// Set up multer memory storage for handling form uploads from admin page
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Serve static files for Love and Grad templates (now internal to the Bot folder for easy deployment)
app.use('/love', express.static(path.join(__dirname, 'public/love')));
app.use('/grad', express.static(path.join(__dirname, 'public/grad')));
app.use('/mini-app', express.static(path.join(__dirname, 'public/mini-app')));

// Helper to upload single file
const uploadSingleFile = async (file, folder) => {
    if (!file) return null;
    const result = await uploadStream(file.buffer, folder, 'auto');
    return result.secure_url;
};

// API: Get Gift
app.get('/api/gift/:id', async (req, res) => {
    try {
        const gift = await Gift.findOne({ id: req.params.id }).lean();
        if (gift) {
            const fixPath = (url, prefix) => {
                if (!url) return url;
                if (Array.isArray(url)) return url.map(u => fixPath(u, prefix));
                if (typeof url === 'string' && url.startsWith('/assets/')) {
                    return prefix + url;
                }
                return url;
            };

            const presetMusicMap = {
                'grad_1': '/grad/assets/sounds/song_1.mp3',
                'grad_2': '/grad/assets/sounds/song_2.mp3',
                'grad_3': '/grad/assets/sounds/song_3.mp3',
                'grad_4': '/grad/assets/sounds/song_4.mp3',
                'grad_5': '/grad/assets/sounds/song_5.mp3',
                'grad_6': '/grad/assets/sounds/song_6.mp3',
                'grad_7': '/grad/assets/sounds/song_7.mp3',
                'grad_8': '/grad/assets/sounds/song_8.mp3',
                'grad_9': '/grad/assets/sounds/song_9.mp3',
                'grad_10': '/grad/assets/sounds/song_10.mp3',
                'grad_11': '/grad/assets/sounds/song_11.mp3',
                'love_1': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
                'love_2': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                'apology_1': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                'friends_1': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
            };

            if (gift.type === 'love') {
                const defaultLovePhotos = [
                    "https://picsum.photos/seed/love1/500/500", "https://picsum.photos/seed/love2/500/500", "https://picsum.photos/seed/love3/500/500"
                ];
                
                return res.json({
                    id: gift.id,
                    texts: {
                        introTitle: gift.introTitle || "عط¯عٹط¯ ط­ط¨ ط³ط¹عٹط¯ عٹط§ ط­ط¨عٹط¨طھعٹ) ًں“‌",
                        introSubtitle: "click the cake to see a suprise !",
                        chooseGiftTitle: "choose your gift",
                        messageTitle: "Happy Birthday",
                        messageBody: gift.messageBody,
                        messageTag: "You're mine",
                        goBack: "GO BACK",
                        flowerTitle: "flower for you!",
                        goBackOrLastPage: "GO BACK OR LAST PAGE"
                    },
                    assets: {
                        music: presetMusicMap[gift.music] || fixPath(gift.music, '/love') || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
                        cakeIcon: "/love/assets/cake.png",
                        flowerImage: fixPath(gift.collageMainPhoto, '/love') || "https://picsum.photos/seed/love6/500/500",
                        envelopeIcon: "/love/assets/envelope.png",
                        flowerIcon: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f490.svg",
                        messageTagPhoto: fixPath(gift.messageTagPhoto, '/love') || "https://picsum.photos/seed/love10/500/500",
                        messagePhotos: gift.messagePhotos && gift.messagePhotos.length > 0 ? fixPath(gift.messagePhotos, '/love') : defaultLovePhotos,
                        flowerPhotos: gift.flowerPhotos && gift.flowerPhotos.length > 0 ? fixPath(gift.flowerPhotos, '/love') : defaultLovePhotos.slice(0, 2),
                        collageMainPhoto: fixPath(gift.collageMainPhoto, '/love') || "https://picsum.photos/seed/love6/500/500",
                        heartsPhotos: gift.heartPhotos && gift.heartPhotos.length > 0 ? fixPath(gift.heartPhotos, '/love') : defaultLovePhotos
                    }
                });
            } else if (gift.type === 'grad') {
                const defaultGradPolaroid = "/grad/assets/defaults/grad_portrait.png";
                const defaultGradFilm = [
                    "/grad/assets/defaults/grad_diploma.png",
                    "/grad/assets/defaults/grad_friends.png",
                    "/grad/assets/defaults/grad_campus.png",
                    "/grad/assets/defaults/grad_balloons.png"
                ];
                const defaultGradPB = [
                    "/grad/assets/defaults/grad_flowers.png",
                    "/grad/assets/defaults/grad_friends.png",
                    "/grad/assets/defaults/grad_diploma.png"
                ];
                
                return res.json({
                    id: gift.id,
                    theme: gift.theme || 'gold',
                    texts: {
                        message1Title: gift.texts?.message1Title || "Congratulations, Graduate!",
                        message1Body: gift.texts?.message1Body || "All those late nights, endless cups of coffee, and moments of doubt have finally paid off.",
                        message2Title: gift.texts?.message2Title || "To Your Next Chapter",
                        message2Body: gift.texts?.message2Body || "This degree is just the beginning of your incredible journey."
                    },
                    assets: {
                        music: presetMusicMap[gift.music] || fixPath(gift.music, '/grad') || "/grad/assets/sounds/song_1.mp3",
                        polaroidPhoto: fixPath(gift.polaroidPhoto, '/grad') || defaultGradPolaroid,
                        filmStripPhotos: gift.filmStripPhotos && gift.filmStripPhotos.length >= 4 ? fixPath(gift.filmStripPhotos, '/grad') : defaultGradFilm,
                        photoboothPhotos: gift.photoboothPhotos && gift.photoboothPhotos.length >= 3 ? fixPath(gift.photoboothPhotos, '/grad') : defaultGradPB,
                        voiceNote: fixPath(gift.voiceNote, '/grad')
                    }
                });
            }
            return res.json(gift);
        }
        res.status(404).json({ error: "Gift not found" });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// Admin API: Create Love Gift (via admin.html)
app.post('/api/create-gift/love', upload.fields([
    { name: 'collageMainPhoto', maxCount: 1 },
    { name: 'messageTagPhoto', maxCount: 1 },
    { name: 'messagePhotos', maxCount: 10 },
    { name: 'heartPhotos', maxCount: 10 },
    { name: 'flowerPhotos', maxCount: 10 },
    { name: 'music', maxCount: 1 }
]), async (req, res) => {
    try {
        const id = Math.random().toString(36).substr(2, 8);
        const files = req.files || {};
        
        const mainPhoto = await uploadSingleFile(files.collageMainPhoto?.[0], 'love');
        const tagPhoto = await uploadSingleFile(files.messageTagPhoto?.[0], 'love');
        
        const msgPhotos = [];
        if (files.messagePhotos) {
            for (const file of files.messagePhotos) {
                const url = await uploadSingleFile(file, 'love');
                if (url) msgPhotos.push(url);
            }
        }
        
        const heartPhotos = [];
        if (files.heartPhotos) {
            for (const file of files.heartPhotos) {
                const url = await uploadSingleFile(file, 'love');
                if (url) heartPhotos.push(url);
            }
        }
        
        const flowerPhotos = [];
        if (files.flowerPhotos) {
            for (const file of files.flowerPhotos) {
                const url = await uploadSingleFile(file, 'love');
                if (url) flowerPhotos.push(url);
            }
        }
        
        const music = await uploadSingleFile(files.music?.[0], 'love');
        
        const gift = await Gift.create({
            id,
            type: 'love',
            introTitle: req.body.introTitle || "Happy Valentine's Day",
            messageBody: req.body.messageBody || "I love you forever...",
            collageMainPhoto: mainPhoto || req.body.collageMainPhoto,
            messageTagPhoto: tagPhoto || req.body.messageTagPhoto,
            messagePhotos: msgPhotos.length ? msgPhotos : (req.body.presetImages ? null : undefined),
            flowerPhotos: flowerPhotos.length ? flowerPhotos : (req.body.presetImages ? null : undefined),
            heartPhotos: heartPhotos.length ? heartPhotos : (req.body.presetImages ? null : undefined),
            music: music || req.body.presetMusic
        });
        
        const baseUrl = req.body.clientBaseUrl || (req.protocol + '://' + req.get('host'));
        const giftUrl = `${baseUrl}/love/view.html?id=${id}`;
        const qrCodeDataUrl = await QRCode.toDataURL(giftUrl, { color: { dark: '#ff007f', light: '#ffffff' }});
        
        res.json({ success: true, id, url: giftUrl, qrCode: qrCodeDataUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Failed to create love gift: " + err.message });
    }
});

// Admin API: Create Grad Gift (via admin.html)
app.post('/api/create-gift/grad', upload.fields([
    { name: 'polaroidPhoto', maxCount: 1 },
    { name: 'filmStripPhotos', maxCount: 4 },
    { name: 'photoboothPhotos', maxCount: 3 },
    { name: 'voiceNote', maxCount: 1 },
    { name: 'music', maxCount: 1 }
]), async (req, res) => {
    try {
        const id = Math.random().toString(36).substr(2, 8);
        const files = req.files || {};
        
        const polaroidPhoto = await uploadSingleFile(files.polaroidPhoto?.[0], 'grad');
        
        const fsPhotos = [];
        if (files.filmStripPhotos) {
            for (const file of files.filmStripPhotos) {
                const url = await uploadSingleFile(file, 'grad');
                if (url) fsPhotos.push(url);
            }
        }
        
        const pbPhotos = [];
        if (files.photoboothPhotos) {
            for (const file of files.photoboothPhotos) {
                const url = await uploadSingleFile(file, 'grad');
                if (url) pbPhotos.push(url);
            }
        }
        
        const voiceNote = await uploadSingleFile(files.voiceNote?.[0], 'grad');
        const music = await uploadSingleFile(files.music?.[0], 'grad');
        
        const gift = await Gift.create({
            id,
            type: 'grad',
            theme: req.body.theme || 'gold',
            texts: {
                message1Title: req.body.message1Title,
                message1Body: req.body.message1Body,
                message2Title: req.body.message2Title,
                message2Body: req.body.message2Body
            },
            polaroidPhoto: polaroidPhoto || req.body.polaroidPhoto,
            filmStripPhotos: fsPhotos.length ? fsPhotos : (req.body.filmStripPhotos || []),
            photoboothPhotos: pbPhotos.length ? pbPhotos : (req.body.photoboothPhotos || []),
            voiceNote: voiceNote,
            music: music || req.body.presetMusic
        });
        
        const baseUrl = req.body.clientBaseUrl || (req.protocol + '://' + req.get('host'));
        const giftUrl = `${baseUrl}/grad/view.html?id=${id}`;
        const qrCodeDataUrl = await QRCode.toDataURL(giftUrl, { color: { dark: '#ff007f', light: '#ffffff' }});
        
        res.json({ success: true, id, url: giftUrl, qrCode: qrCodeDataUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Failed to create grad gift: " + err.message });
    }
});

module.exports = app;
