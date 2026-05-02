import { GoogleSheetsAPI } from './sheets.js';

// Simple formatter for Telegram text output.
function formatSheetAsTable(data, title = 'Sheet Data') {
  if (!data || data.length === 0) return null;

  const cleanCell = (value) =>
    String(value ?? '')
      .replace(/\r?\n/g, ' / ')
      .replace(/\s+/g, ' ')
      .trim();
  const rows = data
    .map((r) => (Array.isArray(r) ? r : [r]))
    .map((row) => row.map(cleanCell));

  const body = rows
    .map((row, idx) => `${idx + 1}. ${row.join(' | ')}`)
    .join('\n');

  const heading = `${title} (${rows.length} rows):`;
  return {
    text: `${heading}\n\n${body}`
  };
}

// Send simple table/list output as plain text.
async function sendTable(botToken, chatId, data, title, keyboard = null) {
  const formatted = formatSheetAsTable(data, title);
  if (!formatted) {
    await sendMessage(botToken, chatId, 'No data found');
    return;
  }

  const MAX = 4096;
  const lines = formatted.text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > MAX && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const chunkText = i === 0 ? chunks[i] : `continued(part ${i + 1})\n\n${chunks[i]}`;
    if (isLast && keyboard) {
      await sendMessageWithKeyboard(botToken, chatId, chunkText, keyboard);
    } else {
      await sendMessage(botToken, chatId, chunkText);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('Telegram Bot is running! ', { status: 200 });
    }

    // Webhook endpoint for Telegram
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        console.log('Received update:', JSON.stringify(update));
        await handleTelegramUpdate(update, env);
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Error processing webhook:', error.message, error.stack);
        return new Response('Error', { status: 500 });
      }
    }

    // Setup webhook endpoint
    if (url.pathname === '/setup') {
      const webhookUrl = `${url.origin}/webhook`;
      const result = await setWebhook(env.TELEGRAM_BOT_TOKEN, webhookUrl);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleTelegramUpdate(update, env) {
  // Handle callback queries (button clicks)
  if (update.callback_query) {
    const callbackChatId = update.callback_query.message.chat.id;

    // Check admin authorization for callbacks
    if (env.ADMIN_TELEGRAM_ID && callbackChatId.toString() !== env.ADMIN_TELEGRAM_ID) {
      await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, update.callback_query.id, 'Unauthorized');
      return;
    }

    await handleCallbackQuery(update.callback_query, env);
    return;
  }

  if (!update.message || !update.message.text) {
    return;
  }

  const chatId = update.message.chat.id;
  const text = update.message.text;

  // Check if admin-only mode is enabled
  if (env.ADMIN_TELEGRAM_ID) {
    if (chatId.toString() !== env.ADMIN_TELEGRAM_ID) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        'Access Denied\n\n' +
        'This bot is private and only accessible to authorized users.\n\n' +
        'Your Telegram ID: ' + chatId
      );
      return;
    }
  }

  try {
    // Handle /start command (no sheets needed)
    if (text === '/start') {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        'Welcome to Google Sheets Bot!\n\n' +
        'Basic Commands:\n' +
        '/sheets - List all sheets/tabs\n' +
        '/read - Read first sheet\n' +
        '/add value1 value2 value3 - Add a row\n\n' +
        'Advanced Commands:\n' +
        '/readsheet [name] - Read specific sheet\n' +
        '/readrange [sheet] [start] [end] - Read range\n' +
        '/addto [sheet] value1 value2 - Add to sheet\n\n' +
        'Type /help for details'
      );
      return;
    }

    // Handle /help command (no sheets needed)
    if (text === '/help') {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        'Complete Command Guide:\n\n' +
        'Sheet Management:\n' +
        '/sheets - List all sheets/tabs\n\n' +
        'Reading Data:\n' +
        '/read - Read first sheet\n' +
        '/readsheet GPT - Read GPT sheet\n' +
        '/readrange GPT A1 D10 - Read cells A1 to D10\n\n' +
        'Writing Data (space-separated):\n' +
        '/add email@test.com pass123 seller - Add to first sheet\n' +
        '/addto GPT email pass seller - Add to GPT sheet\n\n' +
        'Other Commands:\n' +
        '/search John - Search for "John"\n' +
        '/count - Count total rows'
      );
      return;
    }

    // Initialize sheets for commands that need it
    const sheets = new GoogleSheetsAPI(env);

    // Handle /sheets command - List all sheets
    if (text === '/sheets') {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Fetching sheets...');
      const sheetsList = await sheets.listSheets();

      let response = `Available Sheets (${sheetsList.length}):\n\nClick a button below to read a sheet:`;

      // Create inline keyboard with buttons for each sheet
      const keyboard = [];
      for (let i = 0; i < sheetsList.length; i += 2) {
        const row = [];
        row.push({
          text: sheetsList[i].title,
          callback_data: `read_${sheetsList[i].title}`
        });
        if (i + 1 < sheetsList.length) {
          row.push({
            text: sheetsList[i + 1].title,
            callback_data: `read_${sheetsList[i + 1].title}`
          });
        }
        keyboard.push(row);
      }

      await sendMessageWithKeyboard(env.TELEGRAM_BOT_TOKEN, chatId, response, keyboard);
      return;
    }

    // Handle /readsheet command - Read specific sheet
    if (text.startsWith('/readsheet ')) {
      const sheetName = text.replace('/readsheet ', '').trim();
      if (!sheetName) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Please provide sheet name.\nExample: /readsheet GPT');
        return;
      }

      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `Reading "${sheetName}" sheet...`);
      const data = await sheets.readSheet(null, sheetName);

      if (!data || data.length === 0) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `Sheet "${sheetName}" is empty or not found`);
        return;
      }

      const actionButtons = [
        [
          { text: 'Clear', callback_data: 'clear_message' },
          { text: 'Copy', callback_data: `copy_${sheetName}` },
          { text: 'Help', callback_data: 'show_help' }
        ]
      ];

      await sendTable(env.TELEGRAM_BOT_TOKEN, chatId, data, `Sheet: ${sheetName}`, actionButtons);
      return;
    }

    // Handle /readrange command - Read specific range
    if (text.startsWith('/readrange ')) {
      const params = text.replace('/readrange ', '').trim().split(' ');
      if (params.length < 3) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
          'Usage: /readrange <sheet> <start> <end>\n' +
          'Example: /readrange GPT A1 D10'
        );
        return;
      }

      const sheetName = params[0];
      const startCell = params[1];
      const endCell = params[2];

      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        `Reading "${sheetName}" range ${startCell}:${endCell}...`
      );

      const data = await sheets.readSpecificRange(sheetName, startCell, endCell);

      if (!data || data.length === 0) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Range is empty');
        return;
      }

      await sendTable(env.TELEGRAM_BOT_TOKEN, chatId, data, `Range ${startCell}:${endCell}`);
      return;
    }

    // Handle /addto command - Add to specific sheet
    if (text.startsWith('/addto ')) {
      const content = text.replace('/addto ', '').trim();
      const firstSpace = content.indexOf(' ');

      if (firstSpace === -1) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
          'Usage: /addto [sheet] value1 value2 value3\n' +
          'Example: /addto GPT email@test.com pass123 seller'
        );
        return;
      }

      const sheetName = content.substring(0, firstSpace);
      const data = content.substring(firstSpace + 1).trim();

      if (!data) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Please provide data to add');
        return;
      }

      const values = data.split(/\s+/); // Split by one or more spaces
      await sheets.appendRow(values, sheetName);
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        `Data added to "${sheetName}" sheet!\n` +
        `Added: ${values.join(' | ')}`
      );
      return;
    }

    // Handle /read command
    if (text === '/read') {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Reading data...');
      const data = await sheets.readSheet();

      if (!data || data.length === 0) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Sheet is empty');
        return;
      }

      const actionButtons = [
        [
          { text: 'Clear', callback_data: 'clear_message' },
          { text: 'Copy', callback_data: 'copy_sheet' },
          { text: 'Help', callback_data: 'show_help' }
        ]
      ];

      await sendTable(env.TELEGRAM_BOT_TOKEN, chatId, data, 'Sheet Data', actionButtons);
      return;
    }

    // Handle /add command
    if (text.startsWith('/add ')) {
      const data = text.replace('/add ', '').trim();
      if (!data) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
          'Please provide data to add.\nExample: /add email@test.com pass123 seller'
        );
        return;
      }

      const values = data.split(/\s+/); // Split by one or more spaces
      await sheets.appendRow(values);
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        'Data added successfully!\n' +
        `Added: ${values.join(' | ')}`
      );
      return;
    }

    // Handle /search command
    if (text.startsWith('/search ')) {
      const query = text.replace('/search ', '').trim();
      if (!query) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Please provide a search query');
        return;
      }

      const data = await sheets.readSheet();
      const results = data.filter(row =>
        row.some(cell => cell.toString().toLowerCase().includes(query.toLowerCase()))
      );

      if (results.length === 0) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `No results found for "${query}"`);
        return;
      }

      await sendTable(env.TELEGRAM_BOT_TOKEN, chatId, results, `Results for "${query}"`);
      return;
    }

    // Handle /count command
    if (text === '/count') {
      const data = await sheets.readSheet();
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        `Total rows: ${data ? data.length : 0}`
      );
      return;
    }

    // Unknown command
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
      'Unknown command. Type /help to see available commands.'
    );

  } catch (error) {
    console.error('Error handling command:', error.message, error.stack);
    try {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        'An error occurred: ' + error.message
      );
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  }
}

