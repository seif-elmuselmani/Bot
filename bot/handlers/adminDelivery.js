/**
 * Admin Delivery Handler (Arabic) - Extended Version
 * 
 * Allows admins to reply to a pending order in the Admin Group with:
 *   1. Text only     → sends a text message to the user (e.g. "re-upload your file")
 *   2. File/Doc      → sends the document to the user & marks order completed
 *   3. Photo         → sends the image to the user & marks order completed
 * 
 * The admin must REPLY to the original bot order message in the group.
 */

const Order = require('../../models/Order');
const { escapeHTML } = require('../utils/helpers');

// Helper: extract Order ID from a message caption or text
const extractOrderId = (text) => {
  if (!text) return null;
  const match = text.match(/Order ID:\s*([A-Z0-9-]+)/i) || text.match(/رقم الطلب:\s*([A-Z0-9-]+)/i);
  return match ? match[1] : null;
};

const setupAdminDelivery = (bot) => {
  // ─────────────────────────────────────────────
  // Handler 1: Text-only reply → forward message to user
  // ─────────────────────────────────────────────
  bot.on('text', async (ctx, next) => {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (!adminGroupId) return next();
    if (ctx.chat.id.toString() !== adminGroupId.toString()) return next();

    const message = ctx.message;
    if (!message.reply_to_message) return next();

    // Ignore command messages (e.g. /admin, /stats)
    if (message.text && message.text.startsWith('/')) return next();

    const repliedMessage = message.reply_to_message;

    // Extract Order ID from the original bot message caption
    const orderId = extractOrderId(repliedMessage.caption) || extractOrderId(repliedMessage.text);
    if (!orderId) return next(); // Not a reply to an order - let other handlers process it

    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        return ctx.reply(`⚠️ لم يتم العثور على الطلب رقم <code>${orderId}</code> في النظام.`, { parse_mode: 'HTML' });
      }

      // Check if order is cancelled
      if (order.status === 'cancelled') {
        return ctx.replyWithHTML(`❌ الطلب رقم <code>${orderId}</code> ملغي (تم استرداد نقاطه) ولا يمكن مراسلة العميل بشأنه.`);
      }

      // Handle AI reduction pricing quote from admin
      if (order.status === 'pending_payment' && order.serviceType === 'ai_reduction') {
        const cleanText = message.text.trim();
        const price = parseInt(cleanText.replace(/[^\d]/g, ''), 10);
        if (isNaN(price) || price <= 0) {
          return ctx.replyWithHTML('⚠️ يرجى كتابة السعر كرقم صحيح فقط (مثال: <code>250</code>).');
        }

        // Update the order price in DB
        order.price = price;
        await order.save();

        // Send a message to the user with Accept/Reject inline buttons
        const quoteMessage =
          `💰 <b>تحديد سعر خدمة تقليل نسبة الـ AI</b>\n\n` +
          `تم تحديد سعر طلبك من قبل المشرفين:\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>السعر المحدد:</b> <code>${price} نقطة</code>\n\n` +
          `هل توافق على هذا السعر لخصم النقاط والبدء بالعمل؟`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: `✅ موافقة ودفع ${price} نقطة`, callback_data: `user_accept_price_${orderId}` },
              { text: `❌ رفض وإلغاء الطلب`, callback_data: `user_reject_price_${orderId}` }
            ]
          ]
        };

        try {
          await ctx.telegram.sendMessage(order.telegramId, quoteMessage, {
            parse_mode: 'HTML',
            reply_markup: inlineKeyboard
          });
        } catch (tgError) {
          console.error(`Failed to send price quote to user ${order.telegramId}:`, tgError);
          return ctx.replyWithHTML(`❌ فشل إرسال عرض السعر للعميل. قد يكون حظر البوت.\n<code>${tgError.message}</code>`);
        }

        // Update the admin message caption/text to show that the price is sent
        const cleanCaption = (repliedMessage.caption || repliedMessage.text || '').replace(/[*_`[\]()]/g, '');
        try {
          await ctx.telegram.editMessageCaption(
            adminGroupId,
            repliedMessage.message_id,
            null,
            `${cleanCaption}\n\n⏳ <b>تم إرسال عرض السعر:</b> <code>${price} نقطة</code> (بانتظار موافقة العميل)`,
            { parse_mode: 'HTML' }
          );
        } catch (editError) {
          try {
            await ctx.telegram.editMessageText(
              adminGroupId,
              repliedMessage.message_id,
              null,
              `${cleanCaption}\n\n⏳ <b>تم إرسال عرض السعر:</b> <code>${price} نقطة</code> (بانتظار موافقة العميل)`,
              { parse_mode: 'HTML' }
            );
          } catch (editError2) {
            console.error('Failed to update admin message content:', editError2);
          }
        }

        return ctx.replyWithHTML(`✅ تم إرسال عرض السعر (<code>${price} نقطة</code>) للعميل بنجاح.`);
      }

      // Deliver text message to the user WITH clear next-step instructions
      const adminNote = message.text;
      const serviceLabel = order.serviceType.replace(/_/g, ' ').toUpperCase();

      await ctx.telegram.sendMessage(order.telegramId,
        `📩 <b>رسالة من الإدارة بخصوص طلبك:</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>\n\n` +
        `💬 <b>رسالة الإدارة:</b>\n${escapeHTML(adminNote)}\n\n` +
        `─────────────────\n` +
        `↩️ <b>للإعادة والتصحيح:</b>\n` +
        `اضغط على زر <b>📂 الخدمات</b> من القائمة بالأسفل واختر الخدمة مرة أخرى لإرسال الملف الصحيح.`,
        { parse_mode: 'HTML' }
      );

      const keyboardMarkup = {
        inline_keyboard: [
          [{ text: '❌ إلغاء الطلب واسترداد النقاط', callback_data: `admin_refund_order_${orderId}` }]
        ]
      };

      // Confirm to admin group
      await ctx.replyWithHTML(
        `✅ <b>تم إرسال الرسالة للعميل بنجاح.</b>\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>معرّف العميل:</b> <code>${order.telegramId}</code>\n\n` +
        `<i>ملاحظة: حالة الطلب لم تتغير (لم يُرسَل ملف). يمكنك الضغط على الزر أدناه لإلغاء الطلب ورد النقاط للعميل فوراً.</i>`,
        { reply_markup: keyboardMarkup }
      );

    } catch (err) {
      console.error('Text delivery error:', err);
      if (err.description && err.description.toLowerCase().includes('blocked')) {
        return ctx.reply('❌ فشل الإرسال: المستخدم حظر البوت أو لم يبدأ محادثة معه.');
      }
      await ctx.replyWithHTML(`⚠️ خطأ أثناء إرسال الرسالة: <code>${err.message}</code>`);
    }
  });

  // ─────────────────────────────────────────────
  // Handler 2: File reply (with or without caption) → deliver & complete order
  // ─────────────────────────────────────────────
  bot.on('document', async (ctx, next) => {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (!adminGroupId) return next();
    if (ctx.chat.id.toString() !== adminGroupId.toString()) return next();

    const message = ctx.message;
    if (!message.reply_to_message) return next();

    const repliedMessage = message.reply_to_message;

    // Extract Order ID from the original bot message
    const orderId = extractOrderId(repliedMessage.caption) || extractOrderId(repliedMessage.text);
    if (!orderId) return next();

    const deliveredFileId = message.document.file_id;
    // Admin may optionally include a text note alongside the file
    const adminNote = message.caption ? message.caption.trim() : null;

    console.log(`Admin Delivery: File reply detected for Order ${orderId}${adminNote ? ' (with note)' : ''}`);

    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        return ctx.replyWithHTML(`⚠️ خطأ: لم يتم العثور على الطلب رقم <code>${orderId}</code>.`);
      }

      if (order.status === 'cancelled') {
        return ctx.replyWithHTML(`❌ الطلب رقم <code>${orderId}</code> ملغي (تم استرداد نقاطه) ولا يمكن تسليمه.`);
      }

      const serviceLabel = order.serviceType.replace(/_/g, ' ').toUpperCase();
      const isMultiFile = order.serviceType === 'ai_reduction' || order.serviceType === 'both_reports';

      if (isMultiFile) {
        const isFirstFile = !order.deliveredFileId;
        const serviceName = order.serviceType === 'both_reports' ? 'كلا التقريرين (تشابه + AI)' : 'تقليل نسبة الذكاء الاصطناعي';
        
        // Build the caption sent to the user
        let userCaption;
        if (isFirstFile) {
          userCaption =
            `📥 <b>تم استلام الملف الأول (1/2) لطلبك</b>\n\n` +
            `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
            `• <b>نوع الخدمة:</b> <code>${serviceName}</code>\n\n` +
            `⏳ <i>جاري إرسال الملف الثاني المكمل من قبل الإدارة...</i>`;
        } else {
          userCaption =
            `✨ <b>تم استلام الملف الثاني (2/2) لطلبك</b> ✨\n\n` +
            `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
            `• <b>نوع الخدمة:</b> <code>${serviceName}</code>\n\n` +
            `✅ <b>تم تسليم كافة الملفات المطلوبة بنجاح!</b>`;
        }

        if (adminNote) {
          userCaption += `\n\n💬 <b>ملاحظة من الإدارة:</b>\n${adminNote}`;
        }
        userCaption += `\n\nشكراً لاختيارك <b>SaveTimePro</b>! 🙏`;

        // Send the file to the user
        try {
          await ctx.telegram.sendDocument(order.telegramId, deliveredFileId, {
            caption: userCaption,
            parse_mode: 'HTML',
          });
        } catch (tgError) {
          console.error(`Telegram delivery to ${order.telegramId} failed:`, tgError);
          if (tgError.description && tgError.description.toLowerCase().includes('blocked')) {
            return ctx.replyWithHTML('❌ فشل التسليم: قام المستخدم بحظر البوت أو لم يبدأ محادثة معه بعد.');
          }
          return ctx.replyWithHTML(`❌ فشل التسليم: تعذر إرسال الملف للعميل.\n<code>${tgError.message}</code>`);
        }

        if (isFirstFile) {
          order.deliveredFileId = deliveredFileId; // Store first file ID
          await order.save();
          return ctx.replyWithHTML(
            `✅ <b>تم إرسال الملف الأول (1/2) للعميل بنجاح!</b>\n\n` +
            `يرجى الرد على نفس الرسالة بالملف الثاني المكمل لإغلاق الطلب.`
          );
        } else {
          order.status = 'completed';
          await order.save();
          return ctx.replyWithHTML(
            `✅ <b>تم إرسال الملف الثاني (2/2) للعميل بنجاح!</b>\n\n` +
            `تم تسليم الملفين كاملين وتحديث حالة الطلب إلى "مكتمل" بنجاح. 🎉`
          );
        }
      }

      // Normal service logic
      const isAlreadyCompleted = order.status === 'completed';

      // Build the caption sent to the user
      let userCaption;
      if (isAlreadyCompleted) {
        userCaption =
          `📎 <b>ملف إضافي/تقرير تابع لطلبك:</b>\n\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>`;
      } else {
        userCaption =
          `✨ <b>ملف الخدمة الخاص بك جاهز!</b> ✨\n\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>\n` +
          `• <b>الحالة:</b> مكتمل ✅`;
      }

      if (adminNote) {
        userCaption += `\n\n💬 <b>ملاحظة من الإدارة:</b>\n${adminNote}`;
      }

      userCaption += `\n\nشكراً لاختيارك <b>SaveTimePro</b>! 🙏`;

      // Send the file to the user
      try {
        await ctx.telegram.sendDocument(order.telegramId, deliveredFileId, {
          caption: userCaption,
          parse_mode: 'HTML',
        });
      } catch (tgError) {
        console.error(`Telegram delivery to ${order.telegramId} failed:`, tgError);
        if (tgError.description && tgError.description.toLowerCase().includes('blocked')) {
          return ctx.replyWithHTML('❌ فشل التسليم: قام المستخدم بحظر البوت أو لم يبدأ محادثة معه بعد.');
        }
        return ctx.replyWithHTML(`❌ فشل التسليم: تعذر إرسال الملف للعميل.\n<code>${tgError.message}</code>`);
      }

      // Mark order completed in DB
      order.status = 'completed';
      order.deliveredFileId = deliveredFileId;
      await order.save();

      // Confirm to admin group
      const confirmLabel = isAlreadyCompleted ? 'ملف إضافي للطلب' : 'الطلب للعميل';
      await ctx.replyWithHTML(
        `✅ <b>تم تسليم ${confirmLabel} بنجاح!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>معرّف العميل:</b> <code>${order.telegramId}</code>\n` +
        (adminNote ? `• <b>الملاحظة المرفقة:</b> ${adminNote}\n` : '') +
        `\n<i>حالة الطلب في قاعدة البيانات: "مكتمل".</i>`
      );

    } catch (dbError) {
      console.error('Database update error during delivery:', dbError);
      await ctx.replyWithHTML(`⚠️ خطأ في النظام أثناء تحديث قاعدة البيانات:\n<code>${dbError.message}</code>`);
    }
  });

  // ─────────────────────────────────────────────
  // Handler 3: Photo reply (with or without caption) → deliver & complete order
  // ─────────────────────────────────────────────
  bot.on('photo', async (ctx, next) => {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (!adminGroupId) return next();
    if (ctx.chat.id.toString() !== adminGroupId.toString()) return next();

    const message = ctx.message;
    if (!message.reply_to_message) return next();

    const repliedMessage = message.reply_to_message;

    // Extract Order ID from the original bot message
    const orderId = extractOrderId(repliedMessage.caption) || extractOrderId(repliedMessage.text);
    if (!orderId) return next();

    const photoArray = message.photo;
    if (!photoArray || photoArray.length === 0) return next();
    const deliveredFileId = photoArray[photoArray.length - 1].file_id;
    // Admin may optionally include a text note alongside the photo
    const adminNote = message.caption ? message.caption.trim() : null;

    console.log(`Admin Delivery: Photo reply detected for Order ${orderId}${adminNote ? ' (with note)' : ''}`);

    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        return ctx.replyWithHTML(`⚠️ خطأ: لم يتم العثور على الطلب رقم <code>${orderId}</code>.`);
      }

      if (order.status === 'cancelled') {
        return ctx.replyWithHTML(`❌ الطلب رقم <code>${orderId}</code> ملغي (تم استرداد نقاطه) ولا يمكن تسليمه.`);
      }

      const serviceLabel = order.serviceType.replace(/_/g, ' ').toUpperCase();
      const isMultiFile = order.serviceType === 'ai_reduction' || order.serviceType === 'both_reports';

      if (isMultiFile) {
        const isFirstFile = !order.deliveredFileId;
        const serviceName = order.serviceType === 'both_reports' ? 'كلا التقريرين (تشابه + AI)' : 'تقليل نسبة الذكاء الاصطناعي';

        // Build the caption sent to the user
        let userCaption;
        if (isFirstFile) {
          userCaption =
            `📥 <b>تم استلام الملف الأول (1/2) لطلبك (صورة)</b>\n\n` +
            `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
            `• <b>نوع الخدمة:</b> <code>${serviceName}</code>\n\n` +
            `⏳ <i>جاري إرسال الملف الثاني المكمل من قبل الإدارة...</i>`;
        } else {
          userCaption =
            `✨ <b>تم استلام الملف الثاني (2/2) لطلبك (صورة)</b> ✨\n\n` +
            `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
            `• <b>نوع الخدمة:</b> <code>${serviceName}</code>\n\n` +
            `✅ <b>تم تسليم كافة الملفات المطلوبة بنجاح!</b>`;
        }

        if (adminNote) {
          userCaption += `\n\n💬 <b>ملاحظة من الإدارة:</b>\n${adminNote}`;
        }
        userCaption += `\n\nشكراً لاختيارك <b>SaveTimePro</b>! 🙏`;

        // Send the photo to the user
        try {
          await ctx.telegram.sendPhoto(order.telegramId, deliveredFileId, {
            caption: userCaption,
            parse_mode: 'HTML',
          });
        } catch (tgError) {
          console.error(`Telegram delivery to ${order.telegramId} failed:`, tgError);
          if (tgError.description && tgError.description.toLowerCase().includes('blocked')) {
            return ctx.replyWithHTML('❌ فشل التسليم: قام المستخدم بحظر البوت أو لم يبدأ محادثة معه بعد.');
          }
          return ctx.replyWithHTML(`❌ فشل التسليم: تعذر إرسال الصورة للعميل.\n<code>${tgError.message}</code>`);
        }

        if (isFirstFile) {
          order.deliveredFileId = deliveredFileId; // Store first file ID
          await order.save();
          return ctx.replyWithHTML(
            `✅ <b>تم إرسال الملف الأول (1/2) للعميل بنجاح (صورة)!</b>\n\n` +
            `يرجى الرد على نفس الرسالة بالملف الثاني المكمل لإغلاق الطلب.`
          );
        } else {
          order.status = 'completed';
          await order.save();
          return ctx.replyWithHTML(
            `✅ <b>تم إرسال الملف الثاني (2/2) للعميل بنجاح (صورة)!</b>\n\n` +
            `تم تسليم الملفين كاملين وتحديث حالة الطلب إلى "مكتمل" بنجاح. 🎉`
          );
        }
      }

      // Normal service logic
      const isAlreadyCompleted = order.status === 'completed';

      // Build the caption sent to the user
      let userCaption;
      if (isAlreadyCompleted) {
        userCaption =
          `📎 <b>ملف إضافي/تقرير تابع لطلبك:</b>\n\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>`;
      } else {
        userCaption =
          `✨ <b>ملف الخدمة الخاص بك جاهز!</b> ✨\n\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>\n` +
          `• <b>الحالة:</b> مكتمل ✅`;
      }

      if (adminNote) {
        userCaption += `\n\n💬 <b>ملاحظة من الإدارة:</b>\n${adminNote}`;
      }

      userCaption += `\n\nشكراً لاختيارك <b>SaveTimePro</b>! 🙏`;

      // Send the photo to the user
      try {
        await ctx.telegram.sendPhoto(order.telegramId, deliveredFileId, {
          caption: userCaption,
          parse_mode: 'HTML',
        });
      } catch (tgError) {
        console.error(`Telegram delivery to ${order.telegramId} failed:`, tgError);
        if (tgError.description && tgError.description.toLowerCase().includes('blocked')) {
          return ctx.replyWithHTML('❌ فشل التسليم: قام المستخدم بحظر البوت أو لم يبدأ محادثة معه بعد.');
        }
        return ctx.replyWithHTML(`❌ فشل التسليم: تعذر إرسال الصورة للعميل.\n<code>${tgError.message}</code>`);
      }

      // Mark order completed in DB
      order.status = 'completed';
      order.deliveredFileId = deliveredFileId; // Store delivered photo file ID
      await order.save();

      // Confirm to admin group
      const confirmLabel = isAlreadyCompleted ? 'ملف إضافي للطلب (صورة)' : 'الطلب للعميل (صورة)';
      await ctx.replyWithHTML(
        `✅ <b>تم تسليم ${confirmLabel} بنجاح!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>معرّف العميل:</b> <code>${order.telegramId}</code>\n` +
        (adminNote ? `• <b>الملاحظة المرفقة:</b> ${adminNote}\n` : '') +
        `\n<i>حالة الطلب في قاعدة البيانات: "مكتمل".</i>`
      );

    } catch (dbError) {
      console.error('Database update error during photo delivery:', dbError);
      await ctx.replyWithHTML(`⚠️ خطأ في النظام أثناء تحديث قاعدة البيانات:\n<code>${dbError.message}</code>`);
    }
  });
};

module.exports = { setupAdminDelivery };
