# SaveTimePro Bot - Technical Architecture & Detailed Code Walkthrough

Welcome to the technical reference guide for the **SaveTimePro Bot**. This document provides a complete folder map and a detailed, block-by-block and function-by-function walkthrough of the code, explaining exactly how each system, middleware, scene, and helper operates.

---

## 📂 Directory Structure Map

```
c:/Projects/freelane/Bots/
├── bot/
│   ├── actions/
│   │   └── adminActions.js     # Handles deposit approvals/rejections & admin inline refunds
│   ├── commands/
│   │   ├── admin.js            # Admin-only commands (/stats, /ban, /setbalance, /pending, etc.)
│   │   └── user.js             # User commands (/start, /profile, /promo, /services, /help, etc.)
│   ├── config/
│   │   └── services.js         # Unified configuration mapping for service prices & types
│   ├── handlers/
│   │   └── adminDelivery.js    # Delivers result files/messages back to users from admin replies
│   ├── scenes/
│   │   ├── rechargeWizard.js   # Multi-step scene to recharge user wallet points
│   │   ├── orderWizard.js      # Multi-step scene to submit Turnitin & AI report orders
│   │   └── designWizard.js     # Multi-step scene to request CV/Portfolio design orders
│   ├── utils/
│   │   └── helpers.js          # Shared utility helpers (HTML escaping, admin roles, digit normalize)
│   └── middlewares.js          # Main middlewares registry (logger, whitelist, ban check, maintenance, stage, session, cooldown)
├── config/
│   └── db.js                   # Handles Mongoose connection setup & database lifecycle logs
├── models/
│   ├── Deposit.js              # Schema for logs of user wallet recharge requests
│   ├── Order.js                # Schema for tracking user orders & completions
│   ├── PromoCode.js            # Schema for promo codes and redemption limits
│   ├── Session.js              # Schema to persistently store wizard states
│   ├── SystemConfig.js         # Schema for persistent global flags (e.g. maintenance mode)
│   └── User.js                 # Schema for user details, balances, ban status, and referrals
├── tests/
│   ├── config.test.js          # Unit tests verifying services configuration integrity
│   ├── db.test.js              # Unit tests verifying database model schemas & validations
│   └── helpers.test.js         # Unit tests verifying utility helpers and digit normalization
├── index.js                    # The bot's modular entry point & keep-alive HTTP server
├── package.json                # Dependencies and project scripts (npm start, npm test, etc.)
└── .env                        # Local environment credentials (tokens, mongo URI, admin group id)
```

---

## 🔍 Detailed Code Walkthrough (File-by-File)

---

### 1. Main Entry Point: [index.js](file:///c:/Projects/freelane/Bots/index.js)

This file acts as the coordinator of the application. It initializes environment variables, connects to the database, registers middlewares, commands, handlers, and boots the keep-alive server.

#### Code Breakdown:
* **Lines 8-12: Imports & Environment Configuration**
  ```javascript
  require('dotenv').config(); // Loads environment variables from the .env file into process.env
  const { Telegraf } = require('telegraf'); // Imports the Telegraf library to interact with Telegram API
  const connectDB = require('./config/db'); // Imports our MongoDB connection helper
  ```
* **Lines 14-23: Module Imports**
  Imports the modular sections of our bot:
  - `registerMiddlewares`: Registers all pipelines (sessions, security checks, rate limiters).
  - `registerAdminActions`: Hooks callbacks for recharge approvals/rejections and inline refunds.
  - `setupAdminDelivery`: Sets up reply-listeners for the admin group.
  - `registerAdminCommands` / `registerUserCommands`: Registers chat commands and hears triggers.
* **Lines 31-35: Initialization**
  ```javascript
  const bot = new Telegraf(botToken); // Instantiates the Telegraf bot using process.env.BOT_TOKEN
  connectDB(); // Establishes asynchronous connection to the MongoDB cluster
  ```
