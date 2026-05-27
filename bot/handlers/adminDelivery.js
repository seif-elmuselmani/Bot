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

      // Deliver text message to the user WITH clear next-step instructions
      const adminNote = message.text;
      const serviceLabel = order.serviceType.replace(/_/g, ' ').toUpperCase();

      await ctx.telegram.sendMessage(order.telegramId,
        `📩 <b>رسالة من الإدارة بخصوص طلبك:</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>\n\n` +
        `💬 <b>رسالة الإدارة:</b>\n${adminNote}\n\n` +
        `─────────────────\n` +
        `↩️ <b>للإعادة والتصحيح:</b>\n` +
        `اضغط على زر <b>📂 الخدمات</b> من القائمة بالأسفل واختر الخدمة مرة أخرى لإرسال الملف الصحيح.`,
        { parse_mode: 'HTML' }
      );

      // Confirm to admin group
      await ctx.replyWithHTML(
        `✅ <b>تم إرسال الرسالة للعميل بنجاح.</b>\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>معرّف العميل:</b> <code>${order.telegramId}</code>\n\n` +
        `<i>ملاحظة: حالة الطلب لم تتغير (لم يُرسَل ملف). أرسل ملفاً لإغلاق الطلب.</i>`
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

      if (order.status === 'completed') {
        return ctx.replyWithHTML(`ℹ️ الطلب رقم <code>${orderId}</code> مكتمل بالفعل مسبقاً.`);
      }
      if (order.status === 'cancelled') {
        return ctx.replyWithHTML(`❌ الطلب رقم <code>${orderId}</code> ملغي (تم استرداد نقاطه) ولا يمكن تسليمه.`);
      }

      const serviceLabel = order.serviceType.replace(/_/g, ' ').toUpperCase();

      // Build the caption sent to the user
      let userCaption =
        `✨ <b>ملف الخدمة الخاص بك جاهز!</b> ✨\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>\n` +
        `• <b>الحالة:</b> مكتمل ✅`;

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
      await ctx.replyWithHTML(
        `✅ <b>تم تسليم الطلب للعميل بنجاح!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>معرّف العميل:</b> <code>${order.telegramId}</code>\n` +
        (adminNote ? `• <b>الملاحظة المرفقة:</b> ${adminNote}\n` : '') +
        `\n<i>تم تحديث حالة الطلب إلى "مكتمل" في قاعدة البيانات.</i>`
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

      if (order.status === 'completed') {
        return ctx.replyWithHTML(`ℹ️ الطلب رقم <code>${orderId}</code> مكتمل بالفعل مسبقاً.`);
      }
      if (order.status === 'cancelled') {
        return ctx.replyWithHTML(`❌ الطلب رقم <code>${orderId}</code> ملغي (تم استرداد نقاطه) ولا يمكن تسليمه.`);
      }

      const serviceLabel = order.serviceType.replace(/_/g, ' ').toUpperCase();

      // Build the caption sent to the user
      let userCaption =
        `✨ <b>ملف الخدمة الخاص بك جاهز!</b> ✨\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>نوع الخدمة:</b> <code>${serviceLabel}</code>\n` +
        `• <b>الحالة:</b> مكتمل ✅`;

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
      await ctx.replyWithHTML(
        `✅ <b>تم تسليم الطلب للعميل بنجاح (صورة)!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>معرّف العميل:</b> <code>${order.telegramId}</code>\n` +
        (adminNote ? `• <b>الملاحظة المرفقة:</b> ${adminNote}\n` : '') +
        `\n<i>تم تحديث حالة الطلب إلى "مكتمل" في قاعدة البيانات.</i>`
      );

    } catch (dbError) {
      console.error('Database update error during photo delivery:', dbError);
      await ctx.replyWithHTML(`⚠️ خطأ في النظام أثناء تحديث قاعدة البيانات:\n<code>${dbError.message}</code>`);
    }
  });
};

module.exports = { setupAdminDelivery };
