# Flight Info Form App (Angular + Firebase)

Live Demo: https://flight-info-app-7f01c.web.app/login

---

## What this is

An authenticated Angular app deployed on Firebase Hosting. After login, users can submit flight details to the challenge endpoint and receive a clear success/failure response. A confirmation receipt is generated on successful submission.

---

## Run Locally

Environment used:
- Angular CLI: 21.1.3
- Angular: 21.1.3
- Node.js: 24.13.0
- npm: 11.6.2

Start:
- npm install
- ng serve

Open:
- http://localhost:4200

Firebase configuration is already set up and deployed.

> Firebase web configuration is public by design; security is enforced via Firebase Authentication, Security Rules and route guards.

---

## Authentication & Access

Supported login methods:
- Email / Password
- Google Sign-In (SSO)

Test credentials (Email/Password):
- Username: vis.vj01@gmail.com
- Password: ***flight@monster***

Invite-only access:
- Public signup is intentionally disabled.
- Google SSO is enabled, but only allowlisted users are authorized to proceed.

---

## Submission Integration

The app submits flight data using the exact contract provided in the prompt:

Headers:
- token: (value from the challenge prompt)
- candidate: Vishnu Prasath

Payload:
```ts
interface FlightInfoPayload {
  airline: string
  arrivalDate: string
  arrivalTime: string
  flightNumber: string
  numOfGuests: number
  comments?: string
}
```

---

## User-Facing Features
   - Protected form access (unauthenticated users cannot reach the form)
   - Field validation with inline errors (invalid values block submit)
   - Clear success/failure messaging after submission
   - Confirmation receipt on success:
       - Download receipt
       - Copy to clipboard
       - Edit submission
       - Submit another
   - Draft autosave (local):
       - Clears on submit, reset and sign out
   - Cross-tab sign-in/sign-out support
   - Remember last email suggestion (stores only one email)
   - Password reset supported for authenticated users
   - Airline selection backed by a JSON dataset (constructed from OpenFlights data)
   - Ticket Parser (Beta): best-effort extraction to speed up entry; user can review/edit before submitting
   - Deployment:
       - Firebase Hosting
       - Live URL: https://flight-info-app-7f01c.web.app/login