* **Lines 38-67: Global Bot Error Catcher (`bot.catch`)**
  Intercepts runtime errors occurring during update processing to prevent the bot process from crashing.
  - Logs the error details to the server console.
  - Automatically formats a Markdown error notification and dispatches it directly to `process.env.ADMIN_GROUP_ID` to notify administrators of failures immediately.
* **Lines 69-82: Sequence of Registrations**
  Registers components in a strict logical order:
  ```javascript
  registerMiddlewares(bot);  // 1. Pipeline middlewares (ban check, maintenance check, sessions, wizards)
  registerAdminActions(bot); // 2. Inline keyboard actions
  setupAdminDelivery(bot);   // 3. Document delivery reply listeners
  registerAdminCommands(bot);// 4. Admin chat controls
  registerUserCommands(bot); // 5. Public customer commands
  ```
* **Lines 84-96: Command Menu Registration**
  Executes `bot.telegram.setMyCommands(...)` to register user commands directly in Telegram's menu layout.
* **Lines 98-108: HTTP Health-Check Server**
  Creates an HTTP server using Node's native `http` module listening on `process.env.PORT || 3000`. This returns a `200 OK` status with the plain text `SaveTimePro Bot is running!` to satisfy the health check requirements of cloud hosting providers (like Render), keeping the container alive.
* **Lines 110-130: Launch & Graceful Shutdowns**
  - Calls `bot.launch()` to start polling Telegram.
  - Catches `SIGINT` (Ctrl+C) and `SIGTERM` signals. When triggered, it gracefully stops the Telegram polling using `bot.stop(signal)` and closes the MongoDB Mongoose connection to prevent database leaks before exiting with code `0`.

---

### 2. Middlewares Pipeline: [bot/middlewares.js](file:///c:/Projects/freelane/Bots/bot/middlewares.js)

Middlewares process every incoming Telegram update sequentially. The registration order in this file is critical to enforce security checks before executing session lookups or wizard stages.

#### Code Breakdown:
* **Lines 20-58: Custom Mongoose Persistent Session (`mongooseSession`)**
  This custom middleware saves the conversational wizard states on MongoDB instead of local memory, preventing active user wizards from resetting when the server restarts.
  - Generates a unique key: `const key = `${ctx.from.id}:${ctx.chat.id}`;`.
  - Look up standard session document: `Session.findOne({ key })`.
  - Sets `ctx.session = sessionDoc ? sessionDoc.data : {};`.
  - Calls `await next();` to process subsequent wizard steps.
  - Stringifies and compares `originalSession` with `currentSession`.
  - If changed, it updates/upserts the session document in MongoDB, or deletes it if the session is empty.
* **Lines 65-72: Debug Logger Middleware**
  Captures the start time, logs the raw JSON update payload to the console, and logs the duration it took the bot to process the update.
* **Lines 74-98: Group Whitelist Middleware**
  Limits group communication. If the message comes from a group or supergroup, it compares `ctx.chat.id` with `process.env.ADMIN_GROUP_ID`. If they do not match, the bot automatically leaves the chat using `ctx.telegram.leaveChat(ctx.chat.id)`, preventing unauthorized group access.
* **Lines 100-117: User Ban Check Middleware (Early Guard)**
  Queries the `User` model using `ctx.from.id`. If `user.isBanned` is `true`, it interrupts the pipeline, answers callbacks or messages with a banned notification, and drops the update (returns without calling `next()`).
* **Lines 119-149: Maintenance Mode Middleware (Early Guard)**
  Checks if `maintenanceMode` is set to `true` in `SystemConfig`. If active:
  - If the user is in the admin group, it allows it through.
  - If not, it checks if the sender is an administrator (`isUserAdmin`). If the sender is a normal user, it rejects the message with a maintenance notice and stops further execution.
* **Lines 151-155: Persistent Sessions and Wizard Stage Registration**
  Executes `mongooseSession()` and attaches the `Stage` middleware containing our three wizards, allowing user wizard states to resume.
