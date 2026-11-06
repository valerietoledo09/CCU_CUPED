/** Run createCupedTeacherFeedback once in your own Google Apps Script project.
 * Creates a Google Form and linked response spreadsheet. Sends no emails.
 * Re-running this same project reuses its saved Form and Sheet IDs.
 */
function createCupedTeacherFeedback() {
  const props = PropertiesService.getScriptProperties();
  let form;
  const savedForm = props.getProperty('CUPED_FEEDBACK_FORM_ID');
  if (savedForm) {
    form = FormApp.openById(savedForm);
  } else {
    form = FormApp.create('CUPED Teacher Presentation Feedback');
    props.setProperty('CUPED_FEEDBACK_FORM_ID', form.getId());
    form.setDescription('Thank you for welcoming our CCU CUPED interns. This optional survey takes about two minutes and helps us improve. You may skip any question. Name and email are optional. Responses are for the project lead; please do not include student personal information.');
    form.setCollectEmail(false);
    form.setLimitOneResponsePerUser(false);
    form.setPublishingSummary(false);
    form.setShowLinkToRespondAgain(false);
    form.setConfirmationMessage('Thank you! Your feedback has been recorded and will help our interns improve their next presentation.');
  }
  // Track each item so an interrupted setup can be resumed without duplicates.
  const existing = {};
  form.getItems().forEach(function(item) { existing[item.getTitle()] = true; });
  function once(title, add) {
    if (!existing[title]) { add(); existing[title] = true; }
  }
  once('Teacher name (optional)', function() {
    form.addTextItem().setTitle('Teacher name (optional)').setRequired(false);
  });
  once('Presentation date (optional)', function() {
    form.addDateItem().setTitle('Presentation date (optional)').setIncludesYear(true).setRequired(false);
  });
  once('Email for a reply (optional)', function() {
    form.addTextItem().setTitle('Email for a reply (optional)').setHelpText('Only if you would like a response from the project lead.').setValidation(FormApp.createTextValidation().requireTextIsEmail().build()).setRequired(false);
  });
  const ratings = [
    '1 - Needs significant improvement',
    '2 - Needs some improvement',
    '3 - Satisfactory',
    '4 - Very good',
    '5 - Excellent',
    'Not observed / not applicable'
  ];
  [
    'How clearly did the interns explain the information?',
    'How well did the interns engage your students?',
    'How prepared and organized were the interns?',
    'How professional and respectful were the interns?',
    'How appropriate were the pace and use of class time?',
    'How useful and relevant was the presentation for your students?'
  ].forEach(function(question) {
    once(question, function() {
      form.addMultipleChoiceItem().setTitle(question).setChoiceValues(ratings).setRequired(false);
    });
  });
  once('What worked well?', function() {
    form.addParagraphTextItem().setTitle('What worked well?').setRequired(false);
  });
  once('What is one thing we should improve?', function() {
    form.addParagraphTextItem().setTitle('What is one thing we should improve?').setRequired(false);
  });
  once('Would you be open to a future classroom visit?', function() {
    form.addMultipleChoiceItem().setTitle('Would you be open to a future classroom visit?').setChoiceValues(['Yes', 'Maybe', 'Not right now']).setRequired(false);
  });
  let sheet;
  const savedSheet = props.getProperty('CUPED_FEEDBACK_SHEET_ID');
  if (savedSheet) {
    sheet = SpreadsheetApp.openById(savedSheet);
  } else {
    sheet = SpreadsheetApp.create('CUPED Teacher Feedback - Responses');
    props.setProperty('CUPED_FEEDBACK_SHEET_ID', sheet.getId());
  }
  if (form.getDestinationId() !== sheet.getId()) {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  }
  if (typeof form.setPublished === 'function') {
    form.setPublished(true);
  }
  form.setAcceptingResponses(true);
  Logger.log('TEACHER SURVEY LINK: ' + form.getPublishedUrl());
  Logger.log('OWNER FORM EDITOR: ' + form.getEditUrl());
  Logger.log('PRIVATE RESPONSE SHEET: ' + sheet.getUrl());
  Logger.log('Before sharing: open the teacher link in a private window and check Publish/respondent access. District account policies may require a settings change. Never share the editor or response-sheet links with respondents.');
}
