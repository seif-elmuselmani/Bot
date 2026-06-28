const fs = require('fs');
const { Telegraf, Input } = require('telegraf');
const bot = new Telegraf('8849555159:AAF0RhFsuRpiOZDc1ItAeu0lynciBfa5s0U');
const chat_id = 6225860463;
async function run() {
  const ids = {};
  for (let i = 1; i <= 13; i++) {
    const path = 'C:/Projects/freelane/Love/Now/2/Server/public/assets/sounds/song_' + i + '.mp3';
    if (fs.existsSync(path)) {
       console.log('Uploading ' + path);
       const msg = await bot.telegram.sendAudio(chat_id, Input.fromLocalFile(path), { disable_notification: true, title: 'Graduation Song ' + i });
       ids['grad_' + i] = msg.audio.file_id;
       console.log('grad_' + i + ': ' + msg.audio.file_id);
    } else {
       console.log('Missing ' + path);
    }
  }
  fs.writeFileSync('grad_audio_ids.json', JSON.stringify(ids, null, 2));
}
run().catch(console.error);
