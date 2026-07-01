# Pickleball Tournament App

Firebase Realtime Database web app for a doubles pickleball tournament.

## Pages

- `index.html` - team standings and playoff overview
- `matches.html` - live matches at the top, compressed upcoming/completed cards underneath
- `admin.html` - generate tournament, enter scores, lock/unlock scores, generate playoffs
- `players.html` - add players, skill level 1-5, team number, generate balanced teams, validate teams, edit display team names

## Flow

1. Go to **Teams**.
2. Add players with skill level 1-5.
3. Click **Generate Teams**.
4. Click **Save Teams**. This validates exactly 2 players per team.
5. Go to **Admin**.
6. Set tournament name/start time if needed.
7. Click **Generate Tournament**.
8. Enter scores and click **Lock Score**.
9. Once all group matches are locked, click **Generate Playoffs**.

## Rules

- Max 20 players / 10 teams.
- Doubles only, so players must be even.
- Every team must have exactly 2 players.
- Group standings rank by wins, then point differential, then points for.
- Top 4 advance to playoffs.
- Playoffs generate as #1 vs #4 and #2 vs #3.
- Finals and 3rd place are generated after both semifinals are locked.

## Notes

The app uses team numbers internally. Team names are display-only and can be edited later without breaking schedules, scores, or standings.
