const step = (actor, action, owner, output, screen) => ({ actor, action, owner, output, screen });

export const demoCaseWorkflows = [
  {
    id: 'WF-01', title: 'Referral intake and triage', artifact: 'Referral and triage record',
    summary: 'Capture, acknowledge, deduplicate, triage, assign, contact, and convert the referral.',
    statuses: 'Draft → Submitted → Triage → Contacted → Converted',
    exception: 'A possible duplicate is held for human review without exposing another case.',
    steps: [
      step('Referral source', 'Create referral, enter minimum data, and confirm authority', 'System', 'Submitted referral with source, urgency, county, program hypothesis, and consent', 'Referral form'),
      step('System', 'Validate, assign a safe identifier, check duplicates, and acknowledge receipt', 'MMS specialist', 'Acknowledgement and duplicate candidates', 'Duplicate review'),
      step('MMS specialist', 'Review triage queue and choose disposition and owner', 'MMS manager', 'Triage event and accountable assignment', 'Referral triage'),
      step('MMS specialist', 'Record first contact attempt and next contact action', 'Family/representative', 'Contact event and follow-up task', 'Referral detail'),
      step('MMS specialist', 'Confirm client match and convert referral to a case', 'System', 'Client, case, and conversion timeline event', 'Conversion review')
    ]
  },
  {
    id: 'WF-02', title: 'Facility Excel bulk import', artifact: 'Bulk-import reconciliation',
    audience: 'facility',
    summary: 'Validate a controlled facility spreadsheet and create referrals without silent partial imports.',
    statuses: 'Uploaded → Scanning → Validating → Review → Imported',
    exception: 'A wrong template, unsafe file, duplicate upload, or prohibited column is held with an explicit reason.',
    steps: [
      step('Facility user', 'Download the approved template and enter fictional resident rows', 'Facility administrator', 'Versioned template and local synthetic rows', 'Template download'),
      step('Facility user', 'Upload the spreadsheet for quarantine and malware screening', 'System worker', 'Import job, file hash, and scan state', 'Bulk upload'),
      step('System worker', 'Parse, normalize, and validate every row', 'Facility user', 'Row-level errors, duplicate candidates, and authorization flags', 'Validation summary'),
      step('Facility user and MMS specialist', 'Correct rows and disposition duplicates or possible cases', 'System', 'Correction and match history', 'Row correction'),
      step('Facility user', 'Confirm authority, create ready referrals, and reconcile every row', 'MMS specialist', 'Idempotent referral IDs and reconciliation report', 'Import reconciliation')
    ]
  },
  {
    id: 'WF-03', title: 'Client onboarding, identity and authorization', artifact: 'Participant authorization',
    summary: 'Establish identity, relationship, authority, consent, preferences, and scoped access.',
    statuses: 'Invited → Identity verified → Authority approved → Access active',
    exception: 'Missing or expired authority leaves the participant upload-only or offline with documented limits.',
    steps: [
      step('MMS specialist', 'Invite the participant through a safe, expiring link', 'Participant', 'Invitation and delivery event', 'Participant invitation'),
      step('Participant', 'Complete identity verification and declare relationship', 'MMS specialist', 'Identity status and client relationship', 'Identity verification'),
      step('Participant', 'Provide authority evidence for secure review', 'MMS reviewer', 'Authority evidence version', 'Authority upload'),
      step('MMS reviewer', 'Approve scope and capture agreements, consent, and preferences', 'System', 'Versioned authorization, consent, and communication preferences', 'Authority review'),
      step('System', 'Grant least-privilege case access and record the decision', 'Participant', 'Scoped membership and access audit', 'Portal home')
    ]
  },
  {
    id: 'WF-04', title: 'Program selection, smart intake and personalized checklist', artifact: 'Published personalized checklist',
    summary: 'Generate an explainable checklist from versioned answers with human review and overrides.',
    statuses: 'Intake reviewed → Checklist generated → Staff review → Published',
    exception: 'Uncertain programs or conflicting answers are flagged for clarification instead of guessed.',
    steps: [
      step('MMS specialist', 'Select the effective Medicaid program pathway', 'Client/representative', 'Program history and effective policy version', 'Program selection'),
      step('Client/representative', 'Complete smart intake and review all personalization answers', 'MMS specialist', 'Versioned intake answers and completeness state', 'Smart intake'),
      step('MMS specialist', 'Confirm the program and run deterministic checklist rules', 'Rules service', 'Immutable generation snapshot', 'Checklist preview'),
      step('MMS specialist', 'Review explanations and record any override with a reason', 'MMS reviewer', 'Checklist requirements and override history', 'Override history'),
      step('MMS specialist', 'Publish the checklist and create secure requests and reminders', 'Client/representative', 'Published checklist, document requests, tasks, and notice', 'Personalized checklist')
    ]
  },
  {
    id: 'WF-05', title: 'Secure document collection and review', artifact: 'Reviewed document set',
    summary: 'Request, securely collect, scan, version, classify, review, and resolve evidence.',
    statuses: 'Requested → Received → Under review → Accepted',
    exception: 'Malware, wrong-case, illegible, partial, expired, or superseded evidence is safely held and remediated.',
    steps: [
      step('MMS specialist', 'Create minimum-necessary document requests with recipients and due dates', 'Recipient', 'Document requests and safe prompts', 'Request composer'),
      step('Recipient', 'Use the fictional secure upload to provide evidence', 'Document worker', 'Quarantined synthetic upload and scan state', 'Secure upload'),
      step('Document worker', 'Promote the clean file as an immutable version and classify it', 'System', 'Document record, version, source, hash, and classification', 'Upload confirmation'),
      step('System', 'Link exact evidence versions and recalculate gaps', 'MMS specialist', 'Requirement-evidence links and missing-range flags', 'Checklist'),
      step('MMS specialist', 'Review each item and accept, reject, or request clarification', 'Recipient', 'Review outcome, status history, and stopped reminders', 'Document review')
    ]
  },
  {
    id: 'WF-06', title: 'Application preparation, quality review and submission', artifact: 'Approved submission packet',
    summary: 'Build a controlled packet, pass readiness and quality gates, confirm authority, and record submission proof.',
    statuses: 'Preparing → Readiness passed → Quality review → Approved → Confirmed',
    exception: 'Readiness failures create exact remediation work; changed packets require a new approved version.',
    steps: [
      step('MMS specialist', 'Complete versioned forms and calculations without an eligibility guarantee', 'System', 'Application forms with source and provenance', 'Forms'),
      step('MMS specialist', 'Run readiness review and resolve mandatory failures', 'MMS specialist', 'Readiness results, tasks, and requirements', 'Readiness review'),
      step('MMS specialist', 'Build a packet from exact accepted document versions', 'MMS reviewer', 'Frozen packet draft and review assignment', 'Packet builder'),
      step('MMS reviewer', 'Complete independent quality review and approve or return', 'MMS specialist', 'Reviewer checklist, issues, identity, and timestamp', 'Quality review'),
      step('MMS specialist', 'Confirm submission authority and final consent', 'MMS reviewer', 'Authorization evidence and immutable packet version', 'Authorization gate'),
      step('MMS specialist', 'Record county, channel, date, confirmation identifier, and proof', 'System', 'Submission event, confirmation, notifications, and timeliness profile', 'Submission confirmation')
    ]
  },
  {
    id: 'WF-07', title: 'DSS information request and response', artifact: 'Confirmed DSS response',
    summary: 'Turn an exact DSS request into deadline-aware requirements and a controlled response packet.',
    statuses: 'Received → Items open → Collecting → Approved → Confirmed',
    exception: 'Unclear or impossible requests are escalated with the exact wording and accountable action.',
    steps: [
      step('MMS specialist', 'Upload and classify the fictional DSS information request', 'Document worker', 'Scanned notice linked to the case', 'Agency request upload'),
      step('MMS specialist', 'Record received date, due date, source, agency, and exact wording', 'System', 'Agency request and timeliness dates', 'Request detail'),
      step('MMS specialist', 'Break the request into owned items and collect exact evidence', 'Recipients', 'Request items, tasks, and secure document requests', 'Response checklist'),
      step('MMS specialist', 'Build a requested-only response packet', 'MMS reviewer', 'Response packet and quality review', 'Response review'),
      step('MMS specialist', 'Record response submission, proof, and confirmation', 'System', 'Agency response, closed tasks, risk recalculation, and timeline event', 'Response confirmation')
    ]
  },
  {
    id: 'WF-08', title: 'DSS timeliness monitoring and escalation', artifact: 'Timeliness profile and disposition',
    summary: 'Calculate versioned official or internal targets, display risk, attribute delay, and document escalation.',
    statuses: 'Profile current → Risk monitored → Escalated → Timely/untimely',
    exception: 'Missing rules or source dates show Policy review required; the system never guesses an official standard.',
    steps: [
      step('System', 'Resolve the effective timeliness rule and holiday calendar', 'Configuration administrator', 'Versioned profile, rule label, source, and calendar', 'Timeliness profile'),
      step('System', 'Calculate and preserve checkpoints, deadlines, and workday adjustments', 'MMS specialist', 'Calculated dates and adjustment reasons', 'Profile detail'),
      step('System scheduler', 'Update daily risk and create threshold reminders', 'MMS specialist/manager', 'Risk snapshots, tasks, and notifications', 'DSS timeliness dashboard'),
      step('MMS specialist', 'Record delay periods, attribution, and DSS request dates', 'System', 'Delay attribution and linked request', 'Delay editor'),
      step('MMS manager', 'Complete escalation and record the final timely disposition', 'Reporting', 'Escalation outcome and versioned metric', 'Escalation detail')
    ]
  },
  {
    id: 'WF-09', title: 'DSS decision, denial, appeal and reapplication', artifact: 'Confirmed DSS decision',
    summary: 'Preserve the official notice, confirm the determination, and assign accountable follow-up.',
    statuses: 'Notice received → Decision confirmed → Follow-up → Final outcome',
    exception: 'The source notice controls; discrepancies and appeals remain linked without rewriting history.',
    steps: [
      step('MMS specialist', 'Upload and classify the fictional DSS decision notice', 'Document worker', 'Exact decision-notice version linked to the application', 'Notice upload'),
      step('MMS specialist', 'Enter determination, dates, county, program, and processing-time basis', 'MMS reviewer', 'Decision draft and calculated processing time', 'Decision entry'),
      step('MMS specialist', 'Preserve the exact DSS reason and select a controlled denial category if needed', 'MMS reviewer', 'Decision values and denial record', 'Denial categorization'),
      step('MMS reviewer', 'Verify source, dates, category, and notice and confirm the decision', 'System', 'Confirmed decision and timeliness disposition', 'Decision review'),
      step('MMS specialist', 'Assign and record appeal, reapplication, follow-up, and resulting outcome', 'Client/representative', 'Follow-up tasks, lineage, placement, and final outcome', 'Final outcome')
    ]
  },
  {
    id: 'WF-10', title: 'Placement, service connection and case closure', artifact: 'Verified placement and closure',
    summary: 'Confirm service or placement, schedule follow-up and renewal, and close responsibly.',
    statuses: 'Outcome planned → Started → Verified → Follow-up → Closed',
    exception: 'Waitlists, stopped services, client decline, and open appeals remain visible instead of being treated as success.',
    steps: [
      step('MMS specialist', 'Select the final outcome and record provider, facility, and dates', 'Facility/agency', 'Placement or service outcome', 'Final outcome'),
      step('Facility/agency', 'Confirm the fictional placement or service start', 'MMS specialist', 'Authorized verification event', 'Placement record'),
      step('System', 'Notify only authorized stakeholders through safe prompts', 'Family/facility', 'Scoped notification deliveries', 'Notification center'),
      step('MMS specialist', 'Schedule satisfaction follow-up, renewal, and remaining responsibilities', 'System', 'Tasks, renewal, and outcome measure', 'Renewal setup'),
      step('MMS reviewer', 'Complete closure review and close with a reason', 'System', 'Closure checklist, retention state, history, and reopen path', 'Case closure')
    ]
  },
  {
    id: 'WF-11', title: 'Community needs and closed-loop referrals', artifact: 'Completed community referral',
    summary: 'Match a consented need to a verified resource, send minimum data, and confirm the outcome.',
    statuses: 'Need identified → Sent → Acknowledged → Accepted → Completed',
    exception: 'No permission, stale capacity, excessive data requests, nonresponse, and urgent needs follow safe alternate paths.',
    steps: [
      step('MMS specialist', 'Record the need, urgency, barriers, preferences, and client priority', 'Client/representative', 'Client need and needs plan', 'Needs screening'),
      step('MMS specialist', 'Confirm purpose-specific referral permission and disclosure scope', 'Client/representative', 'Authorization and disclosure record', 'Consent review'),
      step('MMS specialist', 'Search and compare resources by service, geography, language, accessibility, cost, and capacity', 'System', 'Match candidates with freshness warnings', 'Resource comparison'),
      step('MMS specialist', 'Review minimum disclosure and send the referral securely', 'Receiving agency', 'Outbound referral and disclosure event', 'Disclosure review'),
      step('Receiving agency', 'Acknowledge, accept, and report service progress', 'MMS specialist', 'Agency response and follow-up state', 'Agency response'),
      step('MMS specialist/agency', 'Confirm completion or rematch while preserving the original referral', 'System', 'Referral outcome and resolved or unmet need', 'Outcome entry')
    ]
  },
  {
    id: 'WF-12', title: 'Renewals and redeterminations', artifact: 'Scheduled renewal cycle',
    summary: 'Open renewal work early, refresh authority and evidence, submit, record the result, and schedule the next cycle.',
    statuses: 'Scheduled → Active → Collecting → Submitted → Next cycle',
    exception: 'Expired authority, lost contact, changed living arrangements, or coverage loss create accountable alternate work.',
    steps: [
      step('System scheduler', 'Create and open renewal work at the configured lead date', 'MMS specialist', 'Renewal record, milestones, tasks, and safe notifications', 'Renewal queue'),
      step('MMS specialist', 'Refresh contact, authority, preferences, facility status, and program', 'Client/representative', 'Updated contact and authorization history', 'Renewal intake'),
      step('Rules service', 'Generate the current-cycle checklist without rewriting prior cycles', 'Client/representative', 'New checklist generation and updated evidence requests', 'Renewal checklist'),
      step('MMS specialist/reviewer', 'Review evidence, pass readiness, and record renewal submission', 'System', 'Approved renewal packet, proof, and timeliness profile', 'Submission record'),
      step('MMS specialist', 'Record requests and decision and schedule the next cycle', 'Stakeholders', 'Renewal outcome, next date, and scoped confirmation', 'Renewal outcome')
    ]
  },
  {
    id: 'WF-13', title: 'Secure messaging, notifications and appointments', artifact: 'Delivered message and completed appointment',
    summary: 'Coordinate authorized participants with secure content, safe prompts, delivery visibility, and appointment outcomes.',
    statuses: 'Draft → Sent → Delivered/read → Appointment completed',
    exception: 'Revoked access, wrong recipients, opt-outs, and provider outages fail safely with visible work.',
    steps: [
      step('MMS user', 'Open the case thread and select authorized participants', 'System', 'Access audit and scoped message draft', 'Message composer'),
      step('MMS user', 'Compose, attach controlled documents, and pass the sensitivity check', 'Notification worker', 'Persisted secure message and outbox event', 'Case thread'),
      step('Notification worker', 'Send a non-sensitive prompt and track delivery', 'Recipient', 'Queued, sent, delivered, or failed delivery state', 'Notification center'),
      step('Recipient', 'Reauthorize, read, and reply inside the secure thread', 'System', 'Read and reply events', 'Case thread'),
      step('MMS specialist', 'Schedule the appointment and record completed, no-show, rescheduled, or cancelled outcome', 'System', 'Appointment, reminders, outcome, and next task', 'Appointment detail')
    ]
  },
  {
    id: 'WF-14', title: 'Organization, access, configuration, audit and incident administration', artifact: 'Administrative and incident audit package',
    summary: 'Demonstrate controlled organization onboarding, least privilege, configuration history, audit review, and incident response.',
    statuses: 'Organization verified → Access reviewed → Config active → Incident closed',
    exception: 'Expired agreements, departed administrators, configuration defects, suspected breaches, and exports trigger controlled safeguards.',
    steps: [
      step('MMS administrator', 'Verify the fictional organization and its agreement status', 'Security/privacy reviewer', 'Organization, service area, contacts, and agreement evidence', 'Organization setup'),
      step('Partner administrator', 'Claim the invitation and assign default-deny roles', 'MMS administrator', 'Verified admin, memberships, roles, and invitation history', 'User management'),
      step('MMS administrator', 'Run an access review and revoke unnecessary access', 'Managers/partner admin', 'Access review items and certification history', 'Access review'),
      step('Configuration administrator', 'Draft, approve, and schedule a versioned configuration change', 'Reviewer', 'Effective-dated configuration version and impact preview', 'Configuration editor'),
      step('Auditor', 'Search protected reads, changes, exports, disclosures, and admin actions', 'Security/privacy reviewer', 'Purpose-bound audit query and synthetic evidence', 'Audit search'),
      step('Security lead', 'Triage, contain, investigate, remediate, and close a fictional incident', 'Auditor', 'Incident actions, evidence, lessons, risks, and closure verification', 'Incident closure')
    ]
  }
];

export function demoWorkflowById(id) {
  return demoCaseWorkflows.find(workflow => workflow.id === id) || null;
}

export const clientCaseWorkflows = demoCaseWorkflows.filter(workflow => workflow.audience !== 'facility');
export const facilityBulkImportWorkflow = demoCaseWorkflows.find(workflow => workflow.id === 'WF-02');

export function totalDemoSteps(workflows = demoCaseWorkflows) {
  return workflows.reduce((total, workflow) => total + workflow.steps.length, 0);
}
