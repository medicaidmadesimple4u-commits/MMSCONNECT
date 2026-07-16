export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const targetEnvironment = process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'development';
  const deploymentMode = targetEnvironment === 'production' ? 'production' : 'staging';

  response.status(200).json({
    configured: Boolean(supabaseUrl && supabasePublishableKey),
    supabaseUrl,
    supabasePublishableKey,
    deploymentMode,
    intakeMode: deploymentMode === 'production' ? 'official_guide' : 'fictional_test',
    referralMode: deploymentMode === 'production' && process.env.MMS_REFERRALS_ENABLED !== 'true' ? 'locked' : 'fictional_test'
  });
}
