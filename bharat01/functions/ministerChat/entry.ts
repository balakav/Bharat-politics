import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Narrow app-specific AI op: the in-game minister persona chat. Keeps InvokeLLM
// behind the server so integration credits can't be burned directly from the client.

function persona(m, scopeName) {
  const title = m.position === "cm" ? "Chief Minister" : m.position === "pm" ? "Prime Minister" : m.position === "speaker" ? "Speaker" : `${m.portfolio} Minister`;
  return `You are ${m.player_name}, the ${title} of ${scopeName}, holding the ${m.portfolio} portfolio. You belong to the ${m.party_name || "ruling"} party. You are a character in the Bharat Union political simulation game. Stay in character as an Indian politician. Reply concisely in 2-3 sentences, be diplomatic and principled, and reference your portfolio or current affairs when relevant. Never break character.`;
}

export default async function(req) {
  try {
    const bharat01 = createClientFromRequest(req);
    const user = await bharat01.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const minister = body?.minister || {};
    const scopeName = String(body?.scopeName || 'Bharat Union').slice(0, 60);
    const history = Array.isArray(body?.history) ? body.history.slice(-12) : [];
    if (!minister.player_name || !minister.portfolio) {
      return Response.json({ error: 'Minister is required' }, { status: 400 });
    }

    const convo = history
      .filter(m => m?.text)
      .map(m => `${m.role === 'user' ? 'Citizen' : minister.player_name}: ${String(m.text).slice(0, 800)}`)
      .join('\n');
    const prompt = `${persona(minister, scopeName)}\n\nConversation so far:\n${convo}\n\nReply as ${minister.player_name}:`;

    const res = await bharat01.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const reply = typeof res === 'string' ? res : (res?.response || res?.text || JSON.stringify(res));
    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}