async function sendMessageWithKeyboard(botToken, chatId, text, inlineKeyboard, parseMode = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  };
  if (parseMode) body.parse_mode = parseMode;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!result.ok) {
    console.error('Failed to send message with keyboard:', result);
  }
  return result;
}

async function answerCallbackQuery(botToken, callbackQueryId, text) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text
    })
  });
  return await response.json();
}

async function deleteMessage(botToken, chatId, messageId) {
  const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId
    })
  });
  return await response.json();
}

async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const callbackQueryId = callbackQuery.id;
  const messageId = callbackQuery.message.message_id;

  try {
    // Handle clear message button
    if (data === 'clear_message') {
      await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId, 'Clearing...');
      await deleteMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId);
      return;
    }

    // Handle copy button
    if (data.startsWith('copy_')) {
      const sheetName = data.replace('copy_', '');
      await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId, 'Preparing data for copying...');

      // Read the sheet data
      const sheets = new GoogleSheetsAPI(env);
      let sheetData;

      if (sheetName === 'sheet') {
        // For generic /read command
        sheetData = await sheets.readSheet();
      } else {
        // For specific sheet
        sheetData = await sheets.readSheet(null, sheetName);
      }

      if (!sheetData || sheetData.length === 0) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'No data to copy');
        return;
      }

      await sendTable(env.TELEGRAM_BOT_TOKEN, chatId, sheetData, sheetName === 'sheet' ? 'Sheet Data' : `Sheet: ${sheetName}`);
      return;
    }

    // Handle help button
    if (data === 'show_help') {
      await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId, '');
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
        'Quick Actions:\n\n' +
        'Clear - Delete this message\n' +
        'Copy - Send data in copyable format\n' +
        'Help - Show this help\n\n' +
        'Commands:\n' +
        '/sheets - List all sheets\n' +
        '/readsheet [name] - Read specific sheet\n' +
        '/add [values] - Add row to sheet'
      );
      return;
    }

    // Handle read sheet button clicks
    if (data.startsWith('read_')) {
      const sheetName = data.replace('read_', '');

      // Answer the callback query to remove the loading state
      await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId, `Reading ${sheetName}...`);

      // Send processing message
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `Reading "${sheetName}" sheet...`);

      // Read the sheet
      const sheets = new GoogleSheetsAPI(env);
      const sheetData = await sheets.readSheet(null, sheetName);

      if (!sheetData || sheetData.length === 0) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, `Sheet "${sheetName}" is empty or not found`);
        return;
      }

      const actionButtons = [
        [
          { text: 'Clear', callback_data: 'clear_message' },
          { text: 'Copy', callback_data: `copy_${sheetName}` },
          { text: 'Help', callback_data: 'show_help' }
        ]
      ];

      await sendTable(env.TELEGRAM_BOT_TOKEN, chatId, sheetData, `Sheet: ${sheetName}`, actionButtons);
    }
  } catch (error) {
    console.error('Error handling callback query:', error.message, error.stack);
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackQueryId, 'Error occurred');
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'An error occurred: ' + error.message);
  }
}

async function sendMessage(botToken, chatId, text, parseMode = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text
  };

  // Add parse_mode if specified
  if (parseMode) {
    body.parse_mode = parseMode;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!result.ok) {
    console.error('Failed to send message:', result);
  }
  return result;
}

async function setWebhook(botToken, webhookUrl) {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl })
  });
  return await response.json();
}


