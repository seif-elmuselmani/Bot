/**
 * Localized Admin Callback Actions (Arabic)
 * Handles inline button callbacks for approving or rejecting user wallet deposits.
 */

const User = require('../../models/User');
const Deposit = require('../../models/Deposit');

// Safe HTML escaper for rebuilding captions without formatting breaking the bot
const escapeHTML = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Registers callback action listeners on the Telegraf bot instance.
 * @param {Telegraf} bot - The Telegraf bot instance.
 */
const registerAdminActions = (bot) => {
  
  // Handle Approval: approve_deposit_{userId}_{amount}
  bot.action(/^approve_deposit_(\d+)_([\d.]+)$/, async (ctx) => {
    const userId = ctx.match[1];
    const amount = parseFloat(ctx.match[2]);

    try {
      // 1. Credit the user's balance in MongoDB
      const user = await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { balance: amount } },
        { new: true } // Returns updated document
      );

      if (!user) {
        return ctx.answerCbQuery('❌ خطأ: لم يتم العثور على المستخدم في قاعدة البيانات.', { show_alert: true });
      }

      // 2. Mark the corresponding pending deposit in DB as approved
      await Deposit.findOneAndUpdate(
        { telegramId: userId, status: 'pending', amount: amount },
        { status: 'approved' },
        { sort: { createdAt: -1 } } // Update the most recent one
      );

      // 3. Notify the user in their private chat
      try {
        await ctx.telegram.sendMessage(
          userId,
          `✅ *تمت الموافقة على شحن رصيدك\\!*\n\n` +
          `تمت الموافقة على طلب الشحن بقيمة *${amount} نقطة* من قبل إدارة البوت\\.\n` +
          `💳 *الرصيد الحالي للمحفظة:* \`${user.balance} نقطة\``,
          { parse_mode: 'MarkdownV2' }
        );
      } catch (notifyErr) {
        console.error(`Notification failed for user ${userId}:`, notifyErr.message);
      }

      // 4. Update the message in the Admin Group (remove keyboard, append status)
      const cleanCaption = escapeHTML(ctx.callbackQuery.message.caption || '');
      await ctx.editMessageCaption(
        `${cleanCaption}\n\n🟢 <b>الحالة:</b> ✅ تم قبول الشحن`,
        { parse_mode: 'HTML', reply_markup: null }
      );

      // Alert the admin who clicked the button
      await ctx.answerCbQuery('✅ تم قبول الشحن وتحديث رصيد العميل.');

    } catch (error) {
      console.error('Error handling approve_deposit callback:', error);
      await ctx.answerCbQuery('⚠️ حدث خطأ في قاعدة البيانات أثناء تأكيد الطلب.', { show_alert: true });
    }
  });

  // Handle Rejection: reject_deposit_{userId}
  bot.action(/^reject_deposit_(\d+)$/, async (ctx) => {
    const userId = ctx.match[1];

    try {
      // 1. Mark the latest pending deposit for this user as rejected
      const deposit = await Deposit.findOneAndUpdate(
        { telegramId: userId, status: 'pending' },
        { status: 'rejected' },
        { sort: { createdAt: -1 } }
      );

      const amountStr = deposit ? `${deposit.amount} نقطة` : 'شحن المحفظة';

      // 2. Notify the user of the rejection
      try {
        await ctx.telegram.sendMessage(
          userId,
          `❌ *تم رفض طلب الشحن*\n\n` +
          `تم رفض طلب شحن الرصيد الخاص بك بقيمة *${amountStr}* من قبل المشرفين\\.\n` +
          `إذا كنت تعتقد أن هذا الإجراء تم بالخطأ، يرجى التواصل مع الدعم الفني للمساعدة\\.`,
          { parse_mode: 'MarkdownV2' }
        );
      } catch (notifyErr) {
        console.error(`Notification failed for user ${userId}:`, notifyErr.message);
      }

      // 3. Update the message in the Admin Group
      const cleanCaption = escapeHTML(ctx.callbackQuery.message.caption || '');
      await ctx.editMessageCaption(
        `${cleanCaption}\n\n🔴 <b>الحالة:</b> ❌ تم رفض طلب الشحن`,
        { parse_mode: 'HTML', reply_markup: null }
      );

      await ctx.answerCbQuery('❌ تم رفض الطلب وإرسال إشعار للعميل.');

    } catch (error) {
      console.error('Error handling reject_deposit callback:', error);
      await ctx.answerCbQuery('⚠️ حدث خطأ في قاعدة البيانات أثناء إلغاء الطلب.', { show_alert: true });
    }
  });
};

module.exports = { registerAdminActions };
