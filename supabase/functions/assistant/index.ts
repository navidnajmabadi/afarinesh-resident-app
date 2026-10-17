// Edge Function: assistant. Receives a resident's chat message, asks OpenAI what to do, and returns the reply.
// The OpenAI key (OPENAI_API_KEY) lives in Supabase secrets, never in the app.
// Optional secrets: OPENAI_MODEL (default gpt-4.1-mini, falls back to gpt-4o-mini) and OPENAI_BASE_URL (default https://api.openai.com/v1).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './core.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class AiError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }

async function callOpenAI(key: string, base: string, models: string[], payload: { messages: unknown[]; tools: unknown[] }) {
  for (let i = 0; i < models.length; i++) {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: models[i], messages: payload.messages, tools: payload.tools, tool_choice: 'auto', max_completion_tokens: 900 }),
    });
    if (r.ok) return await r.json();
    const text = await r.text();
    if (r.status === 401) throw new AiError('openai_key_invalid');
    if (r.status === 429) throw new AiError(/quota|billing/i.test(text) ? 'openai_quota' : 'openai_busy');
    if ((r.status === 404 || r.status === 400) && /model/i.test(text) && i < models.length - 1) continue;   // try the next model
    console.error('OpenAI error', r.status, text.slice(0, 300));
    throw new AiError('ai_error');
  }
  throw new AiError('ai_error');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '';
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json({ error: 'not_configured' });

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  const base = (Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const wanted = Deno.env.get('OPENAI_MODEL');
  const models = [...(wanted ? [wanted] : []), 'gpt-4.1-mini', 'gpt-4o-mini'].filter((m, i, a) => a.indexOf(m) === i);
  try {
    const out = await handle({ sb, body, openai: (p: { messages: unknown[]; tools: unknown[] }) => callOpenAI(key, base, models, p) });
    return json(out);
  } catch (e) {
    console.error('assistant failed', e);
    return json({ error: 'server_error' });
  }
});
