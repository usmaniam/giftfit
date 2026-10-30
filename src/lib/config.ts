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
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  maxRendersPerSession: 8,
};
