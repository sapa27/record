/**
 * Meetily Thai — Google Apps Script bridge
 *
 * Required Script Properties:
 *   GAS_SHARED_SECRET   shared secret (at least 32 characters)
 *   ALLOWED_CLIENT_ID   desktop client id configured in Meetily
 *   SPREADSHEET_ID      destination Google Sheet id
 * Optional:
 *   DRIVE_FOLDER_ID     folder for generated Google Docs
 */
const APP_VERSION = 'meetily-thai-gas-v1';
const REQUEST_TTL_SECONDS = 300;
const MAX_DOCUMENT_CHARS = 2 * 1024 * 1024;
const MAX_REQUEST_CHARS = 4 * 1024 * 1024;
const DOCUMENT_TYPES = Object.freeze({
  meeting_summary: 'สรุปการประชุม',
  meeting_minutes: 'บันทึกการประชุม',
  meeting_news: 'ข่าวการประชุม',
});

function doGet() {
  return jsonOutput_({
    ok: true,
    service: 'Meetily Thai GAS Bridge',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });
}

function doPost(e) {
  try {
    const envelope = parseEnvelope_(e);
    validateEnvelope_(envelope);

    const payload = JSON.parse(envelope.payload);
    if (envelope.action === 'health_check') {
      return jsonOutput_({
        ok: true,
        service: 'Meetily Thai GAS Bridge',
        version: APP_VERSION,
        serverTime: new Date().toISOString(),
      });
    }

    if (envelope.action === 'publish_meeting_document') {
      return jsonOutput_(publishMeetingDocument_(payload, envelope));
    }

    throw new Error('Unsupported action');
  } catch (error) {
    console.error('[Meetily GAS] Request rejected:', safeErrorMessage_(error));
    return jsonOutput_({ ok: false, error: 'Request rejected' });
  }
}

function parseEnvelope_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing JSON request body');
  }
  if (e.postData.contents.length > MAX_REQUEST_CHARS) {
    throw new Error('Request body is too large');
  }
  let envelope;
  try {
    envelope = JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Malformed JSON request body');
  }
  return envelope;
}

function validateEnvelope_(envelope) {
  if (!envelope || envelope.version !== '1') throw new Error('Unsupported protocol version');

  const action = safeString_(envelope.action, 80, 'action');
  const clientId = safeString_(envelope.client_id, 80, 'client_id');
  const nonce = safeString_(envelope.nonce, 100, 'nonce');
  const payload = safeString_(envelope.payload, MAX_REQUEST_CHARS, 'payload');
  const signature = safeString_(envelope.signature, 128, 'signature').toLowerCase();
  const timestamp = Number(envelope.timestamp);

  if (!/^[A-Za-z0-9._-]{3,80}$/.test(clientId)) throw new Error('Invalid client_id format');
  if (!/^[A-Za-z0-9-]{16,100}$/.test(nonce)) throw new Error('Invalid nonce format');
  if (!/^[0-9a-f]{64}$/.test(signature)) throw new Error('Invalid signature format');
  if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp)) throw new Error('Invalid timestamp');
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > REQUEST_TTL_SECONDS) {
    throw new Error('Request timestamp expired');
  }

  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty('GAS_SHARED_SECRET') || '';
  const allowedClientId = properties.getProperty('ALLOWED_CLIENT_ID') || '';
  if (secret.length < 32) throw new Error('Server shared secret is not configured');
  if (!allowedClientId || clientId !== allowedClientId) throw new Error('Client is not allowed');

  const canonical = [clientId, String(timestamp), nonce, action, payload].join('\n');
  const expected = bytesToHex_(Utilities.computeHmacSha256Signature(canonical, secret));
  if (!constantTimeEqual_(signature, expected)) throw new Error('Invalid request signature');

  const cache = CacheService.getScriptCache();
  const nonceKey = 'nonce:' + digestHex_(clientId + ':' + nonce);
  const replayLock = LockService.getScriptLock();
  replayLock.waitLock(5000);
  try {
    if (cache.get(nonceKey)) throw new Error('Duplicate request detected');
    cache.put(nonceKey, '1', REQUEST_TTL_SECONDS + 60);
  } finally {
    replayLock.releaseLock();
  }
}

