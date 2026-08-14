# Cricket Live Auction — Firebase

Mobile-friendly live cricket auction for 3 teams and 24 players.

## Included
- Firebase Anonymous Authentication
- Firebase Realtime Database
- Live bidding using Realtime Database transactions
- 3 teams: Team A, Team B, Team C
- Starting purse: ₹10,000 each
- 24 default players, base price ₹500
- ₹500 bid increment
- Sold / Unsold / Next Player controls
- Automatic purse deduction and roster
- Shareable room link using `?room=ROOMCODE`
- Large Android-friendly bidding button

## Important security note
The current Realtime Database rules (`auth != null`) are suitable for a trusted private auction, but they do not enforce server-side roles. A technically knowledgeable participant could manipulate database data. For a public or high-stakes auction, add server-side authorization/Cloud Functions before relying on it.

## Firebase configuration
`app.js` contains the Firebase Web App configuration supplied for project `cricket-live-auction-75e14`.

## Hosting
`firebase.json` is already configured to serve the repository root as the static site.

After deploying, the default Firebase Hosting URL will normally be:
`https://cricket-live-auction-75e14.web.app`
and
`https://cricket-live-auction-75e14.firebaseapp.com`

## Android use
1. Open the website.
2. Enter the same room code on all phones.
3. Auctioneer chooses `Auctioneer`.
4. Each team chooses `Team` and Team A/B/C.
5. Auctioneer taps Start / Resume.
6. Teams tap BID.
7. Auctioneer taps SOLD, UNSOLD, then Next Player.
