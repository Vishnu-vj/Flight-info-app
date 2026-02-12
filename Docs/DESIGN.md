
---

# DESIGN.md — Flight Info Form App (Angular + Firebase)

This document captures architecture, security posture, tradeoffs and engineering decisions. It intentionally avoids repeating user-facing feature lists.

---

## 1) Key Design Decisions

### Invite-only access (Authentication + Authorization)
- Authentication is handled through Firebase Auth (email/password + Google SSO).
- Authorization is enforced through an allowlist so access is not public Google sign-in.
- Public self-signup was intentionally excluded to reduce abuse and match typical CRM/invite-only workflows.

### Route protection as a hard boundary
- Protected routes are guarded so the form cannot be accessed directly by URL.
- Guard logic enforces both authentication and authorization.

---

## 2) High-Level Architecture

Layers:
- Auth layer: sign-in methods + session state
- Authorization layer: allowlist enforcement
- Form layer: Reactive Forms + validators
- API layer: request construction (headers + payload)
- Receipt layer: immutable confirmation view + edit/resubmit flow

This separation keeps responsibilities clear and reduces coupling (validators don’t leak into API code, auth doesn’t leak into UI state handling).

---

## 3) Validation & Payload Correctness Strategy

The submission endpoint is strict (missing properties fail), so the implementation prioritizes:
- payload shape correctness
- type correctness (ex: numOfGuests as a number)
- preventing invalid states from reaching the API

Validation is treated as a reliability feature (reduce avoidable failed submissions and ambiguous outcomes).

---

## 4) Resilience & State Management

### Prevent duplicate submission
- Submit is disabled while the request is in-flight to avoid double POSTs and confusing UI outcomes.

### Draft autosave (local only)
- Implemented to prevent data loss on refresh/close.
- Cleared on submit, reset and sign out to avoid resurrecting stale drafts or leaking across sessions.

### Cross-tab session consistency
- Sign-in/sign-out events propagate across tabs to avoid inconsistent "half-logged-in" behavior.

---

## 5) Security Notes & Tradeoffs

### Firebase web config
- Firebase web config is public by design; security relies on Auth + Security Rules + guards.

### Token handling
- The challenge requires a token header in the client request.
- In production, this would typically be proxied through a server-side component (Eg:Firebase Cloud Function) to keep tokens server-side and enable rate limiting, logging and safe rotation.

---

## 6) Edge Cases Explicitly Handled

- Direct URL access to protected routes is blocked
- Invalid input states block submission and provide inline guidance
- API returning false is treated as a first-class outcome with a clear UI state
- Network/server failures are handled distinctly from validation failures
- Duplicate submissions are prevented via in-flight blocking
- Draft persistence does not survive sign out / reset / successful submit

---

## 7) Ticket Parser (Beta) Positioning

Ticket formats vary widely across airlines and templates. The parser is intentionally positioned as:
- a best-effort accelerator for structured inputs
- user-verified before submission
- Beta-labeled to set accurate expectations and avoid over-promising

---

## 8) If I Had More Time

-  Enhance the Ticket Parser using a custom document-trained AI model fine-tuned on airline confirmations to improve extraction accuracy across varied formats
- Add e2e tests for the critical path (auth → guard → submit → receipt)
- Add structured observability hooks for submission outcomes (without exposing sensitive data)

