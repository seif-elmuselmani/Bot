const { Scenes: { WizardScene } } = require('telegraf');
const axios = require('axios');
const FormData = require('form-data');
const User = require('../../models/User');

const escapeHTML = (str) => {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
};

const checkCancel = async (ctx, next) => {
  const text = ctx.message?.text?.trim() || '';
  if (text === '❌ إلغاء العملية' || text.toLowerCase() === 'cancel' || text.startsWith('/')) {
    await ctx.reply('❌ تم إلغاء العملية.', {
        reply_markup: {
            keyboard: [
              [{ text: '🎁 إنشاء هدية جديدة' }, { text: '💳 شحن المحفظة' }],
              [{ text: '👤 حسابي الشخصي' }, { text: '❓ المساعدة والأوامر' }]
            ],
            resize_keyboard: true
        }
    });
    // Let Telegraf handle the command if it started with '/'
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

const LOVE_SONGS = [
    { id: 'love_1', fileId: 'CQACAgQAAxkDAAOLaj67NxPjm83RibleXPLVn_TPQHkAAuwfAAJpTPhRvFFnW0MswL48BA' },
    { id: 'love_2', fileId: 'CQACAgQAAxkDAAOMaj67QEK5JwnXvoz2MBGKP7YE1AEAAu0fAAJpTPhRPyIYnT2b0Cs8BA' },
];

function getLoveMusicKeyboard(currentIndex) {
    const prev = currentIndex > 0 ? currentIndex - 1 : LOVE_SONGS.length - 1;
    const next = currentIndex < LOVE_SONGS.length - 1 ? currentIndex + 1 : 0;
    return {
        inline_keyboard: [
            [{ text: `✅ اختيار الأغنية (${currentIndex + 1}/${LOVE_SONGS.length})`, callback_data: `select_love_${currentIndex}` }],
            [
                { text: '⬅️ الأغنية السابقة', callback_data: `play_love_${prev}` },
                { text: 'الأغنية التالية ➡️', callback_data: `play_love_${next}` }
            ]
        ]
    };
}

const loveGiftWizard = new WizardScene(
  'love-gift-wizard',
  
  async (ctx) => {
    ctx.wizard.state.giftData = { messagePhotos: [], flowerPhotos: [], heartPhotos: [] };
    await ctx.replyWithHTML(`❤️ <b>مرحباً بك في مسار هدية الحب!</b>\n\nسنقوم بصناعة هدية رقمية ساحرة ✨\nأولاً: أرسل لي <b>الصورة الرئيسية (الغلاف)</b> التي ستتصدر واجهة الهدية.`);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
        await ctx.reply('⚠️ يرجى إرسال صورة صالحة للغلاف.');
        return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.wizard.state.giftData.collageMainPhoto = photo.file_id;
    await ctx.replyWithHTML(`✅ <b>صورة رائعة للغلاف!</b>\n\nالآن، أرسل <b>3 صور</b> ستظهر داخل أظرف الرسائل التفاعلية 💌\n(أرسلهم صورة تلو الأخرى وليس كمجموعة).`);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
        await ctx.reply('⚠️ يرجى إرسال صورة.');
        return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.wizard.state.giftData.messagePhotos.push(photo.file_id);
    
    if (ctx.wizard.state.giftData.messagePhotos.length < 3) {
        await ctx.reply(`📸 استلمت (${ctx.wizard.state.giftData.messagePhotos.length}) من 3... بانتظار الباقي.`);
        return;
    }
    await ctx.replyWithHTML(`✅ <b>اكتملت صور الرسائل!</b> 💌\n\nالآن، أرسل <b>صورتين (2)</b> ستظهران داخل باقة الورود 🌸.`);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
        await ctx.reply('⚠️ يرجى إرسال صورة.');
        return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.wizard.state.giftData.flowerPhotos.push(photo.file_id);
    
    if (ctx.wizard.state.giftData.flowerPhotos.length < 2) {
        await ctx.reply(`🌸 استلمت (${ctx.wizard.state.giftData.flowerPhotos.length}) من 2... أرسل الصورة الثانية.`);
        return;
    }
    await ctx.replyWithHTML(`✅ <b>اكتملت صور الورود!</b> 🌸\n\nالآن، أرسل <b>3 صور</b> للذكريات لتظهر داخل فقاعات القلوب الطائرة ❤️.`);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
        await ctx.reply('⚠️ يرجى إرسال صورة.');
        return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.wizard.state.giftData.heartPhotos.push(photo.file_id);
    
    if (ctx.wizard.state.giftData.heartPhotos.length < 3) {
        await ctx.reply(`❤️ استلمت (${ctx.wizard.state.giftData.heartPhotos.length}) من 3... بانتظار الباقي.`);
        return;
    }
    await ctx.replyWithHTML(`✅ <b>اكتملت صور القلوب!</b> ❤️\n\nأخيراً بالنسبة للصور، أرسل لي <b>الصورة الختامية</b> لتظهر مع بطاقة الإهداء 🎁.`);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
        await ctx.reply('⚠️ يرجى إرسال صورة الختام.');
        return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.wizard.state.giftData.messageTagPhoto = photo.file_id;
    
    await ctx.replyWithHTML(`✅ <b>انتهينا من جميع الصور!</b> 🎉\n\nالآن، أرسل <b>المقطع الصوتي (تسجيل صوتي أو أغنية MP3)</b> من جهازك ليتم إضافته للهدية:`);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (ctx.message && (ctx.message.audio || ctx.message.voice)) {
        ctx.wizard.state.giftData.musicId = (ctx.message.audio || ctx.message.voice).file_id;
        await ctx.replyWithHTML(`✅ <b>تم استلام مقطعك الصوتي!</b>\n\nالآن، أرسل <b>العنوان الرئيسي</b> الذي سيظهر في البداية:\n<i>(أو اضغط "تخطي" لاستخدام: "Happy Valentine's Day")</i> 📝`);
        return ctx.wizard.next();
    } else {
        await ctx.reply('⚠️ يرجى إرسال ملف صوتي (أغنية أو تسجيل) من جهازك.');
        return;
    }
  },

  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
        await ctx.reply('⚠️ يرجى إرسال نص العنوان الرئيسي.');
        return;
    }
    ctx.wizard.state.giftData.introTitle = ctx.message.text.trim() === 'تخطي' ? '' : ctx.message.text.trim();
    await ctx.replyWithHTML(`✅ تم حفظ العنوان.\n\nالآن، أرسل <b>محتوى رسالة الحب</b> الموجهة لمن تحب:\n<i>(أو اضغط "تخطي" لاستخدام: "I love you forever...")</i>`);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
        await ctx.reply('⚠️ يرجى إرسال نص الرسالة.');
        return;
    }
    ctx.wizard.state.giftData.messageBody = ctx.message.text;
    
    // Process the submission
    const processingMsg = await ctx.reply('⏳ جاري إنشاء هدية الحب الخاصة بك وبناء الصور والروابط، يرجى الانتظار ثوانٍ قليلة...');
    
    try {
        const data = ctx.wizard.state.giftData;
        const form = new FormData();
        
        // Texts
        form.append('introTitle', data.introTitle);
        form.append('messageBody', data.messageBody);
        if (data.presetMusic) {
            form.append('presetMusic', data.presetMusic);
        }
        
        // Single Photos
        const mainStream = await getTelegramFileStream(ctx, data.collageMainPhoto);
        form.append('collageMainPhoto', mainStream, { filename: 'main.jpg' });
        
        const tagStream = await getTelegramFileStream(ctx, data.messageTagPhoto);
        form.append('messageTagPhoto', tagStream, { filename: 'tag.jpg' });
        
        // Arrays
        for (let i = 0; i < Math.min(3, data.messagePhotos.length); i++) {
            const mStream = await getTelegramFileStream(ctx, data.messagePhotos[i]);
            form.append(`messagePhoto${i + 1}`, mStream, { filename: `msg${i}.jpg` });
        }
        for (let i = 0; i < Math.min(3, data.heartPhotos.length); i++) {
            const hStream = await getTelegramFileStream(ctx, data.heartPhotos[i]);
            form.append(`heartPhoto${i + 1}`, hStream, { filename: `heart${i}.jpg` });
        }
        for (let i = 0; i < Math.min(2, data.flowerPhotos.length); i++) {
            const fStream = await getTelegramFileStream(ctx, data.flowerPhotos[i]);
            form.append(`flowerPhoto${i + 1}`, fStream, { filename: `flower${i}.jpg` });
        }
        
        if (data.musicId) {
            const audioStream = await getTelegramFileStream(ctx, data.musicId);
            form.append('music', audioStream, { filename: 'audio.mp3' });
        }
        
        form.append('clientBaseUrl', process.env.BASE_URL || 'http://localhost:7860');
        
        const headers = form.getHeaders();
        headers['x-api-key'] = process.env.API_SECRET;
        
        const currentUser = await User.findOne({ telegramId: ctx.from.id.toString() });
        if (!currentUser || currentUser.balance < 10) {
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            await ctx.reply('⚠️ عذراً، رصيدك غير كافٍ لإتمام الهدية. يرجى شحن المحفظة أولاً.');
            return ctx.scene.leave();
        }
        await User.findOneAndUpdate({ telegramId: ctx.from.id.toString() }, { $inc: { balance: -10 } });

        const response = await axios.post('http://127.0.0.1:7860/api/create-gift/love', form, {
            headers: headers,
        });
        const result = response.data;
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        await ctx.replyWithHTML(
            `🎉 <b>تم إنشاء هدية الحب بنجاح!</b>\n\n🔗 <b>رابط الهدية:</b>\n<a href="${result.url}">${result.url}</a>\n\nتم خصم 10 نقاط.`, {
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

        // إشعار لجروب الإدارة
        const adminGroupId = process.env.ADMIN_GROUP_ID;
        if (adminGroupId) {
            try {
                await ctx.telegram.sendMessage(adminGroupId,
                    `🎁 <b>هدية حب جديدة تم إنشاؤها!</b>\n\n` +
                    `• <b>المستخدم:</b> ${escapeHTML(ctx.from.first_name || 'غير محدد')} (<code>${ctx.from.id}</code>)\n` +
                    `• <b>الرابط:</b> <a href="${result.url}">${result.url}</a>\n` +
                    `• <b>التكلفة:</b> تم خصم 10 نقاط.`,
                    { parse_mode: 'HTML', disable_web_page_preview: true }
                );
            } catch (notifyErr) {
                console.error('Failed to notify admin group about love gift:', notifyErr.message);
            }
        }
    } catch (err) {
        console.error('API Error:', err.message);
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        
        // استرداد الرصيد
        await User.findOneAndUpdate({ telegramId: ctx.from.id.toString() }, { $inc: { balance: 10 } });
        
        // إرسال رسالة للمستخدم مع رقم الدعم
        await ctx.reply('❌ حدث خطأ تقني أثناء إنشاء الهدية.\n\nتم استرداد رصيدك (10 نقاط) بالكامل 💳.\n\n📞 للتواصل مع الدعم الفني وحل المشكلة فوراً، تواصل معي على الرقم: 01277136620');
        
        // إشعار لجروب الإدارة بوجود مشكلة
        const adminGroupId = process.env.ADMIN_GROUP_ID;
        if (adminGroupId) {
            try {
                await ctx.telegram.sendMessage(adminGroupId,
                    `⚠️ <b>تنبيه: خطأ تقني (Love Gift)!</b>\n\n` +
                    `• <b>المستخدم:</b> ${escapeHTML(ctx.from.first_name || 'غير محدد')} (<code>${ctx.from.id}</code>)\n` +
                    `• <b>تفاصيل الخطأ:</b> <code>${err.message}</code>\n\n` +
                    `<i>تم استرداد 10 نقاط للعميل. يرجى تفقد حالة سيرفر الـ API.</i>`,
                    { parse_mode: 'HTML' }
                );
            } catch (notifyErr) {}
        }
    }

    return ctx.scene.leave();
  }
);
module.exports = loveGiftWizard;
