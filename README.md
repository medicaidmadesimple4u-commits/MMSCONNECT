# MMS Connect

MMS Connect is the client and authorized-representative portal for Medicaid Made Simple LLC.

## Current release

- Public landing page
- Email/password registration and sign-in
- Email verification
- Password recovery and reset
- Client and Authorized Representative account types
- Protected dashboard shell
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
5. Apply the variables to Production and Preview environments, then redeploy.
6. Test registration, verification, sign-in, sign-out, password reset, and unauthorized dashboard access using test accounts only.

The publishable key is intended for browser use and is returned by `api/config.js`. Never add the Supabase service-role key to this repository, browser code, or a public environment variable.

## Protected-data boundary

This authentication release is not approved to collect Social Security numbers, medical information, financial records, Medicaid applications, or documents. Those features remain disabled until the production environment, vendor agreements, access policies, audit controls, retention procedures, and security review are complete.

Supabase documents that organizations handling PHI must have a signed Business Associate Agreement and the HIPAA add-on enabled. Compliance is a shared responsibility and is not created by using a particular software service alone.

## Staff access

Public registration can create only `client` or `authorized_representative` profiles. Staff and administrator roles must be assigned through a trusted server-side administrative process. Authorization must not rely on editable user metadata.