function publishMeetingDocument_(payload, envelope) {
  validateDocumentPayload_(payload);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) throw new Error('SPREADSHEET_ID is not configured');

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = getOrCreateSheet_(spreadsheet, 'MEETING_DOCUMENTS', [
      'record_id',
      'request_nonce',
      'meeting_id',
      'document_type',
      'title',
      'meeting_date',
      'language',
      'template_id',
      'content_excerpt',
      'content_sha256',
      'transcript_sha256',
      'google_doc_url',
      'created_at',
      'source',
    ]);

    const existingRow = findByNonce_(sheet, envelope.nonce);
    if (existingRow) {
      return duplicateDocumentResponse_(sheet, existingRow);
    }

    // Protect against a user retry that creates a new transport nonce but sends
    // the same meeting document again.
    const contentHash = digestHex_(payload.content_markdown);
    const existingDocumentRow = findExistingDocument_(
      sheet,
      payload.meeting_id,
      payload.document_type,
      contentHash
    );
    if (existingDocumentRow) {
      return duplicateDocumentResponse_(sheet, existingDocumentRow);
    }

    const recordId = Utilities.getUuid();
    const documentUrl = createGoogleDocument_(payload, recordId, properties);
    const now = new Date().toISOString();

    sheet.appendRow([
      recordId,
      envelope.nonce,
      safeCell_(payload.meeting_id),
      safeCell_(payload.document_type),
      safeCell_(payload.title),
      safeCell_(payload.meeting_date),
      safeCell_(payload.language),
      safeCell_(payload.template_id || ''),
      truncateCell_(payload.content_markdown, 45000),
      contentHash,
      '',
      documentUrl,
      now,
      'Meetily Thai',
    ]);

    return {
      ok: true,
      duplicate: false,
      recordId: recordId,
      documentUrl: documentUrl,
      createdAt: now,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateDocumentPayload_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid document payload');
  safeString_(payload.meeting_id, 160, 'meeting_id');
  safeString_(payload.title, 300, 'title');
  safeString_(payload.meeting_date, 80, 'meeting_date');
  if (payload.language !== 'th') throw new Error('Only Thai documents are accepted');
  if (!DOCUMENT_TYPES[payload.document_type]) throw new Error('Unsupported document_type');
  safeString_(payload.content_markdown, MAX_DOCUMENT_CHARS, 'content_markdown');
  if (payload.transcript_text) {
    throw new Error('Raw transcript export is disabled');
  }
}

