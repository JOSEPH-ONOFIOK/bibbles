/**
 * MOCHI sign-ups — Google Apps Script web app.
 *
 * The only shared list of sign-ups: the site keeps each visitor's progress in
 * their browser and sends their row here. Nothing is read back from this sheet.
 *
 * Contract with src/lib/mirror.ts:
 *
 *   {action:"bulk", rows:[...]}  -> { saved }     adds or updates X handles
 *
 *   GET ?version -> { version }
 *
 * There is no secret: anyone with the web app URL can add rows, so keep the URL
 * private. It belongs only in the site's server settings.
 *
 * Setup is in README.md next to this file.
 */

/** Bumped whenever this file changes, so `?version` shows which copy is deployed. */
var SCRIPT_VERSION = 2;

var SIGNUPS = 'Signups';

/** Rows are written by header name. */
var HEADERS = [
  'X Handle',
  'Wallet',
  'Complete',
  'Followed',
  'Liked + Reposted',
  'Tag Reply',
  'Mochi Post',
  'Joined At',
  'Completed At',
  'Updated At',
];

/** Which field of a row from the site fills each column. */
var FIELDS = {
  'X Handle': 'handle',
  'Wallet': 'wallet',
  'Complete': 'complete',
  'Followed': 'followed',
  'Liked + Reposted': 'liked_reposted',
  'Tag Reply': 'tag_reply',
  'Mochi Post': 'mochi_post',
  'Joined At': 'joined_at',
  'Completed At': 'completed_at',
  'Updated At': 'updated_at',
};

// --- entry points ---------------------------------------------------------

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.version !== undefined) return json({ version: SCRIPT_VERSION });
  return json({ error: 'unknown request' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ error: 'bad request' });
  }
  if (body.action !== 'bulk') return json({ error: 'unknown action' });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ error: 'busy' });
  }
  try {
    return json({ saved: saveAll(body.rows || []) });
  } catch (err) {
    return json({ error: String(err) });
  } finally {
    // Finish the write before the next one starts, or it can read the sheet as it was.
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

// --- writes ---------------------------------------------------------------

/** One read of the handle column, so a batch costs the same however long the sheet is. */
function saveAll(rows) {
  var sheet = signupSheet(), last = sheet.getLastRow(), at = {};
  if (last > 1) {
    var list = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < list.length; i++) at[String(list[i][0]).toLowerCase()] = i + 2;
  }
  var saved = 0;
  for (var j = 0; j < rows.length; j++) {
    if (!rows[j] || !rows[j].handle) continue;
    var handle = String(rows[j].handle).toLowerCase(), number = at[handle] || sheet.getLastRow() + 1;
    var old = at[handle] ? sheet.getRange(number, 1, 1, HEADERS.length).getValues()[0].map(String) : null;
    var row = buildRow(rows[j], old);
    if (row) {
      // Plain text, so Sheets never reads a value as a formula or a date.
      sheet.getRange(number, 1, 1, HEADERS.length).setNumberFormat('@').setValues([row]);
      at[handle] = number;
    }
    saved++;
  }
  return saved;
}

/**
 * Nothing else holds this data, so an update never blanks a cell: someone who
 * cleared their browser starts over on the site but keeps their row here.
 * Returns null for an update older than what is stored; they can arrive out of order.
 */
function buildRow(e, old) {
  var oldOf = function (name) { return old ? old[col(name) - 1] : ''; };
  if (oldOf('Updated At') && String(e.updated_at) < oldOf('Updated At')) return null;

  var row = [];
  for (var i = 0; i < HEADERS.length; i++) {
    var name = HEADERS[i], value = e[FIELDS[name]];
    value = value === undefined || value === null ? '' : String(value);
    row[i] = value || oldOf(name);
  }
  if (oldOf('Joined At')) row[col('Joined At') - 1] = oldOf('Joined At');
  if (oldOf('Complete') === 'yes') row[col('Complete') - 1] = 'yes';
  return row;
}

// --- helpers --------------------------------------------------------------

function signupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(SIGNUPS);
  if (!sheet) sheet = ss.insertSheet(SIGNUPS);
  // Also upgrades a tab made by an older version of this script
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function col(name) {
  return HEADERS.indexOf(name) + 1;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// --- manual test ----------------------------------------------------------

/** Run from the Apps Script editor. Delete the selftest row afterwards. */
function selfTest() {
  var row = { handle: 'selftest', wallet: '0xtest', complete: 'no', joined_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  var send = function () {
    return JSON.parse(doPost({ postData: { contents: JSON.stringify({ action: 'bulk', rows: [row] }) } }).getContent());
  };
  var first = send();
  var before = signupSheet().getLastRow();
  var second = send();
  var once = signupSheet().getLastRow() === before;

  Logger.log('saved         : ' + JSON.stringify(first));
  Logger.log('no duplicate  : ' + once);

  var ok = first.saved === 1 && second.saved === 1 && once;
  Logger.log(ok ? 'PASS. Delete the "selftest" row before going live.' : 'FAIL. See the lines above.');
}
