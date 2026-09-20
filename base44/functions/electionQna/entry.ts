import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Narrow app-specific AI op: answers questions about past election results from
// the game's ElectionRecord data. Keeps InvokeLLM behind the server so
// integration credits can't be consumed directly from the client.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const question = String(body?.question || '').slice(0, 300);
    if (!question) return Response.json({ error: 'Question is required' }, { status: 400 });

    const records = await base44.entities.ElectionRecord.list('-election_date', 500);
    const context = records.map(r =>
      `${r.position_title} - ${r.constituency}${r.seat_type && r.seat_type !== 'general' ? ` (${r.seat_type})` : ''}: ${r.winner_name} (${r.winner_party}), Votes: ${r.winner_votes}, Runner-up: ${r.runner_up_name || 'N/A'}, Date: ${r.election_date}`
    ).join('\n');

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI assistant for the Bharat Union political simulation game. Answer the following question using ONLY the election data below. If the data doesn't contain the answer, say "No data available for this query." Always respond as if this is real in-game data. Be concise.\n\nElection Records:\n${context}\n\nQuestion: ${question}`,
      response_json_schema: { type: 'object', properties: { answer: { type: 'string' } } },
    });
    return Response.json({ answer: response?.answer || 'No data available for this query.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}