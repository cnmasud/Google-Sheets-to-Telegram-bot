export class GoogleSheetsAPI {
  constructor(env) {
    this.serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.privateKey = env.GOOGLE_PRIVATE_KEY;
    this.sheetId = env.GOOGLE_SHEET_ID;
    this.sheetName = env.GOOGLE_SHEET_NAME || 'Sheet1';
  }

  async getAccessToken() {
    const jwtHeader = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const jwtClaimSet = {
      iss: this.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const jwtHeaderBase64 = this.base64urlEncode(JSON.stringify(jwtHeader));
    const jwtClaimSetBase64 = this.base64urlEncode(JSON.stringify(jwtClaimSet));
    const signatureInput = `${jwtHeaderBase64}.${jwtClaimSetBase64}`;

    // Sign the JWT
    const signature = await this.signJWT(signatureInput, this.privateKey);
    const jwt = `${signatureInput}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
    }
    
    return data.access_token;
  }

  async signJWT(data, privateKeyPem) {
    // Handle escaped newlines and clean the key
    let cleanKey = privateKeyPem
      .replace(/\\n/g, '\n')  // Replace escaped newlines with actual newlines
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/[\r\n\s]/g, '');  // Remove all whitespace, newlines, and carriage returns
    
    // Decode base64 to binary
    const binaryDer = Uint8Array.from(atob(cleanKey), c => c.charCodeAt(0));

    // Import the key
    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );

    // Sign the data
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(data)
    );

    // Convert to base64url
    return this.base64urlEncode(signature);
  }

  base64urlEncode(input) {
    let base64;
    if (typeof input === 'string') {
      base64 = btoa(unescape(encodeURIComponent(input)));
    } else if (input instanceof ArrayBuffer) {
      base64 = btoa(String.fromCharCode(...new Uint8Array(input)));
    } else {
      throw new Error('Input must be string or ArrayBuffer');
    }
    
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async listSheets() {
    const accessToken = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}?fields=sheets.properties`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list sheets: ${error}`);
    }

    const data = await response.json();
    return data.sheets.map(sheet => ({
      title: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
      index: sheet.properties.index
    }));
  }

  async readSheet(range = null, sheetName = null) {
    const accessToken = await this.getAccessToken();
    // If sheetName is provided, use it; otherwise use default range
    let readRange;
    if (sheetName && range) {
      readRange = `${sheetName}!${range}`;
    } else if (sheetName) {
      readRange = `${sheetName}!A1:Z1000`;
    } else if (range) {
      readRange = range;
    } else {
      readRange = `A1:Z1000`;
    }
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${encodeURIComponent(readRange)}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to read sheet: ${error}`);
    }

    const data = await response.json();
    return data.values || [];
  }

  async readSpecificRange(sheetName, startCell, endCell) {
    const range = `${startCell}:${endCell}`;
    return await this.readSheet(range, sheetName);
  }

  async appendRow(values, sheetName = null) {
    const accessToken = await this.getAccessToken();
    const range = sheetName ? `${sheetName}!A1` : 'A1';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [values]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to append row: ${error}`);
    }

    return await response.json();
  }

  async updateRow(row, values) {
    const accessToken = await this.getAccessToken();
    const range = `A${row}:Z${row}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [values]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update row: ${error}`);
    }

    return await response.json();
  }

  async clearSheet() {
    const accessToken = await this.getAccessToken();
    const range = `A2:Z1000`; // Keep headers in row 1
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${encodeURIComponent(range)}:clear`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to clear sheet: ${error}`);
    }

    return await response.json();
  }

  async batchUpdate(data) {
    const accessToken = await this.getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}:batchUpdate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to batch update: ${error}`);
    }

    return await response.json();
  }
}
