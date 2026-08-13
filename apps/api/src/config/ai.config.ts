import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  provider: process.env.AI_PROVIDER || 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  // Future providers (not implemented in MVP):
  // openaiApiKey: process.env.OPENAI_API_KEY,
  // openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  // anthropicApiKey: process.env.ANTHROPIC_API_KEY,
}));
