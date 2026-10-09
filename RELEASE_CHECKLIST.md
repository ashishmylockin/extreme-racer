# Extreme Racer – release checklist

## 1. Before you upload

- [ ] Bump `VERSION` near the top of the script in `extremeracer.html` (shown on the menu and in Credits).
- [ ] Play one full city in each mode: World Tour, Daily Challenge, Endless, VS Computer, Multiplayer.
- [ ] Try all three cameras (C), pause / resume, crash and R to retry.
- [ ] Test on a phone (portrait and landscape) and with a controller if you have one.
- [ ] Test in a private / incognito window: a fresh player should see the title, then the tutorial on their first race.
- [ ] Sound starts after the first click or key, and goes quiet when you switch tabs.

## 2. Build the zip for itch.io

itch.io needs a file called `index.html` at the top level of the zip. From the `extreme-racer` folder, in PowerShell:

```powershell
$v = "1.0.0"   # match VERSION in the game
$out = Join-Path $env:TEMP "extreme-racer-build"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $out | Out-Null
Copy-Item extremeracer.html (Join-Path $out "index.html")
Compress-Archive -Path (Join-Path $out "index.html") -DestinationPath "extreme-racer-$v.zip" -Force
```

That gives you `extreme-racer-1.0.0.zip`, which contains a single `index.html`. Don't commit the zip.

## 3. itch.io page settings

- **Kind of project:** HTML
- **Uploads:** add the zip and tick **"This file will be played in the browser"**
- **Embed options:**
  - Viewport: **960 × 540** (16:9; the game stretches to fit)
  - Tick **Mobile friendly** (orientation: Default; the game supports both)
  - Tick **Fullscreen button**
  - Leave **Enable scrollbars** off
- **Genre:** Racing. **Tags:** racing, arcade, cars, endless-runner, singleplayer, local-multiplayer, mobile, controller
- **Pricing:** free (optionally "No payments" or donations)
- Saves are kept in the browser's local storage on itch.io's game domain: they survive updates as long as players use the same browser.

## 4. CrazyGames

- Submit through the CrazyGames developer portal; they review every game.
- Ads on CrazyGames go through **their SDK** (for example ads between races and rewarded ads), and their rules don't allow other ad networks or external links in the game. **Check their current developer docs for the SDK setup and the exact rules before submitting** – that's the step still to do for an ad-supported release.
- They test in an iframe like itch.io, so the iframe work in 1.0.0 (focus, no scrollbars, blocked-controller handling, sound on first tap) already covers the basics.
- Prepare the cover / thumbnail images in the sizes the portal asks for.

## 5. Screenshots to take

Use a 1920 × 1080 browser window, press **F** for fullscreen, and capture with Win + Shift + S. Aim for 5–8:

1. **Title screen:** the animated logo over the demo race.
2. **Chase camera in Tokyo or Monaco:** a busy road, landmarks on the skyline.
3. **Night in Las Vegas:** neon signs and tail lights.
4. **Rain in London:** spray and Big Ben.
5. **A near-miss combo:** "CLOSE! x4" and COMBO on the HUD, ideally mid-nitro.
6. **CITY COMPLETE:** three stars and the flag-coloured confetti.
7. **World Tour map** or the **Garage upgrades** screen.
8. **Phone portrait:** in Chrome or Edge DevTools device mode (F12, then Ctrl + Shift + M), pick a phone and use "Capture screenshot".

itch.io also wants a **cover image (630 × 500)**: crop the title screen or a chase-camera shot.

## 6. Description (ready to paste)

**Short description:**
> Race through 22 world cities, dodge traffic at 300+ km/h and earn three stars in every city.

**Full description:**

> **Extreme Racer** is an arcade racing game you play right in your browser.
>
> Drive an open-wheel race car on a World Tour through 22 cities, from Sydney to the Grand Final in Abu Dhabi. Every city has its own landmarks, weather and traffic: rain and spray in London, neon nights in Las Vegas, roadworks and long trucks.
>
> - **World Tour:** 22 cities, 3 stars and 3 missions each, and a head-to-head Grand Final
> - **Daily Challenge:** the same city and traffic for everyone each day; keep your streak going
> - **Endless, VS Computer and 2-player split controls**
> - **Near misses build combos**, nitro is yours to fire, and shields save you once
> - **Garage:** 11 teams to unlock and upgrades for handling, nitro, magnet and shield
> - Three cameras: overhead, chase and cockpit
> - Plays on keyboard, controller and touch screens
>
> **Controls:** Left / Right to change lanes, Up / Down for gas and brake, Space or Shift for nitro, C to change camera, P to pause. On a phone: tap a side to steer, and use the GAS, BRAKE and NITRO buttons.
>
> Made by Ashish. All teams, cars and liveries are fictional.
