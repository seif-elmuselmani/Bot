/**
 * Localized Design Wizard Scene (Arabic)
 * A unified, flexible wizard handling CV/Portfolio creation and editing services.
 * Collects a reference document, gathers design instructions, and updates MongoDB.
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

// Helper to check for cancel button, main menu buttons, or other slash commands
const checkCancelOrCommand = async (ctx, next) => {
  const text = ctx.message?.text?.trim();
  if (!text) return false;

  const mainButtons = [
    '💳 شحن المحفظة',
    '📂 الخدمات',
    '👤 حسابي الشخصي',
    '📌 تعليمات الاستخدام',
    '❓ المساعدة والأوامر',
    '📞 الدعم الفني'
  ];

  const isCancel = 
    text === '❌ إلغاء الطلب' || 
    text === 'إلغاء' || 
    text.toLowerCase() === 'cancel' || 
    text === '/cancel';

  if (isCancel) {
    await ctx.reply('❌ تم إلغاء طلب التصميم وإعادة تعيين القائمة.', {
      reply_markup: {
        keyboard: [
          [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
          [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
          [{ text: '❓ المساعدة والأوامر' }, { text: '📞 الدعم الفني' }]
        ],
        resize_keyboard: true
      }
    });
    await ctx.scene.leave();
    return true;
  }

  if (mainButtons.includes(text) || text.startsWith('/')) {
    await ctx.scene.leave();
    if (next) await next();
    return true;
  }

  return false;
};

const designWizard = new WizardScene(
  'design-wizard',

  // Step 1: Prompt for the reference document (Old CV or Current ATS CV)
  async (ctx) => {
    const serviceName = ctx.session.selectedServiceName;
    const price = ctx.session.selectedPrice;

    // Safety check for session validation
    if (!serviceName || price === undefined) {
      await ctx.reply('⚠️ انتهت صلاحية الجلسة. من فضلك اختر الخدمة مرة أخرى من قائمة الخدمات /services.');
      return ctx.scene.leave();
    }

    // Verify balance first
    const userId = ctx.from.id.toString();
    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user || user.balance < price) {
        await ctx.reply(`❌ رصيدك الحالي غير كافٍ لطلب هذه الخدمة (السعر: ${price} نقطة). يرجى شحن الرصيد أولاً عبر /recharge.`);
        return ctx.scene.leave();
      }
    } catch (err) {
      console.error('Error verifying balance in designWizard start:', err);
      await ctx.reply('⚠️ تعذر التحقق من ملفك الشخصي. يرجى المحاولة مرة أخرى لاحقاً.');
      return ctx.scene.leave();
    }

    await ctx.replyWithHTML(
      `🎨 <b>الخدمة: ${escapeHTML(serviceName)}</b>\n\n` +
      `السعر: <b>${price} نقطة</b>\n\n` +
      `الخطوة 1/2: من فضلك قم برفع وإرسال <b>المستند المرجعي</b> الخاص بك (مثل: سيرة ذاتية قديمة، مسودة خبرات، أو ملف بيانات أولية):\n\n` +
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

  // Step 2: Validate document, ask for specific notes/instructions
  async (ctx, next) => {
    if (await checkCancelOrCommand(ctx, next)) return;

    const document = ctx.message?.document;
    if (!document) {
      await ctx.reply('❌ يرجى رفع ملف مستند صالح (مثل: PDF أو Word) كمرجع للمصمم:', {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء الطلب' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return; // Stay in the same step
    }

    ctx.wizard.state.referenceFileId = document.file_id;

    await ctx.replyWithHTML(
      `📝 <b>تعليمات وملاحظات التصميم</b>\n\n` +
      `الخطوة 2/2: من فضلك اكتب أي ملاحظات، تعليمات، أو تفضيلات ألوان وتعديلات ترغب في تطبيقها على التصميم الجديد.\n\n` +
      `<i>(إذا لم يكن لديك ملاحظات، اكتب <b>skip</b> أو <b>تخطي</b> أو <b>لا</b> - أو اضغط على الزر بالأسفل للإلغاء)</i>`,
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
  // Step 3: Capture instructions, prompt confirmation
  async (ctx, next) => {
    if (await checkCancelOrCommand(ctx, next)) return;

    const text = ctx.message?.text?.trim();
    if (!text) {
      await ctx.reply('❌ من فضلك اكتب بعض التعليمات، أو اكتب skip أو تخطي للتجاوز:', {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء الطلب' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return; // Stay in the same step
    }

    let notes = text;
    const lowerText = text.toLowerCase();
    if (lowerText === 'skip' || lowerText === 'no' || lowerText === 'تخطي' || lowerText === 'لا') {
      notes = 'بدون ملاحظات إضافية';
    }

    ctx.wizard.state.notes = notes;

    const price = ctx.session.selectedPrice;
    const serviceName = ctx.session.selectedServiceName;
    const userId = ctx.from.id.toString();

    try {
      // Verify user points before confirmation
      const user = await User.findOne({ telegramId: userId });
      if (!user || user.balance < price) {
        await ctx.reply(`❌ رصيدك الحالي غير كافٍ لإتمام هذا الطلب (سعر الخدمة: ${price} نقطة، رصيدك: ${user ? user.balance : 0} نقطة). يرجى شحن محفظتك عبر /recharge أولاً.`);
        return ctx.scene.leave();
      }

      await ctx.replyWithHTML(
        `📋 <b>تأكيد طلب التصميم</b>\n\n` +
        `• <b>الخدمة المطلوبة:</b> <code>${escapeHTML(serviceName)}</code>\n` +
        `• <b>التعليمات والملاحظات:</b> <i>${escapeHTML(notes)}</i>\n` +
        `• <b>التكلفة:</b> <b>${price} نقطة</b>\n` +
        `• <b>رصيدك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `هل تريد تأكيد تقديم طلب التصميم وخصم النقاط الآن؟`,
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
      console.error('Design Wizard Step 3 Error:', error);
      await ctx.reply('⚠️ حدث خطأ في النظام. يرجى المحاولة مرة أخرى.');
      return ctx.scene.leave();
    }
  },

  // Step 4: Handle confirmation, deduct points, log order, and forward to admin group
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

    const userId = ctx.from.id.toString();
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';
    
    const serviceType = ctx.session.selectedService;
    const price = ctx.session.selectedPrice;
    const serviceName = ctx.session.selectedServiceName;
    const referenceFileId = ctx.wizard.state.referenceFileId;
    const notes = ctx.wizard.state.notes;

    try {
      // 1. Fetch user to verify points
      const user = await User.findOne({ telegramId: userId });
      if (!user || user.balance < price) {
        await ctx.reply('❌ رصيدك الحالي غير كافٍ لإتمام هذا الطلب. يرجى شحن محفظتك أولاً عبر /recharge.');
        return ctx.scene.leave();
      }

      // 2. Generate unique order ID
      const dateString = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const orderId = `ORD-${dateString}-${randomDigits}`;

      const adminGroupId = process.env.ADMIN_GROUP_ID;
      if (!adminGroupId) {
        throw new Error('ADMIN_GROUP_ID environment variable is missing.');
      }

      // Format caption for Admin Group using HTML
      const adminCaption = 
        `🎨 <b>[طلب تصميم جديد]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>رقم الطلب:</b> <code>${escapeHTML(orderId)}</code>\n` +
        `👤 <b>العميل:</b> ${escapeHTML(firstName)} (@${escapeHTML(username || 'بدون')})\n` +
        `🔑 <b>معرّف العميل (ID):</b> <code>${escapeHTML(userId)}</code>\n` +
        `🛠️ <b>الخدمة المطلوبة:</b> <code>${escapeHTML(serviceName)}</code>\n` +
        `🪙 <b>التكلفة المخصومة:</b> <code>${price} نقطة</code>\n` +
        `📝 <b>ملاحظات العميل:</b> <i>${escapeHTML(notes)}</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📥 <b>الإجراء المطلوب:</b>\n` +
        `قم بالرد على رسالة هذا الملف بملف التصميم المكتمل لتسليمه للعميل مباشرة وإغلاق الطلب.`;

      const keyboardMarkup = {
        inline_keyboard: [
          [{ text: '❌ إلغاء الطلب واسترداد النقاط', callback_data: `admin_refund_order_${orderId}` }]
        ]
      };

      // 3. Dispatch document to Admin Group first
      const adminSentMessage = await ctx.telegram.sendDocument(adminGroupId, referenceFileId, {
        caption: adminCaption,
        parse_mode: 'HTML',
        reply_markup: keyboardMarkup
      });

      // 4. Deduct balance from user
      user.balance -= price;
      await user.save();
      console.log(`Deducted ${price} points for ${serviceName} from ${userId}. Balance: ${user.balance}`);

      // 5. Record order in database (single write)
      const order = new Order({
        orderId,
        telegramId: userId,
        serviceType,
        price,
        fileId: referenceFileId,
        textInput: `Service Name: ${serviceName} | Notes: ${notes}`,
        status: 'in_progress',
        adminMessageId: adminSentMessage.message_id
      });
      await order.save();

      // 6. Notify user and re-attach main menu
      await ctx.replyWithHTML(
        `✅ <b>تم تقديم طلب التصميم بنجاح!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${escapeHTML(orderId)}</code>\n` +
        `• <b>الخدمة:</b> <code>${escapeHTML(serviceName)}</code>\n` +
        `• <b>النقاط المخصومة:</b> <code>${price} نقطة</code>\n` +
        `• <b>الرصيد المتبقي:</b> <code>${user.balance} نقطة</code>\n\n` +
        `سيقوم فريق التصميم والعمل بتجهيز الملفات وإرسالها لك في هذه المحادثة فور انتهائها.`,
        {
          reply_markup: {
            keyboard: [
              [{ text: '💳 شحن المحفظة' }, { text: '📂 الخدمات' }],
              [{ text: '👤 حسابي الشخصي' }, { text: '📌 تعليمات الاستخدام' }],
              [{ text: '❓ المساعدة والأوامر' }, { text: '📞 الدعم الفني' }]
            ],
            resize_keyboard: true
          }
        }
      );

      // Clear session choices
      delete ctx.session.selectedService;
      delete ctx.session.selectedPrice;
      delete ctx.session.selectedServiceName;

    } catch (error) {
      console.error('Design Wizard Refactored Submission Error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء إرسال طلب التصميم للإدارة. لم يتم خصم أي نقاط من رصيدك. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.');
    }

    return ctx.scene.leave();
  }
);

module.exports = designWizard;
