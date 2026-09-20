import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Voting Agent — manages the voting process of the Legislative Assembly /
// Lok Sabha. When the Speaker closes bill voting, this agent tallies every
// vote (individual members + the party Whip's party-line directives, which
// override that party's individual votes), decides pass/fail with a simple
// majority, routes the bill to the Speaker's Office (passed) or rejects it,
// and announces the result on the house floor.

export default async function (req) {
  try {
    const bharat01 = createClientFromRequest(req);
    const user = await bharat01.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const action = body.action || 'tally';
    if (action !== 'tally') {
      return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }
    const billId = body.bill_id;
    if (!billId) {
      return Response.json({ error: 'bill_id is required' }, { status: 400 });
    }

    const bill = await bharat01.entities.Bill.get(billId);
    if (!bill) {
      return Response.json({ error: 'Bill not found' }, { status: 404 });
    }
    if (bill.status !== 'assembly_vote') {
      return Response.json({ error: 'Voting is not open for this bill' }, { status: 400 });
    }

    // Only the Speaker of this house (or an admin) may close the vote.
    const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: user.id }).catch(() => []);
    const playerId = profiles[0] ? profiles[0].player_id : '';
    const speakers = await bharat01.entities.Minister.filter({ position: 'speaker', is_active: true }).catch(() => []);
    const isHouseSpeaker = speakers.some(m =>
      m.player_id && m.player_id === playerId &&
      (bill.scope === 'national' ? m.scope === 'national' : m.state_id === bill.state_id));
    if (user.role !== 'admin' && !isHouseSpeaker) {
      return Response.json({ error: 'Only the Speaker can close voting' }, { status: 403 });
    }

    // Tally the votes on this bill's channel.
    // Individual: "<playerId>|<vote>|<name>|<party>"
    // Whip line:  "PARTY|<party>|<vote>|<present member count>"
    const voteMsgs = await bharat01.entities.ChatMessage.filter({ channel: 'billvote_' + billId }).catch(() => []);
    const byTime = (a, b) => new Date(a.created_date) - new Date(b.created_date);
    const individual = {}; // playerId -> { vote, party }
    const partyLine = {}; // party -> { vote, count }
    for (const v of [...voteMsgs].sort(byTime)) {
      const parts = String(v.message || '').split('|');
      if (parts[0] === 'PARTY' && parts.length >= 4) {
        const count = parseInt(parts[3], 10) || 0;
        partyLine[parts[1]] = { vote: parts[2], count };
      } else if (parts.length >= 2 && parts[0]) {
        individual[parts[0]] = { vote: parts[1], party: parts[3] || '' };
      }
    }

    let yes = 0, no = 0, abstain = 0;
    for (const info of Object.values(individual)) {
      // A whip directive overrides that party's individual votes ("free" lets them through).
      const line = partyLine[info.party];
      if (line && line.vote !== 'free') continue;
      if (info.vote === 'yes') yes += 1;
      else if (info.vote === 'no') no += 1;
      else abstain += 1;
    }
    // A whip vote counts the party's ACTUAL strength in the house (payload
    // party_seats — the same source the chamber uses), falling back to the
    // count the whip broadcast, so a party line is never tallied as zero.
    const seatMap = {};
    for (const ps of (body.party_seats || [])) {
      if (ps && ps.party) seatMap[ps.party] = ps.count || 0;
    }
    for (const [party, line] of Object.entries(partyLine)) {
      const count = seatMap[party] !== undefined ? seatMap[party] : line.count;
      if (line.vote === 'yes') yes += count;
      else if (line.vote === 'no') no += count;
      else if (line.vote === 'abstain') abstain += count;
    }

    // Majority rules: a Constitutional Amendment bill needs a 2/3 majority of
    // the house's total strength; every other bill a simple majority (half of
    // the total strength + 1 — e.g. 220 MLAs → 111). Without a house size we
    // fall back to a majority of the votes cast.
    const isConstitutional = /constitut/i.test(String(bill.category || '') + ' ' + String(bill.title || ''));
    const totalSeats = parseInt(body.total_seats, 10) || 0;
    let required = 0;
    if (totalSeats > 0) {
      required = isConstitutional ? Math.ceil((totalSeats * 2) / 3) : Math.floor(totalSeats / 2) + 1;
    }
    const passed = required > 0 ? yes >= required : yes > no;
    // Passed bills go back to the Speaker's Office for certification
    // (then Governor for state bills, President for national bills).
    const nextStatus = passed ? 'speaker_office' : 'assembly_rejected';

    await bharat01.entities.Bill.update(billId, {
      status: nextStatus,
      assembly_votes_for: yes,
      assembly_votes_against: no,
    });

    // Announce the result on the house floor.
    const channelKey = bill.scope === 'national' ? 'national' : bill.state_id;
    await bharat01.entities.ChatMessage.create({
      channel: 'parl_chat_' + channelKey,
      sender_id: 'voting_agent',
      sender_name: 'Voting Agent',
      message: '⚖️ Bill "' + bill.title + '" — ' + (passed ? 'PASSED by the house' : 'BILL FAILED') +
        '. YES: ' + yes + ' · NO: ' + no + ' · ABSTAIN: ' + abstain +
        (required > 0 ? ' · Required: ' + required + ' of ' + totalSeats + (isConstitutional ? ' (2/3 majority)' : ' (simple majority)') : '') +
        (passed ? ' → moved to the Speaker\'s Office.' : ''),
      message_type: 'system',
    }).catch(() => {});

    return Response.json({ ok: true, bill_id: billId, passed, yes, no, abstain, required, totalSeats, isConstitutional, nextStatus });
  } catch (error) {
    return Response.json({ error: (error && error.message) || 'tally failed' }, { status: 500 });
  }
}