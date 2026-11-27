# Hash Table

An East Coast tech community platform starting at MIT x Harvard

## Pain point

- Plenty of tech clubs and networking events, but most are one-off events
- No structure for meeting people with shared interests again and building relationships
- Individuals carry the burden of finding people, coordinating schedules, and booking venues

## Solution

- A tech community platform where people with the same interests meet again and again in small groups
- The platform handles connecting people, coordinating schedules, securing venues, and preparing conversation topics

## How it works

- Tech tables of 3 Harvard + 3 MIT members, with invitations sent twice a week
- Small groups matched by field of interest: generative AI, robotics, biotech, healthcare, and more
- Everyone who picks an evening is seated at a dinner that week, with no exceptions unless they would be alone that day
- A would-you-rather game and discussion topics built on that week's news, provided in advance
- A rotating captain at each table: picks the venue and books it directly via OpenTable, Resy, or phone, encourages voting on discussion topics, and leads splitting the bill
- If the captain can't make a booking, the role passes automatically to another member; if there is still no venue by the day of, the table is canceled
- Completing all three missions earns a captain stripe and priority for Industry tables, where members meet people from the industry
- A web app that works from a single link, no app install

## What's next

- Expand to alumni, VCs, and practitioners at tech companies
- Revenue from a partner restaurant network and memberships

## Demo

- Phone demo link: https://claude.ai/artifact/P8rAwZFR773s1wuQcWjDqd (opens only if sharing is turned on)
- View without installing: download the repository (Code → Download ZIP) and open [demo/hash-table-demo.html](demo/hash-table-demo.html) in a browser
- Tap Join on the first screen to choose one of three paths; anything you enter is stored only in your own browser
  - Start as someone new: from signing up via a club link through Charlie's questions, the persona, and the first invitation
  - Skip to after sign-up: start as a new member who has finished signing up, beginning with two sealed first invitations
  - Try it as Jordan: 40 sample members after one week has passed (invitations, round two, friends, captain)

## Running it

```
cd app
npm run seed
npm run dev
```

- Requires Node 18 or later
- For details, see [app/README.md](app/README.md)
