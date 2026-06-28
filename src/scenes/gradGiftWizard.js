const { Scenes: { WizardScene } } = require('telegraf');
const axios = require('axios');
const FormData = require('form-data');
const User = require('../../models/User');

const escapeHTML = (str) => {
  if (!str) return '';
  return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const checkCancel = async (ctx, next) => {
  const text = ctx.message?.text?.trim();
  if (text === '❌ إلغاء العملية' || text === '/cancel') {
    await ctx.reply('❌ تم إلغاء صناعة الهدية.', {
        reply_markup: {
            keyboard: [
              [{ text: '🎁 إنشاء هدية جديدة' }, { text: '💳 شحن المحفظة' }],
              [{ text: '👤 حسابي الشخصي' }, { text: '❓ المساعدة والأوامر' }]
            ],
            resize_keyboard: true
        }
    });
    await ctx.scene.leave();
    return true;
  }
  return false;
};

async function getTelegramFileStream(ctx, fileId) {
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const response = await axios({ url: fileUrl.href, method: 'GET', responseType: 'stream' });
    return response.data;
}

const GRAD_SONGS = [
    { id: '1', fileId: 'CQACAgQAAxkDAAIBO2pBLPdJx_S1ye7ebcUwEm1MiF5dAAK-IwACFa4IUlEnKpOJ5ZdwPAQ' },
    { id: '2', fileId: 'CQACAgQAAxkDAAIBPGpBLPwqAmTEYgyzkZxv7S65QzP1AAK_IwACFa4IUqgP-QZew4E7PAQ' },
    { id: '3', fileId: 'CQACAgQAAxkDAAIBPWpBLP247XbWmgQc8NPFC2DJilEPAALAIwACFa4IUvaeNdTriOI1PAQ' },
    { id: '4', fileId: 'CQACAgQAAxkDAAIBPmpBLP7RYaqJvyrZPN_mY1Qn5rC9AALBIwACFa4IUm52BDhj4zqKPAQ' },
    { id: '5', fileId: 'CQACAgQAAxkDAAIBP2pBLQABncq2DNLtOJx4eg9MUJ1HugACwiMAAhWuCFLjMbrJt6k28DwE' },
    { id: '6', fileId: 'CQACAgQAAxkDAAIBQGpBLQABqffXPBLIX22wDgqqagWlzwACwyMAAhWuCFIGthgtb-m_fzwE' },
    { id: '7', fileId: 'CQACAgQAAxkDAAIBQWpBLQFu3PbPiUA95Wy8bY5QDnYxAALEIwACFa4IUg4wVNoxnCXCPAQ' },
    { id: '8', fileId: 'CQACAgQAAxkDAAIBQmpBLQVarN-m8ONCNOlRKqiL5fz5AALFIwACFa4IUssfgxg8Hy4dPAQ' },
    { id: '9', fileId: 'CQACAgQAAxkDAAIBQ2pBLQXtxDUiln98fK_Gtt0oZDd2AALGIwACFa4IUqBDPZWomFrcPAQ' },
    { id: '10', fileId: 'CQACAgQAAxkDAAIBRGpBLQYMl0p2O2OFvXQ2GdRNK8cwAALHIwACFa4IUvcoKyHz2JNwPAQ' },
    { id: '11', fileId: 'CQACAgQAAxkDAAIBRWpBLQiYZcZjhMYO1Y8QDeFjovgYAALIIwACFa4IUnQ8-EwfTpm5PAQ' }
];

function getStaticMusicKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: 'أغنية 1', callback_data: 'select_grad_0' },
                { text: 'أغنية 2', callback_data: 'select_grad_1' },
                { text: 'أغنية 3', callback_data: 'select_grad_2' }
            ],
            [
                { text: 'أغنية 4', callback_data: 'select_grad_3' },
                { text: 'أغنية 5', callback_data: 'select_grad_4' },
                { text: 'أغنية 6', callback_data: 'select_grad_5' }
            ],
            [
                { text: 'أغنية 7', callback_data: 'select_grad_6' },
                { text: 'أغنية 8', callback_data: 'select_grad_7' },
                { text: 'أغنية 9', callback_data: 'select_grad_8' }
            ],
            [
                { text: 'أغنية 10', callback_data: 'select_grad_9' },
                { text: 'أغنية 11', callback_data: 'select_grad_10' }
            ]
        ]
    };
}

