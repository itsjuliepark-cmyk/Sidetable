# Hash Table Concept (v0.2)

- Early concept document; current behavior is described in [app/README.md](app/README.md)
- Business review is in [BUSINESS.md](BUSINESS.md); the early prototype is [sixtop.html](sixtop.html)

What changed in the current version

- Table names: Topic, Kindred → Tech, Social
- Tracks: 4 → 14
- Invitations: pick how many dinners per week (1 to 5) and invitations are sent
- Personality axis: Host↔Guest → Easygoing↔Planner
- No-show policy: a late-change point system instead of a deposit
- Captain: members take turns instead of club leaders, with three missions and stripes
- Industry table: a table joined by an industry guest, with priority for captains who have stripes
- Format: a web app, not an App Store app

## One-line definition

- A web app for people tired of big gatherings that builds 4 to 6 person dinner tables of people who share interests and are likely to click
- The name Hash Table: a data structure every developer knows; it puts similar things into the same slot (table), the same principle as a service that seats people by interest
- # is also a hashtag, so the name also means gathering people by interest tags
- Slogan: Six seats. Both sides of the Charles.
- The Charles River runs between HBS and MIT, and between Boston and Cambridge, so the slogan still works after the public launch
- Secondary line: Fewer people. Better conversations.

## v0.2 decisions

| Item | Decision |
|---|---|
| Relationship to Amie | Fully separate; only the engine, server, and design are shared |
| Start | Harvard × MIT, with official partnerships with the tech clubs on both sides |
| Long-term goal | Public launch in Greater Boston |
| First topics | 4 tracks: Generative AI, Healthcare AI, Entrepreneurship, Climate |
| Matching | Considers personal fit as well as shared interests |

## Who it is for

| People like this | Today's problem |
|---|---|
| People tired of big receptions, mixers, and club events | Business cards get exchanged, but nobody meets again |
| People who want deep conversation | Evenings that end with nothing but small talk |
| People new to Boston or staying after graduation | Few friends outside school |
| Couples and married people | Dating-app-style gatherings feel awkward |

## Design 1: connect people who share tech-related interests

- People hesitate to join a "make friends" meetup for fear of looking lonely, but a "Healthcare AI dinner" has a clear reason to exist, so there is no awkwardness
- So the first table is a topic-centered Topic table, a format that also fits naturally with tech club partnerships
- Matching considers personal fit from the start
- People who have experienced a first table are offered a Kindred table built from people likely to click with them, regardless of topic

## Design 2: two-layer profile, two kinds of tables

### Profile

| Layer | Contents | How it is collected |
|---|---|---|
| A. What you love | Tracks, specific interests, angle (building, investing, operating, research, switching fields), hot takes | Chip selection, 3 hot takes |
| B. How you connect | Friend Persona, meeting frequency, life stage, activities to do together, relationship sought | Friend test (the friendship version of the Amie test) |

### Tables

| | Topic table | Kindred table |
|---|---|---|
| In one line | People obsessed with the same topic | People who could become real friends |
| Matching weights | Topic 60, people 40 | Topic 20, people 80 |
| Topic | One track (e.g. Healthcare AI) | Conversation starters Charlie picks from what the six have in common |
| Day | Wednesday 19:30 | Friday 19:30 |
| Starts | From day one | From week 3 of the pilot |
| Table deck | Origins → The split → Napkin startup | Origins → Go deeper → Plan the next one |
| Next step | The next table in the same track, 1:1 coffee | Reunion table, regulars |

- Both tables are half HBS and half MIT
- After going public, the direction is to mix neighborhoods, schools, and workplaces

## How it differs from a dating app

| | Amie (dating) | Hash Table (real friends) |
|---|---|---|
| What it looks at | Attraction, looks preferences, dating style | Humor, depth of conversation, meeting frequency, life stage, activities to do together |
| Similarity vs. difference | Some axes work better the more different people are | Mostly better when similar; exceptions are talker vs. listener and planner vs. follower |
| Unit | 1:1 | Group first; 1:1 only when both pick each other |
| Success metric | A single match | Meeting the same people again, many times |
| Photos | Central to matching | Used only to recognize each other at the restaurant |
| Gender | Gender and orientation filters | Mixing is the default; relationship status appears only as life stage |
| Result | Love Persona | Friend Persona |

### Evidence

- Time it takes to become friends: about 50 hours for a casual friend, about 90 hours for a friend, 200+ hours for a close friend (Hall, 2019)
- One dinner is 3 hours, so designing for repeat meetings is the core
- People tend to befriend people similar to them (homophily, McPherson et al., 2001)
- Gradually increasing self-disclosure brings people closer faster (Aron et al., 1997, "36 questions"); reflected in the order of the Table deck rounds

