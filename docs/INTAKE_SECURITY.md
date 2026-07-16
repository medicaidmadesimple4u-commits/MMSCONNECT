# Intake security release boundary

The first protected-intake build is a staging-only security test. It is not approved for real applicant information.

## Current controls

- Every application is permanently marked `environment = staging` and `test_mode = true`.
- Only active MMS staff or administrators can create a test application.
- A user can save applicant information only for a draft test application they own.
- Administrators may read test applications for oversight.
- Staff may read an application only after an active assignment exists.
- Application, applicant, assignment, and audit tables all use row-level security.
- Browser users cannot update application ownership, status, policy version, environment, or test-mode fields.
- Applicant saves and application creation create audit records without copying applicant details into the audit log.
- Residency, household-member, and income-source changes create audit events without copying addresses, names, or financial amounts into the audit log.
- Household, residency, and income tables are server-only; browser database roles receive no direct table privileges.
- The interface requires confirmation that all entered information is fictional.

## Not enabled

- Real applicant intake
- Public client data entry
- Application submission or eligibility decisions
- Staff assignment controls
- Resource, medical, citizenship, immigration, insurance, or long-term-care detail screens
- Document uploads
- Production access to the intake interface

Before real intake is enabled, MMS must approve its privacy and security policies, vendor agreements, access review process, retention schedule, incident response plan, staff training, and production data-handling controls.
