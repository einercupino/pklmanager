# Pickleball Tournament App

Static HTML/JS app using Firebase Cloud Firestore.

## Firebase setup

Edit `firebaseConfig.js` and paste your Firebase web app config.

Firestore collections used:

- `players`
- `teams`
- `matches`
- `settings/tournament`

For testing, Firestore rules can be:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Workflow

1. Go to Teams > Players and add players with skill levels.
2. Go to Teams tab and click Shuffle Teams until you like the pairing.
3. Adjust Team # manually if needed.
4. Save Teams.
5. Go to Admin and Generate Tournament.
6. Enter scores and Lock Match.
7. Generate Playoffs after all group matches are locked.

## BYE behavior

If there are 5, 7, or 9 teams, the app uses the next even schedule and inserts a BYE team.

A BYE match is automatically locked as:

- Win +1 for the real team
- Score 0-0
- PF +0
- PA +0
- Diff +0
