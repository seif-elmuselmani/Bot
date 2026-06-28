/**
 * User Commands Module
 * Defines and registers all public user commands, hears triggers, callback resolvers, and private chat fallbacks.
 */

const User = require('../../models/User');
const PromoCode = require('../../models/PromoCode');
const Order = require('../../models/Order');
const servicesConfig = require('../config/services');

const { escapeHTML } = require('../utils/helpers');

/**
 * Registers all user-level commands and handlers on the Telegraf bot.
 * @param {Telegraf} bot 
 */
const registerUserCommands = (bot) => {

  // Profile Command helper
  const showUserProfile = async (ctx) => {
    const telegramId = ctx.from.id.toString();
    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ الحساب غير مسجل. يرجى إرسال /start أولاً لتسجيل حسابك.');
      }

      const formattedDate = user.joinedAt.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const botInfo = await ctx.telegram.getMe();
      const refLink = `https://t.me/${botInfo.username}?start=ref_${user.telegramId}`;

      const profileMessage = 
        `👤 <b>بيانات الحساب الشخصي</b>\n\n` +
        `• <b>معرّف الحساب (ID):</b> <code>${user.telegramId}</code>\n` +
        `• <b>رصيد النقاط الحالي:</b> <code>${user.balance} نقطة</code>\n` +
        `• <b>تاريخ التسجيل في البوت:</b> <code>${formattedDate}</code>\n\n` +
        `🔗 <b>رابط الإحالة ومشاركة البوت:</b>\n` +
        `<code>${refLink}</code>\n\n` +
        `🎁 <b>ادعُ أصدقاءك واكسب نقاط مجانية!</b>\n` +
        `شارك الرابط الخاص بك مع أصدقائك في الجامعة. ستحصل على <b>+25 نقطة مجانية</b> في محفظتك فور قيام أي صديق يسجل عن طريق رابطك بشحن رصيد بقيمة <b>300 جنيه (أو أكثر)</b> للمرة الأولى!`;

      await ctx.replyWithHTML(profileMessage);
    } catch (error) {
      console.error('Error showing user profile:', error);
      await ctx.reply('⚠️ تعذر استرجاع بيانات الحساب حالياً.');
    }
  };

  bot.command('profile', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showUserProfile(ctx);
  });

  bot.hears('👤 حسابي الشخصي', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showUserProfile(ctx);
  });

  // Services Menu Display helper
  const showServicesMenu = async (ctx) => {
    try {
      const servicesMessage =
        `🎁 <b>قوالب الهدايا المتاحة</b>\n\n` +
        `اختر نوع الهدية التي ترغب في صناعتها. سيتم فحص رصيدك ثم سنقوم بسؤالك عن الصور والنصوص لإخراج الهدية بأبهى صورة.\n\n` +
        `💳 <b>اختر القالب للمتابعة:</b>`;

      await ctx.replyWithHTML(servicesMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❤️ قالب عيد الحب (10 نقاط)', callback_data: 'service_love_gift' }],
            [{ text: '🎓 قالب التخرج (10 نقاط)', callback_data: 'service_grad_gift' }],
            [{ text: 'ℹ️ تفاصيل القوالب', callback_data: 'services_info' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in services menu route:', error);
      await ctx.reply('⚠️ تعذر تحميل قائمة الخدمات. يرجى المحاولة مرة أخرى لاحقاً.');
    }
  };

  bot.action('services_info', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const infoMessage =
        `ℹ️ <b>دليل وتفاصيل قوالب هدايا LoveGift المتاحة</b>\n\n` +
        `• <b>❤️ قالب عيد الحب (10 نقاط):</b>\n` +
        `  - قالب تفاعلي رومانسي يحتوي على 10 صور (صورة الغلاف، صور الذكريات، الورود، والقلوب).\n` +
        `  - يتيح لك كتابة نصوص ورسائل حب مخصصة، مع اختيار أغنية رومانسية أو رفع مقطع صوتي بصوتك.\n` +
        `  - يتم تسليم الهدية على شكل رابط تفاعلي و QR Code.\n\n` +
        `• <b>🎓 قالب التخرج (10 نقاط):</b>\n` +
        `  - قالب تفاعلي للاحتفال بالتخرج يحتوي على 5 صور (الصورة الشخصية الرئيسية، وشريط ذكريات من 4 صور).\n` +
        `  - يمكنك إضافة نصوص تهنئة ومقطع صوتي أو أغنية مخصصة للاحتفال.\n` +
        `  - يتم تسليم الهدية على شكل رابط تفاعلي و QR Code.\n\n` +
        `💡 <i>تُخصم النقاط تلقائياً فور إنهاء الخطوات وبناء الرابط الخاص بك.</i>`;

      await ctx.editMessageText(infoMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 العودة لقائمة الخدمات', callback_data: 'services_back' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error handling services_info:', error);
    }
  });

  bot.action('services_back', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const servicesMessage =
        `🎁 <b>قوالب الهدايا المتاحة</b>\n\n` +
        `اختر نوع الهدية التي ترغب في صناعتها. سيتم فحص رصيدك ثم سنقوم بسؤالك عن الصور والنصوص لإخراج الهدية بأبهى صورة.\n\n` +
        `💳 <b>اختر القالب للمتابعة:</b>`;

      await ctx.editMessageText(servicesMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❤️ قالب عيد الحب (10 نقاط)', callback_data: 'service_love_gift' }],
            [{ text: '🎓 قالب التخرج (10 نقاط)', callback_data: 'service_grad_gift' }],
            [{ text: 'ℹ️ تفاصيل القوالب', callback_data: 'services_info' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error handling services_back:', error);
    }
  });

  bot.command('services', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showServicesMenu(ctx);
  });

  bot.hears('🎁 إنشاء هدية جديدة', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showServicesMenu(ctx);
  });

  // Unified configuration-driven callback resolver for selecting services
  bot.action(/^service_(.+)$/, async (ctx) => {
    const serviceKey = ctx.match[1];
    const service = servicesConfig[serviceKey];

    if (!service) {
      return ctx.answerCbQuery('❌ اختيار خدمة غير معروف.', { show_alert: true });
    }

    const userId = ctx.from.id.toString();
    const price = service.price;

    try {
      // 1. Fetch user profile
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return ctx.answerCbQuery('❌ الحساب غير مسجل. يرجى إرسال /start أولاً.', { show_alert: true });
      }

      // 2. Validate point balance
      if (user.balance < price) {
        await ctx.answerCbQuery('❌ رصيدك غير كافٍ!', { show_alert: false });
        await ctx.replyWithHTML(
          `❌ <b>رصيد نقاطك الحالي غير كافٍ!</b>\n\n` +
          `• <b>الخدمة:</b> <code>${escapeHTML(service.name)}</code>\n` +
          `• <b>التكلفة المطلوبة:</b> <code>${price} نقطة</code>\n` +
          `• <b>رصيدك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
          `يرجى اختيار <b>شحن المحفظة</b> أو إرسال الأمر /recharge لإضافة نقاط لمستودعك.`
        );
        return;
      }

      // 3. Save selected service parameters to user session
      ctx.session.selectedService = service.type;
      ctx.session.selectedPrice = price;
      ctx.session.selectedServiceName = service.name;

      // Acknowledge callback query
      await ctx.answerCbQuery(`✅ تم اختيار: ${service.name}`);

      // 4. Send user into the appropriate wizard scene
      if (service.type === 'love_gift') {
        await ctx.scene.enter('love-gift-wizard');
      } else {
        await ctx.scene.enter('grad-gift-wizard');
      }

    } catch (error) {
      console.error('Error handling service callback:', error);
      await ctx.answerCbQuery('⚠️ حدث خطأ أثناء معالجة الطلب.', { show_alert: true });
    }
  });

  // Handle user accepting the quoted price
  bot.action(/^user_accept_price_(ORD-\d+-\d+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id.toString();

    try {
      // Find the order
      const order = await Order.findOne({ orderId, telegramId });
      if (!order) {
        return ctx.answerCbQuery('❌ لم يتم العثور على الطلب.', { show_alert: true });
      }

      if (order.status !== 'pending_payment') {
        return ctx.answerCbQuery('⚠️ هذا الطلب تم معالجته بالفعل أو دفع قيمته.', { show_alert: true });
      }

      // Fetch user to check balance
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.answerCbQuery('❌ لم يتم العثور على حسابك.', { show_alert: true });
      }

      if (user.balance < order.price) {
        await ctx.answerCbQuery('❌ رصيدك غير كافٍ لدفع قيمة الطلب!', { show_alert: true });
        await ctx.replyWithHTML(
          `❌ <b>رصيدك الحالي غير كافٍ!</b>\n\n` +
          `• <b>تكلفة الطلب:</b> <code>${order.price} نقطة</code>\n` +
          `• <b>رصيدك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
          `يرجى شحن محفظتك بـ <b>${order.price - user.balance} نقطة</b> إضافية على الأقل، ثم الضغط على زر الموافقة والدفع مجدداً.`
        );
        return;
      }

      // Deduct points
      user.balance -= order.price;
      await user.save();

      // Update order status to in_progress
      order.status = 'in_progress';
      await order.save();

      await ctx.answerCbQuery('✅ تم خصم النقاط وبدء العمل!');
      
      // Update user message
      await ctx.editMessageText(
        `✅ <b>تم قبول عرض السعر والدفع بنجاح!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>المبلغ المخصوم:</b> <code>${order.price} نقطة</code>\n` +
        `• <b>الرصيد المتبقي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `بدأ العمل على طلبك بنجاح. ستصلك النتيجة هنا فور انتهاء الإدارة من التعديل.`,
        { parse_mode: 'HTML' }
      );

      // Notify admins in the Admin Group
      const adminGroupId = process.env.ADMIN_GROUP_ID;
      if (adminGroupId) {
        await ctx.telegram.sendMessage(
          adminGroupId,
          `🟢 <b>العميل وافق على السعر ودفع النقاط!</b>\n\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>المبلغ المخصوم:</b> <code>${order.price} نقطة</code>\n` +
          `• <b>العميل:</b> ${escapeHTML(ctx.from.first_name)} (@${escapeHTML(ctx.from.username || '')})\n\n` +
          `يرجى العمل على الملف والرد عليه بالملف المعدل لتسليمه للعميل.`,
          { parse_mode: 'HTML' }
        );
      }

    } catch (error) {
      console.error('Error in user_accept_price:', error);
      await ctx.answerCbQuery('⚠️ حدث خطأ أثناء إتمام العملية.', { show_alert: true });
    }
  });

  // Handle user rejecting the quoted price
  bot.action(/^user_reject_price_(ORD-\d+-\d+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id.toString();

    try {
      const order = await Order.findOne({ orderId, telegramId });
      if (!order) {
        return ctx.answerCbQuery('❌ لم يتم العثور على الطلب.', { show_alert: true });
      }

      if (order.status !== 'pending_payment') {
        return ctx.answerCbQuery('⚠️ هذا الطلب تم معالجته بالفعل.', { show_alert: true });
      }

      order.status = 'cancelled';
      await order.save();

      await ctx.answerCbQuery('❌ تم إلغاء الطلب.');
      await ctx.editMessageText(
        `❌ <b>تم رفض عرض السعر وإلغاء الطلب بنجاح.</b>\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>`,
        { parse_mode: 'HTML' }
      );

      // Notify admins
      const adminGroupId = process.env.ADMIN_GROUP_ID;
      if (adminGroupId) {
        await ctx.telegram.sendMessage(
          adminGroupId,
          `🔴 <b>تم رفض عرض السعر من قبل العميل وإلغاء الطلب.</b>\n\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>العميل:</b> ${escapeHTML(ctx.from.first_name)} (@${escapeHTML(ctx.from.username || '')})`,
          { parse_mode: 'HTML' }
        );
      }

    } catch (error) {
      console.error('Error in user_reject_price:', error);
      await ctx.answerCbQuery('⚠️ حدث خطأ أثناء إرسال الرفض.', { show_alert: true });
    }
  });

  // Promo Code Redemption Command
  bot.command('promo', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    
    if (args.length < 2) {
      return ctx.replyWithHTML('⚠️ <b>طريقة الاستخدام:</b> <code>/promo &lt;كود_الخصم&gt;</code>\n<i>لتفعيل أكواد الهدايا وإضافة نقاط لمحفظتك تلقائياً.</i>');
    }

    const promoCodeInput = args[1].toUpperCase();
    const telegramId = ctx.from.id.toString();

    try {
      // 1. Try to atomically claim a slot for this user
      const promo = await PromoCode.findOneAndUpdate(
        {
          code: promoCodeInput,
          usedBy: { $ne: telegramId },
          $expr: { $lt: [{ $size: '$usedBy' }, '$maxUses'] }
        },
        {
          $push: { usedBy: telegramId }
        },
        { new: true }
      );

      // If claiming failed, find out why to give precise feedback
      if (!promo) {
        const existingPromo = await PromoCode.findOne({ code: promoCodeInput });
        if (!existingPromo) {
          return ctx.reply('❌ كود ترويجي غير صالح. يرجى التأكد وإعادة المحاولة.');
        }
        if (existingPromo.usedBy.includes(telegramId)) {
          return ctx.reply('❌ لقد قمت بتفعيل هذا الكود الترويجي مسبقاً لحسابك.');
        }
        if (existingPromo.usedBy.length >= existingPromo.maxUses) {
          return ctx.reply('❌ لقد وصل هذا الكود للحد الأقصى من الاستخدام وانتهت صلاحيته.');
        }
        return ctx.reply('❌ تعذر تفعيل الكود حالياً. يرجى المحاولة لاحقاً.');
      }

      // 2. Add points to user wallet
      const user = await User.findOneAndUpdate(
        { telegramId },
        { $inc: { balance: promo.rewardPoints } },
        { new: true }
      );

      if (!user) {
        // Rollback: remove user from usedBy list since user account is missing in DB
        await PromoCode.findOneAndUpdate(
          { code: promoCodeInput },
          { $pull: { usedBy: telegramId } }
        );
        return ctx.reply('❌ خطأ في النظام. يرجى إرسال /start لتسجيل حسابك أولاً.');
      }

      await ctx.replyWithHTML(
        `🎉 <b>تم تفعيل الكود بنجاح!</b>\n\n` +
        `• <b>النقاط المضافة:</b> <code>+${promo.rewardPoints} نقطة</code>\n` +
        `• <b>الرصيد الحالي للمحفظة:</b> <code>${user.balance} نقطة</code>`
      );

    } catch (error) {
      console.error('Promo Code Redemption Error:', error);
      await ctx.reply('⚠️ حدث خطأ في النظام أثناء تفعيل كود الهدية. يرجى المحاولة لاحقاً.');
    }
  });

  // Support Trigger
  bot.hears('📞 الدعم الفني', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.replyWithHTML(
      `📞 <b>الدعم الفني لبوت LoveGift</b>\n\n` +
      `للاستفسارات، أو مشاكل عمليات الشحن، أو طلبات الشراكة، يرجى التواصل مباشرة مع الإدارة.\n\n` +
      `💬 <b>حساب التواصل (واتساب):</b> <a href="https://wa.me/201223817860">+201223817860</a>`
    );
  });

  // Instructions of Use helper
  const showInstructionsMenu = async (ctx) => {
    const instructionMessage = 
      `📌 <b>تعليمات الاستخدام لبوت LoveGift</b> 🎁\n\n` +
      `📊 <b>القوالب المتاحة وأسعارها بالنقاط:</b>\n` +
      `• قالب عيد الحب ❤️ — <b>10 نقاط</b>\n` +
      `• قالب التخرج 🎓 — <b>10 نقاط</b>\n\n` +
      `💡 <b>طريقة الاستخدام:</b>\n` +
      `1️⃣ اشحن نقاط أولاً من خلال زر <b>شحن المحفظة</b> (1 جنيه = 1 نقطة).\n` +
      `2️⃣ اختر القالب المطلوب بالضغط على زر <b>إنشاء هدية جديدة</b>.\n` +
      `3️⃣ اتبع تعليمات البوت وأرسل الصور والنصوص المطلوبة بالترتيب.\n\n` +
      `⚠️ <b>القيود والشروط:</b>\n` +
      `• تأكد من إرسال الصور بجودة عالية.\n` +
      `• في حال إرسال ملفات صوتية، يجب أن تكون بصيغة MP3 أو مقطع صوتي عبر التليجرام.\n\n` +
      `❓ <b>أهم الأسئلة الشائعة:</b>\n` +
      `🔸 <b>أشحن بكام عشان أقدر أستخدمه؟</b>\n` +
      `  - سعر القالب الواحد 10 نقاط فقط (10 جنيه).\n` +
      `🔸 <b>هل الرصيد بيختفي مع الوقت؟</b>\n` +
      `  - لا، رصيد نقاطك بيفضل محفوظ في حسابك الشخصي دايماً.\n` +
      `🔸 <b>ليه طلب الشحن بيتأخر أحياناً وبيتقبل في ثواني أحياناً تانية؟</b>\n` +
      `  - لأن تأكيد الدفع ومراجعة الإيصالات يتم بشكل يدوي من قبل الإدارة لضمان الدقة.\n` +
      `🔸 <b>هل بتشوفوا الرسايل والملفات الخاصة بيا؟</b>\n` +
      `  - لا، صورك وهداياك تعامل بسرية تامة وتُعالج تلقائياً ولا يتم مشاركتها.\n\n` +
      `⏱️ <b>الوقت المتوقع للطلب:</b> ثوانٍ معدودة بعد إكمال إرسال الصور.\n\n` +
      `💬 <b>حساب التواصل والدعم (واتساب):</b> <a href="https://wa.me/201223817860">+201223817860</a>\n\n` +
      `اضغط على <b>شحن المحفظة</b> للبدء 👇`;

    await ctx.replyWithHTML(instructionMessage, { disable_web_page_preview: true });
  };

  bot.command('instructions', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showInstructionsMenu(ctx);
  });

  bot.hears('📌 تعليمات الاستخدام', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showInstructionsMenu(ctx);
  });

  const showUserHelp = async (ctx) => {
    const userHelpMessage = 
      `❓ <b>دليل المساعدة والأوامر لبوت LoveGift</b> 🤖\n\n` +
      `مرحباً بك! يمكنك استخدام الأوامر التالية للتفاعل مع البوت بسهولة:\n\n` +
      `👤 <b>أوامر الحساب الشخصي:</b>\n` +
      `• /start — تهيئة حسابك وفتح لوحة التحكم الرئيسية.\n` +
      `• /profile — عرض تفاصيل حسابك، رصيدك، ورابط الإحالة ومكافأتك.\n` +
      `• /promo <code>&lt;الكود&gt;</code> — تفعيل كود الهدية وإضافة نقاط لمحفظتك تلقائياً.\n\n` +
      `📂 <b>أوامر الخدمات والشحن:</b>\n` +
      `• /services — عرض قائمة جميع الخدمات المتاحة وأسعارها بالنقاط.\n` +
      `• /recharge — بدء عملية شحن محفظة النقاط الخاصة بك.\n` +
      `• /instructions — دليل الاستخدام الكامل، القيود، والأسئلة الشائعة.\n` +
      `• /help — عرض رسالة المساعدة ودليل الأوامر هذا.\n\n` +
      `📞 <b>الدعم الفني:</b>\n` +
      `إذا واجهت أي مشكلة أو كان لديك استفسار خاص، اضغط على <b>الدعم الفني</b> للتواصل الفوري مع الإدارة.`;

    await ctx.replyWithHTML(userHelpMessage);
  };

  bot.command('help', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showUserHelp(ctx);
  });

  bot.hears('❓ المساعدة والأوامر', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await showUserHelp(ctx);
  });

  // /recharge Command & hears "💳 شحن المحفظة"
  bot.command('recharge', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    try {
      await ctx.scene.enter('recharge-wizard');
    } catch (error) {
      console.error('Failed to enter recharge wizard:', error);
      await ctx.reply('⚠️ تعذر بدء عملية الشحن حالياً. يرجى المحاولة مرة أخرى.');
    }
  });

  bot.hears('💳 شحن المحفظة', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    try {
      await ctx.scene.enter('recharge-wizard');
    } catch (error) {
      console.error('Failed to enter recharge wizard:', error);
      await ctx.reply('⚠️ تعذر بدء عملية الشحن حالياً. يرجى المحاولة مرة أخرى.');
    }
  });

  // /start Command Handler
  bot.start(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';
    
    try {
      let user = await User.findOne({ telegramId });

      if (!user) {
        let referredBy = null;
        const startPayload = ctx.payload;
        if (startPayload && startPayload.startsWith('ref_')) {
          const referrerId = startPayload.substring(4);
          if (referrerId !== telegramId) {
            const referrerExists = await User.findOne({ telegramId: referrerId });
            if (referrerExists) {
              referredBy = referrerId;
              console.log(`User ${telegramId} was referred by ${referrerId}`);
            }
          }
        }

        user = new User({
          telegramId,
          username,
          firstName,
          lastName,
          balance: 0,
          isBanned: false,
          referredBy,
          referralRewardClaimed: false
        });
        await user.save();
        console.log(`New User registered: ${username || telegramId}`);

        if (referredBy) {
          try {
            await ctx.telegram.sendMessage(
              referredBy,
              `👤 <b>سجل صديق جديد عن طريق رابط الإحالة الخاص بك!</b>\n\n` +
              `ستحصل على الهدية <b>(25 نقطة)</b> فور قيام صديقك بشحن رصيد بمبلغ <b>300 جنيه أو أكثر</b> للمرة الأولى. 📈`,
              { parse_mode: 'HTML' }
            );
          } catch (err) {
            console.error(`Failed to notify referrer ${referredBy} of registration:`, err.message);
          }
        }
      } else {
        user.username = username;
        user.firstName = firstName;
        user.lastName = lastName;
        await user.save();
      }

      const welcomeMessage = 
        `✨ <b>مرحباً بك في بوت LoveGift، ${escapeHTML(firstName)}!</b> ✨\n\n` +
        `متجرك الشخصي والذكي لإنشاء هدايا رقمية تفاعلية مذهلة لمن تحب.\n\n` +
        `💳 <b>رصيد نقاطك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `💡 <b>ماذا تريد أن تفعل اليوم؟</b>\n` +
        `• اضغط على <b>شحن المحفظة</b> لإضافة نقاط لمحفظتك\n` +
        `• اصنع هديتك الأولى من خلال زر <b>إنشاء هدية جديدة</b> بالأسفل\n\n` +
        `<i>للمساعدة والاستفسار، اضغط على زر <b>الدعم الفني</b> للتواصل مع الإدارة.</i>`;

      await ctx.replyWithHTML(welcomeMessage, {
        reply_markup: {
          keyboard: [
            [{ text: '🎁 إنشاء هدية جديدة' }, { text: '💳 شحن المحفظة' }],
            [{ text: '👤 حسابي الشخصي' }, { text: '❓ المساعدة والأوامر' }]
          ],
          resize_keyboard: true
        }
      });
    } catch (error) {
      console.error('Error in /start handler:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء تهيئة حسابك الشخصي. يرجى المحاولة مرة أخرى لاحقاً.');
    }
  });

  // Catch-all message handler to guide users to use keyboard buttons (private chat only)
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();
    if (ctx.scene && ctx.scene.current) {
      return next();
    }
    await ctx.reply('⚠️ يرجى استخدام الأزرار المتاحة في القائمة بالأسفل للتفاعل مع البوت.', {
      reply_markup: {
        keyboard: [
          [{ text: '🎁 إنشاء هدية جديدة' }, { text: '💳 شحن المحفظة' }],
          [{ text: '👤 حسابي الشخصي' }, { text: '❓ المساعدة والأوامر' }]
        ],
        resize_keyboard: true
      }
    });
  });
};

module.exports = { registerUserCommands };