## Friend test (about 3 minutes)

- Like Amie, the user answers situational questions and Charlie reacts right away

### Four axes

| Axis | Two ends | How it is matched |
|---|---|---|
| Conversation | Spark (opens up first) ↔ Listen (listens well) | Mixed; 1 to 3 Sparks per table |
| Conversation wanted | Deep ↔ Playful | Similar; if expected depth differs, both get bored |
| Plans | Host (makes plans) ↔ Guest (goes along) | At least 1 Host per table; without one, the group never meets again |
| Shape of friendship | Ritual (the usual place) ↔ Adventure (something new) | Similar |

### Example types

| Code | Name | In one line |
|---|---|---|
| SDHR | The Hearth Keeper | Hosts a dinner every month that everyone talks about for ages |
| SPHA | The Instigator | Makes the best nights happen with "Wait, should we try this?" |
| LDGR | The Confidant | Loves nothing more than two phone-free hours with one friend |
| LDHA | The Curator | Finds a small exhibit, a hidden bar, or a book and brings friends along |
| LPHR | The Group-Chat Keeper | Keeps the group chat alive and remembers birthdays |
| LPGA | The Easy Yes | Always OK with anything, no fuss |

### Questions

| # | Question | Mainly measures |
|---|---|---|
| 1 | It's 7pm Friday and your plans suddenly fall through. What do you do? | Host/Guest, Spark/Listen |
| 2 | What conversation could you keep going until 2am? | Deep/Playful |
| 3 | The group chat has been quiet for two weeks. What do you do? | Host/Guest |
| 4 | Your ideal Saturday with friends? | Ritual/Adventure |
| 5 | Meeting frequency, life stage, activities to do together, relationship sought | Matched with similar people; activities feed post-dinner plans |

### People fit score

| Factor | Weight | Direction |
|---|---|---|
| Conversation depth (Deep/Playful) | 20% | Similar |
| Meeting frequency and relationship sought | 20% | Similar |
| Life stage | 15% | Similar (parents with parents, newcomers with newcomers) |
| Activities to do together | 15% | The more overlap the better |
| Ritual/Adventure | 10% | Similar |
| Spark/Listen balance | 10% | Mixed |
| Host included | 10% | At least 1 per table, required |

- Topic fit (overlapping interests, disagreement on hot takes, mixing angles) is the same as v0.1

## Becoming real friends

| Step | What happens | When |
|---|---|---|
| 1. First table | Topic table | Week 1 |
| 2. See again? | Pick the people you want to see again; revealed only when both pick each other | Next morning |
| 3. Round two | If 3 people say yes, they meet again 2 weeks later on the same day at the same place; empty seats go to new people who picked that evening | Week 3 |
| 4. Regular table | If still yes after round two, again 2 weeks later | 2 to 3 months |
| 5. Plans beyond dinner | If activities overlap, Charlie suggests plans like running or climbing | Any time |

- Tables are linked with a one-line "Before your next table", and the next table opens with that story
- 1:1 opens only when both pick each other, and it's named "Coffee?" so it doesn't sound like a date
- The North star is the number of pairs who have met the same person a third time, the most direct signal that a friendship is forming

## Four tech tracks

| Track | Specific interests | Partner clubs | Example hot take |
|---|---|---|---|
| Generative AI | AI agents, Foundation models, AI products & UX, AI & the future of work, Developer tools, AI policy & safety | Tech and AI clubs | "AGI arrives before our 10-year reunion." |
| Healthcare AI | Clinical AI, Drug discovery & bio, Digital health, Health systems & payers, Medtech & devices, Mental health | Healthcare clubs | "Hospitals will buy AI long before doctors trust it." |
| Entrepreneurship | Finding a cofounder, Fundraising, Consumer, B2B & SaaS, Lab spinouts, Search funds & ETA | Entrepreneurship clubs | "You should start a company right out of school." |
| Climate | Energy & the grid, Carbon removal, Climate fintech, Mobility & EVs, Food & ag, Climate policy | Energy and climate clubs | "AI's power demand is a climate opportunity, not a problem." |

- If a track doesn't get 6 HBS and 6 MIT members in a week, merge it with the closest track
- Better than opening with an under-filled table

## Official tech club partnerships

| | Details |
|---|---|
| What the club gets | A small-group follow-up program after big events with no operating burden, and the title of a joint HBS×MIT program |
| What we get | First recruits, trust, club newsletters and Slack channels |
| Format | One pair of clubs (one on each side) per track, e.g. Healthcare Club × Hash Table |
| Club leader role | One Table captain per table for the first 2 weeks |
| Asks | 4 Wednesdays during the term, 2 announcements in club channels, dessert for the first dinner (optional) |
| One-line pitch | "Your big events fill the room. We make sure people meet again." |

