
import { base44 } from '@/api/base44Client';

// Game-driven news: ONLY real game events generate news (election results,
// property deals, tickets, laws, protests). No random/ambient stories are
// generated anywhere.

export async function generateElectionNews(election, winner, candidates) {
  const sorted = [...candidates].sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0));
  const runner = sorted[1];
  const margin = (winner.votes_received || 0) - (runner?.votes_received || 0);

  const isUpset = !winner.party_id || winner.party_short === 'IND' ||
    (winner.campaign_budget || 0) < (runner?.campaign_budget || 0) / 2;

  const electionNames = {
    vidhan_sabha: 'Assembly',
    lok_sabha: 'Lok Sabha',
    national: 'General Election',
  };
  const electionName = electionNames[election.election_type] || election.title;

  let title, content;

  if (isUpset) {
    title = `🔴 Election Upset: ${winner.player_name} Stuns ${runner?.player_name || 'Opponents'} in ${electionName}`;
    content = `In a shocking turn of events, ${winner.player_name} (${winner.party_name || 'Independent'}) has pulled off a stunning upset in the ${electionName} election, defeating ${runner?.player_name || 'all opponents'} by ${margin.toLocaleString()} votes. Political analysts are calling it one of the biggest upsets in recent Bharat Union political history.`;
  } else {
    title = `🏆 ${winner.player_name} Wins ${electionName} Election`;
    content = `${winner.player_name} (${winner.party_name || 'Independent'}) has emerged victorious in the ${electionName} election, winning by a margin of ${margin.toLocaleString()} votes. ${winner.party_name ? `This is a major boost for ${winner.party_name} in the region.` : 'This victory marks a significant achievement for the Independent candidate.'}`;
  }

  const existing = await base44.entities.NewsItem.filter({ related_election_id: election.id, category: 'election' });
  if (existing.length === 0) {
    await base44.entities.NewsItem.create({
      title, content, category: 'election', related_election_id: election.id, source: 'TV99 Bharat',
    });
  }
}

export async function generatePropertyNews(property, buyerName) {
  const highValue = property.market_value >= 10000000; // ₹1 Cr+

  const title = highValue
    ? `💰 ${buyerName} Acquires ${property.name} for ₹${(property.market_value / 10000000).toFixed(1)} Cr`
    : `🏠 ${buyerName} Purchases ${property.name} in ${property.location}`;

  const content = highValue
    ? `In a major real estate deal, ${buyerName} has acquired the ${property.name} located in ${property.location} for a staggering ₹${(property.market_value / 10000000).toFixed(1)} Crore. The ${property.type} is one of the most valuable properties in the region, and this acquisition significantly boosts ${buyerName}'s property portfolio.`
    : `${buyerName} has purchased the ${property.name} in ${property.location}. The ${property.type} was listed at ₹${(property.market_value / 100000).toFixed(1)} Lakh.`;

  await base44.entities.NewsItem.create({
    title, content, category: 'economy', related_id: property.id, related_type: 'property', source: 'TV99 Bharat',
  });
}