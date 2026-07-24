# MMS Connect

MMS Connect is the client and authorized-representative portal for Medicaid Made Simple LLC.

## Current release

- Public landing page
- Email/password registration and sign-in
- Email verification
- Password recovery and reset
- Client and Authorized Representative account types
- Protected dashboard shell
- NCDHHS policy-guided intake pathway preview
- Staging-only fictional intake through resources, living arrangement, insurance, authorized representative, review, submission, and administrator queue
- Staff-only fictional intake testing with protected save and resume
- Production-safe account and program-guidance mode with official ePASS, NCDHHS form, and county DSS handoffs
- Production Referral Lite for anonymous organization-to-organization routing and status tracking
- Versioned Terms of Use and Privacy Notice acceptance for new accounts
- Fictional Household & Residency and Income & Employment workflows
- Applications, Documents, Messages, Community Referrals, Profile, and Settings navigation
- Confidential-data collection intentionally disabled

## Authentication setup

This release uses hosted Supabase Auth. Do not enable registration until these steps are complete.

1. Use the hosted MMS Connect Supabase project at `https://abquqllondntucfoosdv.supabase.co`.
2. In the Supabase SQL Editor, run `supabase/schema.sql`.
3. In Authentication URL Configuration:
   - Set the production Site URL to the Vercel production domain.
   - Add `https://YOUR-DOMAIN/app.html` to Redirect URLs.
   - Keep email confirmation enabled.
4. In Vercel Project Settings → Environment Variables, add:
   - `SUPABASE_URL` = `https://abquqllondntucfoosdv.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` as a **Sensitive** server-only value
5. Apply the variables to Production and Preview environments, then redeploy.
6. Test registration, verification, sign-in, sign-out, password reset, and unauthorized dashboard access using test accounts only.

The publishable key is intended for browser use and is returned by `api/config.js`. The service-role key is used only by protected Vercel administrator functions. Never add its real value to this repository, browser code, logs, or a public environment variable.

## Protected-data boundary

The production account portal is approved only for account identity, organization verification, program guidance, official application handoffs, and Referral Lite. Referral Lite stores only the sending and receiving organizations, broad service category, urgency, consent-confirmation time, random reference, status, timestamps, and actors. It has no client-name, contact, identifier, summary, note, intake-link, or document fields. Client-identifying coordination must occur outside MMS Connect through an approved secure channel.

Production does not collect Social Security numbers, medical information, financial records, Medicaid applications, or documents. Those features remain disabled until the dedicated protected-data environment, vendor agreements, access policies, audit controls, retention procedures, and security review are complete.

The program-to-question mapping is documented in [docs/NCDHHS_POLICY_MAP.md](docs/NCDHHS_POLICY_MAP.md). The intake preview uses official NCDHHS manuals and current 2026 limit-table sources without making an eligibility determination or saving confidential answers.

The first applicant-information screen is restricted to fictional staging tests by active MMS staff and administrators. Its database and row-level access boundary are documented in [docs/INTAKE_SECURITY.md](docs/INTAKE_SECURITY.md). It must not be used for real applicant information.

Supabase documents that organizations handling PHI must have a signed Business Associate Agreement and the HIPAA add-on enabled. Compliance is a shared responsibility and is not created by using a particular software service alone.

## Staff access

Public registration can create only `client` or `authorized_representative` profiles. Staff and administrator roles must be assigned through a trusted server-side administrative process. Authorization must not rely on editable user metadata.
