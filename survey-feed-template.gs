// Deploy in Google Apps Script as a Web app. Use non-sensitive demo data only.
// Execute as yourself; grant read access only if you intend this feed to be public.
// Paste the resulting /exec?stage=pre and /exec?stage=post URLs into OmniKnow.
const OMNIKNOW_SOURCES = {
  pre: { spreadsheetId: 'PRE_SPREADSHEET_ID', tab: 'Form Responses 1', id: 'Agent ID', score: 'Score', timestamp: 'Timestamp' },
  post: { spreadsheetId: 'POST_SPREADSHEET_ID', tab: 'Form Responses 1', id: 'Agent ID', score: 'Score', timestamp: 'Timestamp' }
};
function doGet(e) {
  try {
    const config = OMNIKNOW_SOURCES[e.parameter.stage];
    if (!config) throw new Error('Use stage=pre or stage=post.');
    const sheet = SpreadsheetApp.openById(config.spreadsheetId).getSheetByName(config.tab);
    if (!sheet) throw new Error('Response tab not found.');
    const values = sheet.getDataRange().getValues();
    const headers = values.shift().map(String);
    const id = headers.indexOf(config.id), score = headers.indexOf(config.score), time = headers.indexOf(config.timestamp);
    if (id < 0 || score < 0 || time < 0) throw new Error('Check the configured column headings.');
    const rows = values.filter(r => String(r[id]).trim()).map(r => [String(r[id]).trim(), r[score], r[time] instanceof Date ? r[time].toISOString() : String(r[time])]);
    // Deliberately exports only these three fields; excludes form answers and email addresses.
    return ContentService.createTextOutput(JSON.stringify({headers:['agent_id','score','timestamp'],rows})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error:error.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
