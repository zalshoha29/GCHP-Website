/* =========================================
   GCHP Portal — FormResponseView (shared)
   Renders a D1 or D2 submission as question/answer
   sections. Executive detail views use this.
   ========================================= */

function frvAnswer(v) {
  if (v === null || v === undefined || v === '') return '<span class="no-answer">Not provided</span>';
  return esc(v);
}

// Render an array of { title, fields:[{question, answer}], internal? } sections.
function renderFormResponse(sections) {
  return sections.map(section => {
    const rows = section.fields.map(f =>
      `<div class="frv-row"><div class="frv-q">${esc(f.question)}</div><div class="frv-a">${frvAnswer(f.answer)}</div></div>`
    ).join('');
    if (section.internal) {
      return `<div class="frv-internal"><div class="frv-internal-label">Internal Fields — Not Shown to Ambassador</div>${rows}</div>`;
    }
    return `<div class="frv-section"><div class="frv-title">${esc(section.title)}</div>${rows}</div>`;
  }).join('');
}

function fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-GB') : null; }

// ---- D1 section builder (event row joined with profiles) ----
function buildD1Sections(event) {
  const p = event.profiles || {};
  return [
    { title: 'Section A — Ambassador & Campus', fields: [
      { question: 'Ambassador Name', answer: p.display_name },
      { question: 'Ambassador ID', answer: p.ambassador_id },
      { question: 'University', answer: p.university },
      { question: 'Phone Number', answer: p.phone },
      { question: 'Campaign Cycle', answer: event.campaign_cycle },
    ]},
    { title: 'Section B — Event Details', fields: [
      { question: 'Event Name', answer: event.event_name },
      { question: 'Activity Type', answer: event.activity_type },
      { question: 'Event Date', answer: event.event_date },
      { question: 'Location', answer: event.event_location },
      { question: 'Format', answer: event.event_format },
      { question: 'Event Description', answer: event.description },
      { question: 'Expected Attendance', answer: event.expected_attendance },
      { question: 'Number of Volunteers', answer: event.volunteer_count },
    ]},
    { title: 'Section C — Fundraising Target', fields: [
      { question: 'Fundraising Target ($)', answer: event.fundraising_target },
    ]},
    { title: 'Section D — Budget & Promotion', fields: [
      { question: 'Are you expecting any expenses?', answer: event.has_expenses ? 'Yes' : 'No' },
      ...(event.has_expenses ? [
        { question: 'Expense 1 — Description', answer: event.expense_1_description },
        { question: 'Expense 1 — Cost ($)', answer: event.expense_1_cost },
        { question: 'Expense 2 — Description', answer: event.expense_2_description },
        { question: 'Expense 2 — Cost ($)', answer: event.expense_2_cost },
        { question: 'Expense 3 — Description', answer: event.expense_3_description },
        { question: 'Expense 3 — Cost ($)', answer: event.expense_3_cost },
        { question: 'Total Expected Expenses ($)', answer: event.total_expenses },
      ] : []),
      { question: 'Promotion Channels', answer: Array.isArray(event.promotion_channels) ? event.promotion_channels.join(', ') : event.promotion_channels },
    ]},
    { title: 'Section E — Confirmation & Support', fields: [
      { question: 'Support Requests', answer: event.support_requests },
      { question: 'Additional Comments', answer: event.comments },
      { question: 'Date Submitted', answer: fmtDateTime(event.date_pre_form_received) },
      { question: 'Resubmission', answer: event.is_resubmission ? `Yes (resubmission #${event.resubmission_count})` : 'No' },
    ]},
    { internal: true, fields: [
      { question: 'Event ID', answer: event.event_id },
      { question: 'Current Status', answer: event.status },
      { question: 'Scenario', answer: event.scenario },
      { question: 'Fundraising Code', answer: event.fundraising_code },
      { question: 'Fundraising Link', answer: event.fundraising_link },
      { question: 'Date Approved', answer: fmtDateTime(event.date_approved) },
      { question: 'Date Link Sent', answer: fmtDateTime(event.date_link_sent) },
      { question: 'Denial Reason', answer: event.denial_reason },
      { question: 'Duplicate Flagged', answer: event.is_duplicate_flagged ? 'Yes — review before approving' : 'No' },
    ]},
  ];
}

// ---- D2 section builder (post_report joined with event+profile) ----
// Reflects the agreed edits: donations_submitted; no cash/expenses/thank-you.
function buildD2Sections(report) {
  const event = report.events || {};
  const p = event.profiles || {};
  return [
    { title: 'Section A — Reference', fields: [
      { question: 'Ambassador Name', answer: p.display_name },
      { question: 'Ambassador ID', answer: p.ambassador_id },
      { question: 'University', answer: p.university },
      { question: 'Event', answer: `${event.event_name || ''} (${event.event_id || ''})` },
      { question: 'Event Date', answer: event.event_date },
    ]},
    { title: 'Section B — Results', fields: [
      { question: 'Total Amount Raised ($)', answer: report.total_raised },
      { question: 'Have you submitted the donations?', answer: report.donations_submitted ? 'Yes' : 'No' },
      { question: 'Actual Attendance', answer: report.attendance },
      { question: 'Did you meet your target?', answer: report.target_met },
    ]},
    { title: 'Section C — Reflections', fields: [
      { question: 'What went well?', answer: report.what_went_well },
      { question: 'What would you change?', answer: report.what_to_change },
      { question: 'Advice for other ambassadors?', answer: report.advice_for_others },
    ]},
    { title: 'Section D — Follow-Up', fields: [
      { question: 'Would you run another event?', answer: report.run_another_event ? 'Yes' : 'No' },
    ]},
    { title: 'Section E — Photos & Feedback', fields: [
      { question: 'Event Photo', answer: report.photo_url ? 'Uploaded — view via download link' : 'Not uploaded' },
      { question: 'Permission to use photo?', answer: report.photo_permission ? 'Yes' : 'No' },
      { question: 'Experience rating', answer: report.experience_rating ? `${report.experience_rating} / 5` : null },
      { question: 'Open feedback', answer: report.open_feedback },
      { question: 'Date submitted', answer: fmtDateTime(report.date_submitted) },
    ]},
  ];
}
