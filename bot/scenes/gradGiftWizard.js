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
    { id: '1', fileId: 'CQACAgQAAxkDAAOraj69MuwN_YZ2QVqUfY3Pf_xk_ToAAvAfAAJpTPhREGWZ8r7wEiU8BA' },
    { id: '2', fileId: 'CQACAgQAAxkDAAOsaj69NSCe2tT5QIYeJ5UPBpUr-M4AAvEfAAJpTPhRz8HQ-T-oloM8BA' },
    { id: '3', fileId: 'CQACAgQAAxkDAAOtaj69Nr2_S1LGzZoYd22vOoG1TDYAAvIfAAJpTPhRah1TMf0mX7Q8BA' },
    { id: '4', fileId: 'CQACAgQAAxkDAAOuaj69N0aIdvs2DwzsufZsx7qqEaAAAvMfAAJpTPhRT-25UTG42_w8BA' },
    { id: '5', fileId: 'CQACAgQAAxkDAAOvaj69N5NA1hJBchoW5Ghy1bR_HJMAAvQfAAJpTPhRLBPxWmDBKck8BA' },
    { id: '6', fileId: 'CQACAgQAAxkDAAOwaj69OJLlsbKTAAHAldUraglhVGuxAAL1HwACaUz4UcPKlJyRQ9I-PAQ' },
    { id: '7', fileId: 'CQACAgQAAxkDAAOxaj69OaSc8vNxBUDzsgABXApcKd3nAAL2HwACaUz4UZzXrPqVbRspPAQ' },
    { id: '8', fileId: 'CQACAgQAAxkDAAOyaj69OdMWuZCsisH8ocXemVKsqlQAAvcfAAJpTPhRsugYYlHb4h88BA' },
    { id: '9', fileId: 'CQACAgQAAxkDAAOzaj69OmZtT0TRhJurvlIrBaj4D1EAAvgfAAJpTPhRQ_RM-HXhIeY8BA' },
    { id: '10', fileId: 'CQACAgQAAxkDAAO0aj69OwotArBFEky5v2cniRQYJPoAAvkfAAJpTPhRPsB-ZpZc6-Q8BA' },
    { id: '11', fileId: 'CQACAgQAAxkDAAO1aj69PRZqyeDqajwXun2EhLT9wwIAAvofAAJpTPhR5sN_C6t4zxs8BA' },
];

function getGradMusicKeyboard(currentIndex) {
    const prev = currentIndex > 0 ? currentIndex - 1 : GRAD_SONGS.length - 1;
    const next = currentIndex < GRAD_SONGS.length - 1 ? currentIndex + 1 : 0;
    return {
        inline_keyboard: [
            [{ text: `✅ اختيار الأغنية (${currentIndex + 1}/${GRAD_SONGS.length})`, callback_data: `select_grad_${currentIndex}` }],
            [
                { text: '⬅️ الأغنية السابقة', callback_data: `play_grad_${prev}` },
                { text: 'الأغنية التالية ➡️', callback_data: `play_grad_${next}` }
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
        await ctx.replyWithHTML('✅ <b>اكتملت صور الذكريات!</b>\n\nالآن، اكتب <b>عنوان الرسالة الأولى</b> التي ستُعرض في الهدية (مثال: ألف مبروك التخرج!):', {
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
    await ctx.replyWithHTML('📝 <b>محتوى الرسالة الأولى:</b>\n\nاكتب الآن نص الرسالة التفصيلي الذي يعبر عن مشاعرك تجاه الخريج:');
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    ctx.wizard.state.giftData.msg1Body = ctx.message?.text?.trim() === 'تخطي' ? '' : ctx.message?.text?.trim();
    await ctx.replyWithHTML('✍️ <b>عنوان الرسالة الثانية:</b>\n\nاكتب عنواناً للرسالة الثانية (أو اضغط "تخطي"):');
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    ctx.wizard.state.giftData.msg2Title = ctx.message?.text?.trim() === 'تخطي' ? '' : ctx.message?.text?.trim();
    await ctx.replyWithHTML('📝 <b>محتوى الرسالة الثانية:</b>\n\nاكتب نص الرسالة الثانية التفصيلي:');
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
    
    await ctx.replyWithHTML(`✅ <b>تم اختيار الثيم!</b> 🎉\n\nالآن، أرسل <b>المقطع الصوتي (تسجيل صوتي أو أغنية MP3)</b> الذي سيعمل في خلفية الهدية، أو اختر من القائمة أدناه 👇`, {
        reply_markup: { remove_keyboard: true }
    });
    
    try {
        await ctx.replyWithAudio(GRAD_SONGS[0].fileId, { 
            caption: '🎵 استمع للأغاني الجاهزة واكتشف المناسب لك:',
            reply_markup: getGradMusicKeyboard(0)
        });
    } catch (e) {
        console.error('Failed to send audio previews', e);
    }
    return ctx.wizard.next();
  },

  async (ctx, next) => {
    if (await checkCancel(ctx, next)) return;
    
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (data.startsWith('play_grad_')) {
            const index = parseInt(data.replace('play_grad_', ''));
            try {
                await ctx.editMessageMedia({
                    type: 'audio',
                    media: GRAD_SONGS[index].fileId,
                    caption: '🎵 استمع للأغاني الجاهزة واكتشف المناسب لك:'
                }, { reply_markup: getGradMusicKeyboard(index) });
            } catch(e) {}
            await ctx.answerCbQuery();
            return;
        } else if (data.startsWith('select_grad_')) {
            const index = parseInt(data.replace('select_grad_', ''));
            ctx.wizard.state.giftData.song = `grad_${GRAD_SONGS[index].id}`;
            await ctx.answerCbQuery('✅ تم اختيار الأغنية الجاهزة!');
        } else {
            return;
        }
    } else if (ctx.message && (ctx.message.audio || ctx.message.voice)) {
        ctx.wizard.state.giftData.customMusicId = (ctx.message.audio || ctx.message.voice).file_id;
    } else {
        await ctx.reply('⚠️ يرجى إرسال مقطع صوتي خاص بك، أو الضغط على زر اختيار أسفل الأغاني الجاهزة.');
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
            form.append('music', data.song);
        }
        if (data.msg1Title) form.append('message1Title', data.msg1Title);
        if (data.msg1Body) form.append('message1Body', data.msg1Body);
        if (data.msg2Title) form.append('message2Title', data.msg2Title);
        if (data.msg2Body) form.append('message2Body', data.msg2Body);
        
        const mainPhotoStream = await getTelegramFileStream(ctx, data.mainPhotoId);
        form.append('polaroidPhoto', mainPhotoStream, { filename: 'main.jpg' });
        
        for (let i = 0; i < data.filmPhotos.length; i++) {
            const stream = await getTelegramFileStream(ctx, data.filmPhotos[i]);
            form.append('filmStripPhotos', stream, { filename: `film${i}.jpg` });
            if (i < 3) {
                const pbStream = await getTelegramFileStream(ctx, data.filmPhotos[i]);
                form.append('photoboothPhotos', pbStream, { filename: `pb${i}.jpg` });
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