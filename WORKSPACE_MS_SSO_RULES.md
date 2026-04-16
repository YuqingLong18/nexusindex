# Workspace Microsoft SSO Rules

This document defines the Microsoft SSO rules for the local workspace in
[`/Users/ylong/Documents/nexusindex.code-workspace`](/Users/ylong/Documents/nexusindex.code-workspace:1).

Current sibling apps in scope:
- `nexusindex`
- `mathgen`
- `incident`
- `primarybooking`
- `classroomgen`
- `translateppt`

Future sibling apps in this workspace should follow the same rules by default unless an explicit exception is approved.

## Source Of Truth

- `thisnexus.cn` is the central auth service.
- Microsoft OAuth starts at `https://thisnexus.cn/api/auth/microsoft`.
- The shared auth cookie is `thisnexus_session`.
- Sibling apps must verify that cookie with the same `AUTH_SESSION_SECRET`.
- Sibling apps must not invent their own role inference rules.

The central role inference currently lives in [server.js](/Users/ylong/Documents/nexusindex/server.js:218):

```js
function resolveRoleFromEmail(email) {
  if (!email) {
    return 'teacher';
  }

  return /\d/.test(email) ? 'student' : 'teacher';
}
```

Rule in plain language:
- If the Microsoft SSO email contains any digit, infer `student`.
- If the Microsoft SSO email contains no digit, infer `teacher`.

This is the workspace-wide policy unless changed centrally.

## Default Access Policy

For all current workspace apps using Microsoft SSO:
- Reject `role === 'student'`.
- Treat teacher access as the default.
- Only allow student SSO access in an app if that exception is explicitly approved later.

Required behavior for teacher-only apps:
- Gracefully reject student SSO sessions.
- Show a clear message such as `Teacher Microsoft account required`.
- Offer a switch-account path when practical.

Examples already enforcing this:
- [mathgen/middleware.ts](/Users/ylong/Documents/mathgen/middleware.ts:62)
- [classroomgen/src/app/api/teacher/microsoft/route.ts](/Users/ylong/Documents/classroomgen/src/app/api/teacher/microsoft/route.ts:28)
- [translateppt/backend/app.py](/Users/ylong/Documents/translateppt/backend/app.py:172)
- [incident/lib/auth.js](/Users/ylong/Documents/incident/lib/auth.js:129)
- [primarybooking/server.js](/Users/ylong/Documents/primarybooking/server.js:128)

## Required Flow For New Apps

When adding a new sibling app on a `*.thisnexus.cn` subdomain:

1. Reuse the shared cookie.
   - Read `thisnexus_session`.
   - Verify it with `AUTH_SESSION_SECRET`.

2. Start Microsoft sign-in through the central auth service.
   - Redirect users to `https://thisnexus.cn/api/auth/microsoft?returnTo=...`.
   - `returnTo` should point back to the app’s own callback or landing URL.

3. Reject student-tagged sessions unless there is an approved exception.
   - Do not rely on local ad hoc email parsing.
   - Use the shared session `role`.

4. Keep logout aligned with the shared auth service.
   - Clearing only a local session is not enough when the app should truly switch accounts.
   - Prefer routing sign-out through `https://thisnexus.cn/api/auth/logout`.

5. Keep authorization separate from identity.
   - SSO proves who the user is.
   - App-local role tables or scopes may still decide what that teacher can do.
   - Student-tagged sessions should be rejected before teacher-only authorization logic proceeds.

## Required Environment Variables

Teacher-only sibling apps should generally use:

```env
AUTH_BASE_URL=https://thisnexus.cn
AUTH_SERVICE_BASE_URL=https://thisnexus.cn
AUTH_COOKIE_NAME=thisnexus_session
AUTH_SESSION_SECRET=...
```

App-specific base URL variables should also be set, for example:

```env
MATHGEN_BASE_URL=https://mathgen.thisnexus.cn
INCIDENT_BASE_URL=https://incident.thisnexus.cn
IMAGELAB_BASE_URL=https://imagelab.thisnexus.cn
TRANSLATE_BASE_URL=https://translate.thisnexus.cn
BOOKING_BASE_URL=https://booking.thisnexus.cn
```

## Implementation Checklist

Before considering a new sibling app complete:

- Shared cookie verification is implemented.
- The app starts sign-in via `thisnexus.cn`.
- The app rejects `role === 'student'`.
- The rejection is user-facing and not a silent failure.
- Logout can switch the Microsoft account cleanly.
- App-local permission logic runs only after teacher-only SSO gating.

## Change Control

If the workspace ever needs student SSO access in a specific app:
- do not patch only that app quietly
- document the exception here
- keep the central role inference and app-level allowance explicit

Until that happens, the default rule is:

`student` SSO sessions are rejected across the workspace.