const gradGiftWizard = new WizardScene(
  'grad-gift-wizard',
  
  async (ctx) => {
    ctx.wizard.state.giftData = { filmPhotos: [] };
    const user = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (!user || user.balance < 10) {
        await ctx.reply('❌ رصيدك غير كافٍ. الهدية تتطلب 10 نقاط. يرجى شحن محفظتك أولاً.');
        return ctx.scene.leave();
    }
    await ctx.replyWithHTML('🎓 <b>مرحباً بك في مسار التخرج!</b> 🎉\n\nسنقوم بصناعة هدية رقمية تليق بهذه المناسبة السعيدة.\nأولاً: أرسل الآن <b>الصورة الرئيسية (الغلاف)</b> التي ستتصدر الهدية:', {
        reply_markup: { keyboard: [[{ text: '❌ إلغاء العملية' }]], resize_keyboard: true }
    });
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    if (!ctx.message?.photo) return ctx.reply('⚠️ يرجى إرسال صورة صالحة.');
    const photo = ctx.message.photo;
    ctx.wizard.state.giftData.mainPhotoId = photo[photo.length - 1].file_id;
    await ctx.replyWithHTML('✅ <b>صورة غلاف ممتازة!</b>\n\nالآن، أرسل <b>4 صور للذكريات</b> (ستظهر في شريط الذكريات الجانبي).\nأرسلهم واحدة تلو الأخرى، ثم اضغط <b>"التالي"</b> عند الانتهاء.', {
        reply_markup: { keyboard: [[{ text: '➡️ التالي' }], [{ text: '❌ إلغاء العملية' }]], resize_keyboard: true }
    });
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    const text = ctx.message?.text?.trim();
    if (text === '➡️ التالي') {
        if (ctx.wizard.state.giftData.filmPhotos.length === 0) return ctx.reply('⚠️ أرسل صورة واحدة على الأقل ثم اضغط التالي.');
        await ctx.replyWithHTML('✅ <b>اكتملت صور الذكريات!</b>\n\nالآن، اكتب <b>عنوان الرسالة الأولى</b> التي ستُعرض في الهدية:\n<i>(أو اضغط "تخطي" لاستخدام: "A Journey to Remember")</i>', {
            reply_markup: { keyboard: [[{ text: 'تخطي' }], [{ text: '❌ إلغاء العملية' }]], resize_keyboard: true }
        });
        return ctx.wizard.next();
    }
    if (ctx.message?.photo) {
        const photo = ctx.message.photo;
        ctx.wizard.state.giftData.filmPhotos.push(photo[photo.length - 1].file_id);
        return ctx.reply(`📸 استلمت الصورة (${ctx.wizard.state.giftData.filmPhotos.length}). أرسل المزيد أو اضغط "التالي".`);
    }
    await ctx.reply('⚠️ يرجى إرسال صور أو الضغط على "التالي".');
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    ctx.wizard.state.giftData.msg1Title = ctx.message?.text?.trim() === 'تخطي' ? '' : ctx.message?.text?.trim();
    await ctx.replyWithHTML('📝 <b>محتوى الرسالة الأولى:</b>\n\nاكتب الآن نص الرسالة التفصيلي الذي يعبر عن مشاعرك تجاه الخريج:\n<i>(أو اضغط "تخطي" لاستخدام: "You did it! All the late nights...")</i>');
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    ctx.wizard.state.giftData.msg1Body = ctx.message?.text?.trim() === 'تخطي' ? '' : ctx.message?.text?.trim();
    await ctx.replyWithHTML('✍️ <b>عنوان الرسالة الثانية:</b>\n\nاكتب عنواناً للرسالة الثانية:\n<i>(أو اضغط "تخطي" لاستخدام: "The Future is Yours")</i>');
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    ctx.wizard.state.giftData.msg2Title = ctx.message?.text?.trim() === 'تخطي' ? '' : ctx.message?.text?.trim();
    await ctx.replyWithHTML('📝 <b>محتوى الرسالة الثانية:</b>\n\nاكتب نص الرسالة الثانية التفصيلي:\n<i>(أو اضغط "تخطي" لاستخدام: "This degree is just the beginning...")</i>');
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    ctx.wizard.state.giftData.msg2Body = ctx.message?.text?.trim() === 'تخطي' ? '' : ctx.message?.text?.trim();
    await ctx.replyWithHTML('🎤 <b>رسالة صوتية (Voice Note):</b>\n\nقم بتسجيل مقطع صوتي بصوتك ليسمعه المستلم عند فتح الهدية! (أو اضغط "تخطي"):', {
        reply_markup: { keyboard: [[{ text: 'تخطي' }], [{ text: '❌ إلغاء العملية' }]], resize_keyboard: true }
    });
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    if (ctx.message?.voice || ctx.message?.audio) {
        ctx.wizard.state.giftData.voiceNoteId = (ctx.message.voice || ctx.message.audio).file_id;
    }
    await ctx.replyWithHTML('🎨 <b>اختيار لون الثيم:</b>\n\nاختر لون الواجهة المفضل لخلفية الهدية:', {
        reply_markup: {
            keyboard: [[{ text: 'الأزرق (Blue) 🔵' }, { text: 'الوردي (Pink) 🌸' }], [{ text: '❌ إلغاء العملية' }]], resize_keyboard: true
        }
    });
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    ctx.wizard.state.giftData.theme = ctx.message?.text?.includes('الأزرق') ? 'blue' : 'pink';
    
    const webAppUrl = (process.env.BASE_URL || 'https://gitr_i7bcc-980.d.jrnm.app') + '/mini-app/music-player.html';
    
    await ctx.replyWithHTML(`🎵 <b>إضافة أغنية (الموسيقى):</b>\n\nكيف تفضل إضافة الأغنية التي ستعمل في خلفية الهدية؟\n\n1️⃣ <b>أرسل الآن ملف الأغنية (MP3)</b> من جهازك ليتم استخدامه مباشرة.\n\n2️⃣ <b>أو افتح المشغل أدناه</b> لاستماع واختيار الأغاني الجاهزة:`, {
        reply_markup: {
            keyboard: [
                [{ text: '🎧 افتح مشغل الموسيقى', web_app: { url: webAppUrl } }],
                [{ text: '❌ إلغاء العملية' }]
            ], resize_keyboard: true
        }
    });
    
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    
    if (ctx.message?.web_app_data) {
        try {
            const data = JSON.parse(ctx.message.web_app_data.data);
            if (data.song) {
                ctx.wizard.state.giftData.song = data.song;
                await ctx.reply('✅ تم اختيار الأغنية بنجاح من المشغل!', { reply_markup: { remove_keyboard: true } });
            }
        } catch (e) {
            console.error('Failed to parse web app data', e);
            return;
        }
    } else if (ctx.message && (ctx.message.audio || ctx.message.voice)) {
        ctx.wizard.state.giftData.customMusicId = (ctx.message.audio || ctx.message.voice).file_id;
        await ctx.reply('✅ تم استلام مقطعك الصوتي!', { reply_markup: { remove_keyboard: true } });
    } else {
        await ctx.reply('⚠️ يرجى إرسال مقطع صوتي خاص بك، أو الضغط على زر "افتح مشغل الموسيقى".');
        return;
    }
    
    const processingMsg = await ctx.reply('⏳ جاري صناعة الهدية والاتصال بالسيرفر...');

    try {
        await User.findOneAndUpdate({ telegramId: ctx.from.id.toString() }, { $inc: { balance: -10 } });
        const form = new FormData();
        const data = ctx.wizard.state.giftData;
        
        form.append('theme', data.theme);
        if (data.customMusicId) {
            const musicStream = await getTelegramFileStream(ctx, data.customMusicId);
            form.append('music', musicStream, { filename: 'custom_music.mp3' });
        } else {
            form.append('presetMusic', data.song);
        }
        if (data.msg1Title) form.append('message1Title', data.msg1Title);
        if (data.msg1Body) form.append('message1Body', data.msg1Body);
        if (data.msg2Title) form.append('message2Title', data.msg2Title);
        if (data.msg2Body) form.append('message2Body', data.msg2Body);
        
        const mainPhotoStream = await getTelegramFileStream(ctx, data.mainPhotoId);
        form.append('polaroidPhoto', mainPhotoStream, { filename: 'main.jpg' });
        
        for (let i = 0; i < data.filmPhotos.length; i++) {
            const stream = await getTelegramFileStream(ctx, data.filmPhotos[i]);
            form.append(`filmStripPhotos`, stream, { filename: `film${i}.jpg` });
            if (i < 3) {
                const pbStream = await getTelegramFileStream(ctx, data.filmPhotos[i]);
                form.append(`photoboothPhotos`, pbStream, { filename: `pb${i}.jpg` });
            }
        }
        
        if (data.voiceNoteId) {
            const vnStream = await getTelegramFileStream(ctx, data.voiceNoteId);
            form.append('voiceNote', vnStream, { filename: 'voice.ogg' });
        }
        
        // Pass public URL so the generated link is shareable
        // Note: When deployed, this should be the actual server domain, e.g., process.env.BASE_URL
        form.append('clientBaseUrl', process.env.BASE_URL || 'http://localhost:7860');

        const response = await axios.post('http://127.0.0.1:7860/api/create-gift/grad', form, {
            headers: form.getHeaders(),
        });
        const result = response.data;
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        await ctx.replyWithHTML(
            `🎉 <b>تم إنشاء هديتك بنجاح!</b>\n\n🔗 <b>رابط الهدية:</b>\n<a href="${result.url}">${result.url}</a>\n\nتم خصم 10 نقاط.`, {
                reply_markup: {
                    keyboard: [
                        [{ text: '🎁 إنشاء هدية جديدة' }, { text: '💳 شحن المحفظة' }],
                        [{ text: '👤 حسابي الشخصي' }, { text: '❓ المساعدة والأوامر' }]
                    ], resize_keyboard: true
                }
            }
        );
        
        const base64Data = result.qrCode.replace(/^data:image\/png;base64,/, "");
        const qrBuffer = Buffer.from(base64Data, 'base64');
        await ctx.replyWithPhoto({ source: qrBuffer });
    } catch (err) {
        console.error('API Error:', err.message);
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        await ctx.reply('⚠️ حدث خطأ أثناء إنشاء الهدية. تم استرداد رصيدك.');
        await User.findOneAndUpdate({ telegramId: ctx.from.id.toString() }, { $inc: { balance: 10 } });
    }
    return ctx.scene.leave();
  }
);
module.exports = gradGiftWizard;