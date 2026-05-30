# SaveTimePro Bot - Technical Architecture & File Reference Guide

Welcome to the technical reference guide for the **SaveTimePro Bot**. This document provides an in-depth analysis of the entire codebase architecture, database models, conversational wizards, security layers, testing framework, and UI/UX systems.

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

## ⚙️ Core Modules & File Breakdown

### 1. Main Entry & Database Connection
* **[index.js](file:///c:/Projects/freelane/Bots/index.js)**: 
  Coordinates and boots all modular registration blocks in order. Runs a simple HTTP server (on port 3000) forRender.com health-check pings to keep the application active 24/7. Registers the bot's commands list on Telegram's menu.
* **[config/db.js](file:///c:/Projects/freelane/Bots/config/db.js)**: 
  Connects to MongoDB using Mongoose. Listens to lifecycle events (`connected`, `disconnected`, `error`) and logs database status to the server console.

### 2. Database Models (`/models`)
* **[User.js](file:///c:/Projects/freelane/Bots/models/User.js)**:
  Tracks user Telegram details, point balance (cannot be negative), joined date, ban status, and referral metrics (`referredBy`, `referralRewardClaimed`).
* **[Order.js](file:///c:/Projects/freelane/Bots/models/Order.js)**:
  Tracks all purchased services, order statuses (`pending_payment`, `paid`, `in_progress`, `completed`, `cancelled`), prices, file IDs (reference and finished delivery files), and admin group message IDs.
* **[Deposit.js](file:///c:/Projects/freelane/Bots/models/Deposit.js)**:
  Stores user deposits/recharges, documenting the requested amount, sender's phone number, proof photo/document file ID, and approval state (`pending`, `approved`, `rejected`).
* **[PromoCode.js](file:///c:/Projects/freelane/Bots/models/PromoCode.js)**:
  Manages gift codes, awarding points to users. Keeps track of maximum uses and an array of user IDs who have redeemed it to prevent duplicate claims.
* **[Session.js](file:///c:/Projects/freelane/Bots/models/Session.js)**:
  Stores current user session and wizard states persistently. Configured with a TTL index to delete idle sessions automatically after 7 days.
* **[SystemConfig.js](file:///c:/Projects/freelane/Bots/models/SystemConfig.js)**:
  Stores key-value global flags. Currently manages `maintenanceMode` status across server instances.

### 3. Middleware & Pipeline Registry (`/bot`)
* **[middlewares.js](file:///c:/Projects/freelane/Bots/bot/middlewares.js)**:
  Configures the execution pipeline order for incoming updates. Reordered to execute security validation early:
  1. **Logger**: Logs incoming updates and processing times.
  2. **Whitelist**: Automatically leaves any group except the configured `ADMIN_GROUP_ID`.
  3. **Ban Check**: Blocks updates instantly if the user is flagged as banned in the database.
  4. **Maintenance Mode**: Restricts all private chats from interacting with the bot if maintenance is enabled (admins bypass this check to test code).
  5. **Mongoose Sessions**: Fetches and saves wizard states on MongoDB.
  6. **Wizard Stage**: Directs user inputs through multi-step forms.
  7. **Cooldown (Rate Limiter)**: Throttles user private commands to 1 request per second to prevent spam (disabled for the Admin Group).

### 4. Interactive Wizards (`/bot/scenes`)
* **[rechargeWizard.js](file:///c:/Projects/freelane/Bots/bot/scenes/rechargeWizard.js)**:
  Collects deposit amount, captures receipt screenshot (either uploaded as photo or document file), accepts the sender's 11-digit mobile number, and dispatches the styled approval request directly to the Admin Group.
* **[orderWizard.js](file:///c:/Projects/freelane/Bots/bot/scenes/orderWizard.js)**:
  Handles documents submission for Turnitin/AI reports. Prompts for documents, performs wallet balance validation, shows a detailed confirmation panel, and dispatches the document with a styled card to the Admin Group.
* **[designWizard.js](file:///c:/Projects/freelane/Bots/bot/scenes/designWizard.js)**:
  Guides users through CV/Portfolio designs. Gathers reference documents and specific user notes/instructions, confirms details, and uploads the request to the Admin Group.

### 5. Actions, Delivery, & Commands
* **[bot/actions/adminActions.js](file:///c:/Projects/freelane/Bots/bot/actions/adminActions.js)**:
  - Resolves inline actions for recharge requests (`approve_dep_`, `reject_dep_`). Handles **virality referrals**: if a referred user's first recharge is **>= 300 EGP**, the referrer is credited with **+25 points** and notified.
  - Resolves **admin inline refunds** (`admin_refund_order_`): enables admins to instantly refund points to a user's wallet and cancel the order with a single click.
* **[bot/handlers/adminDelivery.js](file:///c:/Projects/freelane/Bots/bot/handlers/adminDelivery.js)**:
  Listens for replies inside the Admin Group. If an admin replies to an order card with a document or photo, the bot delivers the file to the client and marks the order as `completed`. If an admin replies with text, it forwards the message as a guide to the user (e.g. asking for file resubmissions).
* **[bot/commands/user.js](file:///c:/Projects/freelane/Bots/bot/commands/user.js)**:
  Registers public commands `/start`, `/profile` (referral links & statistics), `/services` menu, `/recharge`, and the user-level `/help` instruction command.
* **[bot/commands/admin.js](file:///c:/Projects/freelane/Bots/bot/commands/admin.js)**:
  Registers admin controls restricted to the Admin Group: `/stats` (live dashboard), `/export` (aggregates complete CSV malling list & sales report), `/ban`/`/unban`, `/addpoints`/`/setbalance`, `/refund`, `/maintenance`, `/pending` queue, and `/help` for administration commands.
* **[bot/utils/helpers.js](file:///c:/Projects/freelane/Bots/bot/utils/helpers.js)**:
  Contains helper functions for escaping characters (`escapeHTML`), verifying group membership, checking admin credentials (`checkAdmin`), and converting Eastern Arabic numbers to standard numerals (`normalizeDigits`).

---

## 🎨 UI/UX Refinements & Safeguards

1. **Wizard Keyboard Interceptor**:
   If a user is inside any wizard flow (e.g., uploading a document) and decides to click one of the persistent main menu keyboard buttons (like `👤 حسابي الشخصي` or `📂 الخدمات`), the scene interceptor catches the text, leaves the wizard scene instantly, and redirects the user to their selected menu. This prevents users from getting stuck or receiving invalid input errors.
2. **Transaction Fail-Safe Order Placement**:
   Documents and reference files are uploaded and verified on Telegram *first* before any database logs are recorded or user balance is deducted. If the network or upload fails, the transaction is discarded without deducting any user points.
3. **Inline Refund Integration**:
   - Order cards sent to the Admin Group contain an inline button: `❌ إلغاء الطلب واسترداد النقاط`.
   - When admins reply to an order with a text message (e.g., requesting a correction), the confirmation message also includes the refund button.
   - Clicking the button cancels the order, returns points to the user's wallet, updates the group card to a red cancelled status, and sends a private notice to the customer.
4. **Excel-Friendly CSV Export**:
   Admins can export user and transaction stats using `/export`. The system formats numbers, normalizes dates, merges user accounts with deposit phone histories, and prepends the UTF-8 BOM (`\ufeff`) so that Excel reads Arabic names and characters perfectly.

---

## 🧪 Testing Suite (`/tests`)

The application includes a fully automated unit testing suite powered by Node.js's native test runner (meaning no heavy external test frameworks are installed). 

The test suite covers:
1. **Helpers Validation** (`tests/helpers.test.js`): Verifies that HTML formats escape correctly and that Eastern Arabic digits convert to Western Arabic numerals accurately.
2. **Services Integrity** (`tests/config.test.js`): Ensures all services defined in `services.js` have correct data structures, valid Arabic descriptions, and non-negative pricing.
3. **DB Schema Validation** (`tests/db.test.js`): Tests validation limits, default variables, and enumerations for Mongoose models without requiring a live connection to MongoDB.

To execute tests locally:
```bash
npm test
```
