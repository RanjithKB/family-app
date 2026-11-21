// ---------------------------------------------------------------
//  The only file you need to edit to connect the app.
//  1. Create a free project at https://supabase.com
//  2. Paste the Project URL and the "anon public" key below.
//  3. Leave DEMO_MODE as true to try the app with sample data first.
// ---------------------------------------------------------------
export const CONFIG = {
  // Your app's name, shown on the sign-in screen and browser tab.
  // Also change "name" and "short_name" in manifest.webmanifest (that's the home-screen label).
  APP_NAME: 'Family Memories',

  // true  = sample data in memory, no sign-in (resets on reload). Good for a first look.
  // false = real app using Supabase.
  DEMO_MODE: true,

  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',

  BUCKET: 'photos',

  // Image sizes
  THUMB_W: 720,        // timeline thumbnail, 4:5 (sharp enough for the big wedding carousel)
  THUMB_H: 900,
  DISPLAY_MAX: 1600,   // longest edge of the photo-view copy
  WEBP_QUALITY: 0.82
};
