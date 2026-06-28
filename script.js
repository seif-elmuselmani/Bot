const { Telegraf } = require('telegraf');
const bot = new Telegraf('8849555159:AAF0RhFsuRpiOZDc1ItAeu0lynciBfa5s0U');
const chat_id = 6225860463;
const urls = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'
];
async function run() {
  for (let i=0; i<urls.length; i++) {
    console.log('Uploading ' + urls[i]);
    const msg = await bot.telegram.sendAudio(chat_id, { url: urls[i] }, { disable_notification: true });
    console.log('URL ' + i + ': file_id = ' + msg.audio.file_id);
  }
}
run().catch(console.error);
