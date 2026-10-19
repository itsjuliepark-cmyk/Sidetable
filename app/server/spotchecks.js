// Spot checks: what the restaurant's own booking page showed for a party of six on one evening, read by hand on OpenTable and
// Resy (Tock pages need a click per time, so those weren't read). Times are the ones offered around the asked-for 7:00 PM (the
// pages show a few either side); an empty list means nothing for six that evening near 7, and 'call' means the page said the
// party is too large to book online. Places missing from a night weren't read that night (OpenTable started refusing the
// page after a few dozen reads, so the rest of Wednesday was left unread rather than guessed).
// This is a snapshot, not live availability: tables come and go all day. The app shows when each was read, ranks places with
// room first, and lets captains mark a place full for six when they find it so (server.js, seen).
'use strict';
module.exports = [
  { date: '2026-10-21', size: 6, time: '19:00', at: '2026-10-19T06:45:00-04:00', seen: {
    'Alden & Harlow': ['17:30', '20:30'], 'Bar Enza': ['20:30', '20:45', '21:00', '21:15', '21:30'], 'Bosso Ramen Tavern': ['17:00', '17:30', '18:00', '18:15', '18:30', '20:30', '20:45'],
    'Grafton Street Pub & Grill': ['18:45', '19:00', '19:15'], 'Harvest': [], "Henrietta's Table": ['18:45', '19:15'], 'La Royal': ['20:00'],
    "Lou's": ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:30', '20:00', '20:30', '21:00'], 'Nine Tastes': ['18:45', '19:00', '19:15'],
    'Russell House Tavern': ['18:45', '19:15'], 'Source Restaurant': [], 'The Hourly Oyster House': ['18:45', '19:00', '19:15'], 'The Maharaja': ['18:45', '19:00', '19:15'],
    'The Smoke Shop BBQ': ['17:45', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15'], 'Toscano Harvard Square': ['18:15', '19:45'],
    'Wusong Road': ['16:30', '20:00'], 'Ama at The Atlas': ['21:00'], 'Aatma at Widowmaker': ['16:00'],
    'Sumiao Hunan Kitchen': ['17:00', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15'],
    'Fallow Kin': ['17:00', '17:15', '17:30', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15'], 'Naco Taco': [],
    'Pagu': ['17:30', '17:45', '18:15', '18:30', '19:45', '20:00', '20:15'], 'Saigon Babylon': ['17:00', '20:45', '21:00'], 'Oleana': ['20:15', '20:30', '20:45', '21:00'],
  } },
  { date: '2026-10-23', size: 6, time: '19:00', at: '2026-10-19T06:30:00-04:00', seen: {
    'Alden & Harlow': ['17:45', '20:45'], 'Bar Enza': ['20:30', '20:45', '21:00'], 'Bosso Ramen Tavern': ['18:00', '18:15', '19:45', '20:00'], 'Grafton Street Pub & Grill': ['18:45', '19:00', '19:15'],
    'Harvest': ['14:45', '20:30'], "Henrietta's Table": ['17:00'], 'La Royal': ['17:45', '19:30'], "Lou's": ['18:30', '19:00', '19:30', '20:00'], 'Nine Tastes': ['18:45', '19:00', '19:15'],
    'Russell House Tavern': ['16:30', '20:15'], 'Source Restaurant': ['15:45', '21:30'], 'The Hourly Oyster House': ['16:00', '21:00'], 'The Maharaja': ['18:45', '19:00', '19:15'],
    'The Painted Burro Harvard Square': ['18:45', '19:15'], 'The Smoke Shop BBQ': ['18:00', '18:15', '18:45', '19:30', '19:45', '20:00'], 'Toscano Harvard Square': ['15:45', '20:45'], 'Wusong Road': ['15:00'],
    'Ama at The Atlas': ['18:45', '19:00', '19:15'], 'Lone Star Taco Bar': ['18:45', '19:00', '19:15'], 'Qiao Lin Hotpot': ['18:30', '19:30'], "Sloane's": ['18:45', '19:00', '19:15'],
    'Aatma at Widowmaker': ['16:00'], 'Naksan Korean BBQ': ['18:45', '19:00', '19:15'], 'Alice': ['18:45', '19:00', '19:15'], 'Area Four Cambridge': ['17:30', '20:30'], 'Catalyst Restaurant': ['14:30', '20:00'],
    'Fuji at Kendall': ['18:45', '19:00', '19:15'], 'Legal Sea Foods Kendall Square': ['18:45', '19:00', '19:15'], 'Mex Taqueria & Bar': ['18:45', '19:00', '19:15'], 'Row 34': ['18:00', '20:45'],
    'Sulmona': ['18:45', '19:00', '19:15'], 'Sumiao Hunan Kitchen': ['17:15', '20:45'], 'Bambara Kitchen & Bar': ['12:45'], 'The Helmand': ['18:45', '19:00', '19:15'], 'Fallow Kin': ['21:15', '21:30'],
    'La Fábrica Central': 'call', 'Little Donkey': ['20:30'], 'Moona Central Square': ['17:15', '19:45'], 'Naco Taco': [], 'Pagu': ['17:00', '20:45', '21:00'], 'Saigon Babylon': ['20:45', '21:00'],
    'Vialé': ['17:30', '21:45'], 'Oak Bistro': ['17:30', '21:30'], 'Oleana': [], 'Olé': ['18:45', '19:00', '19:15'], 'Oyster Bar by Puritan & Co.': ['17:00', '20:00'], 'Puritan & Company': ['17:30'],
  } },
];
