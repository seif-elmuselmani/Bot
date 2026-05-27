/**
 * Admin Commands Module
 * Defines and registers all commands and hears triggers restricted to the bot administrators.
 */

const User = require('../../models/User');
const Deposit = require('../../models/Deposit');
const Order = require('../../models/Order');
const PromoCode = require('../../models/PromoCode');
const SystemConfig = require('../../models/SystemConfig');

const { escapeHTML, checkAdmin, getStatsHTML, getPromosHTML } = require('../utils/helpers');

/**
 * Registers all admin-level commands and handlers on the Telegraf bot.
 * @param {Telegraf} bot 
 */
const registerAdminCommands = (bot) => {

  // Admin Command: /ban <telegramId_or_@username>
  bot.command('ban', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return; // Silent ignore

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    if (args.length < 2) {
      return ctx.reply('⚠️ طريقة الاستخدام: /ban <telegramId_أو_@اسم_المستخدم>');
    }

    const targetInput = args[1];
    let query = {};
    if (/^\d+$/.test(targetInput)) {
      query = { telegramId: targetInput };
    } else {
      const cleanUsername = targetInput.replace(/^@/, '');
      query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
    }

    try {
      const user = await User.findOne(query);
      if (!user) {
        return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات "${targetInput}" في قاعدة البيانات.`);
      }

      if (user.isBanned) {
        return ctx.reply(`ℹ️ المستخدم ${user.firstName || user.username || user.telegramId} محظور بالفعل مسبقاً.`);
      }

      user.isBanned = true;
      await user.save();

      console.log(`User ${user.telegramId} was banned by admin.`);
      await ctx.replyWithHTML(
        `✅ <b>تم حظر المستخدم بنجاح!</b>\n\n` +
        `• <b>الاسم:</b> ${escapeHTML(user.firstName || 'غير محدد')}\n` +
        `• <b>المعرّف:</b> <code>${user.telegramId}</code>\n` +
        `• <b>اسم المستخدم:</b> @${escapeHTML(user.username || 'بدون')}\n\n` +
        `<i>تم حظر حسابه ولن يتمكن من استخدام البوت بعد الآن.</i>`
      );
    } catch (error) {
      console.error('Ban command error:', error);
      await ctx.reply('⚠️ حدث خطأ في قاعدة البيانات أثناء معالجة طلب الحظر.');
    }
  });

  // Admin Command: /unban <telegramId_or_@username>
  bot.command('unban', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return; // Silent ignore

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    if (args.length < 2) {
      return ctx.reply('⚠️ طريقة الاستخدام: /unban <telegramId_أو_@اسم_المستخدم>');
    }

    const targetInput = args[1];
    let query = {};
    if (/^\d+$/.test(targetInput)) {
      query = { telegramId: targetInput };
    } else {
      const cleanUsername = targetInput.replace(/^@/, '');
      query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
    }

    try {
      const user = await User.findOne(query);
      if (!user) {
        return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات "${targetInput}" في قاعدة البيانات.`);
      }

      if (!user.isBanned) {
        return ctx.reply(`ℹ️ المستخدم ${user.firstName || user.username || user.telegramId} غير محظور حالياً.`);
      }

      user.isBanned = false;
      await user.save();

      console.log(`User ${user.telegramId} was unbanned by admin.`);
      await ctx.replyWithHTML(
        `✅ <b>تم إلغاء حظر المستخدم بنجاح!</b>\n\n` +
        `• <b>الاسم:</b> ${escapeHTML(user.firstName || 'غير محدد')}\n` +
        `• <b>المعرّف:</b> <code>${user.telegramId}</code>\n` +
        `• <b>اسم المستخدم:</b> @${escapeHTML(user.username || 'بدون')}\n\n` +
        `<i>تم تنشيط حسابه ويمكنه التفاعل مع البوت الآن.</i>`
      );
    } catch (error) {
      console.error('Unban command error:', error);
      await ctx.reply('⚠️ حدث خطأ في قاعدة البيانات أثناء إلغاء الحظر.');
    }
  });

  // Admin Command: /broadcast <message_text>
  bot.command('broadcast', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return; // Silent ignore

    const text = ctx.message?.text || '';
    const spaceIndex = text.indexOf(' ');
    
    if (spaceIndex === -1) {
      return ctx.reply('⚠️ طريقة الاستخدام: /broadcast <نص_الرسالة>');
    }

    const broadcastMessage = text.substring(spaceIndex + 1).trim();
    if (!broadcastMessage) {
      return ctx.reply('⚠️ لا يمكن إرسال رسالة بث فارغة.');
    }

    await ctx.reply('⏳ جارٍ إرسال رسالة البث الجماعي لجميع المستخدمين في الخلفية...');

    try {
      const users = await User.find({});
      let successCount = 0;
      
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      for (const u of users) {
        if (u.isBanned) continue;

        try {
          await ctx.telegram.sendMessage(u.telegramId, broadcastMessage);
          successCount++;
        } catch (sendErr) {
          console.error(`Broadcast message delivery failed for user ${u.telegramId}: ${sendErr.message}`);
        }

        await sleep(50);
      }

      await ctx.reply(`✅ اكتمل إرسال البث الجماعي. تم التسليم بنجاح إلى ${successCount}/${users.length} مستخدم نشط.`);
    } catch (error) {
      console.error('Broadcast command error:', error);
      await ctx.reply('⚠️ حدث خطأ في النظام أثناء إرسال البث الجماعي.');
    }
  });

  // Admin Command: /export or /export_data
  const handleExport = async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    try {
      const statusMsg = await ctx.reply('⏳ جاري تجميع البيانات وتوليد التقرير...');

      const reportData = await User.aggregate([
        {
          $lookup: {
            from: 'deposits',
            localField: 'telegramId',
            foreignField: 'telegramId',
            as: 'userDeposits'
          }
        },
        {
          $lookup: {
            from: 'orders',
            localField: 'telegramId',
            foreignField: 'telegramId',
            as: 'userOrders'
          }
        },
        {
          $project: {
            telegramId: 1,
            username: 1,
            firstName: 1,
            lastName: 1,
            balance: 1,
            joinedAt: 1,
            phone: {
              $let: {
                vars: {
                  lastDeposit: { $arrayElemAt: ["$userDeposits", -1] }
                },
                in: { $ifNull: ["$$lastDeposit.senderPhone", "N/A"] }
              }
            },
            totalRecharged: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$userDeposits",
                      as: "d",
                      cond: { $eq: ["$$d.status", "approved"] }
                    }
                  },
                  as: "d",
                  in: "$$d.amount"
                }
              }
            },
            totalSpent: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$userOrders",
                      as: "o",
                      cond: { $ne: ["$$o.status", "cancelled"] }
                    }
                  },
                  as: "o",
                  in: "$$o.price"
                }
              }
            },
            cvCount: {
              $size: {
                $filter: {
                  input: "$userOrders",
                  as: "o",
                  cond: { $eq: ["$$o.serviceType", "cv_design"] }
                }
              }
            },
            similarityCount: {
              $size: {
                $filter: {
                  input: "$userOrders",
                  as: "o",
                  cond: { $eq: ["$$o.serviceType", "similarity_report"] }
                }
              }
            },
            portfolioCount: {
              $size: {
                $filter: {
                  input: "$userOrders",
                  as: "o",
                  cond: { $eq: ["$$o.serviceType", "portfolio_design"] }
                }
              }
            },
            aiCount: {
              $size: {
                $filter: {
                  input: "$userOrders",
                  as: "o",
                  cond: { $eq: ["$$o.serviceType", "ai_writing_report"] }
                }
              }
            },
            pdfCount: {
              $size: {
                $filter: {
                  input: "$userOrders",
                  as: "o",
                  cond: { $eq: ["$$o.serviceType", "pdf_to_word"] }
                }
              }
            },
            translationCount: {
              $size: {
                $filter: {
                  input: "$userOrders",
                  as: "o",
                  cond: { $eq: ["$$o.serviceType", "translation"] }
                }
              }
            },
            pendingRechargesCount: {
              $size: {
                $filter: {
                  input: "$userDeposits",
                  as: "d",
                  cond: { $eq: ["$$d.status", "pending"] }
                }
              }
            },
            totalOrders: { $size: "$userOrders" }
          }
        }
      ]);

      const headers = [
        'معرّف تليجرام (Telegram ID)',
        'اسم المستخدم (Username)',
        'الاسم بالكامل (Full Name)',
        'رقم الهاتف (Phone)',
        'الرصيد الحالي للمحفظة (Current Balance)',
        'إجمالي الرصيد المشحون (Total Recharged)',
        'إجمالي الرصيد المستهلك (Total Spent)',
        'طلبات السيرة الذاتية (CV Design)',
        'طلبات فحص التشابه (Similarity)',
        'طلبات البورتفوليو (Portfolio)',
        'طلبات تقارير الذكاء الاصطناعي (AI Report)',
        'طلبات تحويل PDF لوورد (PDF to Word)',
        'طلبات الترجمة (Translation)',
        'إجمالي طلبات العميل (Total Orders)',
        'طلبات شحن معلقة (Pending Recharges)',
        'تاريخ الانضمام (Joined At)'
      ];

      const escapeField = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str}"`;
        }
        return str;
      };

      const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      const rows = reportData.map(item => {
        const fullName = (item.firstName || item.lastName)
          ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
          : 'N/A';
        return [
          escapeField(item.telegramId),
          escapeField(item.username || 'N/A'),
          escapeField(fullName),
          escapeField(item.phone),
          item.balance,
          item.totalRecharged,
          item.totalSpent,
          item.cvCount,
          item.similarityCount,
          item.portfolioCount,
          item.aiCount,
          item.pdfCount,
          item.translationCount,
          item.totalOrders,
          item.pendingRechargesCount,
          escapeField(formatDate(item.joinedAt))
        ].join(',');
      });

      const csvContent = '\ufeff' + [headers.join(','), ...rows].join('\n');

      await ctx.replyWithDocument({
        source: Buffer.from(csvContent, 'utf-8'),
        filename: `SaveTimePro_Report_${new Date().toISOString().split('T')[0]}.csv`
      }, {
        caption: '📊 <b>تقرير المستخدمين والمبيعات الحالي جاهز للإكسل!</b>\nتم تجميع البيانات وربط أرقام الهواتف والطلبات بنجاح.',
        parse_mode: 'HTML'
      });

      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    } catch (error) {
      console.error('Export command error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء تجميع البيانات وتصدير الملف.');
    }
  };

  bot.command('export', handleExport);
  bot.command('export_data', handleExport);

  // Admin Command: /maintenance or /togglemaintenance
  const handleMaintenance = async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    
    let targetState = null;
    if (args.length >= 2) {
      const arg = args[1].toLowerCase();
      if (arg === 'on' || arg === 'true' || arg === 'نشط' || arg === 'تفعيل') targetState = true;
      else if (arg === 'off' || arg === 'false' || arg === 'معطل' || arg === 'إيقاف') targetState = false;
    }

    try {
      let isMaintenance = false;
      if (targetState !== null) {
        await SystemConfig.findOneAndUpdate(
          { key: 'maintenanceMode' },
          { value: targetState },
          { upsert: true, new: true }
        );
        isMaintenance = targetState;
      } else {
        const current = await SystemConfig.findOne({ key: 'maintenanceMode' });
        const newState = current ? !current.value : true;
        await SystemConfig.findOneAndUpdate(
          { key: 'maintenanceMode' },
          { value: newState },
          { upsert: true, new: true }
        );
        isMaintenance = newState;
      }

      const stateText = isMaintenance ? '🟢 نشط (وضع الصيانة مفعل)' : '🔴 معطل (وضع الصيانة مغلق - البوت متاح للجميع)';
      await ctx.replyWithHTML(
        `⚙️ <b>تحديث وضع صيانة البوت</b>\n\n` +
        `• <b>الحالة الحالية:</b> ${stateText}\n\n` +
        `<i>ملاحظة: عند تفعيل وضع الصيانة، يتم حظر كافة المستخدمين العاديين من المحادثة الخاصة مع البوت، مع إبقائه متاحاً فقط للمشرفين.</i>`
      );
    } catch (error) {
      console.error('Maintenance toggle error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء تحديث وضع الصيانة في قاعدة البيانات.');
    }
  };

  bot.command('maintenance', handleMaintenance);
  bot.command('togglemaintenance', handleMaintenance);

  // Admin Command: /refund <orderId>
  bot.command('refund', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    if (args.length < 2) {
      return ctx.reply('⚠️ طريقة الاستخدام: /refund <رقم_الطلب>');
    }

    const orderId = args[1].toUpperCase();

    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        return ctx.reply(`❌ خطأ: لم يتم العثور على الطلب رقم "${orderId}" في قاعدة البيانات.`);
      }

      if (order.status === 'cancelled') {
        return ctx.reply(`ℹ️ الطلب رقم "${orderId}" ملغي ومسترد بالفعل مسبقاً.`);
      }

      const refundAmount = order.price;
      const userId = order.telegramId;

      const user = await User.findOneAndUpdate(
        { telegramId: userId },
        { $inc: { balance: refundAmount } },
        { new: true }
      );

      if (!user) {
        return ctx.reply(`❌ خطأ: لم يتم العثور على صاحب الطلب في قاعدة البيانات لرد النقاط.`);
      }

      order.status = 'cancelled';
      await order.save();

      try {
        await ctx.telegram.sendMessage(
          userId,
          `⚠️ <b>تم إلغاء طلبك واسترداد نقاطك</b>\n\n` +
          `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
          `• <b>النقاط المستردة:</b> <code>+${refundAmount} نقطة</code>\n` +
          `• <b>رصيدك الحالي:</b> <code>${user.balance} نقطة</code>\n\n` +
          `تم إلغاء الطلب من قبل الإدارة وإعادة النقاط إلى محفظتك بالكامل. يمكنك تقديم طلب جديد الآن.`,
          { parse_mode: 'HTML' }
        );
      } catch (notifyErr) {
        console.error(`Failed to notify user ${userId} of refund:`, notifyErr.message);
      }

      await ctx.replyWithHTML(
        `💸 <b>تم إلغاء الطلب ورد النقاط بنجاح!</b>\n\n` +
        `• <b>رقم الطلب:</b> <code>${orderId}</code>\n` +
        `• <b>المستلم (ID):</b> <code>${userId}</code> (الاسم: ${escapeHTML(user.firstName || 'غير محدد')})\n` +
        `• <b>النقاط المستردة:</b> <code>+${refundAmount} نقطة</code>\n` +
        `• <b>الرصيد الجديد للعميل:</b> <code>${user.balance} نقطة</code>`
      );

    } catch (error) {
      console.error('Refund command error:', error);
      await ctx.reply('⚠️ حدث خطأ في النظام أثناء عملية استرداد النقاط.');
    }
  });

  // Admin Command: /addpoints <telegramId_or_@username> <amount>
  bot.command('addpoints', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    if (args.length < 3) {
      return ctx.replyWithHTML(
        `⚠️ <b>طريقة الاستخدام:</b>\n` +
        `<code>/addpoints &lt;telegramId_أو_@اسم_المستخدم&gt; &lt;عدد_النقاط&gt;</code>\n\n` +
        `<b>أمثلة:</b>\n` +
        `• <code>/addpoints @username 150</code> — إضافة 150 نقطة (استرداد)\n` +
        `• <code>/addpoints 123456789 -50</code> — خصم 50 نقطة (تصحيح)\n` +
        `• <code>/addpoints @username 0</code> — عرض الرصيد الحالي فقط`
      );
    }

    const targetInput = args[1];
    const pointsArg = parseFloat(args[2]);

    if (isNaN(pointsArg)) {
      return ctx.reply('❌ قيمة النقاط غير صالحة. أدخل رقماً صحيحاً (موجب للإضافة، سالب للخصم).');
    }

    let query = {};
    if (/^\d+$/.test(targetInput)) {
      query = { telegramId: targetInput };
    } else {
      const cleanUsername = targetInput.replace(/^@/, '');
      query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
    }

    try {
      const user = await User.findOne(query);
      if (!user) {
        return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات "${targetInput}" في قاعدة البيانات.`);
      }

      const balanceBefore = user.balance;

      if (pointsArg === 0) {
        return ctx.replyWithHTML(
          `📊 <b>رصيد المستخدم:</b>\n\n` +
          `• <b>الاسم:</b> ${escapeHTML(user.firstName || 'غير محدد')}\n` +
          `• <b>المعرّف:</b> <code>${user.telegramId}</code>\n` +
          `• <b>الرصيد الحالي:</b> <code>${user.balance} نقطة</code>`
        );
      }

      const updatedUser = await User.findOneAndUpdate(
        query,
        { $inc: { balance: pointsArg } },
        { new: true }
      );

      const balanceAfter = updatedUser.balance;
      const action = pointsArg > 0 ? '➕ إضافة' : '➖ خصم';
      const emoji = pointsArg > 0 ? '✅' : '⚠️';

      try {
        if (pointsArg > 0) {
          await ctx.telegram.sendMessage(user.telegramId,
            `💰 <b>تم إضافة نقاط لمحفظتك!</b>\n\n` +
            `• <b>النقاط المضافة:</b> <code>+${pointsArg} نقطة</code>\n` +
            `• <b>الرصيد السابق:</b> <code>${balanceBefore} نقطة</code>\n` +
            `• <b>الرصيد الجديد:</b> <code>${balanceAfter} نقطة</code>\n\n` +
            `يمكنك الآن إعادة اختيار الخدمة من زر <b>📂 الخدمات</b>.`,
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.telegram.sendMessage(user.telegramId,
            `💳 <b>تم تعديل رصيد محفظتك</b>\n\n` +
            `• <b>النقاط المخصومة:</b> <code>${pointsArg} نقطة</code>\n` +
            `• <b>الرصيد الجديد:</b> <code>${balanceAfter} نقطة</code>`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (notifyErr) {
        console.error(`Failed to notify user ${user.telegramId} about point change:`, notifyErr.message);
      }

      await ctx.replyWithHTML(
        `${emoji} <b>${action} نقاط بنجاح!</b>\n\n` +
        `• <b>المستخدم:</b> ${escapeHTML(user.firstName || 'غير محدد')} (<code>${user.telegramId}</code>)\n` +
        `• <b>النقاط المعدّلة:</b> <code>${pointsArg > 0 ? '+' : ''}${pointsArg} نقطة</code>\n` +
        `• <b>الرصيد قبل:</b> <code>${balanceBefore} نقطة</code>\n` +
        `• <b>الرصيد بعد:</b> <code>${balanceAfter} نقطة</code>\n\n` +
        `<i>تم إشعار العميل بتغيير رصيده تلقائياً.</i>`
      );

    } catch (error) {
      console.error('Addpoints command error:', error);
      await ctx.reply('⚠️ حدث خطأ في قاعدة البيانات أثناء تعديل الرصيد.');
    }
  });

  // Admin Command: /setbalance <telegramId_or_@username> <amount>
  bot.command('setbalance', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    if (args.length < 3) {
      return ctx.reply('⚠️ طريقة الاستخدام: /setbalance <telegramId_أو_@اسم_المستخدم> <الرصيد_الجديد>');
    }

    const targetInput = args[1];
    const newBalance = parseFloat(args[2]);

    if (isNaN(newBalance) || newBalance < 0) {
      return ctx.reply('❌ خطأ: يرجى إدخال قيمة رصيد صحيحة وغير سالبة.');
    }

    let query = {};
    if (/^\d+$/.test(targetInput)) {
      query = { telegramId: targetInput };
    } else {
      const cleanUsername = targetInput.replace(/^@/, '');
      query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
    }

    try {
      const user = await User.findOne(query);
      if (!user) {
        return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات "${targetInput}" في قاعدة البيانات.`);
      }

      const oldBalance = user.balance;
      user.balance = newBalance;
      await user.save();

      try {
        await ctx.telegram.sendMessage(
          user.telegramId,
          `💳 <b>تعديل رصيد محفظتك</b>\n\n` +
          `قامت الإدارة بتحديث رصيدك بشكل مباشر:\n` +
          `• <b>الرصيد السابق:</b> <code>${oldBalance} نقطة</code>\n` +
          `• <b>الرصيد الجديد:</b> <code>${newBalance} نقطة</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (notifyErr) {
        console.error(`Failed to notify user ${user.telegramId} of balance override:`, notifyErr.message);
      }

      await ctx.replyWithHTML(
        `👤 <b>تم تعديل رصيد المحفظة مباشرة!</b>\n\n` +
        `• <b>العميل:</b> ${escapeHTML(user.firstName || 'غير محدد')} (<code>${user.telegramId}</code>)\n` +
        `• <b>الرصيد السابق:</b> <code>${oldBalance} نقطة</code>\n` +
        `• <b>الرصيد الجديد:</b> <code>${newBalance} نقطة</code>`
      );

    } catch (error) {
      console.error('Setbalance command error:', error);
      await ctx.reply('⚠️ حدث خطأ في قاعدة البيانات أثناء تحديث الرصيد.');
    }
  });

  // Admin Command: /pending
  bot.command('pending', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    try {
      const pendingDeposits = await Deposit.find({ status: 'pending' }).sort({ createdAt: 1 });
      const pendingOrders = await Order.find({ status: 'in_progress' }).sort({ createdAt: 1 });

      let message = `📥 <b>قائمة العمليات المعلقة الحالية</b>\n\n`;

      message += `<b>💳 طلبات شحن المحفظة المعلقة (${pendingDeposits.length}):</b>\n`;
      if (pendingDeposits.length === 0) {
        message += `• لا يوجد طلبات شحن معلقة حالياً.\n`;
      } else {
        pendingDeposits.forEach((dep, idx) => {
          message += `${idx + 1}. ID: <code>${dep.depositId}</code> | العميل: <code>${dep.telegramId}</code> | المبلغ: <b>${dep.amount} نقطة</b> | رقم المحول: <code>${dep.senderPhone}</code>\n`;
        });
      }

      message += `\n`;

      message += `<b>📂 طلبات الخدمات الجاري تنفيذها (${pendingOrders.length}):</b>\n`;
      if (pendingOrders.length === 0) {
        message += `• لا يوجد طلبات خدمات قيد التنفيذ حالياً.\n`;
      } else {
        pendingOrders.forEach((ord, idx) => {
          const serviceLabel = ord.serviceType.replace(/_/g, ' ').toUpperCase();
          message += `${idx + 1}. ID: <code>${ord.orderId}</code> | العميل: <code>${ord.telegramId}</code> | الخدمة: <code>${serviceLabel}</code> | التكلفة: <b>${ord.price} نقطة</b>\n`;
        });
      }

      await ctx.replyWithHTML(message);

    } catch (error) {
      console.error('Pending command error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء جلب العمليات المعلقة.');
    }
  });

  // Admin Command: /userinfo <telegramId_or_@username>
  bot.command('userinfo', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    if (args.length < 2) {
      return ctx.reply('⚠️ طريقة الاستخدام: /userinfo <telegramId_أو_@اسم_المستخدم>');
    }

    const targetInput = args[1];
    let query = {};
    if (/^\d+$/.test(targetInput)) {
      query = { telegramId: targetInput };
    } else {
      const cleanUsername = targetInput.replace(/^@/, '');
      query = { username: new RegExp(`^${cleanUsername}$`, 'i') };
    }

    try {
      const user = await User.findOne(query);
      if (!user) {
        return ctx.reply(`❌ لم يتم العثور على مستخدم بالبيانات المدخلة "${targetInput}" في النظام.`);
      }

      const deposits = await Deposit.find({ telegramId: user.telegramId, status: 'approved' });
      const totalRecharged = deposits.reduce((sum, dep) => sum + dep.amount, 0);
      const totalUserOrders = await Order.countDocuments({ telegramId: user.telegramId });

      const formattedDate = user.joinedAt.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const userInfoMsg =
        `👤 <b>تفاصيل حساب المستخدم: ${escapeHTML(user.firstName)}</b>\n\n` +
        `• <b>المعرّف (ID):</b> <code>${user.telegramId}</code>\n` +
        `• <b>اسم المستخدم:</b> @${escapeHTML(user.username || 'بدون_اسم_مستخدم')}\n` +
        `• <b>الاسم الأول:</b> ${escapeHTML(user.firstName || 'لا يوجد')}\n` +
        `• <b>الاسم الأخير:</b> ${escapeHTML(user.lastName || 'لا يوجد')}\n` +
        `• <b>حالة الحساب:</b> ${user.isBanned ? '🚫 محظور' : '✅ نشط'}\n` +
        `• <b>تاريخ الانضمام:</b> <code>${formattedDate}</code>\n\n` +
        `💰 <b>البيانات المالية والطلبات:</b>\n` +
        `• الرصيد الحالي للمحفظة: <code>${user.balance} نقطة</code>\n` +
        `• إجمالي المبالغ المشحونة: <code>${totalRecharged} جنيه</code>\n` +
        `• عدد مرات الشحن المعتمدة: <code>${deposits.length}</code> مرات\n` +
        `• إجمالي طلبات الخدمات المقدمة: <code>${totalUserOrders}</code> طلبات`;

      await ctx.replyWithHTML(userInfoMsg);
    } catch (error) {
      console.error('Userinfo command error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء جلب بيانات المستخدم.');
    }
  });

  // Admin Command: /promos
  bot.command('promos', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    try {
      const promosHTML = await getPromosHTML();
      await ctx.replyWithHTML(promosHTML);
    } catch (error) {
      console.error('Promos command error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء استرجاع الأكواد الترويجية.');
    }
  });

  // Admin Command: /stats
  bot.command('stats', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    try {
      const statsHTML = await getStatsHTML();
      await ctx.replyWithHTML(statsHTML);
    } catch (error) {
      console.error('Stats command error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء جلب إحصائيات النظام.');
    }
  });

  // Admin Command: /adminhelp
  bot.command('adminhelp', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const adminHelpMsg = 
      `🛠️ <b>لوحة تحكم مشرفي SaveTimePro</b>\n\n` +
      `الأوامر المتاحة للإدارة:\n\n` +
      `📊 <b>الإحصائيات والتقارير:</b>\n` +
      `• /stats — عرض إحصائيات البوت والأرباح اليومية والكلية.\n` +
      `• /export — تصدير تقرير إكسل (CSV) للمستخدمين والمبيعات.\n` +
      `• /pending — عرض طلبات الشحن والخدمات المعلقة حالياً.\n` +
      `• /userinfo &lt;telegramId_أو_@اسم_المستخدم&gt; — عرض بيانات شحن مستخدم وتفاصيل حسابه.\n\n` +
      `🎟️ <b>إدارة الأكواد الترويجية:</b>\n` +
      `• /addpromo &lt;الكود&gt; &lt;النقاط&gt; &lt;أقصى_استخدامات&gt; — إنشاء كود هدية جديد.\n` +
      `• /promos — عرض جميع الأكواد الترويجية النشطة وحالة استخدامها.\n\n` +
      `💰 <b>إدارة رصيد المستخدمين:</b>\n` +
      `• /addpoints &lt;telegramId_أو_@اسم_المستخدم&gt; &lt;النقاط&gt; — إضافة أو خصم نقاط.\n` +
      `• /setbalance &lt;telegramId_أو_@اسم_المستخدم&gt; &lt;النقاط&gt; — تعيين الرصيد مباشرة.\n` +
      `• /refund &lt;رقم_الطلب&gt; — إلغاء الطلب رد النقاط بالكامل للمحفظة.\n\n` +
      `🚫 <b>إدارة الحظر (المستخدمين):</b>\n` +
      `• /ban &lt;telegramId_أو_@اسم_المستخدم&gt; — حظر مستخدم من البوت.\n` +
      `• /unban &lt;telegramId_أو_@اسم_المستخدم&gt; — إلغاء حظر مستخدم.\n\n` +
      `📢 <b>البث الجماعي:</b>\n` +
      `• /broadcast &lt;نص_الرسالة&gt; — إرسال رسالة جماعية لكل المشتركين النشطين.\n\n` +
      `⚙️ <b>وضع الصيانة:</b>\n` +
      `• /maintenance &lt;on/off&gt; — تفعيل أو إيقاف وضع صيانة البوت (طوارئ).\n\n` +
      `🛠️ <b>لوحة التحكم السريعة:</b>\n` +
      `• /admin — عرض لوحة التحكم السريعة (أزرار الاختصار) داخل الجروب.`;

    await ctx.replyWithHTML(adminHelpMsg);
  });

  // Admin Command: /admin
  bot.command('admin', async (ctx) => {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (!adminGroupId) return;

    if (ctx.chat.id.toString() !== adminGroupId.toString()) {
      return;
    }

    await ctx.replyWithHTML(
      `🛠️ <b>لوحة تحكم مشرفي SaveTimePro</b>\n\n` +
      `مرحباً بك في لوحة التحكم السريعة للجروب. يرجى استخدام الأزرار أدناه لإجراء العمليات السريعة:`,
      {
        reply_markup: {
          keyboard: [
            [{ text: '📊 إحصائيات البوت' }, { text: '🎟️ الأكواد الترويجية' }],
            [{ text: '🛠️ مساعدة المسؤول' }, { text: '❌ إغلاق لوحة التحكم' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      }
    );
  });

  // Admin Keyboard Hears Handlers
  bot.hears('📊 إحصائيات البوت', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    try {
      const statsHTML = await getStatsHTML();
      await ctx.replyWithHTML(statsHTML);
    } catch (error) {
      console.error('Stats button error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء تجميع إحصائيات النظام.');
    }
  });

  bot.hears('🎟️ الأكواد الترويجية', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    try {
      const promosHTML = await getPromosHTML();
      await ctx.replyWithHTML(promosHTML);
    } catch (error) {
      console.error('Promos button error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء استرجاع الأكواد الترويجية.');
    }
  });

  bot.hears('🛠️ مساعدة المسؤول', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const adminHelpMsg = 
      `🛠️ <b>لوحة تحكم مشرفي SaveTimePro</b>\n\n` +
      `الأوامر المتاحة للإدارة:\n\n` +
      `📊 <b>الإحصائيات والتقارير:</b>\n` +
      `• /stats — عرض إحصائيات البوت والأرباح اليومية والكلية.\n` +
      `• /export — تصدير تقرير إكسل (CSV) للمستخدمين والمبيعات.\n` +
      `• /pending — عرض طلبات الشحن والخدمات المعلقة حالياً.\n` +
      `• /userinfo &lt;telegramId_أو_@اسم_المستخدم&gt; — عرض بيانات شحن مستخدم وتفاصيل حسابه.\n\n` +
      `🎟️ <b>إدارة الأكواد الترويجية:</b>\n` +
      `• /addpromo &lt;الكود&gt; &lt;النقاط&gt; &lt;أقصى_استخدامات&gt; — إنشاء كود هدية جديد.\n` +
      `• /promos — عرض جميع الأكواد الترويجية النشطة وحالة استخدامها.\n\n` +
      `💰 <b>إدارة رصيد المستخدمين:</b>\n` +
      `• /addpoints &lt;telegramId_أو_@اسم_المستخدم&gt; &lt;النقاط&gt; — إضافة أو خصم نقاط.\n` +
      `• /setbalance &lt;telegramId_أو_@اسم_المستخدم&gt; &lt;النقاط&gt; — تعيين الرصيد مباشرة.\n` +
      `• /refund &lt;رقم_الطلب&gt; — إلغاء الطلب ورد النقاط بالكامل للمحفظة.\n\n` +
      `🚫 <b>إدارة الحظر (المستخدمين):</b>\n` +
      `• /ban &lt;telegramId_أو_@اسم_المستخدم&gt; — حظر مستخدم من البوت.\n` +
      `• /unban &lt;telegramId_أو_@اسم_المستخدم&gt; — إلغاء حظر مستخدم.\n\n` +
      `📢 <b>البث الجماعي:</b>\n` +
      `• /broadcast &lt;نص_الرسالة&gt; — إرسال رسالة جماعية لكل المشتركين النشطين.\n\n` +
      `⚙️ <b>وضع الصيانة:</b>\n` +
      `• /maintenance &lt;on/off&gt; — تفعيل أو إيقاف وضع صيانة البوت (طوارئ).\n\n` +
      `🛠️ <b>لوحة التحكم السريعة:</b>\n` +
      `• /admin — عرض لوحة التحكم السريعة (أزرار الاختصار) داخل الجروب.`;

    await ctx.replyWithHTML(adminHelpMsg);
  });

  bot.hears('❌ إغلاق لوحة التحكم', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    await ctx.reply('🔒 تم إغلاق لوحة التحكم وإخفاء الأزرار.', {
      reply_markup: {
        remove_keyboard: true
      }
    });
  });

  // Admin Command: /addpromo <CODE> <POINTS> <MAX_USES>
  bot.command('addpromo', async (ctx) => {
    const isAdmin = await checkAdmin(ctx);
    if (!isAdmin) return;

    const text = ctx.message?.text?.trim() || '';
    const args = text.split(/\s+/);
    if (args.length < 4) {
      return ctx.reply('⚠️ طريقة الاستخدام: /addpromo <الكود> <النقاط> <أقصى_استخدامات>');
    }

    const promoCode = args[1].toUpperCase();
    const points = parseFloat(args[2]);
    const maxUses = parseInt(args[3], 10);

    if (isNaN(points) || points <= 0 || isNaN(maxUses) || maxUses <= 0) {
      return ctx.reply('❌ خطأ: يرجى إدخال قيم نقاط واستخدامات صحيحة وأكبر من صفر.');
    }

    try {
      let promo = await PromoCode.findOne({ code: promoCode });
      if (promo) {
        return ctx.reply(`❌ خطأ: الكود الترويجي ${promoCode} موجود بالفعل في النظام.`);
      }

      promo = new PromoCode({
        code: promoCode,
        rewardPoints: points,
        maxUses: maxUses,
        usedBy: []
      });
      await promo.save();

      await ctx.replyWithHTML(
        `✅ <b>تم إنشاء الكود الترويجي بنجاح!</b>\n\n` +
        `• <b>الكود:</b> <code>${escapeHTML(promoCode)}</code>\n` +
        `• <b>النقاط الممنوحة:</b> <code>+${points} نقطة</code>\n` +
        `• <b>الحد الأقصى للاستخدامات:</b> <code>${maxUses}</code> مرات`
      );
    } catch (error) {
      console.error('Addpromo command error:', error);
      await ctx.reply('⚠️ حدث خطأ أثناء إنشاء الكود الترويجي في قاعدة البيانات.');
    }
  });

  // Group catch-all: remove stale user keyboard if any user button text appears in the admin group
  bot.on('message', async (ctx, next) => {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (!adminGroupId) return next();
    if (ctx.chat.id.toString() !== adminGroupId.toString()) return next();

    const text = ctx.message?.text || '';
    if (!text || text.startsWith('/')) return next();

    const userButtons = [
      '💳 شحن المحفظة', '📂 الخدمات', '👤 حسابي الشخصي',
      '📌 تعليمات الاستخدام', '📞 الدعم الفني'
    ];
    if (userButtons.includes(text)) {
      await ctx.reply(
        '⚠️ هذا الزر خاص بالمستخدمين وليس بالجروب. استخدم /admin لعرض لوحة تحكم الإدارة.',
        { reply_markup: { remove_keyboard: true } }
      );
    } else {
      return next();
    }
  });
};

module.exports = { registerAdminCommands };
