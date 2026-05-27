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
        `📂 <b>قائمة خدمات SaveTimePro المتاحة</b>\n\n` +
        `اختر الخدمة المطلوبة من القائمة أدناه. سيتم فحص رصيدك أولاً ثم مطالبتك برفع الملفات المطلوبة.\n\n` +
        `💳 <b>اختر الخدمة للمتابعة:</b>`;

      await ctx.replyWithHTML(servicesMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 تقرير التشابه العلمي (60 نقطة)', callback_data: 'service_similarity_60' }],
            [{ text: '🤖 تقرير فحص الذكاء الاصطناعي (50 نقطة)', callback_data: 'service_ai_50' }],
            [{ text: '📄 إنشاء سيرة ATS جديدة (150 نقطة)', callback_data: 'service_design_create_cv' }],
            [{ text: '✏️ تعديل سيرة ATS الحالية (50 نقطة)', callback_data: 'service_design_edit_cv' }],
            [{ text: '💼 إنشاء بورتفوليو (300 نقطة)', callback_data: 'service_design_create_portfolio' }],
            [{ text: '🛠️ تعديل البورتفوليو الحالي (100 نقطة)', callback_data: 'service_design_edit_portfolio' }],
            [{ text: '✍️ تقليل نسبة الذكاء الاصطناعي (تسعير يدوي)', callback_data: 'service_ai_reduction' }],
            [{ text: 'ℹ️ تفاصيل واستفسار عن الخدمات', callback_data: 'services_info' }]
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
        `ℹ️ <b>دليل وتفاصيل خدمات SaveTimePro المتاحة</b>\n\n` +
        `• <b>📊 تقرير التشابه العلمي (60 نقطة):</b>\n` +
        `  1. ارفع ملف البحث بصيغة PDF أو Word.\n` +
        `  2. يجب ألا يقل الملف عن 300 كلمة.\n` +
        `  3. ستقوم الإدارة بفحصه وإرسال تقرير الاقتباس المفصل بصيغة PDF خلال 10-15 دقيقة.\n\n` +
        `• <b>🤖 تقرير فحص الذكاء الاصطناعي (50 نقطة):</b>\n` +
        `  1. ارفع الملف بصيغة PDF أو Word ليتم فحصه بالكامل.\n` +
        `  2. ستستلم تقريراً يوضح الجمل المكتوبة بالذكاء الاصطناعي ونسبتها.\n\n` +
        `• <b>📄 إنشاء سيرة ATS جديدة (150 نقطة):</b>\n` +
        `  1. اختر الخدمة واكتب بياناتك (الخبرات، التعليم، المهارات) عندما يطلبها البوت.\n` +
        `  2. ستقوم الإدارة بتصميم سيرة ذاتية احترافية متوافقة مع أنظمة الفرز الإلكتروني (ATS) من الصفر.\n\n` +
        `• <b>✏️ تعديل سيرة ATS الحالية (50 نقطة):</b>\n` +
        `  1. ارفع ملف سيرتك الذاتية الحالية.\n` +
        `  2. <u>ملاحظة:</u> يمكنك تعديل سيرة ذاتية قمت بإنشائها سابقاً عبر البوت، أو تحسين وتعديل أي سيرة أخرى لتصبح متوافقة تماماً مع معايير الـ ATS.\n\n` +
        `• <b>💼 إنشاء بورتفوليو (300 نقطة):</b>\n` +
        `  1. أرسل تفاصيل مشاريعك، خبراتك، روابط أعمالك، وصورك الشخصية.\n` +
        `  2. سيتم بناء ملف بورتفوليو مهني احترافي لعرض أعمالك.\n\n` +
        `• <b>🛠️ تعديل البورتفوليو الحالي (100 نقطة):</b>\n` +
        `  1. ارفع البورتفوليو الحالي واكتب التعديلات المطلوبة بوضوح ليتم تطبيقها.\n\n` +
        `• <b>✍️ تقليل نسبة الذكاء الاصطناعي (تسعير يدوي):</b>\n` +
        `  1. ارفع الملف المراد معالجته وإعادة صياغته.\n` +
        `  2. سيتم إرسال الملف للإدارة وسيقومون بتحديد السعر المناسب وإرساله لك للموافقة.\n` +
        `  3. عند موافقتك ودفع التكلفة المطلوبة، يبدأ العمل فوراً وتسليم الملف بعد انتهائه.`;

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
        `📂 <b>قائمة خدمات SaveTimePro المتاحة</b>\n\n` +
        `اختر الخدمة المطلوبة من القائمة أدناه. سيتم فحص رصيدك أولاً ثم مطالبتك برفع الملفات المطلوبة.\n\n` +
        `💳 <b>اختر الخدمة للمتابعة:</b>`;

      await ctx.editMessageText(servicesMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 تقرير التشابه العلمي (60 نقطة)', callback_data: 'service_similarity_60' }],
            [{ text: '🤖 تقرير فحص الذكاء الاصطناعي (50 نقطة)', callback_data: 'service_ai_50' }],
            [{ text: '📄 إنشاء سيرة ATS جديدة (150 نقطة)', callback_data: 'service_design_create_cv' }],
            [{ text: '✏️ تعديل سيرة ATS الحالية (50 نقطة)', callback_data: 'service_design_edit_cv' }],
            [{ text: '💼 إنشاء بورتفوليو (300 نقطة)', callback_data: 'service_design_create_portfolio' }],
            [{ text: '🛠️ تعديل البورتفوليو الحالي (100 نقطة)', callback_data: 'service_design_edit_portfolio' }],
            [{ text: '✍️ تقليل نسبة الذكاء الاصطناعي (تسعير يدوي)', callback_data: 'service_ai_reduction' }],
            [{ text: 'ℹ️ تفاصيل واستفسار عن الخدمات', callback_data: 'services_info' }]
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

  bot.hears('📂 الخدمات', async (ctx) => {
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
      if (serviceKey.startsWith('design_')) {
        await ctx.scene.enter('design-wizard');
      } else {
        await ctx.scene.enter('order-wizard');
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
      const promo = await PromoCode.findOne({ code: promoCodeInput });
      if (!promo) {
        return ctx.reply('❌ كود ترويجي غير صالح. يرجى التأكد وإعادة المحاولة.');
      }

      if (promo.usedBy.length >= promo.maxUses) {
        return ctx.reply('❌ لقد وصل هذا الكود للحد الأقصى من الاستخدام وانتهت صلاحيته.');
      }

      if (promo.usedBy.includes(telegramId)) {
        return ctx.reply('❌ لقد قمت بتفعيل هذا الكود الترويجي مسبقاً لحسابك.');
      }

      promo.usedBy.push(telegramId);
      await promo.save();

      const user = await User.findOneAndUpdate(
        { telegramId },
        { $inc: { balance: promo.rewardPoints } },
        { new: true }
      );

      if (!user) {
        // Rollback: remove user from usedBy list since registration is missing
        promo.usedBy.pull(telegramId);
        await promo.save();
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
      `📞 <b>الدعم الفني لبوت SaveTimePro</b>\n\n` +
      `للاستفسارات، أو مشاكل عمليات الشحن، أو طلبات الشراكة، يرجى التواصل مباشرة مع الإدارة.\n\n` +
      `💬 <b>حساب التواصل (واتساب):</b> <a href="https://wa.me/201223817860">+201223817860</a>`
    );
  });

  // Instructions of Use helper
  const showInstructionsMenu = async (ctx) => {
    const instructionMessage = 
      `📌 <b>تعليمات الاستخدام لبوت SaveTimePro</b> 🤖\n\n` +
      `📊 <b>الخدمات المتاحة وأسعارها بالنقاط:</b>\n` +
      `• تقرير فحص التشابه العلمي 📊 — <b>60 نقطة</b>\n` +
      `• تقرير فحص الذكاء الاصطناعي 🤖 — <b>50 نقطة</b>\n` +
      `• إنشاء سيرة ذاتية ATS جديدة 📄 — <b>150 نقطة</b>\n` +
      `• تعديل سيرة ذاتية ATS حالية ✏️ — <b>50 نقطة</b>\n` +
      `• إنشاء بورتفوليو مهني 💼 — <b>300 نقطة</b>\n` +
      `• تعديل بورتفوليو حالي 🛠️ — <b>100 نقطة</b>\n\n` +
      `💡 <b>طريقة الاستخدام:</b>\n` +
      `1️⃣ اشحن نقاط أولاً من خلال زر <b>شحن المحفظة</b> (1 جنيه = 1 نقطة).\n` +
      `2️⃣ اختر الخدمة المطلوبة بالضغط على زر <b>الخدمات</b>.\n` +
      `3️⃣ ارفع الملف المطلوب بالصيغة المدعومة.\n\n` +
      `📂 <b>الصيغ المقبولة للمستندات الأكاديمية:</b>\n` +
      `<code>.doc, .docx, .pdf, .txt, .rtf, .odt, .htm, .html</code>\n\n` +
      `⚠️ <b>القيود والشروط:</b>\n` +
      `• الحد الأقصى لحجم الملف المرفوع: <b>20 ميجابايت (20 MB)</b>.\n` +
      `• <b>ممنوع إرسال:</b> الصور، الملفات المضغوطة (zip/rar)، أو ملفات PowerPoint.\n` +
      `• يُفضَّل تسمية الملف باللغة الإنجليزية.\n` +
      `• <b>ملاحظة عن عدد الكلمات:</b> أنظمة الفحص لا تقبل أي ملف يقل عن <b>300 كلمة</b> وسيتم رفضه تلقائياً.\n\n` +
      `❓ <b>أهم الأسئلة الشائعة:</b>\n` +
      `🔸 <b>أشحن بكام عشان أقدر أستخدمه؟</b>\n` +
      `  - اشحن بالرصيد اللي يناسبك، وأسعار الخدمات تبدأ من 50 نقطة فقط.\n` +
      `🔸 <b>هل الرصيد بيختفي مع الوقت؟</b>\n` +
      `  - لا، رصيد نقاطك بيفضل محفوظ في حسابك الشخصي دايماً.\n` +
      `🔸 <b>هل بتقلل اقتباس؟</b>\n` +
      `  - نعم، تواصل مع الدعم الفني والاتفاق بيكون حسب نوع وحجم الملف.\n` +
      `🔸 <b>ليه البوت عملي بلوك؟</b>\n` +
      `  - في حالة التلاعب في إيصال الدفع، أو إدخال قيمة شحن غير حقيقية، أو تكرار إرسال إيصالات غير صالحة.\n` +
      `🔸 <b>إزاي أفك البلوك وأرجع أستخدم البوت تاني؟</b>\n` +
      `  - تواصل مع الدعم الفني وقدم تفاصيل حسابك وسيتم حل المشكلة وتنشيط حسابك فوراً.\n` +
      `🔸 <b>ليه طلب الشحن بيتأخر أحياناً وبيتقبل في ثواني أحياناً تانية؟</b>\n` +
      `  - لأن تأكيد الدفع ومراجعة الإيصالات يتم بشكل يدوي من قبل الإدارة لضمان الدقة.\n` +
      `🔸 <b>هل بتشوفوا الرسايل والملفات الخاصة بيا؟</b>\n` +
      `  - لا، ملفاتك تعامل بسرية تامة وتُرسل مباشرة للإدارة لمعالجتها فقط ولا يتم مشاركتها.\n\n` +
      `⏱️ <b>الوقت المتوقع للطلب:</b> 10-15 دقيقة.\n` +
      `💼 يوجد لدينا خدمة تقليل اقتباس واعادة صياغة وتقليل نسبة الذكاء الاصطناعي، للحصول عليها تواصل معنا.\n\n` +
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
        `✨ <b>مرحباً بك في بوت SaveTimePro، ${escapeHTML(firstName)}!</b> ✨\n\n` +
        `متجرك الشخصي والذكي لطلب الخدمات الأكاديمية والترجمة وخدمات التصميم.\n\n` +
        `💳 <b>رصيد نقاطك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `💡 <b>ماذا تريد أن تفعل اليوم؟</b>\n` +
        `• اضغط على <b>شحن المحفظة</b> بالأسفل لإضافة نقاط لمحفظتك\n` +
        `• تصفح الخدمات المتاحة من خلال زر <b>الخدمات</b> بالأسفل\n\n` +
        `<i>للمساعدة والاستفسار، اضغط على زر <b>الدعم الفني</b> للتواصل مع الإدارة.</i>`;

      await ctx.replyWithHTML(welcomeMessage, {
        reply_markup: {
          keyboard: [
            [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
            [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
            [{ text: '📞 الدعم الفني' }]
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
          [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
          [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
          [{ text: '📞 الدعم الفني' }]
        ],
        resize_keyboard: true
      }
    });
  });
};

module.exports = { registerUserCommands };
