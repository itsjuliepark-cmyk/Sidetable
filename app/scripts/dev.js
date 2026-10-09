// Local development: a fixed admin key ("local-admin") and school email codes shown on screen instead of emailed, then the real server.
// Never use these settings for a real pilot.
'use strict';
process.env.SIXTOP_DEV = '1';
process.env.SIXTOP_ADMIN_KEY = process.env.SIXTOP_ADMIN_KEY || 'local-admin';
process.env.SIXTOP_MAIL = process.env.SIXTOP_MAIL || 'show'; // school email codes show up on screen instead of going out
require('../server/server.js').start();
