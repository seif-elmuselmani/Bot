/**
 * Localized Order Wizard Scene (Arabic)
 * Wizard scene guiding users through service order files submissions.
 * Validates document uploads, performs point balance deductions, saves the order log,
 * and alerts the admin team.
 */

const { Scenes: { WizardScene } } = require('telegraf');
const User = require('../../models/User');
const Order = require('../../models/Order');

// Helper to escape HTML characters for Telegram HTML formatting
const escapeHTML = (str) => {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// Helper to check for cancel button or other slash commands
const checkCancelOrCommand = async (ctx, next) => {
  const text = ctx.message?.text?.trim();
  if (!text) return false;

  const isCancel = 
    text === '❌ إلغاء الطلب' || 
    text === 'إلغاء' || 
    text.toLowerCase() === 'cancel' || 
    text === '/cancel';

  if (isCancel) {
    await ctx.reply('❌ تم إلغاء تقديم الطلب وإعادة تعيين القائمة.', {
      reply_markup: {
        keyboard: [
          [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
          [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
          [{ text: '📞 الدعم الفني' }]
        ],
        resize_keyboard: true
      }
    });
    await ctx.scene.leave();
    return true;
  }

  if (text.startsWith('/')) {
    await ctx.scene.leave();
    if (next) await next();
    return true;
  }

  return false;
};

const orderWizard = new WizardScene(
  'order-wizard',

  // Step 1: Prompt the user to upload the document
  async (ctx) => {
    const serviceType = ctx.session.selectedService;
    const price = ctx.session.selectedPrice;

    // Safety check if session was lost
    if (!serviceType || price === undefined) {
      await ctx.reply('⚠️ انتهت صلاحية الجلسة. من فضلك اختر الخدمة مرة أخرى من قائمة الخدمات /services.');
      return ctx.scene.leave();
    }

    const formattedService = serviceType.replace(/_/g, ' ').toUpperCase();
    await ctx.replyWithHTML(
      `📥 <b>تقديم طلب خدمة: ${escapeHTML(formattedService)}</b>\n\n` +
      `السعر: <b>${price} نقطة</b>\n\n` +
      `من فضلك قم برفع وإرسال <b>المستند</b> المراد فحصه أو معالجته (مثل: PDF أو Word):\n\n` +
      `<i>أرسل كلمة "إلغاء" أو اضغط على الزر بالأسفل لإلغاء العملية.</i>`,
      {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء الطلب' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
    return ctx.wizard.next();
  },
  // Step 2: Validate document, fetch user details, prompt confirmation
  async (ctx, next) => {
    if (await checkCancelOrCommand(ctx, next)) return;

    // Validate if user sent a document
    const document = ctx.message?.document;
    if (!document) {
      await ctx.reply('❌ يرجى رفع ملف مستند صالح (مثل: PDF أو Word) للمتابعة:', {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء الطلب' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return; // Wait for document; do not advance
    }

    const serviceType = ctx.session.selectedService;
    const price = ctx.session.selectedPrice;
    const userId = ctx.from.id.toString();

    try {
      // Fetch user to re-verify balance
      const user = await User.findOne({ telegramId: userId });
      if (!user || user.balance < price) {
        await ctx.reply(`❌ رصيدك الحالي غير كافٍ لإتمام هذا الطلب (سعر الخدمة: ${price} نقطة، رصيدك: ${user ? user.balance : 0} نقطة). يرجى شحن محفظتك عبر /recharge أولاً.`);
        return ctx.scene.leave();
      }

      // Save document details in wizard state
      ctx.wizard.state.fileId = document.file_id;
      ctx.wizard.state.fileName = document.file_name || 'document';

      const formattedService = serviceType.replace(/_/g, ' ').toUpperCase();

      await ctx.replyWithHTML(
        `📋 <b>تأكيد طلب الخدمة</b>\n\n` +
        `• <b>الخدمة المطلوبة:</b> <code>${escapeHTML(formattedService)}</code>\n` +
        `• <b>الملف المرفق:</b> <code>${escapeHTML(ctx.wizard.state.fileName)}</code>\n` +
        `• <b>التكلفة:</b> <b>${price} نقطة</b>\n` +
        `• <b>رصيدك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `هل تريد تأكيد تقديم الطلب وخصم النقاط الآن؟`,
        {
          reply_markup: {
            keyboard: [
              [{ text: '✅ تأكيد وتقديم الطلب' }],
              [{ text: '❌ إلغاء الطلب' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
      return ctx.wizard.next();

    } catch (error) {
      console.error('Order Wizard Step 2 Error:', error);
      await ctx.reply('⚠️ حدث خطأ في النظام. يرجى المحاولة مرة أخرى.');
      return ctx.scene.leave();
    }
  },

  // Step 3: Receive confirmation, deduct points, record order, notify admins
  async (ctx, next) => {
    if (await checkCancelOrCommand(ctx, next)) return;

    const text = ctx.message?.text?.trim();
    if (text !== '✅ تأكيد وتقديم الطلب') {
      await ctx.reply('❌ يرجى استخدام الأزرار بالأسفل لتأكيد تقديم الطلب أو إلغائه:', {
        reply_markup: {
          keyboard: [
            [{ text: '✅ تأكيد وتقديم الطلب' }],
            [{ text: '❌ إلغاء الطلب' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return; // Do not advance
    }

    const serviceType = ctx.session.selectedService;
    const price = ctx.session.selectedPrice;
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';
    const fileId = ctx.wizard.state.fileId;

    try {
      // 1. Fetch user to re-verify balance
      const user = await User.findOne({ telegramId: userId });
      if (!user || user.balance < price) {
        await ctx.reply('❌ رصيدك الحالي غير كافٍ لإتمام هذا الطلب. يرجى شحن محفظتك عبر /recharge أولاً.');
        return ctx.scene.leave();
      }

      // 2. Generate unique order ID
      const dateString = new Date().toISOString().slice(0,10).replace(/-/g, '');
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const orderId = `ORD-${dateString}-${randomDigits}`;

      // 3. Deduct points from user's balance
      user.balance -= price;
      await user.save();
      console.log(`Deducted ${price} points from user ${userId}. New balance: ${user.balance}`);

      // 4. Create new Order in MongoDB
      const order = new Order({
        orderId,
        telegramId: userId,
        serviceType,
        price,
        fileId,
        status: 'in_progress',
      });
      await order.save();

      // 5. Send order notification and document to Admin Group
      const adminGroupId = process.env.ADMIN_GROUP_ID;
      if (!adminGroupId) {
        throw new Error('ADMIN_GROUP_ID environment variable is missing.');
      }

      const formattedService = serviceType.replace(/_/g, ' ').toUpperCase();

      const adminCaption = 
        `📥 <b>طلب مستند أكاديمي جديد</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${escapeHTML(orderId)}</code>\n` +
        `• <b>معرّف المستخدم:</b> <code>${escapeHTML(userId)}</code>\n` +
        `• <b>المستخدم:</b> ${escapeHTML(firstName)} (@${escapeHTML(username || 'بدون_اسم_مستخدم')})\n` +
        `• <b>نوع الخدمة:</b> <code>${escapeHTML(formattedService)}</code>\n` +
        `• <b>التكلفة المخصومة:</b> <code>${price} نقطة</code>\n\n` +
        `📥 <b>الإجراء المطلوب:</b> يرجى الرد على رسالة هذا الملف بملف النتيجة المكتمل ليتم تسليمه للمستخدم تلقائياً.`;

      // Send the document directly to the Admin Group
      const adminSentMessage = await ctx.telegram.sendDocument(adminGroupId, fileId, {
        caption: adminCaption,
        parse_mode: 'HTML',
      });

      // Save admin message ID to Order for tracking replies
      order.adminMessageId = adminSentMessage.message_id;
      await order.save();

      // 6. Notify user and re-attach main menu
      await ctx.replyWithHTML(
        `✅ <b>تم تقديم طلبك بنجاح!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${escapeHTML(orderId)}</code>\n` +
        `• <b>الحالة:</b> قيد المعالجة\n` +
        `• <b>النقاط المخصومة:</b> <code>${price} نقطة</code>\n` +
        `• <b>الرصيد المتبقي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `الوقت المقدر للتنفيذ والتسليم هو <b>10-15 دقيقة</b>. ستصلك النتيجة هنا فور انتهاء الإدارة من العمل عليها.`,
        {
          reply_markup: {
            keyboard: [
              [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
              [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
              [{ text: '📞 الدعم الفني' }]
            ],
            resize_keyboard: true
          }
        }
      );

      // Clear selection session variables
      delete ctx.session.selectedService;
      delete ctx.session.selectedPrice;

    } catch (error) {
      console.error('Order Wizard Submission Error:', error);
      await ctx.reply('⚠️ حدث خطأ غير متوقع أثناء حفظ طلب الخدمة. يرجى التواصل مع الدعم الفني.');
    }

    return ctx.scene.leave();
  }
);

module.exports = orderWizard;
