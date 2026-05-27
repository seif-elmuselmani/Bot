/**
 * Localized Recharge Wizard Scene (Arabic)
 * Wizard scene guiding users through depositing funds, uploading a payment proof,
 * and forwarding requests to the administration group.
 */

const { Scenes: { WizardScene } } = require('telegraf');
const Deposit = require('../../models/Deposit');
const { normalizeDigits } = require('../utils/helpers');

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
    text === '❌ إلغاء العملية' || 
    text === 'إلغاء' || 
    text.toLowerCase() === 'cancel' || 
    text === '/cancel';

  if (isCancel) {
    await ctx.reply('❌ تم إلغاء عملية الشحن وإعادة تعيين القائمة.', {
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

const rechargeWizard = new WizardScene(
  'recharge-wizard',
  
  // Step 1: Prompt for the deposit amount
  async (ctx) => {
    await ctx.replyWithHTML(
      '💳 <b>شحن رصيد المحفظة</b>\n\n' +
      'لشحن رصيدك بالنقاط، يرجى أولاً تحويل المبلغ إلى رقم فودافون كاش التالي:\n' +
      '📞 <b><code>01223817860</code></b>\n\n' +
      'بعد إتمام التحويل، من فضلك أدخل هنا عدد النقاط التي ترغب في شحنها (مثال: <code>100</code>):\n\n' +
      '<i>أرسل كلمة "إلغاء" أو اضغط على الزر بالأسفل لإلغاء العملية.</i>',
      {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء العملية' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
    return ctx.wizard.next();
  },

  // Step 2: Validate amount and prompt for receipt photo
  async (ctx, next) => {
    if (await checkCancelOrCommand(ctx, next)) return;

    const text = ctx.message?.text?.trim();
    const amount = parseFloat(normalizeDigits(text));
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ قيمة غير صالحة. من فضلك أدخل رقماً صحيحاً أكبر من صفر (مثال: 150):', {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء العملية' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return; // Do not advance; wait for correct input
    }

    ctx.wizard.state.amount = amount;
    await ctx.replyWithHTML(
      '📸 <b>تحميل إيصال الدفع</b>\n\n' +
      'من فضلك قم برفع وإرسال <b>صورة/لقطة شاشة (Screenshot)</b> لإيصال تحويل الأموال الخاص بك:',
      {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء العملية' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
    return ctx.wizard.next();
  },  // Step 3: Validate receipt photo or document, and prompt for sender's phone number
  async (ctx, next) => {
    if (await checkCancelOrCommand(ctx, next)) return;

    const photo = ctx.message?.photo;
    const document = ctx.message?.document;
    let receiptFileId = null;
    let isPhoto = true;

    if (photo && photo.length > 0) {
      receiptFileId = photo[photo.length - 1].file_id;
    } else if (document) {
      receiptFileId = document.file_id;
      isPhoto = false;
    }

    if (!receiptFileId) {
      await ctx.reply('❌ يجب أن يكون الإيصال صورة مرفوعة أو ملف مستند. من فضلك ارفع لقطة شاشة أو ملف الإيصال الخاص بعملية الدفع:', {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء العملية' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return; // Do not advance
    }

    ctx.wizard.state.receiptFileId = receiptFileId;
    ctx.wizard.state.isPhoto = isPhoto;

    await ctx.replyWithHTML(
      '📱 <b>رقم الهاتف المحول منه</b>\n\n' +
      'من فضلك أدخل <b>رقم الهاتف المحول منه (11 رقماً)</b> (مثال: <code>01234567890</code>):',
      {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء العملية' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
    return ctx.wizard.next();
  },

  // Step 4: Validate phone number, save pending deposit, and notify admins
  async (ctx, next) => {
    if (await checkCancelOrCommand(ctx, next)) return;

    const text = ctx.message?.text?.trim();
    const phone = normalizeDigits(text);

    // Validate 11-digit number
    const phoneRegex = /^\d{11}$/;
    if (!phone || !phoneRegex.test(phone)) {
      await ctx.reply('❌ رقم الهاتف غير صالح. من فضلك أدخل رقم هاتف مكون من 11 رقماً (مثال: 01012345678):', {
        reply_markup: {
          keyboard: [
            [{ text: '❌ إلغاء العملية' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return; // Do not advance; wait for correct input
    }
    const amount = ctx.wizard.state.amount;
    const receiptFileId = ctx.wizard.state.receiptFileId;
    const isPhoto = ctx.wizard.state.isPhoto !== false;
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';

    try {
      // 1. Create a unique deposit ID for tracking
      const depositId = `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 2. Persist pending deposit in MongoDB
      const deposit = new Deposit({
        depositId,
        telegramId: userId,
        amount,
        senderPhone: phone,
        receiptFileId,
        status: 'pending',
      });
      await deposit.save();

      // 3. Dispatch validation alert to Admin Group
      const adminGroupId = process.env.ADMIN_GROUP_ID;
      if (!adminGroupId) {
        throw new Error('ADMIN_GROUP_ID environment variable is missing.');
      }

      // Format caption for Admin Group using HTML
      const adminCaption = 
        `📥 <b>طلب شحن محفظة جديد</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${escapeHTML(depositId)}</code>\n` +
        `• <b>المستخدم:</b> ${escapeHTML(firstName)} (@${escapeHTML(username || 'بدون_اسم_مستخدم')})\n` +
        `• <b>معرّف المستخدم:</b> <code>${escapeHTML(userId)}</code>\n` +
        `• <b>المبلغ المراد شحنه:</b> <code>${amount} نقطة</code>\n` +
        `• <b>رقم المحول:</b> <code>${escapeHTML(phone)}</code>\n\n` +
        `يرجى مراجعة إيصال الدفع المرفق واتخاذ الإجراء الملائم:`;

      const keyboardMarkup = {
        inline_keyboard: [
          [
            { text: '✅ موافقة', callback_data: `approve_dep_${depositId}` },
            { text: '❌ رفض', callback_data: `reject_dep_${depositId}` }
          ]
        ]
      };

      if (isPhoto) {
        await ctx.telegram.sendPhoto(adminGroupId, receiptFileId, {
          caption: adminCaption,
          parse_mode: 'HTML',
          reply_markup: keyboardMarkup
        });
      } else {
        await ctx.telegram.sendDocument(adminGroupId, receiptFileId, {
          caption: adminCaption,
          parse_mode: 'HTML',
          reply_markup: keyboardMarkup
        });
      }
      // 4. Acknowledge user and close wizard with main menu keyboard
      await ctx.replyWithHTML(
        `✅ <b>تم إرسال الطلب بنجاح!</b>\n\n` +
        `طلب الشحن الخاص بك بقيمة <b>${amount} نقطة</b> تم رفعه للمشرفين وهو قيد المراجعة حالياً.\n` +
        `ستصلك رسالة إشعار هنا فور الموافقة عليه وتحديث محفظتك.`,
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

    } catch (error) {
      console.error('Recharge Wizard Error:', error);
      await ctx.reply('⚠️ حدث خطأ غير متوقع أثناء حفظ طلب الشحن. يرجى التواصل مع الدعم الفني.');
    }

    return ctx.scene.leave();
  }
);

module.exports = rechargeWizard;
