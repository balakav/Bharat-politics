
// Election schedule utilities — elections happen on fixed days/times

export const ELECTION_SCHEDULES = {
  vidhan_sabha: {
    label: 'Tamil Nadu Vidhan Sabha',
    shortLabel: 'Vidhan Sabha',
    votingStartDay: 3,   // Wednesday
    votingStartHour: 22, // 10 PM
    votingEndDay: 4,     // Thursday
    votingEndHour: 22,   // 10 PM
    totalSeats: 234,
    majorityMark: 118,
    votingWindow: 'Wed 10 PM → Thu 10 PM',
  },
  rmc: {
    label: 'Rameswaram Municipal Council',
    shortLabel: 'RMC',
    votingStartDay: 4,   // Thursday
    votingStartHour: 23, // 11 PM
    votingEndDay: 5,     // Friday
    votingEndHour: 22,   // 10 PM
    totalSeats: 33,
    majorityMark: 17,
    votingWindow: 'Thu 11 PM → Fri 10 PM',
  },
  panchayat: {
    label: 'Mahabalipuram Panchayat',
    shortLabel: 'Panchayat',
    votingStartDay: 5,   // Friday
    votingStartHour: 23, // 11 PM
    votingEndDay: 6,     // Saturday
    votingEndHour: 22,   // 10 PM
    totalSeats: 9,
    majorityMark: 5,
    votingWindow: 'Fri 11 PM → Sat 10 PM',
  },
};

export const SALARY_CONFIG = {
  baseSalary: 1000000, // ₹10 Lakh
  cooldownMinutes: 5,
};

export function getCurrentWeekMonday() {
  const now = new Date();
  const monday = new Date(now);
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  monday.setDate(monday.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getCycleKey(electionType) {
  const monday = getCurrentWeekMonday();
  return `${electionType}_${monday.toISOString().split('T')[0]}`;
}

export function getVotingDates(electionType) {
  const schedule = ELECTION_SCHEDULES[electionType];
  const monday = getCurrentWeekMonday();

  const votingStart = new Date(monday);
  votingStart.setDate(votingStart.getDate() + (schedule.votingStartDay - 1));
  votingStart.setHours(schedule.votingStartHour, 0, 0, 0);

  const votingEnd = new Date(monday);
  votingEnd.setDate(votingEnd.getDate() + (schedule.votingEndDay - 1));
  votingEnd.setHours(schedule.votingEndHour, 0, 0, 0);

  return { votingStart, votingEnd };
}

export function getElectionStatus(electionType) {
  const { votingStart, votingEnd } = getVotingDates(electionType);
  const now = new Date();

  if (now < votingStart) {
    return { status: 'campaign', votingStart, votingEnd };
  } else if (now < votingEnd) {
    return { status: 'voting', votingStart, votingEnd };
  } else {
    return { status: 'completed', votingStart, votingEnd };
  }
}

export function getPositionForElection(electionType, seatType) {
  if (electionType === 'vidhan_sabha') return 'MLA';
  if (electionType === 'rmc') {
    if (seatType === 'Nagaradhyaksh') return 'Nagaradhyaksh';
    return 'Nagarsevak';
  }
  if (electionType === 'panchayat') {
    if (seatType === 'Sarpanch') return 'Sarpanch';
    return 'Gram Panchayat Member';
  }
  return null;
}

export function getGoogleCalendarUrl(title, startDate, endDate, description = '') {
  const formatDate = (date) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const text = encodeURIComponent(title);
  const desc = encodeURIComponent(description);
  const details = encodeURIComponent(`${description}\n\nTamil Nadu Politics MMO — Election Schedule`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}

export function formatCountdown(ms) {
  if (ms <= 0) return 'Ready';
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}