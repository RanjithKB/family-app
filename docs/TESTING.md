# Phone test checklist

Run this on real Android phones (Chrome) before each release. A desktop browser can't test pinch, the camera, the gallery Share menu, Google sign-in, real uploads or speed on a mid-range phone.

Write down each phone's **model and Android version** first.

## A. Demo mode (Cloudflare Pages link, `DEMO_MODE: true`)
- [ ] It opens fast. Note how long the first load takes on mobile data.
- [ ] Chrome menu > **Install app**. The icon looks right on the home screen, and the app opens full screen without the browser bar.
- [ ] Nothing hides behind the notch, status bar or gesture bar. The bottom nav sits clear of the gesture line.
- [ ] Scrolling Home and Timeline is smooth, with no stutter or jumpy animation.
- [ ] Wedding carousel: a finger swipe snaps to each event, and the dots and counter update.
- [ ] Settings > Animations > **Off**: everything still works and feels instant. Then try **Light**.
- [ ] Emojis ❤️ 😂 🎉 and the "moved" face all show properly, not as empty boxes. (On Android 11 and older, 🥹 is shown as 🥺 on purpose.)
- [ ] "Open timeline" on Home is easy to tap first time.

## B. Adding memories
- [ ] **+ > Photos**: pick 5 or more from the gallery at once. Pinch to zoom and drag in the crop screen, try Fill and Fit, and use "Auto-crop rest".
- [ ] **+ > Take a photo**: the camera opens, and the photo comes back to the crop screen.
- [ ] Photo dates: "Photo's own date" picks the right date for older gallery photos.
- [ ] While typing a caption or note, the keyboard doesn't cover the input or the Save button.
- [ ] From the **gallery app**: Share > the app. It opens the crop screen with those photos (only after installing).
- [ ] Write a note with emojis from the phone keyboard, not only the picker.
- [ ] The phone's **back button** closes the open screen first, and only leaves the app from Home.
- [ ] After adding 20–30 photos, the timeline still scrolls smoothly.

## C. Real mode (Supabase + Google sign-in, both phones)
- [ ] "Continue with Google" signs in and comes back to the app, including when it's installed as an app.
- [ ] A third Google account sees "This is a private app" and nothing else.
- [ ] A photo added on phone A shows on phone B after a reload.
- [ ] Phone B can react and comment on A's photo, but the ⋮ menu has no edit or delete options.
- [ ] Phone A can edit and delete its own photo, and it disappears on both phones.
- [ ] Settings: set the wedding date, baby date and both birthdays. The counters, chapter suggestions and age tags all update.
- [ ] Upload on weak signal or switch on flight mode halfway. The app shows a clear error and nothing half-saved appears.
- [ ] Close the app for a day and reopen it: you're still signed in and photos still load.
- [ ] Settings > Export (JSON) downloads a file.

## If the app looks out of date
- In the app: **Settings > Refresh app**.
- If you can't get to Settings (or it still shows old screens, like demo mode after switching to real mode): open **`<your site>/reset`** in Chrome. It clears the saved copy and reopens the app. You stay signed in.

## D. Reporting a problem
Open an issue (or note it down) with:
- Phone model and Android version
- Which step, what you expected, what happened
- A screenshot or screen recording

## Desktop browser check (before the phone test)
Serve the folder (`python -m http.server 8765`), open `http://localhost:8765` in Chrome, press F12, and turn on device mode (e.g. Pixel 7). Click through every screen and check the Console tab for errors.
