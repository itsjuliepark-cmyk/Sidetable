# Hash Table Web App

- The web app actually used in the Harvard and MIT pilot
- Opened from a browser link with no App Store install; add it to the home screen to use it like an app
- Runs on a single Node server file with no external packages and a single JSON data file (same structure as the Amie beta)
- The screens say Hash Table, but the code folder (sixtop/), environment variables (SIXTOP_*), and GitHub repository name (Sidetable) keep the old names
- At Harvard, every school can sign up, not just HBS: the College, Kennedy School, Law, Medical, SEAS, and more
- To accept people from outside these schools, just add the school and email domain to `SCHOOLS` in `public/shared.js`
- Planning is in [CONCEPT.md](../CONCEPT.md), business review in [BUSINESS.md](../BUSINESS.md), and the early prototype in [sixtop.html](../sixtop.html)

## Running locally

```bash
npm run seed
```

```bash
npm run dev
```

- `seed`: creates 40 sample members (20 Harvard, 20 MIT) and demo data, and prints a link that signs you in as Jordan
  - Last week's tech dinner: next-day picks and 1:1 chats are done; 3 people said yes, so round two is booked, with new people in the empty seats
  - This week: Jordan has two invitations (tech and social), and Jordan is captain of the social table
  - Next week: 34 people have already picked their available evenings, so tables can be built right away from the admin screen
  - At last week's table, Jordan completed all three captain missions, earning 1 stripe and one Industry table next week
  - Also 6 Hangs, Board posts, and 4 fictional restaurants booked by captains
- `dev`: the admin key is `local-admin`, and verification codes are shown on screen instead of emailed; never use it for the real pilot
- Web app at <http://localhost:8800>, admin page at <http://localhost:8800/admin>
- The phone demo (`npm run demo`) creates invitations as soon as you pick an evening, without waiting for Sunday night
- Running `npm run demo` also regenerates `demo/hash-table-demo.html` in the repository; commit it together with any code changes
  - The first screen's Join offers three starting points: sign up from scratch, a new member who has finished signing up, or Jordan

## Running the real pilot

```bash
SIXTOP_ADMIN_KEY=choose-a-long-secret SIXTOP_PUBLIC_URL=https://your-domain npm start
```