function createGoogleDocument_(payload, recordId, properties) {
  const folderId = properties.getProperty('DRIVE_FOLDER_ID');
  const typeLabel = DOCUMENT_TYPES[payload.document_type];
  const fileName = sanitizeFileName_(typeLabel + ' - ' + payload.title);
  const doc = DocumentApp.create(fileName);
  const body = doc.getBody();

  body.appendParagraph(typeLabel).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(payload.title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('วันที่ประชุม: ' + payload.meeting_date);
  body.appendParagraph('รหัสการประชุม: ' + payload.meeting_id);
  body.appendHorizontalRule();
  appendMarkdown_(body, payload.content_markdown);
  body.appendHorizontalRule();
  body.appendParagraph('เลขอ้างอิงระบบ: ' + recordId);
  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  if (folderId) {
    const folder = DriveApp.getFolderById(folderId);
    file.moveTo(folder);
  }
  return doc.getUrl();
}

function appendMarkdown_(body, markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    // Convert GitHub-Flavoured Markdown tables into native Google Docs tables.
    if (
      line.indexOf('|') !== -1 &&
      index + 1 < lines.length &&
      isMarkdownTableSeparator_(lines[index + 1])
    ) {
      const rows = [parseMarkdownTableRow_(line)];
      index += 2; // Skip the separator row.
      while (index < lines.length && lines[index].trim().indexOf('|') !== -1) {
        rows.push(parseMarkdownTableRow_(lines[index]));
        index += 1;
      }
      index -= 1;
      if (rows.length > 0 && rows[0].length > 0) {
        body.appendTable(rows);
      }
      continue;
    }

    const text = stripInlineMarkdown_(line);
    if (!text) {
      body.appendParagraph('');
    } else if (/^---+$/.test(line)) {
      body.appendHorizontalRule();
    } else if (line.indexOf('### ') === 0) {
      body.appendParagraph(text).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    } else if (line.indexOf('## ') === 0) {
      body.appendParagraph(text).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    } else if (line.indexOf('# ') === 0) {
      body.appendParagraph(text).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    } else if (/^[-*]\s+/.test(line)) {
      body.appendListItem(text.replace(/^[-*]\s+/, '')).setGlyphType(DocumentApp.GlyphType.BULLET);
    } else if (/^\d+[.)]\s+/.test(line)) {
      body.appendListItem(text.replace(/^\d+[.)]\s+/, '')).setGlyphType(DocumentApp.GlyphType.NUMBER);
    } else if (/^>\s?/.test(line)) {
      body.appendParagraph(text.replace(/^>\s?/, '')).setIndentStart(24);
    } else {
      body.appendParagraph(text);
    }
  }
}

function isMarkdownTableSeparator_(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''));
}

function parseMarkdownTableRow_(line) {
  let normalized = String(line || '').trim();
  if (normalized.charAt(0) === '|') normalized = normalized.slice(1);
  if (normalized.charAt(normalized.length - 1) === '|') normalized = normalized.slice(0, -1);
  return normalized.split('|').map(function(cell) {
    return stripInlineMarkdown_(cell.trim()).slice(0, 5000);
  });
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findByNonce_(sheet, nonce) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index][0] === nonce) return index + 2;
  }
  return 0;
}


function findExistingDocument_(sheet, meetingId, documentType, contentHash) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, 3, lastRow - 1, 8).getDisplayValues();
  for (let index = values.length - 1; index >= 0; index--) {
    const row = values[index];
    if (row[0] === meetingId && row[1] === documentType && row[7] === contentHash) {
      return index + 2;
    }
  }
  return 0;
}

function duplicateDocumentResponse_(sheet, rowNumber) {
  return {
    ok: true,
    duplicate: true,
    recordId: String(sheet.getRange(rowNumber, 1).getValue()),
    documentUrl: String(sheet.getRange(rowNumber, 12).getValue() || ''),
  };
}

function safeString_(value, maxLength, fieldName) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(fieldName + ' is required');
  if (value.length > maxLength) throw new Error(fieldName + ' exceeds the allowed length');
  return value;
}

function safeCell_(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// Google Sheets cells are limited to 50,000 characters. Keep only a safe
// searchable excerpt; the complete document remains in Google Docs.
function truncateCell_(value, maxLength) {
  const text = safeCell_(value);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 20) + '\n...[ตัดทอนในชีต]';
}

function sanitizeFileName_(value) {
  return String(value || 'เอกสารการประชุม')
    .replace(/[\\/:*?"<>|#%{}~]/g, '_')
    .slice(0, 180);
}

function stripInlineMarkdown_(value) {
  return String(value || '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)');
}

function digestHex_(value) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value));
}

function bytesToHex_(bytes) {
  return bytes.map(function(byte) {
    const normalized = (byte + 256) % 256;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function constantTimeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function safeErrorMessage_(error) {
  const message = error && error.message ? String(error.message) : 'Unknown server error';
  return message.slice(0, 300);
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
