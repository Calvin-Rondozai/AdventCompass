// Sourced from the General Conference's official "Calendar of Special Days, Events and
// Offerings" (https://gc.adventist.org/events/special-days/, PDF published under
// ted.adventist.org) for 2026 — that calendar is republished with slightly different
// dates every year, so this list needs a manual refresh from the current year's PDF once
// a year. Multi-day entries carry both a start and end date; single-day entries omit
// endMonth/endDay.
export type SpecialDay = {
  id: string;
  title: string;
  startMonth: number; // 1-12
  startDay: number;
  endMonth?: number;
  endDay?: number;
};

export const SPECIAL_DAYS: SpecialDay[] = [
  { id: 'fasting-jan', title: 'Day of Fasting and Prayer', startMonth: 1, startDay: 3 },
  { id: 'ten-days-prayer', title: 'Ten Days of Prayer', startMonth: 1, startDay: 7, endMonth: 1, endDay: 17 },
  { id: 'health-ministries', title: 'Health Ministries', startMonth: 1, startDay: 10 },
  { id: 'religious-liberty', title: 'Religious Liberty Day', startMonth: 1, startDay: 17 },
  { id: 'reach-personal-outreach', title: 'Reach the World: Personal Outreach', startMonth: 2, startDay: 7 },
  { id: 'christian-home-week', title: 'Christian Home and Marriage Week', startMonth: 2, startDay: 14, endMonth: 2, endDay: 21 },
  { id: 'womens-prayer', title: "Women's Day of Prayer", startMonth: 3, startDay: 7 },
  { id: 'awr', title: 'Adventist World Radio', startMonth: 3, startDay: 14 },
  { id: 'youth-week-prayer', title: 'Youth Week of Prayer', startMonth: 3, startDay: 21, endMonth: 3, endDay: 28 },
  { id: 'global-youth-day', title: "Global Youth Day / Children's Day", startMonth: 3, startDay: 21 },
  { id: 'christian-education-mar', title: 'Christian Education', startMonth: 3, startDay: 28 },
  { id: 'fasting-apr', title: 'Day of Fasting and Prayer', startMonth: 4, startDay: 4 },
  { id: 'youth-spiritual-commitment', title: 'Youth Spiritual Commitment', startMonth: 4, startDay: 4 },
  { id: 'friends-of-hope', title: "Friends of Hope Day (Visitor's Day)", startMonth: 4, startDay: 11 },
  { id: 'hope-channel', title: 'Hope Channel International', startMonth: 4, startDay: 11 },
  { id: 'world-impact-day', title: 'World Impact Day (Missionary Book Distribution)', startMonth: 4, startDay: 11 },
  { id: 'literature-evangelism-week', title: 'Literature Evangelism Rally Week', startMonth: 4, startDay: 11, endMonth: 4, endDay: 17 },
  { id: 'possibility-ministries', title: 'Possibility Ministries Day', startMonth: 4, startDay: 18 },
  { id: 'drug-awareness-month', title: 'Drug Awareness Month', startMonth: 5, startDay: 2, endMonth: 5, endDay: 30 },
  { id: 'reach-communication', title: 'Reach the World: Using Communication Channels', startMonth: 5, startDay: 2 },
  { id: 'disaster-famine-relief', title: 'Disaster and Famine Relief Offering', startMonth: 5, startDay: 9 },
  { id: 'global-adventurers-day', title: "Global Adventurer's Day", startMonth: 5, startDay: 16 },
  { id: 'children-at-risk', title: 'World Day of Prayer for Children at Risk', startMonth: 5, startDay: 23 },
  { id: 'reach-bible-study', title: "Reach the World: Bible Study, Sabbath School & Correspondence Courses", startMonth: 6, startDay: 6 },
  { id: 'womens-ministries', title: "Women's Ministries Emphasis Day", startMonth: 6, startDay: 13 },
  { id: 'reach-nurture', title: 'Reach the World: Nurture and Reclaiming', startMonth: 6, startDay: 20 },
  { id: 'refugee-day', title: 'Adventist Church World Refugee Day', startMonth: 6, startDay: 20 },
  { id: 'public-campus-ministries', title: 'World Public Campus Ministries Day', startMonth: 6, startDay: 27 },
  { id: 'fasting-jul', title: 'Day of Prayer and Fasting', startMonth: 7, startDay: 4 },
  { id: 'world-mission-offering', title: 'Missions Promotion: World Mission Offering', startMonth: 7, startDay: 11 },
  { id: 'reach-media', title: 'Reach the World: Media Ministry', startMonth: 7, startDay: 18 },
  { id: 'childrens-sabbath', title: "Children's Sabbath", startMonth: 7, startDay: 25 },
  { id: 'global-mission-evangelism', title: 'Global Mission Evangelism', startMonth: 8, startDay: 1 },
  { id: 'reach-church-planting', title: 'Reach the World: Church Planting', startMonth: 8, startDay: 8 },
  { id: 'education-day', title: 'Education Day', startMonth: 8, startDay: 15 },
  { id: 'enditnow-day', title: 'enditnow Day', startMonth: 8, startDay: 22 },
  { id: 'lay-evangelism', title: 'Lay Evangelism', startMonth: 8, startDay: 22 },
  { id: 'youth-spiritual-mission', title: 'Youth Spiritual & Mission Commitment Day', startMonth: 9, startDay: 5 },
  { id: 'family-togetherness-week', title: 'Family Togetherness Week', startMonth: 9, startDay: 6, endMonth: 9, endDay: 12 },
  { id: 'family-togetherness-prayer', title: 'Family Togetherness Day of Prayer', startMonth: 9, startDay: 12 },
  { id: 'unusual-opportunities', title: 'Mission Promotion: Unusual Opportunities Offering', startMonth: 9, startDay: 12 },
  { id: 'pathfinder-day', title: 'Pathfinder Day', startMonth: 9, startDay: 19 },
  { id: 'sabbath-school-guest-day', title: 'Sabbath School Guest Day', startMonth: 9, startDay: 26 },
  { id: 'fasting-oct', title: 'Day of Prayer and Fasting', startMonth: 10, startDay: 3 },
  { id: 'review-subscription', title: 'Adventist Review Subscription Promotion', startMonth: 10, startDay: 3 },
  { id: 'pastor-appreciation', title: 'Pastor Appreciation Day', startMonth: 10, startDay: 10 },
  { id: 'heritage-spirit-of-prophecy', title: 'Adventist Heritage and Spirit of Prophecy', startMonth: 10, startDay: 17 },
  { id: 'creation-sabbath', title: 'Creation Sabbath', startMonth: 10, startDay: 24 },
  { id: 'week-of-prayer', title: 'Week of Prayer', startMonth: 11, startDay: 7, endMonth: 11, endDay: 14 },
  { id: 'annual-sacrifice', title: 'Annual Sacrifice Offering (Global Mission)', startMonth: 11, startDay: 14 },
  { id: 'e-week-youth', title: 'e-Week of Prayer for Youth and Young Adults', startMonth: 11, startDay: 14, endMonth: 11, endDay: 20 },
  { id: 'orphans-day', title: 'World Orphans-Vulnerable Children Day', startMonth: 11, startDay: 21 },
  { id: 'hiv-aids-awareness', title: 'HIV/AIDS Awareness', startMonth: 11, startDay: 28 },
  { id: 'stewardship-revival-nov', title: 'Stewardship Revival Week', startMonth: 11, startDay: 28, endMonth: 11, endDay: 30 },
  { id: 'stewardship-revival-dec', title: 'Stewardship Revival Week', startMonth: 12, startDay: 1, endMonth: 12, endDay: 5 },
  { id: 'stewardship-sabbath', title: 'Stewardship Sabbath', startMonth: 12, startDay: 5 },
  { id: 'health-emphasis', title: 'Health Emphasis', startMonth: 12, startDay: 12 },
];

// The next real calendar Date this special day starts on, on or after `from` — rolls
// into next year for anything already passed this year.
export function nextOccurrence(day: SpecialDay, from: Date): Date {
  const year = from.getFullYear();
  const candidate = new Date(year, day.startMonth - 1, day.startDay);
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (candidate.getTime() < fromMidnight.getTime()) {
    return new Date(year + 1, day.startMonth - 1, day.startDay);
  }
  return candidate;
}

export type UpcomingSpecialDay = SpecialDay & { date: Date };

export function getUpcomingSpecialDays(from: Date = new Date()): UpcomingSpecialDay[] {
  return SPECIAL_DAYS.map((day) => ({ ...day, date: nextOccurrence(day, from) })).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}
