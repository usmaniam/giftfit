export const config = {
  demoMode: (process.env.DEMO_MODE ?? 'true') !== 'false',
  youcamKey: process.env.YOUCAM_API_KEY ?? '',
  youcamBase: process.env.YOUCAM_BASE_URL ?? 'https://yce-api-01.makeupar.com',
  // Adapters whose request bodies are not yet verified against YouCam docs stay off unless this is true.
  youcamExperimental: process.env.YOUCAM_EXPERIMENTAL === 'true',
  demoDelayMs: Number(process.env.DEMO_DELAY_MS ?? 2500),
  maxConcurrentRenders: 3,
  reportEmail: process.env.REPORT_EMAIL ?? '',
  geminiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GIFT_AGENT_MODEL ?? '',
  geminiBaseUrl: process.env.GEMINI_BASE_URL ?? '', // test override only (mock server)
  llmTimeoutMs: 8000,
  agentEnabled: (process.env.AGENT_ENABLED ?? 'true') !== 'false',
  storageDir: process.env.STORAGE_DIR ?? './storage',
  // 'supabase' when explicitly chosen, or when Supabase credentials are present; otherwise local disk.
  storageDriver: (process.env.STORAGE_DRIVER ?? (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'local')) as 'local' | 'supabase',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  storageBucket: process.env.SUPABASE_BUCKET ?? 'giftfit',
  cronSecret: process.env.CRON_SECRET ?? '',
  appUrl: process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  maxRendersPerSession: 8,
};