| Environment variable | Default | Description |
|---|---|---|
| `SIXTOP_ADMIN_KEY` | Random on each run, printed to the log | Admin page key; must be 16+ characters on an https address |
| `PORT` | 8800 | Assigned automatically on Railway and similar |
| `SIXTOP_DATA_DIR` | Railway volume path, otherwise `./data` | Where members, tables, chats, photos, and backups are stored; refuses to start on Railway without a volume |
| `SIXTOP_PUBLIC_URL` | None | Base address for invitation links, club links, and restaurant links |
| `SIXTOP_TZ` | `America/New_York` | Time zone for deadlines, venue reveals, and other time calculations |
| `SIXTOP_AREA` | `Central Square` | Default neighborhood for newly opened nights |
| `RESEND_API_KEY`, `SIXTOP_MAIL_FROM` | None | [Resend](https://resend.com) key and sender address for verification codes and restaurant email; sign-up is impossible without them |
| `SIXTOP_MAIL` | None | `show` displays verification codes on screen; for local development and demos only; refuses to start on an https address |
| `SIXTOP_AUTO_WEEK` | None | `1` builds and publishes next week's tables automatically at 20:00 on Sunday |
| `SIXTOP_PUSH_DAY` | 4 | Maximum number of notifications one person receives per day |
| `SIXTOP_VAPID_PUBLIC`, `SIXTOP_VAPID_PRIVATE` | Generated on first run and saved in the data folder | Push notification keys; changing them requires every member to re-enable notifications; refuses to start with invalid keys |
| `SIXTOP_VAPID_SUBJECT` | `SIXTOP_PUBLIC_URL` if it is https | Contact given to push services (e.g. `mailto:hello@your-domain`); Apple rejects notifications with a fake address |

## Running a week

Admin tabs: Tables, Places, Ops, Pop-ups, People, Roles, Links, Reports

| When | What happens |
|---|---|
| Once, at the start | Create a sign-up link per club in the Links tab and share it in club channels; register partner restaurants in Places and the ops team in Ops |
| By 18:00 Sunday | Members choose next week's number of dinners (1 to 5) and available evenings (Mon to Fri) |
| Sunday evening | Build tables with Build the tables in the Tables tab, review, then Publish the week; restaurants and captains are assigned automatically |
| 22:00 Sunday | The week's plan is emailed to each partner restaurant |
| Right after publishing | Invitations and group chats open for members; Charlie posts a table introduction and the week's question |
| 09:00 the day before | Reminder that changes are free until noon |
| Noon the day before | Free changes close and the final headcount goes to the restaurant (Monday tables go out Sunday evening, with the deadline at 10am Monday) |
| Noon on the day | Restaurant address revealed and the captain's name posted in the group chat |
| That evening | The table plays the three rounds of the Table deck |
| 10:00 the next day | Feedback prompt: attended or not, rating, who to see again, round two or not |
| After that | 1:1 chats open between people who picked each other; the admin marks attendance |

- With `SIXTOP_AUTO_WEEK=1`, building and publishing run automatically at 20:00 on Sunday
- Special nights are set up separately under A special night in the Tables tab with a date and neighborhood; sign-ups close 3 days before
- The numbers at the top of the admin screen are the same pass-line metrics as in BUSINESS.md

## Screens

### First screen

- A 22-second vertical video plays full screen, with the # mark and Hash Table logo on top, Charlie's line near the bottom, and Sign in and Join at the very bottom
- Warm colors like late-afternoon sunlight, centered on tech scenes of students building things themselves
- The video has five scenes
  1. Campus in fall, coffee and a laptop on the lawn, the walk to class: "A small group of builders, one table, deeper connection"
  2. Rapid cuts of code on screen, a 3D printer and CAD, drone assembly, Arduino soldering, a robot arm, a prosthetic hand, a microscope, and a circuit board, with "Late nights, big ideas, new friends" appearing word by word
  3. Five people around one laptop, makers looking at a prototype together, sketches on a glass board, a high five in the library: "Talk AI, bio and robots until they stack the chairs"
  4. A kitchen packed with friends, a collapsing Jenga tower, a guitar in the park
  5. Setting the table together and a dinner with many people around it: "Come for the tech talk, stay for the friends"
- If autoplay is blocked, the first frame is shown and tapping plays it; with reduced motion enabled, playback is skipped
- The text sits over a shadow near the bottom so it doesn't cover faces; a terminal cursor lingers briefly at the end of the typing and then disappears
- The 6 photos behind the tech table screen are also extracted from the video's object shots (3D printer, code, prosthetic hand, circuit, drone), with no faces
- The source footage uses only Mixkit Free License clips and Pexels clips; both allow commercial use with no attribution required
- Mixkit Restricted License clips (personal use only) are not allowed; 19 of them were mixed into the video before 2026-10-17, and all were replaced
- Pexels condition: don't use footage so that people on screen appear to endorse our service

```bash
npm run film
```

- Rebuilds the first-screen video; requires ffmpeg (`winget install Gyan.FFmpeg`)
- Source clip numbers (Pexels clips are P + number) and color grading are in `art/make-film.js`; output goes to `public/video/film.mp4`
- Before adding a new clip, check the "Free License" label on its Mixkit page
- If you change the cuts, also update `FILM_T` in `index.html` to match `film.json`

### Member screens

- The same soft light tone as Amie, with rose for Harvard and mist blue for MIT
- The background is Amie's "room" with slowly drifting colored fog, a different color for each tab

| Tab | Contents |
|---|---|
| Tables | Charlie's invitations, my Hangs, this month's card, next week's plan |
| Hangs | Pop-up meetups anyone can host, on social or tech topics |
| Board | Reading, questions, hot takes, launches, events, jobs |
| People | People you've sat with and 1:1 messages |
| Me | Profile, Friend Persona, table size, captain settings, notifications, taking a break |

- Who's coming on the table screen: faces, names, and schools of the people at the table at a glance; tapping a shared interest highlights only those people with a gold border
- Words instead of symbols: days already booked in the weekly plan say "Tech" or "Social", question cards say Mild, Spicy, or Heated, and captain stripes show the count
- 1:1 chats open only when both people picked each other after dinner, both Waved, or an introduction request was accepted
- People who picked each other are seated at the same table when they pick the same evening

### Sign-up

- After school email verification, enter only name, school and program, and graduation year
- Choose a dinner type: Tech + social (default), Tech tables only, or Mostly social
- Personality questions cover four axes: Listen↔Spark, Playful↔Deep, Easygoing↔Planner, Ritual↔Adventure
- Tables are half Harvard and half MIT, with no school over half
- Charlie's reactions to answers aren't embedded in the screen; after Continue, they pop up briefly over the next screen and disappear (a translucent black card that closes immediately when tapped)
- Applies to: table type, angle, hot takes, connection-style questions (right after answering), life stage, future direction
- Pick as many tracks as you like; the first one is the track you're mainly seated in
- Specific interests also have no limit, with at least one; the first is the anchor
- Charlie's note floats just above the button, shows a brief three-dot typing indicator, then appears word by word, in a human voice (Ooh, Wow, Ha)
- Why I put you together on the table screen shows one card per reason, swiped left and right or moved with arrows
  - Each card shows the kind of reason (What you share, Where you split, Who's at the table, Across the river, etc.) with the faces of the people involved, and agree/disagree shown as bars
- Tonight's question also shows the three questions side by side as cards during voting, with Vote right as you swipe

## Tonight's question

- A game where each table splits into sides over the hottest question of the week
- Runs in a one-line bar at the top of the group chat; cards open in a sheet when tapped

| When | What happens |
|---|---|
| Table published | Charlie posts 3 question cards, each with why it's hot right now and an article link |
| Voting | One tap to vote; closes when everyone has voted or at noon the day before |
| Picking a side | Pick A or B secretly; others only see how many picked each |
| Dinner starts | Results revealed; round 2 of the Table deck uses this question |
| Next morning | Pick your position again; Charlie mentions anyone who changed their mind |

- Card formats: Balance game, Hot take, Place your bet, Would you rather, Be honest
- Social tables get get-to-know-you questions instead of tech questions
- Hangs use the same game, with voting closing 1 hour before the start
- There are 65 cards in `CARDS` in `public/shared.js`; replacing tech cards every 1 to 2 weeks is recommended
- Card selection is done in code, so there is no extra cost
- Drafting new cards weekly with Claude costs about $10 a month, plus 15 to 20 minutes of human review per week

## When you can't make it

- I can't make it on the invitation offers two choices
- Find me another evening: pick an available evening in the next 7 days, and a new invitation is sent for an empty seat at a table of the same kind
  - Excludes people you've blocked, keeps the school ratio, and prioritizes the same track for tech tables
  - If there are no empty seats, you wait, and you're seated automatically when a seat opens
- Just skip this one: skip just this time; after noon the day before, it's 1 late-change point
- While changes are free, if a table drops to three people, one person who picked that evening is added right away (so the table doesn't collapse if one more person drops); if 3 of 6 drop, it's restored to 4
- If a table drops below three people, it's merged with another table or ended
- Server code: `reinvite`, `chairFits`, `openChair`, `fillChair`, `pruneStandby`

## Making it more than one time

- Becoming close requires meeting the same people many times, so there are mechanisms linking one table to the next
- About 50 hours to become a casual friend; one dinner is 3 hours

### Round two

- The next morning, each person chooses directly whether to meet again as the same table in 2 weeks; there is no default
- If 3 people say yes, it's booked for the same weekday 2 weeks later (for a 3-person table, all 3)
- Everyone who said yes keeps a seat; remaining seats are filled with new people who picked that evening
- New people only up to the size of the first table, and never more than returning people (if 3 of 6 say yes, 3 new people)
- How new people are chosen: preferred table type, same track first for tech tables, people who haven't sat together before first, school ratio, excluding blocked pairs
- People who said no last round aren't added back as new people either
- New people are chosen during Sunday's assignment and notified on Sunday along with other invitations
- On days when many people picked the evening, seats are filled before regular assignment; on days with few, they're filled after regular assignment with the people left over (so nobody else misses out on a table)
- New people's invitations say it's a returning table and how many are coming back; existing members' invitations show the number of new faces
- Last time's restaurant is preferred for the venue; if it has no room, another restaurant
- If one vote short, One more yes is posted in the group chat
- After round two, round three works the same way
- Pairs who blocked each other are excluded; if only two remain, it's canceled

### Other connection mechanisms

- Same faces again: people who picked each other are seated together when they pick the same evening, and their faces appear on the evening-picking screen
- Since last time: write one line about something to try before the next table, and Charlie mentions it at the next table
- Your October: a Tables tab card showing this month as a calendar; tech tables in blue "Tech", social in pink "Social", round two as "Round 2", past evenings as filled cells, upcoming evenings as dashed cells, today with a border
- The calendar runs from the 1st to the last day of this month, with upcoming round twos (the same table meeting again, with new people in empty seats) and faces below
- Server code: `roundTwo`, `roundOpen`, `againNudge`, `fillRounds` inside `matchWeek`, `setLoose`, `looseFor`, `monthView`

## Venues and operations

### How restaurants are booked

- The default is the captain booking directly: the captain books a restaurant picked from the list under their own name via OpenTable, Resy, Tock, the restaurant's site, or phone
- Booking links open with the date, time, and party size filled in (OpenTable uses `covers` and `dateTime`, Resy uses `date` and `seats`, Tock uses `date`, `size`, and `time`; verified in a real browser in 2026-10)
- After booking, the captain enters the time, the name on the reservation, and a confirmation number (optional); Hash Table doesn't contact the restaurant
- OpenTable and Resy have no public booking API, so automated booking is impossible; the OpenTable Directory API requires a partnership review and contract
- Six is at the edge of online booking limits, so phone instructions are shown too; card guarantees and $25 to 50 per person cancellation fees are common for six, so there's a reminder to check before booking
- Partner restaurants (always held, or confirmed each time) remain an optional feature; since the table is already held, the captain just picks it with no booking

### Restaurant list between Harvard, MIT, and HBS

- `server/restaurants.js`: 120 places (first survey on October 20, 2026; second and third surveys on the 22nd)
- Areas: Harvard Square, Porter, Huron Village 31; Allston, Brighton 24; Kendall, East Cambridge, Cambridgeport 22; Central, Inman, Riverside, Mid-Cambridge 24; across the river, Back Bay, Fenway, Kenmore 19
- Booking method: OpenTable 67, Resy 15, own site 15, phone 21, Tock 2
- Selection criteria: places where seating six works structurally (six-tops, round tables, large booths, private rooms, large halls, online booking for 6+), places where you can talk, places with good weekday evening availability
- For each restaurant: map coordinates (OpenStreetMap), number of six-tops (many, some, few), private room and size, total seats, online maximum party size, weekday and weekend booking difficulty (easy, some, hard), overall fit (1 to 5), whether it's a partner candidate, caveats affecting a 7pm table (hours), regular opening hours (open), group surcharges or time limits (fee), rationale and sources
- 11 dropped in the first survey: places that can't seat six (Giulia, Pammy's), closed (Dear Annie and others), or bars where conversation is hard (SOJUba, Audubon, The Citizen), etc.
- 18 added in the second survey: Season to Taste, Moëca, Nirvana Taste of India, Forage (Harvard, Porter), Dumpling House, Dalí, Cafe Sushi Nisei, 5 Spices House (Central, Inman), Passage to India, Geppetto, The Lexington (Cambridge Crossing), Paperback Tavern, Shu DaXia Hotpot, Row 34 Kenmore Square, Willow & Ivy, UNI, Dumpling Palace, Zuma Boston (across the river)
- Candidates removed in the second survey: places that don't take reservations (Muqueca), closed (S&S; Cloud & Spirits converted to an event space; The Pearl temporarily closed), places where six is hard (Holdfast, Black Ruby), unverifiable (Ricen, Cafe of India, Gen Korean BBQ)
- 73 corrected in the second survey: Catalyst is open Mondays, Rail Stop closes at 8pm Sunday and Monday, Moona is open Mondays, Ariana online up to 8, Fallow Kin online up to 6, Legal Sea Foods Kendall up to 10, Atlantic Fish up to 10, Area Four adds an automatic 20% tip for 6+, Margeaux requires a card guarantee for 7+ and charges $25 per person for late changes, Urban Hearth charges $50 per person for cancellations within 24 hours, India Quality and LUCIE use their own booking pages, Loco Fenway takes phone bookings, etc.
- Information from the first Central survey that was flagged for rechecking because it was read with a page reader was rechecked and corrected in the second survey using the restaurants' own sites and articles (Althea's online limit of 8 and group tip couldn't be verified and were removed)
- Third survey (October 22): re-researched places with thin evidence, opening each booking page once in an ordinary browser to check whether six can book online and what the party size menu offers
  - Six online: 83 of the 91 that allow it were verified directly on the booking page; phone 26 (including 21 phone-only); unknown 3 (Standard Italian, Dalí, LUCIE)
  - Daedalus and Gran Gusto were switched to phone because OpenTable said six is too many
  - Online maximum party size numbers: from 26 places to 38 (the number just before "N+ Guests" in Resy's party size menu; SevenRooms, Toast, and Tock party size menus; the restaurant's own notice if stricter): Pagu 8, Sumiao 8, Gufo 12, Aatma 12, Bar Enza 7, Paperback 7, Zuma 9, Mad Monkfish 10, American Flatbread 11, Veggie Galaxy 8, etc.
  - 9 changed to easy on weekdays (Source, Gyu-Kaku, Qiao Lin, American Flatbread, Brighton Bodega, Alice, Mex, Sulmona, Atlantic Fish); Urban Hearth changed to hard; The Lexington to some
  - Noise: Sumiao (live band at night), Naco Taco, Olé, and Dumpling Palace changed to lively; Atlantic Fish to moderate; Oleana talk 3; Painted Burro talk 1
  - Costs: Talulla 23% admin fee, Paperback 20% service charge, Sumiao 2 hours for 4+, Zuma 2 hours, Koreana 20% automatic tip, etc.
  - Rationale for 12 places that had been cut at 320 characters in the second survey was restored to the full text (the cut hid thin evidence at some places, so the actual number of thin places after the second survey was 59)
- Remaining limitations: 49 places still have a field with thin evidence (mostly one field); by type, six-top count 19, noise 28, weekday 10, demand 12
  - OpenTable's noise tag is Moderate for nearly every restaurant, so it isn't used as evidence; the 7 places with only that tag have noise marked as thin evidence
  - OpenTable's party size menu is 1 to 20 everywhere, so the maximum is unknown; only whether six works can be checked
  - From around 3:20am on October 22, OpenTable started returning 403 for availability lookups; we stopped there and did not work around it (13 places unverified, including Puritan and Alden & Harlow)
- Weekday and weekend difficulty is a research judgment based on room size, booking frequency, and reviews, not live availability; the app phrases it as "Usually easy on weeknights"
- Add and update via the list button in the admin Places tab; restaurants removed from the list are paused rather than deleted (tables already booked stay)

### Good places to talk

- Noise (quiet 11, moderate 81, lively 28), talk score (3 easy 26, 2 fine if you get the right seat 90, 1 hard 4)
- Quiet and easy to talk: Harvest, The Maharaja, TooHot, Hong Kong Restaurant (first-floor restaurant), Changsho, Talulla, Ariana, Fallow Kin, India Quality, Season to Taste, Nirvana Taste of India
- Moderate but easy to talk: Henrietta's Table, Nine Tastes, Nubar, Ama, The Stockyard, Devlin's, Catalyst, Judy's Bay, Moona, Oak Bistro, Urban Hearth, The Capital Grille, Forage, Willow & Ivy, Geppetto
- Hard to talk in the evening: Russell House, Mex, La Fábrica, Little Donkey
- seat: the seat to request in the booking note; sound: a one-line description of the room; both editable in the admin screen

### Choosing by travel time (`server/trip.js`)

- No map API, zero cost: travel times in minutes calculated from walking plus real stop maps for the Red Line, Green Line (trunk, B, D, E, Lechmere branch), and the 1, 47, 66, 69, and 70 buses
- Walking is 1.25× the straight-line distance at 80m per minute; riding time uses line speed plus 30 seconds per stop, a wait before boarding (subway 4 to 6 minutes, bus 7 to 8 minutes), another wait at each transfer, and walking to a stop up to 1.3km
- Example results: HBS to Harvest 16 minutes on foot, MIT to Harvard Square 22 minutes on the Red Line, Harvard Square to Kendall 18 minutes
- Where members come from: 11 neighborhoods picked on the card (Harvard Square, HBS and Allston campus, MIT and Kendall, Central, Inman, Porter, East Cambridge, Lower Allston and Brighton, Back Bay, Fenway and BU, Longwood); no addresses collected
- If not picked, defaults by program: Business School and SEAS map to the Allston campus, Medical School and Public Health to Longwood, MIT to Kendall, and the rest of Harvard to Harvard Square
- For each table and restaurant, the travel time of the farthest person and the average are calculated; the farthest person is weighted more so nobody travels far alone
- Automatic partner restaurant assignment uses the same criteria (without coordinates, same neighborhood first as before)

### Order of the captain's list

- First grouped by check records: places with availability confirmed between 6 and 8, unchecked places, places full for six (when the table is smaller), full places
- Within each group, a fit score for the table (lower is better, roughly in minutes)
  - Travel: farthest person's time + half the average
  - Conversation: 10 per talk level; noise quiet 0, moderate 3, lively 9 (a quiet, easy-to-talk place beats a noisy one by the equivalent of 20 minutes of travel)
  - Seating six: six-tops many 0, some 4, few 10; private room -2
  - Booking difficulty for that weekday: easy 0, some 5, hard 12 (Friday and Saturday use the weekend rating)
  - Records from other days: ±8 for the same weekday, ±6 for a different weekday; if every checked day was full, the "usually easy" label and score are lowered too
  - Insufficient online party size, phone booking, number of our tables that day, research fit
- The first plausible restaurant gets "Best fit for your table" even if unconfirmed
- Cards show lines and tags like "Everyone's there within 22 minutes", "Lots of tables for six", "Private room", "Usually easy on weeknights"
- Tapping a restaurant shows "Getting there" with headcount and time by neighborhood ("From MIT and Kendall, two of you: 23 minutes on the Red Line"), plus any group surcharge or time limit

### Spot guide for captains (web page)

- `node scripts/build-guide.js`: generates `dist/spot-guide.html` and `demo/spot-guide.html`, using the same data, travel times, and scores as the app
- Pick the date, time, and headcount by neighborhood at the top (e.g. HBS 3, MIT 3), and the list and map re-sort for that table
- Map: the Charles River, major roads, subway lines, parks, and campuses are drawn directly from a simplified one-time OpenStreetMap download (`scripts/guide/map.json`; no map tiles, no external requests); zoom, pan, and pinch supported
- For each restaurant: travel time (by neighborhood), conversation, six-tops, private room, booking difficulty that day, caveats (surcharges, hours affecting a 7pm table), regular hours under Why it's here, a booking button with date and party size filled in, copy phone number, copy booking note, directions, rationale and sources
- Filters: quiet places, private rooms, many six-tops, easy that day, can book that party size online, 5 areas, cuisine, price, 4 sort orders
- Table view: all 120 places sortable by column, with booking method links
- Online party size column: the confirmed maximum number; 6+ if six works but the maximum is unknown; Call if online booking isn't possible; cards show Online up to 8, Takes six online, or Call for six tags
- The check date in availability lines is the day each record was actually seen (e.g. when we looked Oct 22)
- How to book view: 7 steps, with a phone script filled in for that day and a copyable booking note
- Places closed or not taking bookings that day collapse to the bottom; supports phone screens and dark mode

### Partner candidates (places to ask to hold a six-top on weekdays)

- Quiet places with rooms: Harvest (Fireplace Room 28, front alcove 24), Ariana (private room 22), Henrietta's Table (private room 45), Nubar (Berkeley Room 8 to 20; seats regular guests when free), The Maharaja, Changsho
- Large places that are quiet on weekdays: Rail Stop (Brighton Hall 30), Pagu (private room 20, mezzanine 20), The Stockyard (Wine Room 15 to 40), Catalyst (Crick Room 14), Bambara (mezzanine 50), Olé (back room 75)
- Across the river: The Capital Grille (small rooms 10 to 16), LUCIE (10 to 30), Joe's on Newbury (Wine Room 24)
- This list is based on the research's partner flag, fit of 4 or higher, and weekday easy

### Checking real availability (spot checks)

- OpenTable, Resy, and Tock don't publish availability APIs, and machine-reading the pages violates their terms (OpenTable even blocks it), so we use records of what people saw; no cost
- Three ways records come in: what captains answer when they return from a booking page, the ops team's Spot checks tab, and `server/spotchecks.js` with pasting
- `server/spotchecks.js`: opens each restaurant's booking page for six at 7pm and records the times shown around 7 by date
- Checked the morning of 2026-10-19: 46 places for Fri 10/23 and 24 places for Wed 10/21 (OpenTable started blocking consecutive lookups, so the rest of Wednesday was left blank rather than filled with guesses)
- For Fri 10/23 between 6 and 8pm: 24 places had room for six, 22 didn't, and La Fábrica can't take six online, so phone
- Checked the morning of 2026-10-22: 47 OpenTable places for Tue 10/27; 42 had room for six between 6 and 8, 3 didn't (Urban Hearth, Krasi, Row 34 Kenmore), 2 phone (Daedalus, Gran Gusto)
- Tuesday clearly has more room than Friday; when there's a record for the same weekday, it's used to predict other Tuesdays
- Resy pages no longer show times without clicking, so there are no Resy restaurants for 10/27
- A time between 6 and 8 means available; none means full; if full for six but the table is four, it's "tight" (four might work)
- For dates nobody has checked, records from other days are shown with their dates and never presented as confirmed ("Nobody has checked Saturday yet, so nothing here is confirmed")
- Newer records win; records older than 4 months are deleted automatically
- These are records, not live data, so the list shows who (we, you, another captain) looked and when; the only guaranteed seats are partner restaurant holds

### When a captain returns from a booking page

- After tapping a booking button (or phone) and returning to the app, an "Oh hey, you're back!" sheet appears (trips under 2.5 seconds are ignored)
- Four answers: booked it (enter the booking time and name), there were times but not booked yet (tap the times seen in 15-minute steps), nothing between 6 and 8, they said to call for this party size
- Answers are saved to the server immediately (`/api/captain-seen`) and reflected right away in other captains' lists for that day: places with room move up, places without move to the bottom
- Times booked by a captain are our seats, so they're removed from the free times other captains see
- If the app was closed in the meantime, the captain card shows one line, "How did The Maharaja look?", which opens the same sheet (within 12 hours, once per restaurant)
- In the demo, the same sheet appears 1 second after tapping a booking button
- The "Mark it full" link on the booking screen stays as a shortcut

### Predicting unchecked dates

- Uses records from other days (spot checks, captain answers) together with tables captains actually booked
- If there are records for the same weekday, only those; otherwise all; full for six also counts against four-person tables; fake bookings in the demo are excluded
- Party size rules: room for six means room for four too; full for four means full for six too

### Ops Spot checks tab

- A new tab in the admin page showing, for each evening in the next 8 days, the number of tables, tables without a venue, places checked, and places with room
- Picking an evening lists the restaurants open that day, with places nobody has looked at in 24 hours on top and quiet places first within that (the same order as the top of the captain's list)
- For each restaurant: the latest record, a booking link filled in for six (phone number for phone restaurants), time buttons from 6:00 to 8:00 in 15-minute steps, "Nothing near 7", "Says call"
- 10 seconds per place and 10 places per evening is enough; recommended after the weekly tables are published on Sunday night
- At 8:30pm Sunday, if any evening with captain tables has fewer than 5 places checked, the person on duty gets one alert
- The JSON paste box also moved to this tab (`/api/admin/spot-check`, by restaurant name or id)

### The venue list captains see

- Only places open on that date: excludes weekly closures, closure dates entered by the admin, and places already full with our tables that day
- Order: partner restaurants first, then the "Order of the captain's list" above (check record groups, and fit score within each)
- Places confirmed full go to the bottom behind a "Show them anyway" button
- Filter with cuisine chips at the top: All, Tacos, Asian (Chinese, Japanese, Korean, Thai and Vietnamese), Pizza & Italian, Indian, American, Mediterranean, Seafood, Vegetarian
- Each card shows cuisine and neighborhood, atmosphere, travel time, available times and when they were checked ("At 6:45, 7:00 and 7:15, when we looked today at 6:30 AM"), other days' records with dates for unchecked days ("Other nights: room on Wed Oct 21"), "Free for six" or "Full around 7", conversation, six-tops, and booking difficulty tags, and price range
- Tapping a restaurant shows check records, the room's atmosphere, the seat to request in the booking note, and available time buttons
- Shows 10 at a time, with Show more for the rest
- Booking buttons open with that date, party size, and confirmed available time filled in

### Safeguards for captain bookings

- If there's no booking 48 hours before dinner, the captain gets a reminder, but only once they've been captain for 6 hours
- If there's still none 36 hours before, the captain role passes to another member and it's announced in the group chat and by notification, only at least 6 hours after the reminder; the previous captain is notified too
- Even if nobody wants to be captain, one person is captain; tables without a captain show an "I'll be captain" button
- If not yet booked at the noon reveal, the group chat says "the captain is booking"; once booked, the venue, time, and name on the reservation are announced right away
- If none by the free-change deadline (noon the day before), the person on duty is alerted; booking is still possible until 2pm on the day
- If the table was created after noon the day before, the deadline is the later of 2 hours after publishing and 10am on the day
- If there's no venue by 2pm on the day (1 hour after the free-change deadline for tables created very late), the table is canceled so nobody makes a wasted trip, with priority seating next week
- If a booking falls through on the day, another place can be booked within 1 hour, and the person on duty is alerted too
- If a booking falls through or the venue or time changes after the noon reveal, everyone at the table gets a group chat message and notification
- If a partner restaurant can't take the table on the day or the person who booked leaves, the captain gets a notification and 2 hours to rebook
- If the person who booked leaves after the free-change deadline, the booking stays and the person on duty is asked to check with the restaurant
- Booking reminders and captain handoffs are sent only between 8am and 9pm
- If the headcount changes after booking, the person who booked gets a notification to update it, with an "Update it" link on the briefing card
- The booking belongs to whoever made it: when a table is canceled, merged, rebooked elsewhere, or an evening is canceled, that person is reminded to cancel the restaurant booking
- If the person who booked hands off captain or drops out, they're asked to keep the booking, and the new captain's screen shows whose name it's under
- Round two doesn't inherit the previous booking; the new captain books, with the previous venue at the top of the list
- "I booked it" activates only after opening the booking page or entering a confirmation number
- Mission records and stripes go only to the person who booked directly and to captains who actually attended
- In 4 to 6 week simulations with 50 and 100 people: 0 tables reached the evening without a venue and 0 phantom bookings (a venue shown that nobody booked)

### Partner restaurants (optional)

- Registered in the admin Places tab, choosing between "Captains book it themselves" (default), always held, or confirmed each time
- For captain-booked venues, enter the booking route (OpenTable, Resy, Tock, site, phone), booking link or phone number, price range, whether a card guarantee is required, and a one-line atmosphere
- For partner restaurants, register the name, address, days, number of tables, contact, closure dates, and contract terms
- The default is always held, excluded only when the restaurant says it can't take the table
- Restaurants that want to confirm every evening use confirm-each-time mode, and the address stays hidden from members until confirmed
- When invitations go out, tables are placed automatically at partner restaurants with room, preferring the same neighborhood and less crowded places
- Email restaurants receive: the weekly plan on Sunday night, the final headcount at noon the day before, and any changes after that until dinner starts
- If an email fails, it's resent a few minutes later and the person on duty is alerted; for restaurants without email, the person on duty is asked to call at final headcount time
- Only headcount, time, dietary notes, and the captain's name are shared, with no member names or profiles
- Restaurants confirm or decline on a dedicated page (`/place?k=…`) without signing in
- If a restaurant declines, the table moves to another partner restaurant; if there's nowhere to move it, the person on duty handles it
- If a confirm-each-time restaurant gets one more table, already confirmed tables stay as is and only the new table is confirmed again

### Members

- Free changes until noon the day before (until 10am Monday for Monday tables)
- After that, a cancellation is 1 point and a no-show is 2 points; 3 points within 60 days pauses invitations for 2 weeks
- No points for dropping late if seated with someone you've blocked or reported; reports alert the person on duty immediately
- If a table drops below three, it's merged with another table or ended; evenings with only two people are never created because they could look like a date
- People from closed tables get priority seating next week
- Captain: one per table; see "Captain: three missions" below for the three missions
  - Ordered by who hasn't been captain recently; can opt out in Me; can hand off up to two hours before

### Ops team

- At first, the founder and 1 to 2 campus leads take turns being on duty for a day each
- The person on duty receives email alerts about tables without seats, restaurants that haven't replied, and same-day changes, and handles them in the Ops tab
- When RSVPs close, the headcount is sent to the person on duty; dates can be changed in the Places tab (Thanksgiving, year end)
- Server code: `placeTable`, `savePlace`, `syncBooking`, `placeAnswer`, `placeMail`, `shrink`, `closeTable`, `lateChanges`, `pickCaptain`, `alertOps`; the restaurant page is `public/place.html`

## Captain: three missions

- One member per table takes a turn as captain, with people who have been to a dinner preferred over first-timers (so nobody gets a job with their first invitation)
- When first published, there's no separate captain notification; the invitation notification just adds one line: "There's a small job inside for you"
- A sealed invitation only shows a gold "Open this one first" ("Open soon" if there's only one invitation); the word captain isn't mentioned before opening
- Inside the invitation, the captain role is explained in plain words: the remaining missions, the booking deadline, and that it can be handed off if wanted
- Only after the invitation is opened does a "You're the captain" line and the next mission appear right below that invitation on home (e.g. Next: book the spot by Sunday at noon)
- Captains get clear animations
  - Sealed envelope: a gold border circles, it glows brightly and wiggles every 2 to 3 seconds, a gold flag bounces on the seal, and the gold "Open this one first" tag pulses
  - On first open: a "You're the captain!" gold card appears in the center for 3 seconds with rotating light rays and gold confetti, then a gold Captain stamp appears in the corner of the letter
  - Home: the whole captain line shimmers gold and the flag waves
  - Table screen: a thick gold border circles the briefing card with a soft glow, a large flag, and a flag on the captain's face in Who's coming
- The briefing card on the table screen shows the three missions and a progress bar
- If the captain changes midway, a captain notification is sent at that point
- Safeguards when the captain doesn't show up
  - If the captain hasn't opened the invitation or the table: after 12 hours from publishing (or 35% of the remaining time if short), captain passes to a table member who has opened it (the original captain is told "your seat stays")
  - If opened but not booked: reminder two days before, handoff to someone else 36 hours before (existing)
  - If nobody has booked 4 hours before the deadline: everyone at the table is told "anyone can book, and whoever books is captain", with an I'll book it button on the table screen and home
  - If there's no booking by the deadline (2pm on the day), the table is canceled, with priority seating next week and an alert to the person on duty (existing)
  - If the captain cancels, someone else becomes captain immediately, preferring people who opened it and people who have been to a dinner
  - Even if the captain doesn't show up on the day, the name on the reservation is visible to everyone at the table, so someone else can check in
- Mission 1, book the venue: pick from up to 4 places in the list, book directly, and enter the time and name on the reservation with "I booked it"
  - If the original time isn't available, booking within an hour either side is allowed; the booked time is shown on the table screen and invitation
  - The table is only told that the captain booked a venue; the venue is revealed at noon on the day
  - If it's a place a partner restaurant is holding, choose Keep or another place with no booking
  - If the booking falls through, revert with "It fell through" and book again
- Mission 2, get the vote out: at least three quarters of the table votes on Tonight's question
  - Up to two Nudges (3 hours apart): a captain message and vote button in the group chat, and a notification to people who haven't voted
- Mission 3, separate checks: ask for separate checks when sitting down, and check Done from the evening of the dinner through the next day
- Confirming the party at the door with "Hash Table, party of six" stays the same
- Completing all three missions earns one stripe, with a report card and celebration effect the next morning
- People at the table can say thanks the next morning with "Thank Jordan for captaining"
- Ranks: 1 stripe Captain, 3 Senior captain, 5 Commodore, recorded in the Captain's log on the Me tab
- Server code: `missions`, `captainStats`, `spotOptions`, `bookLink`, `captainSpot`, `captainBook`, `captainNudge`, `captainChecks`, `briefCaptain`; API `/api/captain-spot`, `/api/captain-book`, `/api/captain-nudge`, `/api/captain-checks`

## Industry table: captains first

- A tech table joined by an industry guest (a founder, investor, working engineer, etc.)
- Created as an Industry table under A special night in the admin Tables tab, entering the guest's name, role, and a one-line intro
- For the first 48 hours only captains with stripes can sign up; then it opens to everyone
- When building the table, people with more stripes are seated first
- When it opens, captains are notified right away, and everyone 48 hours later (if Ping everyone is on)

## Board

- A board for people at Harvard and MIT
- Post types: Worth reading, Ask, Hot take, Shipped, Event; job postings go in the Roles tab
- Hot takes get Agree/Disagree votes; every post gets hearts and comments
- People is not a member directory but a list of people you've met, and the server only sends those people

## Table building rules

- Code in [server/tables.js](server/tables.js), tests in `test/tables.test.js`
- Hard requirements: 4 to 6 people, at least two schools, no school over half, excluding people who blocked or reported each other
- Reports persist even if a block is lifted, and also exclude seating together when filling empty seats on other evenings
- The number of tables is set by the smaller school's headcount (at most 1 table per 2 people from the smaller school), preventing tables from breaking with people scattered one by one
- People who have already sat together are placed at different tables as much as possible (except reunion tables)
- Matching weights: tech tables topic 60, people 40 / social tables topic 20, people 80
- Tracks short on people merge with the closest track; if most tracks are small, everyone is pooled and same-track people sit together
- After assignment by track, if 4 or more people remain, they're mixed into one table named after the track with the most overlap
- After regular assignment, a second pass makes sure "nobody is left out", in this order from the smallest concession
  - An empty seat at a table of the preferred kind (same track first, smaller tables first)
  - A new table of 3+ from the people left that day
  - Relaxing the school ratio (two schools must still be included)
  - Someone alone that day: bring in 2 to 3 people who picked the same evening to make a new table, taking them from six-person tables, people who wanted one more dinner, or tables with room on other evenings (people who move keep their dinner count)
  - If still none, a table of the other kind; finally, a single-school table only if only one school is present that day
- When taking people from their original table, that table keeps its school ratio and at least 4 people
- Seats filled in the second pass are marked `rescued` in seats, tables with a relaxed ratio are marked `loose`, and the admin screen shows the school mix
- Assignment fails only when nobody else picked the same evening that week; in that case the person waits for empty seats on those evenings (any kind) and gets priority seating next week
- The second pass never moves people who only want social tables to tech tables; only when seating someone alone at the other kind does the invitation give the reason, with dropping free
- Two people who picked each other (a reunion) are never separated in the second pass either
- During the free-change period, if one person drops from a 3-person table, it's filled first with someone who picked that evening
- The same seed gives the same result

## Pre-launch rehearsal

```bash
npm run simulate
```

- A simulation of 50 fictional members (25 Harvard, 25 MIT) spending 4 weeks on a fake clock; real data is untouched
- Runs through picking evenings each week, automatic Sunday assignment, captain bookings and votes, cancellations and no-shows, next-day feedback, and round two
- Checks at every step: two tables on the same day, 3 to 6 people, school ratio, blocked people, captains, requested counts and evenings, and rules for paused members
- Also checks same-day booking failures (1 in 20) and rebooking, booking cancellation reminders for closed tables, and venue display without a booking
- Options: `--people 100`, `--weeks 6`, `--seed 3`, `--flat` (the hardest case, with tracks spread evenly)
- Results as of 2026-10-17 (20 to 100 people, 8 configurations): 100% of people who picked evenings got a dinner every week, with an average of 2 to 6 people a week seated by the second pass
- 46 to 50% of tech table seats are in the person's own track, 61 to 73% including adjacent tracks, and 39 to 44% in the worst case with tracks spread evenly
- 0 rule violations, 0 tables reaching the evening without a venue, median member screen response 3 to 10ms
- Separate validation of the matching engine: 200 random configurations and 120 server weeks with 0 school ratio or block rule violations, and the same data gives the same result
- Automatic Sunday assignment time: 1.8 seconds for 50 people, 3.5 seconds for 100 (worst case, with everyone picking all 5 days); beyond 150, consider moving it to a separate job

### End to end on a real server

```bash
npm run e2e
```

- Starts the real server with a temporary data folder, and 50 fictional members use it over HTTP like phones
- From sign-up via a club link, school email code verification, filling out the card, the weekly plan, Sunday assignment and publishing, opening invitations, group chats, voting, captain booking, schedule changes, reporting, Hang, Board, People, through account deletion
- Checks the status and rules of every response (nobody left out, no two tables on one evening, 3 to 6 people, school ratio, restaurant hidden before noon, no email exposure)
- If Chrome is available, opens the same server in a headless Chrome phone screen to check rendering, chat input, and console errors
- Also checks web app items: install manifest (id, icons with padding), security headers, video ETag, app version display, email sign-in for people who were invited but never verified, automatic reconnect after losing the connection
- Options: `--people 80`, `--no-ui`
- Results on 2026-10-18: with both 50 and 80 people, everyone signed up, everyone who picked an evening was seated, 0 rule violations, median response 2ms, all web app items passed

## Deployment (Railway)

```bash
npm install -g @railway/cli
```

- From this folder, run `railway login`, `railway init`, `railway up`, `railway domain` in that order
- In the Railway dashboard, attach a Volume at `/data` (the server refuses to start without one), and turn on volume backups too
- Set the environment variables `SIXTOP_ADMIN_KEY`, `SIXTOP_DATA_DIR=/data`, `SIXTOP_PUBLIC_URL`, `RESEND_API_KEY`, `SIXTOP_MAIL_FROM`, `SIXTOP_VAPID_SUBJECT`
- Push notifications only work over HTTPS; on iPhone, notifications require adding it to the home screen (iOS 16.4 or later)
- Launch only after settling on the real domain; home screen apps and notification subscriptions are tied to the address, so changing the domain later means every member must reinstall and sign in again
- If `SIXTOP_PUBLIC_URL` is https, http requests redirect to https and an HSTS header is added

## Using it as a web app

- iPhone: web notifications only work in an app added to the home screen, so after the persona result there's a 4-step guide to adding it (starting with opening in Safari if in an in-app browser like KakaoTalk or Instagram)
- The home screen app has separate storage from Safari, so it needs one more sign-in; the Sign in button is shown first in the home screen app
- Android and desktop: after the result, a prompt to turn on notifications; tapping Not now asks again 3 days later, and if blocked in the browser it stops asking
- Members without notifications: invitations, venue reveals, venue changes, table cancellations, and captain-related notifications are sent by email instead (up to 3 a day)
- If the app reopens while you're in your mail app checking the code, it stays on the code entry step (15 minutes), and sign-up answers are saved on the phone step by step (except photos)
- If the connection drops, a retry button is shown while staying signed in, and it reconnects automatically when the connection returns
- After a new version is deployed, an app left open for a long time refreshes itself the next time it's opened
- The screen height fits the visible area so the chat input isn't hidden when the keyboard comes up; map links on iPhone open Apple Maps
- The notification badge (Android status bar) is a # shape on a transparent background, and the home screen icon's number badge is the unread message count
- Keyboard, notifications, and add-to-home-screen need to be checked by hand once each on real iPhone and Android devices (automated tests use Chrome)

## Data and privacy

- The data folder stores names, school emails, photos, and life stage; never make it public, and delete it after the pilot
- Data is backed up to `backups/` once a day, keeping the last 14 days
- If `db.json` is corrupted, or there are photos but no `db.json`, the server stops starting (it never overwrites with empty data); in that case restore a backup file as `db.json`
- Every member verifies a Harvard or MIT email with a 6-digit code and can't use the app before verifying
- A profile photo is required and shown only to verified members
- Life stage is used only for matching, and at the table it's mentioned only as a number when two or more people share it
- Sample member faces are AI-generated portraits (not real people)
- Delete my account deletes the photo and profile immediately

## Not built yet

| Item | Now | Next step |
|---|---|---|
| Sending school email | Resend integration done; real delivery not yet confirmed | Verify the sending domain; confirm delivery to harvard.edu and mit.edu |
| Privacy consent | None | Add a consent screen at sign-up before the beta |
| Sign-up status exposure | The sign-in screen reveals whether an email has signed up | If needed, show the same message whether or not the email is registered |
| Alumni email | Alumni addresses like alum.mit.edu can also sign up | Decide whether to accept students only |
| Late-change fee | Point system | About $15 per person after card registration, disclosed at sign-up |
| Restaurant booking system integration | Email, dedicated restaurant page, phone | Apply for official OpenTable and Resy partnerships once scale grows |

## Files

```
server/server.js   API, admin API, storage, notifications, static files
server/tables.js   Table building (scores, rules, Charlie's "why these people")
server/push.js     Web push
public/index.html  Member screens
public/admin.html  Admin page
public/place.html  Dedicated partner restaurant page
public/shared.js   Questions, tracks, personas, and question cards shared by the screens and server
public/app.css     Design, first-screen video, backgrounds
public/manifest.webmanifest, public/sw.js  Add to home screen and push notifications
public/video/      First-screen video
art/make-film.js   Builds the first-screen video
scripts/seed.js    Sample data (never use on real data)
scripts/dev.js     Run for local development
scripts/build-demo.js  Builds the phone demo (dist/ and the repository's demo/)
test/              npm test (11 table building tests, 52 server tests)
scripts/simulate.js  50-person, 4-week rehearsal (npm run simulate)
```
