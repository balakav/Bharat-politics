import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getStateById, resolveState, assemblyConstituencyNames, lokSabhaConstituencyNames } from '../../shared/bharatConstituencies.ts';

// Party president bulk candidate import: parses an uploaded Excel/CSV
// (State Name | Constituency Number | Candidate Name | Party Name) and registers
// every candidate for an election in one shot. The AI file extraction runs
// server-side, so integration credits can't be consumed from the client.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, election_id, party_id } = body || {};
    if (!file_url || !election_id || !party_id) {
      return Response.json({ error: 'file_url, election_id and party_id are required' }, { status: 400 });
    }

    const election = await base44.entities.Election.get(election_id);
    if (!election) return Response.json({ error: 'Election not found' }, { status: 404 });
    const party = await base44.entities.PoliticalParty.get(party_id);
    if (!party) return Response.json({ error: 'Party not found' }, { status: 404 });

    // Only the party president may file the party's candidate list.
    const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: user.id });
    const profile = profiles[0];
    if (!profile || party.president_id !== profile.player_id) {
      return Response.json({ error: 'Only the party president can upload the candidate list' }, { status: 403 });
    }

    const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          state_name: { type: 'string' },
          constituency_number: { type: 'string' },
          constituency_name: { type: 'string' },
          candidate_name: { type: 'string' },
          party_name: { type: 'string' },
        },
      },
    });
    if (extraction?.status !== 'success' || !Array.isArray(extraction.output)) {
      return Response.json({ error: extraction?.details || 'Could not read the file' }, { status: 400 });
    }

    // Constituency name lists for this election's scope.
    let stateList = null;
    if (election.election_type === 'vidhan_sabha' && election.state_id) {
      const stateObj = getStateById(election.state_id);
      stateList = stateObj ? assemblyConstituencyNames(stateObj) : [];
    }

    // Skip constituencies where this party already has a candidate.
    const existing = await base44.entities.Candidature.filter({ election_id: election.id, party_id: party.id });
    const taken = new Set(existing.map(c => c.constituency));

    const isNational = election.election_type === 'national';
    const toCreate = [];
    const skippedReasons = [];
    // Excel lists often write the state name only on the first row of a group
    // (merged cells / drag-down). Forward-fill the last seen state so every row
    // resolves — critical for national (all-state) candidate lists.
    let lastStateName = '';
    for (const row of extraction.output) {
      const name = String(row?.candidate_name || '').trim().slice(0, 80);
      const rawState = String(row?.state_name || '').trim();
      if (rawState) lastStateName = rawState;
      const stateName = rawState || lastStateName;
      const num = parseInt(String(row?.constituency_number ?? '').trim(), 10);
      const cName = String(row?.constituency_name || '').trim();
      let constituency = null;
      if (isNational) {
        const st = resolveState(stateName);
        const list = st ? lokSabhaConstituencyNames(st) : [];
        if (num >= 1 && num <= list.length) constituency = list[num - 1];
        else if (cName) constituency = cName; // fall back to an explicit constituency name
      } else if (stateList) {
        if (num >= 1 && num <= stateList.length) constituency = stateList[num - 1];
        else if (cName) constituency = cName;
      }
      if (!name) { skippedReasons.push('Row without a candidate name'); continue; }
      if (!constituency) { skippedReasons.push(`${name}: could not resolve constituency (state: "${stateName || '—'}"${Number.isFinite(num) ? `, #${num}` : ''})`); continue; }
      if (taken.has(constituency)) { skippedReasons.push(`${constituency}: this party already has a candidate there`); continue; }
      taken.add(constituency); // dedupe within the file too
      const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      toCreate.push({
        election_id: election.id,
        election_type: election.election_type,
        player_id: 'AI_' + suffix,
        player_name: name,
        party_id: party.id,
        party_name: party.name,
        party_short: party.short_name || '',
        constituency,
        seat_type: 'general',
        manifesto: 'Nominated by the party via bulk candidate list.',
        campaign_budget: 0,
        registration_number: 'BR-' + Date.now().toString(36).toUpperCase() + suffix,
        ticket_status: 'approved',
        ticket_number: 'TICKET-' + suffix,
      });
    }

    for (let i = 0; i < toCreate.length; i += 400) {
      await base44.entities.Candidature.bulkCreate(toCreate.slice(i, i + 400));
    }
    return Response.json({
      created: toCreate.length,
      skipped: skippedReasons.length,
      skipped_reasons: skippedReasons.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}