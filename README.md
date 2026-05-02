# Telegram Bot + Google Sheets + Cloudflare Workers

A serverless Telegram bot that reads from and writes to Google Sheets, deployed on Cloudflare Workers.

## Features

- ✅ Read data from Google Sheets
- ✅ Add new rows to Google Sheets
- ✅ Search data in sheets
- ✅ Count total rows
- ✅ Clear sheet data
- ✅ Serverless deployment on Cloudflare Workers
- ✅ Secure authentication with Google Service Account

## Prerequisites

1. **Cloudflare Account** - [Sign up here](https://dash.cloudflare.com/sign-up)
2. **Telegram Bot Token** - Get from [@BotFather](https://t.me/BotFather)
3. **Google Cloud Service Account** - For Google Sheets API access
4. **Google Sheet** - The spreadsheet you want to access

## Setup Instructions

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Save the bot token - you'll need it later

### 2. Set Up Google Sheets API

#### Create a Service Account:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create a Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Fill in the details and click "Create"
   - Skip optional steps and click "Done"

5. Create a Key:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose JSON format
   - Download the JSON file

6. Extract from the JSON file:
   - `client_email` (your service account email)
   - `private_key` (your private key)

#### Share Your Google Sheet:

1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email (from JSON file)
4. Give it "Editor" permissions
5. Copy the Sheet ID from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Secrets

Set your environment variables using Wrangler:

```bash
# Set Telegram Bot Token
wrangler secret put TELEGRAM_BOT_TOKEN
# When prompted, paste your bot token

# Set Google Service Account Email
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# When prompted, paste the client_email from your JSON file

# Set Google Private Key
wrangler secret put GOOGLE_PRIVATE_KEY
# When prompted, paste the private_key from your JSON file
# Make sure to include -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----

# Set Google Sheet ID
wrangler secret put GOOGLE_SHEET_ID
# When prompted, paste your Sheet ID
```

Optional: Set sheet name (defaults to "Sheet1"):
```bash
wrangler secret put GOOGLE_SHEET_NAME
# When prompted, enter your sheet name (e.g., "Data" or "Sheet1")
```

### 5. Test Locally

```bash
npm run dev
```

This will start a local development server. Note: You can't set webhooks to localhost, so local testing is limited.

### 6. Deploy to Cloudflare

```bash
npm run deploy
```

After deployment, you'll get a URL like: `https://telegram-sheets-bot.YOUR_SUBDOMAIN.workers.dev`

### 7. Set Up Telegram Webhook

Visit this URL in your browser:
```
https://telegram-sheets-bot.YOUR_SUBDOMAIN.workers.dev/setup
```

You should see a success message confirming the webhook is set.

## Bot Commands

Once your bot is running, you can use these commands in Telegram:

- `/start` - Welcome message and command list
- `/help` - Show available commands
- `/read` - Read all data from the sheet
- `/add <data>` - Add a new row (comma-separated values)
  - Example: `/add John Doe,john@email.com,+1234567890`
- `/search <query>` - Search for data in the sheet
  - Example: `/search John`
- `/count` - Get the total number of rows
- `/clear` - Clear all data (keeps headers in row 1)

## Example Usage

1. **Add data:**
   ```
   /add Alice,alice@example.com,555-0001
   /add Bob,bob@example.com,555-0002
   ```

2. **Read data:**
   ```
   /read
   ```
   Shows all rows in the sheet

3. **Search:**
   ```
   /search Alice
   ```
   Finds all rows containing "Alice"

4. **Count rows:**
   ```
   /count
   ```
   Returns the total number of rows

## Troubleshooting

### Bot not responding?
1. Check if webhook is set: Visit `/setup` endpoint
2. Check Cloudflare Workers logs: `npm run tail`
3. Verify all secrets are set correctly

### Google Sheets API errors?
1. Make sure the service account email has access to your sheet
2. Verify the Sheet ID is correct
3. Check that Google Sheets API is enabled in your project
4. Ensure the private key is properly formatted (includes BEGIN/END markers)

### Telegram API errors?
1. Verify your bot token is correct
2. Make sure webhook URL is publicly accessible
3. Check that your bot is not blocked

## Security Notes

- Never commit your bot token or service account credentials to Git
- All sensitive data should be stored as Cloudflare Workers secrets
- The service account should only have access to the specific sheet(s) you need
- Consider adding user authentication to restrict bot access

## Project Structure

```
telegram-sheets-bot/
├── src/
│   ├── index.js    # Main worker with Telegram webhook handling
│   └── sheets.js   # Google Sheets API integration
├── wrangler.toml   # Cloudflare Workers configuration
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