* **Lines 157-187: Cooldown Rate-Limiter Middleware**
  Stores user IDs and message timestamps in a local `Map`. If a user sends messages in less than `1000ms` (1 second), the bot rejects the update with a warning, protecting the bot from message flooding. This cooldown is bypassed for the admin group.

---

### 3. Service Configurations: [bot/config/services.js](file:///c:/Projects/freelane/Bots/bot/config/services.js)

Contains a clean configuration map (`servicesConfig`) defining prices, types, and localized Arabic labels for all services, providing a single source of truth for pricing:
```javascript
const servicesConfig = {
  'similarity_report': { type: 'similarity_report', price: 45, name: 'تقرير التشابه العلمي (Similarity)' },
  ...
};
```

---

### 4. Database Models: `/models`

* **[models/User.js](file:///c:/Projects/freelane/Bots/models/User.js)**:
  Defines user records. Configures `telegramId` (unique index), `balance` (points, min: 0), `isBanned` index, and viral referral fields: `referredBy` (storing the referrer's Telegram ID) and `referralRewardClaimed`. Contains a virtual `fullName` helper.
* **[models/Order.js](file:///c:/Projects/freelane/Bots/models/Order.js)**:
  Defines purchase records. Configures `orderId` (unique index), `telegramId`, `serviceType` (restricted to service enum values), `status` (restricted to status enum values), `price` (cost in points, min: 0), `fileId` (document pointer), and administrative tracking fields (`adminMessageId`, `deliveredFileId`).
* **[models/Deposit.js](file:///c:/Projects/freelane/Bots/models/Deposit.js)**:
  Defines recharge records. Tracks `depositId` (unique), `telegramId`, `amount` (EGP, min: 0.01), `senderPhone` (11 digits), `receiptFileId` (payment proof), and `status` (`pending`, `approved`, `rejected`).
* **[models/PromoCode.js](file:///c:/Projects/freelane/Bots/models/PromoCode.js)**:
  Tracks promotional gift codes. Features uppercase code enforcement, reward points value, maximum uses, and an array of user IDs (`usedBy`) who claimed it to enforce one-time usage per customer.
* **[models/SystemConfig.js](file:///c:/Projects/freelane/Bots/models/SystemConfig.js)**:
  Manages persistent system configurations in MongoDB using key-value indexing (e.g. key `maintenanceMode` -> value `true/false`).

---

### 5. Interactive Wizards: `/bot/scenes`

#### [bot/scenes/rechargeWizard.js](file:///c:/Projects/freelane/Bots/bot/scenes/rechargeWizard.js)
Guides users through submitting a deposit receipt proof.
* **`checkCancelOrCommand` Helper**:
  Intercepts inputs. If the user clicks `❌ إلغاء العملية` or one of the main keyboard buttons (like `👤 حسابي الشخصي` or `📂 الخدمات`), it automatically leaves the scene using `ctx.scene.leave()` and delegates execution to the main handlers.
* **Step 1 (Prompt)**: Prompts the user to transfer money to the Vodafone Cash number and enter the points amount.
* **Step 2 (Amount Validation)**: Validates that the input is a positive number. Prompts the user to send a receipt screenshot.
* **Step 3 (Receipt Validation)**: Accepts photos (`ctx.message.photo`) and document files (`ctx.message.document`). Saves the file ID to the wizard state. Prompts for the sender's mobile number.
* **Step 4 (Submission)**: Validates that the phone number is exactly 11 digits. Generates a unique `DEP-` ID, saves a pending deposit record to the database, formats a detailed notification card, and dispatches the receipt to the admin group with approval/rejection inline buttons.

#### [bot/scenes/orderWizard.js](file:///c:/Projects/freelane/Bots/bot/scenes/orderWizard.js)
Guides users through submitting research files for checking.
* **Step 1 (Prompt)**: Displays the service pricing and prompts the user to upload their document.
* **Step 2 (Validation & Confirmation)**: 
  - Validates document presence. For `ai_reduction` (AI reduction), it enforces Word formats (`.doc`/`.docx`).
  - Verifies user points.
  - Displays a detailed confirmation panel highlighting the file name, cost, and the user's current balance, prompting the user for approval.
* **Step 3 (Point Deduction & Dispatch)**:
  - Triggered when the user confirms.
  - Attaches an inline refund button (`admin_refund_order_`) to the order.
  - Sends the file to the admin group *first* using `ctx.telegram.sendDocument`.
  - Only when the upload succeeds does it deduct points from the user's balance and record the order as `in_progress` in MongoDB, preventing users from losing points due to upload failures.

#### [bot/scenes/designWizard.js](file:///c:/Projects/freelane/Bots/bot/scenes/designWizard.js)
Guides users through CV/Portfolio design requests.
* **Step 1 (Prompt)**: Verifies user points and prompts for the reference document (e.g. draft notes, old CV).
* **Step 2 (Instructions)**: Validates the reference document and prompts the user for specific styling/customization notes.
* **Step 3 (Confirmation)**: Displays a summary of instructions, cost, and balance, prompting for confirmation.
* **Step 4 (Point Deduction & Dispatch)**: Sends the request file to the admin group with an inline refund button, deducts points from the user's balance, and saves the order as `in_progress`.

---

### 6. Admin Actions & Refunds: [bot/actions/adminActions.js](file:///c:/Projects/freelane/Bots/bot/actions/adminActions.js)

Handles inline button clicks originating from the admin group.

#### Code Breakdown:
* **Lines 24-119: Approve Deposit Callback (`approve_dep_`)**
  - Finds the deposit document and updates status from `pending` to `approved` atomically: `Deposit.findOneAndUpdate({ depositId, status: 'pending' }, { status: 'approved' })`. This database-level lock prevents double-spend recharge bugs if admins click the button multiple times.
  - Increments the user's points balance: `User.findOneAndUpdate({ telegramId }, { $inc: { balance: amount } })`.
  - Sends a private Telegram alert to the user.
  - **Viral Referrals (Lines 68-103)**:
    Checks if the user has a referrer, has not claimed the referral reward, and this deposit is **>= 300 points (EGP)**. If matched, it adds **+25 points** to the referrer's balance, sets `referralRewardClaimed` to `true`, and notifies the referrer.
  - Updates the admin group message to remove the inline keyboard and display `🟢 الحالة: ✅ تم قبول الشحن`.
* **Lines 122-166: Reject Deposit Callback (`reject_dep_`)**
  Sets the deposit status to `rejected`, notifies the user, and updates the admin group message status.
* **Lines 168-241: Inline Order Refund Callback (`admin_refund_order_`)**
  Enables admins to instantly cancel an order and refund points with a single click.
  - Validates that the click came from the admin group.
  - Verifies that the order is not already `cancelled` or `completed`.
  - Refunds the order price back to the user's wallet: `User.findOneAndUpdate({ telegramId }, { $inc: { balance: refundAmount } })`.
  - Updates order status to `cancelled`.
  - Sends a private Telegram alert to the customer about their cancellation and refund.
  - Updates the admin group message to remove the button and display: `🔴 الحالة: ❌ تم إلغاء الطلب واسترداد X نقطة للعميل.`.

---

### 7. Administrative Message Delivery: [bot/handlers/adminDelivery.js](file:///c:/Projects/freelane/Bots/bot/handlers/adminDelivery.js)

Enables admins to deliver completed work by replying to the bot's order cards in the Admin Group.

#### Code Breakdown:
* **Lines 25-149: Text Reply Handler**
  Executed when an admin replies to an order card with a text message.
  - Extracts the Order ID.
  - Verifies that the order is not `cancelled` (refunded).
  - **AI Reduction Pricing (Lines 54-117)**:
    If the order is a pending pricing quote for AI reduction, it parses the text as a number (e.g. `250`), updates the order's price, and sends an inline Accept/Reject pricing quote directly to the customer's private chat.
  - **Text Forwarding (Lines 119-140)**:
    If it is a general message (e.g. "File is wrong, please resubmit"), it forwards the text to the customer. It then replies to the admin with a confirmation message containing the inline `❌ إلغاء الطلب واسترداد النقاط` button, allowing the admin to easily refund the user's points.
* **Lines 154-300: Document Reply Delivery**
  Executed when an admin replies to an order card with a finished document.
  - Checks if the service is a multi-file delivery (`ai_reduction` or `both_reports`).
  - **Multi-File Sequential Delivery**:
    - If `order.deliveredFileId` is empty, it delivers this first file as **File (1/2)** and saves its file ID. The order remains in progress.
    - If `order.deliveredFileId` is already populated, it delivers this second file as **File (2/2)** and marks the order as `completed`.
  - **Standard Delivery**:
    Delivers the document to the customer, updates the order status to `completed`, and logs the file ID as `deliveredFileId`.
* **Lines 305-455: Photo Reply Delivery**
  Executed when an admin replies to an order card with an image. Follows the same multi-file and standard delivery rules as document replies, sending the visual output to the customer and completing the order.

---

### 8. Commands Modules: `/bot/commands`

#### [bot/commands/user.js](file:///c:/Projects/freelane/Bots/bot/commands/user.js)
* **`/start`**: Checks if the user is registered. Handles referral deep-links (`/start ref_REFERRERID`) to bind users to their referrers in MongoDB. Welcomes the user and attaches the main keyboard.
* **`/profile`**: Displays the user's Telegram ID, current points, registration date, and their referral invite link.
* **`/services`**: Displays an inline keyboard of all services configured in `services.js`. Handles clicks by routing users to the appropriate wizards (`order-wizard` or `design-wizard`).
* **`/promo <CODE>`**: Enforces uppercase coupon lookups in MongoDB. Validates usage limits and adds reward points to the user's wallet.
* **`/instructions`**: Displays the user guide and answers frequently asked questions.
* **`/help` & hears `❓ المساعدة والأوامر`**: Displays a detailed list of all user commands.

#### [bot/commands/admin.js](file:///c:/Projects/freelane/Bots/bot/commands/admin.js)
Restricts commands to members of the admin group.
* **`/stats` & hears `📊 إحصائيات البوت`**: Displays total users, banned users, daily revenue, all-time revenue, and order status summaries.
* **`/export`**: Generates and sends a CSV file containing all user details, total points recharged/spent, order counts for each service, registration dates, and phone numbers.
* **`/ban` / `/unban`**: Updates the user's `isBanned` status in the database.
* **`/addpoints` / `/setbalance`**: Manually adds, deducts, or overrides a user's wallet balance.
* **`/refund <orderId>`**: Manually refunds an order and notifies the customer (admins can also use the inline button).
* **`/maintenance <on/off>`**: Activates/deactivates the global maintenance mode.
* **`/pending`**: Lists all pending deposits and orders currently in progress.
* **`/help` & hears `🛠️ مساعدة المسؤول`**: Displays the admin command reference.
* **`/admin`**: Spawns the quick admin reply keyboard menu in the group.

---

### 9. Shareable Utilities: [bot/utils/helpers.js](file:///c:/Projects/freelane/Bots/bot/utils/helpers.js)

* **`escapeHTML`**: Escapes characters like `<`, `>`, and `&` to prevent message formatting breaks in Telegram HTML messages.
* **`checkAdmin`**: Verifies if the request originates from the `ADMIN_GROUP_ID` group and that the sender is an admin or creator.
* **`isUserAdmin`**: Verifies if a user is an administrator of the group chat, used for validating permissions from private chats.
* **`normalizeDigits`**: Replaces Eastern Arabic (`١٢٣`) and Persian (`۱۲۳`) numerals with standard Western numbers (`123`), ensuring inputs like phone numbers and recharge amounts process correctly.