- Co-branding between a student club and a for-profit service, and use of the Harvard and MIT names and logos, require checking school rules
- Take care not to appear school-endorsed; check both student affairs offices' rules before the pilot

## From Harvard × MIT to Greater Boston

| Stage | Timing (example) | Who | Verification | Condition for the next stage |
|---|---|---|---|---|
| 0. Pilot | Fall 2026 | HBS × MIT Sloan, 4 tech tracks | School email | 90% attendance, 60% re-signup, reunion tables happening |
| 1. Campus | Spring 2027 | All Harvard and MIT graduate students and postdocs; Kindred table officially opens | School email | Steady growth in third-meeting pairs |
| 2. Boston schools and alumni | Fall 2027 | Graduate students at Tufts, BU, Northeastern, BC, etc., and alumni living in Boston | School or alumni email | Enough people per neighborhood to fill tables every week |
| 3. Greater Boston | 2028 | Anyone 22+, by application and referral from existing members | ID, selfie, workplace or LinkedIn | |

What to protect when going public

- The first members shape the culture, so mix campus members into early public tables
- Open neighborhood by neighborhood: Cambridge, Back Bay, South End, Seaport, Somerville, in that order, with 2 to 3 restaurants secured per neighborhood
- Expand topics: themes people outside school also relate to, such as Books & Ideas, Food & Boston, Running & Outdoors
- Serious revenue starts with a monthly membership at the public stage

## Not looking like dating

- Matching does not use looks, dating style, or orientation
- Mixing genders is the default; a women-only table option still needs a decision
- Group chats and 1:1s use friend language like "Coffee?" and "Reunion table"
- "Treated this like a date" is included as a report reason
- The start screen and table rules state that couples and married people are welcome and that it is "Not a dating app"

## During dinner: Table deck

| Round | Topic table | Kindred table |
|---|---|---|
| 1 (10 min) | Origins: "What did you almost do instead of business school?" | Origins: "Where's home, and what do you miss about it?" |
| 2 (20 min) | The split: argue the other side of a hot take the table disagreed on | Go deeper: "What's something you're proud of that nobody here would guess?" |
| 3 (20 min) | Napkin startup: Sloan decides what to build, HBS decides who pays | Plan the next one: one thing to do together within 3 weeks, with a date set on the spot |
| Last | Pick the people you want to see again (next day in the web app, private) | Same |

- Round 3 of the Kindred table is the link that leads to a reunion

## Pilot (4 weeks)

| Item | Plan |
|---|---|
| Duration | 4 Wednesdays; Friday Kindred tables added in weeks 3 and 4 |
| Size | 80 people (40 HBS, 40 MIT), about 48 per week, 2 tables per track |
| Recruiting | 4 pairs of clubs by track; club leaders serve as Table captains |
| Venues | 2 to 3 restaurants in Central Square (one stop from Harvard Square and Kendall) |
| Cost | Everyone pays for their own meal; $10 deposit (returned on attendance) |
| Operations | For the first 2 weeks, a person reviews the algorithm's output before seating |

### Success criteria

| Metric | Target |
|---|---|
| North star: third-meeting pairs | 20+ pairs during the pilot |
| Attendance | 90%+ |
| Table rating | 4.3 / 5 or higher |
| Re-signup within 3 weeks | 60%+ |
| Mutual picks | At least half of attendees matched with 1+ person |
| Kindred table sign-ups | 40%+ of Topic table attendees |

## Risks

| Risk | Response |
|---|---|
| The embarrassment of a "friend-finding app" | The entry point is a topic; Kindred tables are offered only to people who have been once |
| Spreading people across 4 tracks | Merge with the closest track if a track has fewer than 12 people |
| Relationships that end after one meeting | Required Host, Plan the next one round, reunion tables |
| HBS dominating the conversation | Spark balance, taking turns to speak each round |
| Turning into a pitching or recruiting venue | Max 2 investors per table, no pitching |
| Using school names | No wording that looks like school endorsement; check student affairs rules |
| Change of atmosphere after the public expansion | Application and referral, neighborhood-by-neighborhood launch, mixing with campus members |

## Still to decide

1. Name: changed to Hash Table (2026-10-17); the previous name was Sidetable (2026-10-06); Tech Table was ruled out because it overlaps with Tech2Table in SF; check trademark and domain before going public
2. Kindred table day: Friday (recommended) or Sunday brunch
3. Women-only tables: choose between from the pilot, from the campus stage, or not at all
4. Track launch: all at once if all 4 club pairs are secured; otherwise Generative AI and Entrepreneurship first
