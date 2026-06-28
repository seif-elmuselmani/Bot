require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const bot = new Telegraf(process.env.BOT_TOKEN);

async function run() {
    const chat_id = process.env.ADMIN_GROUP_ID;
    console.log("Uploading GRAD songs...");
    for(let i=1; i<=11; i++) {
        try {
            const msg = await bot.telegram.sendAudio(chat_id, { source: `./public/grad/assets/sounds/song_${i}.mp3` });
            console.log(`GRAD_SONG ${i}:`, msg.audio.file_id);
        } catch(e) {
            console.error(`Failed song ${i}:`, e.message);
        }
    }
}
run().catch(console.error);
