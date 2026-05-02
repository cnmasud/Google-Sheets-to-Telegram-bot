# 🤖 Telegram Bot + Google Sheets + Cloudflare Workers

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cnmasud/Google-Sheets-to-Telegram-bot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, serverless Telegram bot that provides a seamless interface to read from and write to Google Sheets. Built with **Cloudflare Workers**, it ensures high availability, low latency, and zero infrastructure management.

## 🚀 Features

- **Read**: Fetch data directly from your spreadsheet.
- **Write**: Append new rows via simple Telegram commands.
- **Search**: Query your data instantly.
- **Manage**: Count rows or clear data while preserving headers.
- **Secure**: Uses Google Service Accounts for restricted, safe access.
- **Serverless**: Runs on Cloudflare's global edge network.

---

## 🛠 Prerequisites

Before you begin, ensure you have:
1. A **Cloudflare Account** ([Sign up](https://dash.cloudflare.com/sign-up))
2. A **Telegram Bot Token** (Get it from [@BotFather](https://t.me/BotFather))
3. A **Google Cloud Project** with the **Google Sheets API** enabled.
4. **Node.js** and **npm** installed locally.

---

## 📦 Setup Instructions

### 1. Bot & Sheets Preparation
- **Telegram**: Create a bot via `@BotFather` and save the API Token.
- **Google Sheets**:
    1. Create a **Service Account** in the [Google Cloud Console](https://console.cloud.google.com/).
    2. Download the **JSON Key File** for the service account.
    3. **Share** your Google Sheet with the `client_email` found in that JSON (give it "Editor" access).
    4. Copy the **Sheet ID** from your browser's URL bar.

### 2. Local Setup
```bash
git clone https://github.com/cnmasud/Google-Sheets-to-Telegram-bot.git
cd Google-Sheets-to-Telegram-bot
npm install
```

### 3. Configure Secrets
We use `wrangler` to securely store your credentials on Cloudflare. Run these commands:

```bash
# Required Secrets
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put GOOGLE_SHEET_ID

# Optional: Set your sheet name (defaults to "Sheet1")
wrangler secret put GOOGLE_SHEET_NAME
```

> **Note**: For `GOOGLE_PRIVATE_KEY`, copy the entire block including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`.

---

## 🚢 Deployment

Deploy your worker to the edge:
```bash
npm run deploy
```

Once deployed, you will receive a Worker URL (e.g., `https://your-bot.your-subdomain.workers.dev`).

### 🔗 Activate Webhook
To link your Telegram bot to the Worker, visit the setup endpoint in your browser:
`https://your-bot.your-subdomain.workers.dev/setup`

---

## 🎮 Bot Commands

| Command | Action | Example |
| :--- | :--- | :--- |
| `/start` | Welcome message & help | `/start` |
| `/read` | List all data rows | `/read` |
| `/add` | Append row (comma-separated) | `/add John, Doe, john@example.com` |
| `/search` | Find rows containing text | `/search John` |
| `/count` | Total row count | `/count` |
| `/clear` | Wipe data (keeps headers) | `/clear` |

---

## 📂 Project Structure

- `src/index.js`: The brain of the bot (webhook handler & Telegram logic).
- `src/sheets.js`: Integration with Google Sheets API (JWT Auth & REST calls).
- `wrangler.toml`: Cloudflare Worker configuration.

---

## 🔒 Security
- **No Hardcoded Secrets**: All tokens are handled via Cloudflare Secrets.
- **JWT Authentication**: Secure, short-lived tokens for Google API access.
- **Git Safety**: Sensitive files are pre-configured in `.gitignore`.

## 📄 License
This project is licensed under the [MIT License](LICENSE).

## 🤝 Contributing
Contributions are welcome! Feel free to open an issue or submit a pull request.

---
Created by [cnmasud](https://github.com/cnmasud)
├── package.json    # Dependencies and scripts
└── README.md       # This file
```

## Customization

### Adding New Commands

Edit `src/index.js` and add a new command handler in the `handleTelegramUpdate` function:

```javascript
if (text.startsWith('/mycommand ')) {
  const param = text.replace('/mycommand ', '').trim();
  // Your logic here
  await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Response');
  return;
}
```

### Changing Sheet Range

Modify the range in `sheets.js`:

```javascript
async readSheet(range = null) {
  const readRange = range || `${this.sheetName}!A1:Z1000`;
  // Change Z1000 to your desired range
}
```

## License

MIT

## Support

For issues and questions:
- Check the troubleshooting section
- Review Cloudflare Workers documentation
- Check Telegram Bot API documentation
- Review Google Sheets API documentation
