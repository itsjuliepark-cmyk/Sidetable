/* Hash Table: what the app and the server both need to know. Tracks, questions, personas, and the small helpers that
   turn answers into a Friend Persona. Loaded by the page as window.SX and by the server with require(). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Who can join: anyone at Harvard (any school; harvard.edu and hbs.edu, subdomains included) or MIT. A school is a
  // community, so opening Hash Table to more people later is a new entry here (and its email domains).
  const SCHOOLS = {
    harvard: { id: 'harvard', t: 'Harvard', short: 'Harvard', domains: ['harvard.edu', 'hbs.edu'],
      programs: ['Business School', 'College', 'Kennedy School', 'Law School', 'Medical School', 'Public Health', 'Engineering (SEAS)', 'Arts & Sciences (PhD)', 'Design', 'Education', 'Other'] },
    mit: { id: 'mit', t: 'MIT', short: 'MIT', domains: ['mit.edu'],
      programs: ['Sloan', 'Undergraduate', 'Engineering', 'Computing (EECS)', 'Science', 'Media Lab', 'Architecture & Planning', 'Humanities & Social Science', 'Other'] }
  };
  // class years, as of fall 2026 (the Class of 2028 is the newest MBA class)
  const YEARS = ['Class of 2027', 'Class of 2028', 'Class of 2029', 'Class of 2030', 'PhD or postdoc', 'Recent alum'];

  const TRACKS = [
    { id: 'genai', t: 'Generative AI', d: 'Agents, models, AI products, AI and work', q: 'Are AI agents doing real work yet, or just great demos?',
      take: 'AGI arrives before our 10-year reunion.', warm: 'What’s the most useful thing an AI did for you this week? Embarrassing answers count double.' },
    { id: 'hcai', t: 'Healthcare AI', d: 'Clinical AI, bio, digital health, health systems', q: 'Will a hospital ever trust an AI to make the call?',
      take: 'Hospitals will buy AI long before doctors trust it.', warm: 'What’s the most broken part of healthcare you’ve run into yourself?' },
    { id: 'founders', t: 'Entrepreneurship', d: 'Cofounders, fundraising, building from zero', q: 'Should you start a company right out of school?',
      take: 'You should start a company right out of school.', warm: 'What’s an idea you’d start tomorrow if someone handed you a year and no salary worries?' },
    { id: 'climate', t: 'Climate', d: 'Energy, the grid, carbon, climate fintech', q: 'Is AI’s power demand a climate problem or a climate opportunity?',
      take: 'AI’s power demand is a climate opportunity, not a problem.', warm: 'What’s one climate fix you think is overrated, and one that’s underrated?' },
    { id: 'fintech', t: 'Fintech & crypto', d: 'Payments, banking, crypto, markets', q: 'Will crypto ever feel normal?',
      take: 'Stablecoins will matter more than any new bank app.', warm: 'What’s the most annoying way you’ve ever had to move money?' },
    { id: 'robotics', t: 'Robotics & hardware', d: 'Robots, chips, devices, deep tech', q: 'When does a robot fold your laundry?',
      take: 'Most homes will have a robot within ten years.', warm: 'What chore would you pay a robot to do starting tomorrow?' },
    { id: 'bio', t: 'Bio & life sciences', d: 'Synthetic biology, genomics, longevity, neurotech', q: 'Will AI actually make drug discovery faster?',
      take: 'An AI-designed drug becomes a blockbuster before 2030.', warm: 'What’s the wildest thing biology can do that most people don’t know about?' },
    { id: 'consumer', t: 'Consumer & creators', d: 'Social apps, creators, games, communities', q: 'Is there room for one more social app?',
      take: 'The next big social app will be invite-only.', warm: 'What app do you open first every morning, and are you proud of it?' },
    { id: 'product', t: 'Product & design', d: 'PM craft, UX, growth, zero to one', q: 'Do PMs still need engineers to prototype?',
      take: 'In the AI era, every PM should ship their own prototypes.', warm: 'What’s a product you love that most people have never heard of?' },
    { id: 'vc', t: 'Venture & investing', d: 'VC, angels, growth equity, how funds work', q: 'Is VC still the best way into tech for an MBA?',
      take: 'Most MBAs who go into VC would be happier operating.', warm: 'Which company would you have bet on early, and why?' },
    { id: 'space', t: 'Space & defense', d: 'Satellites, aerospace, defense tech, security', q: 'Should startups sell to the military?',
      take: 'Defense tech is the best place to build right now.', warm: 'If you could spend a week in space, what would you bring?' },
    { id: 'future', t: 'Future of work & learning', d: 'Edtech, upskilling, hiring, AI coworkers', q: 'Will degrees matter less in ten years?',
      take: 'In ten years, a portfolio will matter more than a degree.', warm: 'What’s the best thing you ever learned outside a classroom?' },
    { id: 'cities', t: 'Cities & real estate', d: 'Proptech, housing, transit, construction', q: 'Can tech actually fix housing?',
      take: 'Boston’s housing problem is a technology problem.', warm: 'If you ran the city for a day, what would you change first?' },
    { id: 'society', t: 'Tech & society', d: 'AI policy, privacy, ethics, big tech', q: 'Who should regulate AI?',
      take: 'AI should be regulated like medicine.', warm: 'What’s one tech rule you’d write into law tomorrow?' }
  ];
  // when a track is too small for a table this week, it joins its nearest neighbor
  const NEAR = { hcai: 'genai', climate: 'genai', founders: 'genai', genai: 'founders', fintech: 'vc', vc: 'founders', robotics: 'genai', bio: 'hcai', consumer: 'founders',
    product: 'genai', space: 'robotics', future: 'genai', cities: 'climate', society: 'genai' };

  const INTS = [
    { id: 'agents', tr: 'genai', t: 'AI agents' }, { id: 'models', tr: 'genai', t: 'Foundation models' }, { id: 'aiux', tr: 'genai', t: 'AI products & UX' },
    { id: 'work', tr: 'genai', t: 'AI & the future of work' }, { id: 'devtools', tr: 'genai', t: 'Developer tools' }, { id: 'safety', tr: 'genai', t: 'AI policy & safety' },
    { id: 'clinical', tr: 'hcai', t: 'Clinical AI' }, { id: 'bio', tr: 'hcai', t: 'Drug discovery & bio' }, { id: 'dighealth', tr: 'hcai', t: 'Digital health' },
    { id: 'systems', tr: 'hcai', t: 'Health systems & payers' }, { id: 'medtech', tr: 'hcai', t: 'Medtech & devices' }, { id: 'mental', tr: 'hcai', t: 'Mental health' },
    { id: 'cofounder', tr: 'founders', t: 'Finding a cofounder' }, { id: 'raise', tr: 'founders', t: 'Fundraising' }, { id: 'consumer', tr: 'founders', t: 'Consumer' },
    { id: 'b2b', tr: 'founders', t: 'B2B & SaaS' }, { id: 'spinout', tr: 'founders', t: 'Lab spinouts' }, { id: 'search', tr: 'founders', t: 'Search funds & ETA' },
    { id: 'grid', tr: 'climate', t: 'Energy & the grid' }, { id: 'carbon', tr: 'climate', t: 'Carbon removal' }, { id: 'cfin', tr: 'climate', t: 'Climate fintech' },
    { id: 'mobility', tr: 'climate', t: 'Mobility & EVs' }, { id: 'agfood', tr: 'climate', t: 'Food & ag' }, { id: 'cpolicy', tr: 'climate', t: 'Climate policy' },
    { id: 'payments', tr: 'fintech', t: 'Payments' }, { id: 'banking', tr: 'fintech', t: 'Neobanks & banking' }, { id: 'crypto', tr: 'fintech', t: 'Crypto & stablecoins' },
    { id: 'markets', tr: 'fintech', t: 'Trading & markets' }, { id: 'insurtech', tr: 'fintech', t: 'Insurtech' }, { id: 'aifin', tr: 'fintech', t: 'AI in finance' },
    { id: 'humanoids', tr: 'robotics', t: 'Humanoids & robots' }, { id: 'chips', tr: 'robotics', t: 'Chips & compute' }, { id: 'devices', tr: 'robotics', t: 'Consumer hardware' },
    { id: 'autonomy', tr: 'robotics', t: 'Autonomy & self-driving' }, { id: 'mfg', tr: 'robotics', t: 'Manufacturing' }, { id: 'sensors', tr: 'robotics', t: 'Sensors & IoT' },
    { id: 'synbio', tr: 'bio', t: 'Synthetic biology' }, { id: 'genomics', tr: 'bio', t: 'Genomics' }, { id: 'longevity', tr: 'bio', t: 'Longevity' },
    { id: 'neuro', tr: 'bio', t: 'Neurotech' }, { id: 'labauto', tr: 'bio', t: 'Lab automation' }, { id: 'biomfg', tr: 'bio', t: 'Biomanufacturing' },
    { id: 'socialapps', tr: 'consumer', t: 'Social apps' }, { id: 'creators', tr: 'consumer', t: 'The creator economy' }, { id: 'games', tr: 'consumer', t: 'Games' },
    { id: 'commerce', tr: 'consumer', t: 'Marketplaces & commerce' }, { id: 'brands', tr: 'consumer', t: 'Brands & DTC' }, { id: 'community', tr: 'consumer', t: 'Communities' },
    { id: 'pmcraft', tr: 'product', t: 'PM craft' }, { id: 'ux', tr: 'product', t: 'UX & design' }, { id: 'growth', tr: 'product', t: 'Growth' },
    { id: 'uxr', tr: 'product', t: 'User research' }, { id: 'pricing', tr: 'product', t: 'Pricing' }, { id: 'zero2one', tr: 'product', t: 'Zero-to-one products' },
    { id: 'earlyvc', tr: 'vc', t: 'Early-stage VC' }, { id: 'angels', tr: 'vc', t: 'Angel investing' }, { id: 'growthpe', tr: 'vc', t: 'Growth & PE' },
    { id: 'funds', tr: 'vc', t: 'How funds work' }, { id: 'diligence', tr: 'vc', t: 'Diligence' }, { id: 'emerging', tr: 'vc', t: 'Emerging managers' },
    { id: 'satellites', tr: 'space', t: 'Launch & satellites' }, { id: 'defense', tr: 'space', t: 'Defense tech' }, { id: 'drones', tr: 'space', t: 'Drones' },
    { id: 'cyber', tr: 'space', t: 'Cybersecurity' }, { id: 'aero', tr: 'space', t: 'Aerospace' }, { id: 'govtech', tr: 'space', t: 'Selling to government' },
    { id: 'edtech', tr: 'future', t: 'Edtech' }, { id: 'upskill', tr: 'future', t: 'Upskilling' }, { id: 'hiring', tr: 'future', t: 'Hiring & HR tech' },
    { id: 'hybrid', tr: 'future', t: 'Remote & hybrid work' }, { id: 'aicoworkers', tr: 'future', t: 'AI coworkers' }, { id: 'solo', tr: 'future', t: 'Solo careers' },
    { id: 'proptech', tr: 'cities', t: 'Proptech' }, { id: 'housing', tr: 'cities', t: 'Housing' }, { id: 'transit', tr: 'cities', t: 'Transit' },
    { id: 'contech', tr: 'cities', t: 'Construction tech' }, { id: 'smartcity', tr: 'cities', t: 'Smart cities' }, { id: 'hospitality', tr: 'cities', t: 'Hospitality' },
    { id: 'aireg', tr: 'society', t: 'AI regulation' }, { id: 'privacy', tr: 'society', t: 'Privacy' }, { id: 'ethics', tr: 'society', t: 'Tech ethics' },
    { id: 'antitrust', tr: 'society', t: 'Antitrust & big tech' }, { id: 'misinfo', tr: 'society', t: 'Misinformation' }, { id: 'kidstech', tr: 'society', t: 'Kids & tech' }
  ];
  const INTNAME = {}; INTS.forEach((i) => { INTNAME[i.id] = i.t; });

  const LENS = [
    { id: 'build', t: 'Building it', s: 'Founder, engineer, maker', note: 'A builder. I’ll make sure someone at your table asks who pays.' },
    { id: 'fund', t: 'Funding it', s: 'VC, angel, corporate venture', note: 'An investor. Two per table at most, so it never turns into pitch night.' },
    { id: 'run', t: 'Running it', s: 'PM, operator, GM', note: 'An operator. Every table needs one person who has shipped the thing.' },
    { id: 'study', t: 'Studying it', s: 'Research, policy, medicine, science', note: 'A researcher. You’ll keep everyone honest.' },
    { id: 'pivot', t: 'Pivoting into it', s: 'New to this and curious', note: 'New to this? Best seat in the house. You get to ask the obvious question nobody else will.' }
  ];
  const BEFORE = ['Engineer', 'Product', 'Consulting', 'Banking / PE', 'Founder', 'Medicine', 'Military', 'Something else'];

  const BASE_TAKES = [
    { id: 'code', t: 'Every MBA should learn to code.' },
    { id: 'lab', t: 'The best startups come out of a lab, not a case study.' }
  ];
  const STANCE = { agree: 'Agree', disagree: 'Disagree', depends: 'It depends' };

  /* Friend test: four axes, Amie-style */
  const AXES = [
    { k: 's', lo: 'Listen', hi: 'Spark' },
    { k: 'd', lo: 'Playful', hi: 'Deep' },
    { k: 'h', lo: 'Easygoing', hi: 'Planner' },
    { k: 'a', lo: 'Ritual', hi: 'Adventure' }
  ];
  const QS = [
    { q: 'Friday, 7 PM. Your plans just fell through. You…', o: [
      { t: 'Text three people and rally a new plan', d: { h: 26, s: 10 }, note: 'A rallier. Every table needs one, or nobody ever meets again.' },
      { t: 'Honestly? Relieved. Takeout and a long call with one friend', d: { s: -16, d: 12, a: -10 }, note: 'One good conversation over a crowd. Noted.' },
      { t: 'Go somewhere new alone and see who you meet', d: { a: 26, s: 8 }, note: 'Brave. You’re the friend with the best stories.' },
      { t: 'Wait for someone to invite me somewhere', d: { h: -24 }, note: 'A joiner. Good news: I’ll make sure your table has a planner.' }] },
    { q: 'The conversation you’d stay up until 2 AM for…', o: [
      { t: 'What we’d do if we weren’t scared', d: { d: 28 }, note: 'Deep end. Your people will go there with you.' },
      { t: 'Ranking things that don’t need ranking', d: { d: -26, s: 8 }, note: 'Ha. Bits over big questions. Your table will be loud.' },
      { t: 'A book, a paper, a wild theory', d: { d: 14, a: 8 }, note: 'A thinker who still wants to have fun.' },
      { t: 'Stories. The more embarrassing, the better', d: { d: -12, s: 14 }, note: 'A storyteller. Good. Someone has to go first.' }] },
    { q: 'The group chat has been dead for two weeks. You…', o: [
      { t: 'Propose a plan with a date and a place', d: { h: 28 }, note: 'A planner. Friendships survive because of people like you.' },
      { t: 'Revive it with a meme and see what happens', d: { h: 8, d: -10, s: 6 }, note: 'Low effort, high return. Respect.' },
      { t: 'Wait. Someone will text eventually', d: { h: -22 }, note: 'Fair. I’ll make sure someone does.' },
      { t: 'Skip the group and call one person', d: { d: 14, s: -10, h: 6 }, note: 'Straight to one-on-one. A classic close-friend move.' }] },
    { q: 'Your ideal Saturday with friends is…', o: [
      { t: 'Our usual spot, our usual order', d: { a: -28 }, note: 'Rituals. The best friendships run on them.' },
      { t: 'Something none of us has done before', d: { a: 28 }, note: 'Adventure first. I’ll find you people who say yes.' },
      { t: 'A long walk along the Charles that turns into dinner', d: { a: -8, d: 10 }, note: 'Unhurried. My kind of Saturday.' },
      { t: 'Anything with a scoreboard', d: { a: 10, s: 10, d: -8 }, note: 'A little competition. Great for bonding, apparently.' }] }
  ];
  const RHYTHM = [['Every week', 'Weekly'], ['Every two weeks', 'Every 2 weeks'], ['Once a month', 'Monthly']];
  const LIFE = ['New to Boston', 'Partnered', 'Married', 'A parent', 'International', 'Staying in Boston'];
  // only these are ever mentioned to a table, and only as a count of two or more; the rest stay private to matching
  const LIFE_PUBLIC = ['New to Boston', 'International', 'Staying in Boston'];
  const LIFEV = { 'New to Boston': 'are new to Boston', 'International': 'moved here from abroad', 'Staying in Boston': 'plan to stay in Boston after school' };
  const ACTS = ['Run the Charles', 'Climb', 'Cook together', 'Museums', 'Live music', 'Celtics & Red Sox', 'Hike', 'Board games', 'Try new restaurants'];
  const ACTV = { 'Run the Charles': 'run the Charles', 'Climb': 'climb', 'Cook together': 'cook together', 'Museums': 'go to museums', 'Live music': 'see live music',
    'Celtics & Red Sox': 'catch a Celtics game', 'Hike': 'hike', 'Board games': 'play board games', 'Try new restaurants': 'try new restaurants' };
  const LOOK = [
    { id: 'crew', t: 'A crew I see every month', note: 'A crew. I’ll keep seating you with the same faces until it sticks.' },
    { id: 'close', t: 'One or two close friends', note: 'Close friends. Fewer people, more often. I can do that.' },
    { id: 'ideas', t: 'People to argue ideas with', note: 'Sparring partners. Your tech tables will be loud.' },
    { id: 'acts', t: 'People to do things with', note: 'Activity people. I’ll turn dinners into Saturday plans.' }
  ];
  const DIETS = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Alcohol-free table'];
  // what kind of dinners someone wants Charlie to invite them to
  const MIX = [
    { id: 'both', t: 'Tech + social', s: 'Tech tables and social ones, mixed through the week. Most people pick this.', note: 'Both. I’ll mix them, so you get the nerding out and the new friends.' },
    { id: 'topic', t: 'Tech tables only', s: 'Dinners around my corner of tech. That’s why I’m here.', note: 'Tech tables it is. I’ll seat you with people who love the same corner of tech.' },
    { id: 'social', t: 'Mostly social', s: 'Good people first. The topic can wait.', note: 'Good people first. I’ll seat you for how you click, not what you do, so I’ll skip most of the tech questions.' }
  ];
  // where someone is headed after school, and how Charlie says it at a table
  const NEXT = ['Start a company', 'Join a startup', 'Big tech', 'Venture capital', 'Back to my old industry', 'Research or a PhD', 'Still figuring it out'];
  const NEXTV = { 'Start a company': 'want to start a company after school', 'Join a startup': 'want to join a startup after school', 'Big tech': 'are headed to big tech',
    'Venture capital': 'want to end up in venture', 'Back to my old industry': 'are going back to their old industry with new tricks', 'Research or a PhD': 'are thinking about research or a PhD',
    'Still figuring it out': 'are still figuring out what’s next, which is a fine place to be' };
  // what a social hang is about (a topic hang uses one of the TRACKS instead)
  const VIBES = [{ id: 'coffee', t: 'Coffee' }, { id: 'food', t: 'Food' }, { id: 'walk', t: 'Walk' }, { id: 'games', t: 'Games' }, { id: 'move', t: 'Move' }, { id: 'cowork', t: 'Cowork' }, { id: 'culture', t: 'Culture' }];
  // what a member is open to, shown on their profile in People
  const OPEN_TO = ['A cofounder', 'Full-time roles', 'Internships', 'Investing', 'Advising', 'Beta testing', 'Side projects'];

  /* the Board: roles members and partner clubs post */
  const JOB = {
    kinds: ['Full-time', 'Internship', 'Founding team', 'Fellowship', 'Part-time'],
    roles: ['Product', 'BizOps & Strategy', 'Engineering', 'Venture', 'Chief of Staff', 'Research', 'Growth', 'Operations'],
    stages: ['Pre-seed', 'Seed', 'Series A', 'Series B+', 'Growth', 'Public']
  };
  /* Pulse: what members post */
  const POSTS = {
    read: { t: 'Worth reading', hint: 'A paper, post, newsletter or talk worth 20 minutes' },
    ask: { t: 'Ask', hint: 'A cofounder, beta users, an intro, a reference' },
    take: { t: 'Hot take', hint: 'Something people can agree or disagree with' },
    ship: { t: 'Shipped', hint: 'Something you launched, built or closed' },
    event: { t: 'Event', hint: 'A talk, demo night or meetup around Boston worth going to' }
  };

  /* Friend Persona: [S|L][D|P][H|G][R|A]. The letters stay internal; people see the words in AXWORD. */
  const AXWORD = { S: 'Spark', L: 'Listen', D: 'Deep', P: 'Playful', H: 'Planner', G: 'Easygoing', R: 'Ritual', A: 'Adventure' };
  const PERSONAS = {
    SDHR: ['The Hearth', 'Keeper', 'You’re the reason the group still gets together every month, and the talk always goes somewhere.'],
    SDHA: ['The Expedition', 'Leader', 'You plan the trip, then ask the question nobody else would.'],
    SDGR: ['The Late-Night', 'Philosopher', 'Show up, sit down, and take the conversation somewhere real.'],
    SDGA: ['The Restless', 'Thinker', 'You’ll say yes to anything, as long as it ends in a good argument.'],
    SPHR: ['The', 'Ringleader', 'Same place, same night, same people. You make it happen.'],
    SPHA: ['The', 'Instigator', '“Wait, what if we…” is how most of your best nights start.'],
    SPGR: ['The Life of the', 'Table', 'You make every room louder, in the best way.'],
    SPGA: ['The Perfect', 'Plus-One', 'Invite you anywhere. You’ll make it fun.'],
    LDHR: ['The Quiet', 'Anchor', 'You remember everyone’s news and quietly keep the group together.'],
    LDHA: ['The', 'Curator', 'You find the tiny exhibit, the hidden bar, the book, and bring one friend.'],
    LDGR: ['The', 'Confidant', 'Two hours, one friend, no phones. That’s your kind of night.'],
    LDGA: ['The Quiet', 'Explorer', 'You say little on the way there, then the thing everyone remembers.'],
    LPHR: ['The Group-Chat', 'Keeper', 'You keep the thread alive, the birthdays straight, and the memes flowing.'],
    LPHA: ['The', 'Scout', 'You’ve already found the new place. You just need five people to try it.'],
    LPGR: ['The', 'Regular', 'Same table, same jokes, and somehow it never gets old.'],
    LPGA: ['The Easy', 'Yes', 'Low drama, high fun, always up for whatever.']
  };
  const TRAITS = {
    S: 'Get the conversation going', L: 'Notice the person who hasn’t talked yet',
    D: 'Take small talk somewhere real', P: 'Keep it light enough that everyone relaxes',
    H: 'Turn “we should do this again” into a date on the calendar', G: 'Show up, every time, fully there',
    R: 'Turn one good night into a tradition', A: 'Drag everyone somewhere new'
  };

  function axes(answers) {
    const a = { s: 50, d: 50, h: 50, a: 50 };
    Object.keys(answers || {}).forEach((qi) => {
      const q = QS[+qi], o = q && q.o[answers[qi]]; if (!o) return;
      Object.keys(o.d).forEach((k) => { a[k] = Math.max(6, Math.min(94, a[k] + o.d[k])); });
    });
    return a;
  }
  const codeOf = (v) => (v.s >= 50 ? 'S' : 'L') + (v.d >= 50 ? 'D' : 'P') + (v.h >= 50 ? 'H' : 'G') + (v.a >= 50 ? 'A' : 'R');
  function persona(code) { const p = PERSONAS[code] || PERSONAS.SDHR; return { code, first: p[0], last: p[1], name: p[0] + ' ' + p[1], tag: p[2] }; }
  // best seated with: same depth and same ritual/adventure, opposite on talk and on plans
  const bestWith = (c) => (c[0] === 'S' ? 'L' : 'S') + c[1] + (c[2] === 'H' ? 'G' : 'H') + c[3];
  const track = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
  function takesFor(trackId) { return [{ id: 'track', t: track(trackId).take }].concat(BASE_TAKES); }

  /* Tonight's question: the game every table plays. Charlie puts three cards on the table's menu, the table votes for
     one, everyone picks a side in secret, and the split is revealed when dinner starts. Cards are written from the week's
     news (each one links to what to read first) or are simply fun. tr: the tracks a card fits, 'social' for social
     tables; k: the format; heat: how spicy (1 to 3); a and b: the two sides. Refresh the tech cards every week or two. */
  const KINDS = { balance: 'Balance game', take: 'Hot take', bet: 'Place your bet', wyr: 'Would you rather', honest: 'Be honest' };
  const CARDS = [
    { id: 'agents-first-job', tr: ['genai', 'future', 'founders', 'product', 'society'], k: 'balance', heat: 3,
      q: 'Your first job after school: you manage five AI agents, or five senior people mentor you?', a: 'Five agents', b: 'Five mentors',
      why: 'Investors and CEOs are openly predicting that AI agents will take over a lot of entry-level work',
      reads: [['Investors predict AI is coming for labor in 2026', 'TechCrunch', 'https://techcrunch.com/2025/12/31/investors-predict-ai-is-coming-for-labor-in-2026/'],
        ['ServiceNow’s CEO says graduate unemployment could reach 30% because of AI agents', 'TechRadar', 'https://www.techradar.com/pro/so-much-of-the-work-is-going-to-be-done-by-agents-servicenow-ceo-says-graduate-unemployment-could-reach-30-percent-because-of-ai-agents']] },
    { id: 'robot-at-home', tr: ['robotics', 'consumer', 'genai', 'social'], k: 'wyr', heat: 2,
      q: 'A $20K humanoid that does your laundry, but a remote human sometimes takes the controls. Do you let it in?', a: 'Let it in', b: 'I’ll fold my own',
      why: 'The first humanoid robots for homes are taking preorders, and the fine print is about privacy',
      reads: [['A $20K humanoid robot to help around the house? The price isn’t the only caveat', 'Yahoo Tech', 'https://tech.yahoo.com/home/articles/20k-humanoid-robot-help-around-072000358.html'],
        ['Claims of $20,000 humanoid home robots target a 2026 debut', 'Humanoid Guide', 'https://humanoid.guide/claims-of-20000-humanoid-home-robots-target-2026-debut-market/']] },
    { id: 'nuclear-ai', tr: ['climate', 'genai', 'cities'], k: 'take', heat: 2,
      q: 'Big Tech going nuclear to power AI is the best thing to happen to climate in a decade', a: 'Agree', b: 'Disagree',
      why: 'Google, Microsoft and Amazon have signed nuclear deals, small modular reactors included, to power AI data centers',
      reads: [['Google wants to address data center power demands with nuclear power', 'TechRadar', 'https://www.techradar.com/pro/google-wants-to-address-data-center-power-demands-with-nuclear-power'],
        ['Big tech companies aim to develop small nuclear reactors', 'VOA', 'https://learningenglish.voanews.com/amp/big-tech-companies-aim-to-develop-small-nuclear-reactors/7827577.html']] },
    { id: 'glp1-pill', tr: ['bio', 'hcai', 'consumer'], k: 'balance', heat: 3,
      q: 'A daily pill that quiets food cravings: the biggest health win of the decade, or a dependency we’ll regret?', a: 'Biggest win', b: 'We’ll regret it',
      why: 'GLP-1 weight-loss pills are now FDA-approved, so the Ozempic era no longer needs a needle',
      reads: [['FDA grants speedy approval to Eli Lilly’s weight-loss pill for obesity', 'PBS NewsHour', 'https://www.pbs.org/newshour/health/fda-grants-speedy-approval-to-eli-lillys-weight-loss-pill-for-obesity'],
        ['What’s changing with weight-loss drugs in 2026', 'NBC New York', 'https://www.nbcnewyork.com/news/health/weight-loss-drugs-changes-2026/6437937/']] },
    { id: 'ai-bubble', tr: ['vc', 'founders', 'fintech', 'genai'], k: 'bet', heat: 3,
      q: 'The AI boom is 1999 all over again, or it’s 2007 and the iPhone just came out?', a: '1999, it pops', b: '2007, just starting',
      why: 'AI valuations keep breaking records while a lot of companies are still working out how to make money from it',
      reads: [['Crystal ball: will the AI bubble burst or balloon in 2026?', 'Fortune', 'https://fortune.com/2026/01/05/crystal-ball-will-the-ai-bubble-burst-or-balloon-in-2026/'],
        ['Will the AI bubble burst in 2026? We ask the experts', 'City AM', 'https://www.cityam.com/will-the-ai-bubble-burst-in-2026-we-ask-the-experts/']] },
    { id: 'stablecoin-paycheck', tr: ['fintech', 'vc'], k: 'bet', heat: 2,
      q: 'Within five years you get paid in stablecoins and don’t even notice', a: 'Yes, quietly', b: 'Never',
      why: 'New rules in the US and the EU have banks and fintechs racing to build stablecoin payments',
      reads: [['Why 2026 could be the year stablecoins go mainstream', 'Fintech Weekly', 'https://www.fintechweekly.com/magazine/articles/stablecoins-mainstream-payments-genius-act-2026'],
        ['Global Stablecoins Report 2026', 'The Paypers', 'https://thepaypers.com/crypto-web3-and-cbdc/reports/global-stablecoins-report-2026']] },
    { id: 'ai-scribe', tr: ['hcai', 'genai'], k: 'balance', heat: 2,
      q: 'At your next checkup: an AI writes the notes so your doctor can look at you, or no AI and your doctor types the whole time?', a: 'AI in the room', b: 'Just us',
      why: 'Ambient AI scribes are spreading through hospitals faster than almost any tool doctors have used',
      reads: [['Take note: the AI scribe era is here', 'Medical Economics', 'https://www.medicaleconomics.com/view/take-note-the-ai-scribe-era-is-here'],
        ['AI scribe use modestly reduces clinical documentation time', 'HealthDay', 'https://www.healthday.com/healthpro-news/public-health/ai-scribe-use-modestly-reduces-clinical-documentation-time']] },
    { id: 'robotaxi-boston', tr: ['cities', 'robotics', 'consumer', 'social'], k: 'wyr', heat: 2,
      q: 'Your first driverless ride in Boston is down Storrow Drive in a snowstorm. Are you in?', a: 'Front seat, filming', b: 'I’ll take the T',
      why: 'Waymo wants to bring robotaxis to Boston, but Massachusetts law doesn’t allow driverless cars yet',
      reads: [['Waymo brings its robotaxis to Boston for testing', 'Axios Boston', 'https://www.axios.com/local/boston/2026/02/05/waymo-boston-expansion-autonomous-testing'],
        ['Waymo wants to bring robot taxis to Boston. Are we ready?', 'Yahoo News', 'https://www.yahoo.com/news/articles/waymo-wants-bring-robot-taxis-104640004.html']] },
    { id: 'two-person-giant', tr: ['founders', 'vc', 'genai', 'hcai'], k: 'balance', heat: 3,
      q: 'Two brothers and a stack of AI tools book hundreds of millions in sales: the future of startups, or a cautionary tale?', a: 'The future', b: 'Cautionary tale',
      why: 'Medvi went viral as proof of the AI-built mega company, and critics say the headlines left out a lot',
      reads: [['From $20K to $1.8B in revenue: how one founder built a telehealth giant with AI and no VC', 'Dealroom', 'https://dealroom.co/news/127216-from-20k-to-1-8b-in-revenue-how-one-founder-built-a-telehealth-giant-wit/'],
        ['The critics’ side of the Medvi story', 'Techdirt', 'https://www.techdirt.com/company/medvi/']] },
    { id: 'pm-prototypes', tr: ['product', 'genai', 'founders'], k: 'take', heat: 2,
      q: 'A PM who can’t ship a working prototype with AI isn’t really a PM anymore', a: 'Agree', b: 'Disagree',
      why: 'Product managers are vibe coding real prototypes in days instead of handing over mockups',
      reads: [['AI won’t replace product managers, but vibe coding will redefine them', 'HackerNoon', 'https://hackernoon.com/lite/ai-wont-replace-product-managers-but-vibe-coding-will-redefine-them'],
        ['Vibe coding for product managers', 'monday.com', 'https://monday.com/blog/vibe-coding/vibe-coding-product-managers/']] },
    { id: 'crispr-for-one', tr: ['bio', 'hcai'], k: 'balance', heat: 2,
      q: 'Gene-editing cures made for a single patient: the future of medicine, or a luxury only a few will ever get?', a: 'The future', b: 'A luxury',
      why: 'The first baby treated with a personalized CRISPR therapy just passed a year, and the FDA drafted a path for more',
      reads: [['Personalized gene editing, one of 2026’s breakthrough technologies', 'MIT Technology Review', 'https://www.technologyreview.com/2026/01/12/1129999/gene-editing-base-edited-baby-personalized-drugs-2026-breakthrough-technology/'],
        ['One year since the world’s first personalized CRISPR therapy', 'Children’s Hospital of Philadelphia', 'https://www.chop.edu/news/childrens-hospital-philadelphia-marks-one-year-anniversary-worlds-first-personalized-crispr']] },
    { id: 'ai-best-friend', tr: ['consumer', 'society', 'genai', 'social'], k: 'balance', heat: 3,
      q: 'Your future kid’s best friend is an AI. Fine, or hard no?', a: 'Fine', b: 'Hard no',
      why: 'Surveys say most teens now turn to AI for friendship, and researchers are worried about what that does',
      reads: [['Teens are using AI for friendship, here are the potential risks', 'KY3', 'https://www.ky3.com/2026/05/14/teens-are-using-ai-friendship-here-are-potential-risks/'],
        ['Is this really your friend?', 'Scholastic Scope', 'https://scope.scholastic.com/issues/2025-26/020126/is-this-really-your-friend.html']] },
    { id: 'moon-or-million', tr: ['space', 'robotics', 'social'], k: 'wyr', heat: 1,
      q: 'A seat on the next crewed Moon flyby, or a guaranteed million dollars?', a: 'The Moon', b: 'The million',
      why: 'Artemis II flew four astronauts around the Moon this spring, farther from Earth than anyone had ever been',
      reads: [['Artemis II astronauts prepare for their lunar flyby', 'ABC13', 'https://abc13.com/amp/post/artemis-ii-mission-approaches-midpoint-astronauts-prepare-lunar-flyby-monday/18845477/'],
        ['Artemis II crew prepares for a historic Moon flyby', 'Euronews', 'https://www.euronews.com/my-europe/2026/04/05/artemis-ii-spacecrew-prepare-for-historic-moon-flyby']] },
    { id: 'eu-ai-rules', tr: ['society', 'genai', 'vc'], k: 'take', heat: 2,
      q: 'Europe regulating AI first is a feature, not a bug', a: 'Feature', b: 'Bug',
      why: 'The EU AI Act’s first big obligations kicked in this August, while the high-risk rules were pushed back',
      reads: [['The EU AI Act’s deadline moved to 2027. Yours didn’t', 'Holistic AI', 'https://www.holisticai.com/blog/eu-ai-acts-deadline-moved-2027'],
        ['EU AI Act 2026: what actually changed', 'Process Excellence Network', 'https://www.processexcellencenetwork.com/ai/articles/eu-ai-act-2026-what-actually-changed-and-what-deployers-still-must-do']] },
    { id: 'five-days', tr: ['future', 'product', 'vc', 'founders', 'social'], k: 'balance', heat: 2,
      q: 'Five days a week in the office with a team you love, or fully remote with a 20% raise?', a: 'The office', b: 'Remote + raise',
      why: 'More big companies moved to five days a week in the office this year',
      reads: [['Which companies are enforcing office returns', 'Raconteur', 'https://www.raconteur.net/talent-culture/which-companies-are-enforcing-office-returns']] },
    { id: 'agi-reunion', tr: ['genai', 'future', 'space'], k: 'bet', heat: 3,
      q: 'AGI shows up before your 10-year reunion', a: 'Before', b: 'After',
      why: 'Nobody agrees on the date, and everyone at this table will be at that reunion', reads: [] },
    // social tables and hangs: about life
    { id: 'boston-forever', tr: ['social', 'cities'], k: 'balance', heat: 2, q: 'Boston for the rest of your life, or a new city every two years?', a: 'Boston forever', b: 'A new city',
      why: 'Half of you probably haven’t decided where to live after school', reads: [] },
    { id: 'phone-stack', tr: ['social'], k: 'take', heat: 2, q: 'Phones go in a stack, and whoever grabs theirs first buys the next round', a: 'Stack them', b: 'Absolutely not',
      why: 'If you vote yes, I’ll hold you to it', reads: [] },
    { id: 'ten-or-eighty', tr: ['social'], k: 'wyr', heat: 1, q: 'Dinner with your 10-year-old self, or your 80-year-old self?', a: '10-year-old me', b: '80-year-old me',
      why: 'One of them would be very impressed. Maybe', reads: [] },
    { id: 'languages-or-music', tr: ['social'], k: 'wyr', heat: 1, q: 'Instantly speak every language, or play every instrument?', a: 'Every language', b: 'Every instrument',
      why: 'No wrong answers. Some answers are more fun at parties', reads: [] },
    { id: 'brunch', tr: ['social', 'cities'], k: 'take', heat: 2, q: 'Brunch is the most overrated meal in Boston', a: 'Agree', b: 'Disagree',
      why: 'Bring your counterexample, with an address', reads: [] },
    { id: 'plans-or-chaos', tr: ['social'], k: 'balance', heat: 1, q: 'The perfect weekend: every hour planned, or zero plans?', a: 'Every hour', b: 'Zero plans',
      why: 'This one decides who organizes the next one', reads: [] },
    { id: 'ai-twin', tr: ['social', 'genai', 'consumer'], k: 'balance', heat: 2, q: 'An AI that answers your texts in your voice: freedom, or creepy?', a: 'Freedom', b: 'Creepy',
      why: 'Most of you could build one this weekend. Should you?', reads: [] },
    // social hangs and social tables: the questions friends actually bond over. why is the follow-up that gets the stories out;
    // vibe matches a social hang's vibe (coffee, food, walk, games, move, cowork, culture)
    { id: 'text-back', tr: ['social'], k: 'take', heat: 2, vibe: ['coffee', 'walk'], q: 'Taking three days to text a friend back is fine, actually', a: 'Totally fine', b: 'That’s rude',
      why: 'Everyone checks their phone: whose unanswered text is the oldest?', reads: [] },
    { id: 'group-chat-role', tr: ['social'], k: 'balance', heat: 1, q: 'In your group chat, are you the one who plans everything, or the one who says “I’m down” and shows up?', a: 'The planner', b: '“I’m down”',
      why: 'Look around. This group needs at least one of each', reads: [] },
    { id: 'roommate', tr: ['social'], k: 'wyr', heat: 2, q: 'A roommate who’s messy but fun, or spotless but silent?', a: 'Messy but fun', b: 'Spotless, silent',
      why: 'Bonus points for a real roommate story', reads: [] },
    { id: 'big-or-quiet', tr: ['social'], k: 'balance', heat: 1, q: 'After a long week: a big night out with everyone, or a quiet night with one person?', a: 'Big night', b: 'Quiet night',
      why: 'This decides who plans the next one', reads: [] },
    { id: 'family-texts', tr: ['social'], k: 'balance', heat: 1, q: 'Your family: one long call a week, or a group chat that never sleeps?', a: 'The weekly call', b: 'The group chat',
      why: 'And who in your family texts like every word costs money?', reads: [] },
    { id: 'screen-time', tr: ['social'], k: 'bet', heat: 2, vibe: ['coffee', 'food', 'games'], q: 'Someone here has over six hours of screen time today', a: 'Easy, yes', b: 'No way',
      why: 'Settings, Screen Time, phones on the table. Whoever’s highest gets the next coffee', reads: [] },
    { id: 'unread-emails', tr: ['social'], k: 'bet', heat: 1, vibe: ['coffee', 'cowork'], q: 'At least one person here has more than 1,000 unread emails', a: 'Obviously', b: 'Not this crowd',
      why: 'Check together. No judgment. Some judgment', reads: [] },
    { id: 'photo-or-text', tr: ['social'], k: 'wyr', heat: 3, vibe: ['food', 'games', 'coffee'], q: 'Everyone shows the last photo in their camera roll, or reads their last sent text out loud?', a: 'Last photo', b: 'Last text',
      why: 'Whatever wins, everyone does it. Yes, you too', reads: [] },
    { id: 'this-week', tr: ['social'], k: 'balance', heat: 1, q: 'This week has been: a little chaos, or weirdly calm?', a: 'A little chaos', b: 'Weirdly calm',
      why: 'Go around: one high, one low, thirty seconds each', reads: [] },
    { id: 'sunday-nights', tr: ['social'], k: 'take', heat: 1, q: 'Sunday night is the best night of the week', a: 'Agree', b: 'Disagree',
      why: 'Defend it with your actual Sunday routine', reads: [] },
    { id: 'five-or-one', tr: ['social'], k: 'wyr', heat: 1, vibe: ['move', 'walk'], q: '5 AM run club, or 1 AM deep talks?', a: '5 AM', b: '1 AM',
      why: 'Now you know who not to text before 10', reads: [] },
    { id: 'cook-or-out', tr: ['social'], k: 'wyr', heat: 1, vibe: ['food'], q: 'Cook every meal for a month, or eat out every meal for a month?', a: 'Cook it all', b: 'Eat out',
      why: 'Then name the one dish you’d make for this group', reads: [] },
    { id: 'new-hobby', tr: ['social'], k: 'balance', heat: 1, q: 'This semester: pick up a new hobby, or finally get good at an old one?', a: 'Something new', b: 'Get good',
      why: 'Say the hobby out loud. Someone here might join you', reads: [] },
    { id: 'boston-winter', tr: ['social', 'cities'], k: 'take', heat: 2, vibe: ['walk', 'move'], q: 'A Boston winter builds character', a: 'It does', b: 'It builds nothing',
      why: 'Share your survival trick for February', reads: [] },
    { id: 'voice-notes', tr: ['social'], k: 'take', heat: 2, q: 'Voice notes longer than a minute should be illegal', a: 'Ban them', b: 'Let us talk',
      why: 'Who here sends the four-minute ones?', reads: [] },
    { id: 'cancelled-plans', tr: ['social'], k: 'honest', heat: 2, q: 'When plans get cancelled, you’re secretly relieved', a: 'Guilty', b: 'Never',
      why: 'Hands up if it happened this month', reads: [] },
    { id: 'rehearse-call', tr: ['social'], k: 'honest', heat: 1, q: 'You’ve rehearsed a phone call before making it', a: 'Guilty', b: 'Never',
      why: 'Bonus: the call you rehearsed the longest', reads: [] },
    { id: 'taste-or-kind', tr: ['social'], k: 'balance', heat: 1, q: 'Would you rather be complimented on your taste, or on your kindness?', a: 'My taste', b: 'My kindness',
      why: 'Then give one to the person on your left', reads: [] },
    { id: 'sore-loser', tr: ['social'], k: 'take', heat: 2, vibe: ['games'], q: 'How you lose a board game is a personality test', a: 'Agree', b: 'Disagree',
      why: 'You’re about to find out', reads: [] },
    { id: 'walk-and-talk', tr: ['social'], k: 'take', heat: 1, vibe: ['walk', 'move'], q: 'Walking and talking beats sitting and talking', a: 'Walk', b: 'Sit',
      why: 'Vote with your feet', reads: [] },
    { id: 'work-sound', tr: ['social'], k: 'wyr', heat: 1, vibe: ['cowork'], q: 'When you work: a playlist on loop, or total silence?', a: 'Playlist', b: 'Silence',
      why: 'Then share the one song that gets you through a deadline', reads: [] },
    { id: 'museum-pace', tr: ['social'], k: 'balance', heat: 1, vibe: ['culture'], q: 'At a museum: read every label, or walk fast and vibe?', a: 'Every label', b: 'Walk and vibe',
      why: 'This decides who leads the next visit', reads: [] },
    { id: 'coffee-order', tr: ['social'], k: 'take', heat: 1, vibe: ['coffee'], q: 'Your coffee order says more about you than your resume', a: 'Agree', b: 'Disagree',
      why: 'Say yours. The group decodes it', reads: [] },
    // light and silly: the questions that get a table laughing in the first ten minutes
    { id: 'hot-dog', tr: ['social'], k: 'take', heat: 2, vibe: ['food'], q: 'A hot dog is a sandwich', a: 'It is', b: 'Absolutely not',
      why: 'Defend it like it’s your thesis', reads: [] },
    { id: 'cereal-soup', tr: ['social'], k: 'take', heat: 1, vibe: ['food', 'coffee'], q: 'Cereal is a soup', a: 'It’s soup', b: 'It’s cereal',
      why: 'The losing side has to define soup', reads: [] },
    { id: 'pineapple', tr: ['social'], k: 'take', heat: 2, vibe: ['food'], q: 'Pineapple belongs on pizza', a: 'Belongs', b: 'Never',
      why: 'Some friendships don’t survive this one. Yours will', reads: [] },
    { id: 'duck-horses', tr: ['social'], k: 'wyr', heat: 1, vibe: ['games', 'walk'], q: 'Fight one horse-sized duck, or a hundred duck-sized horses?', a: 'One big duck', b: '100 tiny horses',
      why: 'Walk everyone through your strategy', reads: [] },
    { id: 'karaoke', tr: ['social'], k: 'wyr', heat: 1, vibe: ['games', 'culture'], q: 'Karaoke: the song everyone knows, or the deep cut only you love?', a: 'Crowd pleaser', b: 'My deep cut',
      why: 'Name the song. One line out loud for bonus points', reads: [] },
    { id: 'teleport-fly', tr: ['social'], k: 'wyr', heat: 1, vibe: ['walk', 'move'], q: 'Teleport once a day, or fly whenever you want but only at walking speed?', a: 'Teleport', b: 'Slow flying',
      why: 'Where are you going first?', reads: [] },
    { id: 'skull-emoji', tr: ['social'], k: 'bet', heat: 1, vibe: ['coffee', 'games', 'food'], q: 'Someone here’s most-used emoji is 💀', a: 'Obviously', b: 'Not us',
      why: 'Phones out, open your emoji keyboard, no hiding', reads: [] },
    { id: 'dunkin', tr: ['social', 'cities'], k: 'balance', heat: 1, vibe: ['coffee'], q: 'Dunkin’, or a seven-dollar oat latte?', a: 'Dunkin’', b: 'Oat latte',
      why: 'Boston is judging you either way', reads: [] },
    { id: 'weekend-trip', tr: ['social'], k: 'balance', heat: 1, q: 'Last-minute weekend trip with this group: Montreal or Maine?', a: 'Montreal', b: 'Maine',
      why: 'If three of you mean it, someone books it', reads: [] },
    { id: 'sleep-or-gym', tr: ['social'], k: 'balance', heat: 1, vibe: ['move'], q: 'An extra hour of sleep, or an extra hour at the gym?', a: 'Sleep', b: 'Gym',
      why: 'Be honest about the last time you picked the gym', reads: [] },
    { id: 'five-minutes-away', tr: ['social'], k: 'honest', heat: 2, q: 'You’ve texted “five minutes away” while still at home', a: 'Guilty', b: 'Never',
      why: 'How far away were you really?', reads: [] },
    { id: 'snooze', tr: ['social'], k: 'honest', heat: 1, vibe: ['coffee', 'cowork'], q: 'You hit snooze at least three times this morning', a: 'Guilty', b: 'Up at once',
      why: 'Fastest wake-up gets to pick the next spot', reads: [] },
    { id: 'airport', tr: ['social'], k: 'balance', heat: 1, q: 'At the airport: three hours early, or sprinting to the gate?', a: 'Three hours early', b: 'Sprinting',
      why: 'The sprinters always have the best stories', reads: [] },
    { id: 'dessert-first', tr: ['social'], k: 'take', heat: 1, vibe: ['food'], q: 'Dessert should come first', a: 'Yes', b: 'Chaos',
      why: 'If it wins, you know what to order', reads: [] },
    { id: 'texting-style', tr: ['social'], k: 'balance', heat: 1, q: 'Texting style: one long paragraph, or twelve tiny messages?', a: 'One paragraph', b: 'Twelve messages',
      why: 'Show everyone your last one', reads: [] },
    { id: 'chips-chocolate', tr: ['social'], k: 'wyr', heat: 1, vibe: ['cowork', 'games'], q: 'One snack for the rest of the semester: chips or chocolate?', a: 'Chips', b: 'Chocolate',
      why: 'Name the exact brand. Details matter', reads: [] },
    { id: 'spoilers', tr: ['social'], k: 'take', heat: 2, vibe: ['culture'], q: 'Spoilers don’t actually ruin anything', a: 'Agree', b: 'Disagree',
      why: 'The worst spoiler that ever happened to you, go', reads: [] },
    { id: 'make-bed', tr: ['social'], k: 'take', heat: 1, q: 'Making your bed every morning is a waste of time', a: 'Waste', b: 'Non-negotiable',
      why: 'The bed-makers will now explain themselves', reads: [] },
    { id: 'laugh-along', tr: ['social'], k: 'honest', heat: 1, q: 'You’ve laughed at a joke you didn’t get, just to keep things moving', a: 'Guilty', b: 'Never',
      why: 'Admit it, and explain one joke you still don’t get', reads: [] },
  ];
  // the two-to-four word handle for each card, used wherever a whole question would be too much
  const KW = {"agents-first-job":"AI agents vs mentors",
    "robot-at-home":"The $20K home robot",
    "nuclear-ai":"Nuclear-powered AI",
    "glp1-pill":"The craving pill",
    "ai-bubble":"AI bubble or iPhone moment",
    "stablecoin-paycheck":"Paid in stablecoins",
    "ai-scribe":"AI in the exam room",
    "robotaxi-boston":"Robotaxis on Storrow",
    "two-person-giant":"The two-person mega startup",
    "pm-prototypes":"PMs who can’t prototype",
    "crispr-for-one":"CRISPR for one patient",
    "ai-best-friend":"Kids with AI best friends",
    "moon-or-million":"Moon flyby or $1M",
    "eu-ai-rules":"Europe’s AI rules",
    "five-days":"Office or remote",
    "agi-reunion":"AGI before the reunion",
    "boston-forever":"Boston forever",
    "phone-stack":"The phone stack",
    "ten-or-eighty":"Your 10 or 80-year-old self",
    "languages-or-music":"Languages or instruments",
    "brunch":"Overrated brunch",
    "plans-or-chaos":"Planned or no plans",
    "ai-twin":"Your AI texting twin",
    "text-back":"The 3-day text back",
    "group-chat-role":"Planner or “I’m down”",
    "roommate":"Messy or silent roommate",
    "big-or-quiet":"Big night or quiet one",
    "family-texts":"Family call or group chat",
    "screen-time":"Six hours of screen time",
    "unread-emails":"1,000 unread emails",
    "photo-or-text":"Last photo or last text",
    "this-week":"Chaos or calm",
    "sunday-nights":"Sunday nights",
    "five-or-one":"5 AM or 1 AM",
    "cook-or-out":"Cook or eat out",
    "new-hobby":"New hobby or old one",
    "boston-winter":"Boston winters",
    "voice-notes":"Long voice notes",
    "cancelled-plans":"Cancelled-plans relief",
    "rehearse-call":"Rehearsed phone calls",
    "taste-or-kind":"Taste or kindness",
    "sore-loser":"Board game losers",
    "walk-and-talk":"Walk or sit",
    "work-sound":"Playlist or silence",
    "museum-pace":"Museum pace",
    "coffee-order":"Your coffee order",
    "hot-dog":"Hot dog sandwich",
    "cereal-soup":"Cereal soup",
    "pineapple":"Pineapple pizza",
    "duck-horses":"Duck vs 100 horses",
    "karaoke":"Your karaoke song",
    "teleport-fly":"Teleport or slow flying",
    "skull-emoji":"The 💀 emoji",
    "dunkin":"Dunkin’ or oat latte",
    "weekend-trip":"Montreal or Maine",
    "sleep-or-gym":"Sleep or gym",
    "five-minutes-away":"“Five minutes away”",
    "snooze":"The snooze button",
    "airport":"Airport timing",
    "dessert-first":"Dessert first",
    "texting-style":"Paragraph or 12 texts",
    "chips-chocolate":"Chips or chocolate",
    "spoilers":"Spoilers",
    "make-bed":"Making your bed",
    "laugh-along":"Laughing along"};
  CARDS.forEach((c) => { c.kw = KW[c.id] || c.q; });
  const card = (id) => CARDS.find((c) => c.id === id) || null;

  /* the three rounds at the table */
  // game: tonight's question once the table has picked it ({ q, a, b, na, nb } with the split once it's revealed)
  function deck(type, trackId, split, game) {
    const last = ['Last', '1 min', 'Before you go', 'Who do you want to see again?', 'Don’t say it out loud. Tell me tomorrow morning. Only mutual picks are shared.'];
    const big = game && ['Round 2', '20 min', 'Tonight’s question', game.q, game.na != null && game.na !== game.nb
      ? `You split ${game.na}–${game.nb}. Team “${game.na < game.nb ? game.a : game.b}” opens, since they’re outnumbered. Then everyone argues the other side for a minute, and you vote again in the app. Changing your mind counts as winning.`
      : 'Go around once with your side and one reason. Then everyone argues the other side for a minute, and you vote again in the app. Changing your mind counts as winning.'];
    if (type === 'kindred') return [
      ['Round 1', '10 min', 'Origins', 'Where’s home, and what do you miss about it?', 'Go around once. Everyone answers, nobody follows up yet.'],
      big || ['Round 2', '20 min', 'Go deeper', 'What’s something you’re proud of that nobody here would guess?', 'Go around. The person on your left asks one follow-up before you pass it on.'],
      ['Round 3', '20 min', 'Plan the next one', 'Pick one thing you’ll do together in the next three weeks.', 'A run, a show, dinner at someone’s place. Name a host and a date before the check comes.'],
      last];
    const sp = split && split.a && split.d ? `You split ${split.a}–${split.d} on “${split.t}”` : 'Pick the take you disagree on most';
    return [
      ['Round 1', '10 min', 'Origins', 'What did you almost do instead of business school?', 'Go around once. Everyone answers, nobody follows up yet.'],
      big || ['Round 2', '20 min', 'The split', sp, 'Switch sides. Argue the position you disagree with, then vote again. Changing your mind counts as winning.'],
      ['Round 3', '25 min', 'Napkin startup', `Build one ${track(trackId).t} company together before dessert.`, 'Half the table: what it does and how it works. The other half: who pays and how much. Pitch it in one sentence when the check comes.'],
      last];
  }

  return { SCHOOLS, YEARS, TRACKS, NEAR, INTS, INTNAME, LENS, BEFORE, BASE_TAKES, STANCE, AXES, QS, RHYTHM, LIFE, LIFE_PUBLIC, LIFEV, ACTS, ACTV, LOOK, DIETS, VIBES, MIX, NEXT, NEXTV, OPEN_TO, JOB, POSTS,
    PERSONAS, TRAITS, AXWORD, axes, codeOf, persona, bestWith, track, takesFor, deck, KINDS, CARDS, card };
});
