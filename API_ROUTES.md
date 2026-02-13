# Jinnar Backend – API Routes Reference

Base URL: **`/api`** (e.g. `GET /api/viral/draws`)

Auth: Send JWT in header: `Authorization: Bearer <token>`

---

## A. Jinnar Viral (viral.jinnar.com)

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/viral/draws` | List draws (query: `?status=active\|upcoming\|closed`) |
| GET | `/api/viral/draws/:id` | Single draw details |
| GET | `/api/viral/draws/:drawId/winners` | Past winners for a draw |
| GET | `/api/viral/leaderboard` | Leaderboard (query: `drawId`, `scope=global\|country\|city`, `country`, `city`, `limit`, `offset`) |

### Participant (auth: Bearer token)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/viral/points/me` | My points & post history (query: `?drawId`) |
| POST | `/api/viral/submissions` | Upload video for approval (multipart: `video`, body: `drawId`, `title`) |
| GET | `/api/viral/submissions/me` | My submissions |
| GET | `/api/viral/submissions/me/:id` | One submission (approval status & feedback) |
| POST | `/api/viral/posts` | Submit post proof (body: `submissionId`, `drawId`, `platform`, `postUrl`; optional file: `screenshot`) |
| GET | `/api/viral/leaderboard/me` | My rank (query: `?drawId`) |
| GET | `/api/viral/rewards/me` | My rewards |

### Viral Admin (auth: super_admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/viral/admin/draws` | List all draws |
| POST | `/api/viral/admin/draws` | Create draw |
| PUT | `/api/viral/admin/draws/:id` | Update draw |
| POST | `/api/viral/admin/draws/:drawId/rewards` | Create reward rows (body: array of `{ rank, rewardType, amount }`) |
| POST | `/api/viral/admin/draws/:drawId/close` | Close draw & assign winners |
| GET | `/api/viral/admin/submissions` | Review queue (query: `?status`, `?drawId`) |
| PUT | `/api/viral/admin/submissions/:id` | Approve/reject (body: `status`, `reviewNotes`) |
| PUT | `/api/viral/admin/posts/:id` | Manual override (body: `verified`, `fraudFlag`, `engagement`) |

### Viral upload (legacy – course-style)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/viral/upload/thumbnail` | Upload thumbnail |
| POST | `/api/viral/upload/video` | Upload video |

### Static

| Path | Description |
|------|-------------|
| `/uploads/viral/*` | Viral videos & screenshots |

---

## B. Auth & sign-in

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/verify` | Verify code |
| POST | `/api/auth/resend-verification` | Resend verification code |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Forgot password |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/switch-role` | Switch role (auth) |
| POST | `/api/auth/change-contact/initiate` | Initiate contact change (auth) |
| POST | `/api/auth/change-contact/verify` | Verify contact change (auth) |
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback (JWT redirect) |
| GET | `/api/auth/github` | Start GitHub OAuth |
| GET | `/api/auth/github/callback` | GitHub OAuth callback (JWT redirect) |
| GET | `/api/auth/facebook` | Start Facebook OAuth (Viral token persistence) |
| GET | `/api/auth/facebook/callback` | Facebook OAuth callback (JWT redirect) |

---

## C. User & profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user/profile` | My profile (auth) |
| POST | `/api/user/update` | Update profile (auth) |
| GET | `/api/user/public/:id` | Public profile |
| GET | `/api/user/public/:id/reviews` | Seller reviews |
| POST | `/api/user/fcm-token` | Update FCM token (auth) |
| POST | `/api/user/reports/create` | Create report (auth) |
| GET | `/api/user/reports/me` | My reports (auth) |
| POST | `/api/user/submit-verification` | Submit identity verification (auth) |
| GET | `/api/user/details/:id` | User details for admin (support+) |

---

## D. Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications (auth) |
| PATCH | `/api/notifications/read` | Mark all read (auth) |
| PUT | `/api/notifications/:id/read` | Mark one read (auth) |
| POST | `/api/notifications/test` | Test notification (auth) |

---

## E. Orders & jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders/my-orders` | My orders (auth) |
| GET | `/api/orders/seller-stats` | Seller stats (auth) |
| GET | `/api/orders/active-jobs` | Ongoing job requests (auth) |
| GET | `/api/orders/new` | Pending job requests (auth) |
| GET | `/api/orders/completed` | Completed (auth) |
| GET | `/api/orders/cancelled` | Cancelled (auth) |
| GET | `/api/orders/:id` | Order by ID (auth) |
| POST | `/api/orders/create` | Create job request (auth) |
| PATCH | `/api/orders/cancel` | Cancel order (auth) |
| POST | `/api/orders/complete` | Complete order (auth) |
| GET | `/api/orders/available` | Available jobs (auth) |
| POST | `/api/orders/accept` | Accept job (auth) |
| POST | `/api/orders/decline` | Decline job (auth) |
| GET | `/api/orders/declined` | Declined requests (auth) |
| POST | `/api/orders/custom-offer` | Create custom offer (auth) |
| POST | `/api/orders/accept-offer` | Accept custom offer (auth) |
| POST | `/api/orders/cancel-offer` | Cancel custom offer (auth) |
| POST | `/api/orders/reject-offer` | Reject custom offer (auth) |
| POST | `/api/orders/message` | Send message (auth) |
| POST | `/api/orders/read` | Mark messages read (auth) |
| POST | `/api/orders/deliver` | Upload deliverable (auth) |
| POST | `/api/orders/review` | Rate & review order (auth) |

---

## F. Wallet & payment

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/wallet/predict` | Predict correspondent |
| GET | `/api/wallet/countries-providers` | Countries & providers |
| POST | `/api/wallet/deposit` | Deposit |
| POST | `/api/wallet/withdraw` | Withdraw / payout |
| GET | `/api/wallet/balance` | Balance |
| GET | `/api/wallet/earnings` | Earnings |
| GET | `/api/wallet/payout-status/:payoutId` | Payout status |
| GET | `/api/wallet/payout-stats` | Payout stats |
| GET | `/api/payment/providers` | Providers |
| POST | `/api/payment/predict-correspondent` | Predict correspondent |
| POST | `/api/payment/deposit` | Deposit (auth) |
| POST | `/api/payment/payout` | Payout (auth) |
| GET | `/api/payment/status/:transactionId/:type` | Transaction status |
| POST | `/api/payment/refund` | Refund |
| GET | `/api/payout/providers` | Payout providers |
| POST | `/api/payout` | Payout |
| POST | `/api/pawapay/callback/deposit` | PawaPay deposit webhook |
| POST | `/api/pawapay/callback/payout` | PawaPay payout webhook |
| POST | `/api/pawapay/callback/refund` | PawaPay refund webhook |

---

## G. Support & tickets

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/support/tickets` | Create ticket (optional auth) |
| GET | `/api/support/tickets` | My tickets (auth) |
| GET | `/api/support/tickets/:id` | Ticket by ID (auth) |
| POST | `/api/support/tickets/:id/reply` | Reply to ticket (auth) |

---

## H. FAQ & help

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/faq/help` | List FAQs (public) |
| POST | `/api/faq/help` | Create FAQ (support) |
| POST | `/api/faq/help/bulk` | Bulk create FAQs (support) |
| PATCH | `/api/faq/help/:id` | Update FAQ (support) |
| DELETE | `/api/faq/help/:id` | Delete FAQ (supervisor+) |

---

## I. Gigs & categories

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gigs` | List gigs |
| GET | `/api/gigs/search` | Search gigs |
| GET | `/api/gigs/:id` | Gig by ID |
| GET | `/api/gigs/my-gigs` | My gigs (auth) |
| POST | `/api/gigs/create` | Create gig (auth, multipart) |
| PUT | `/api/gigs/update/:id` | Update gig (auth) |
| DELETE | `/api/gigs/delete/:id` | Delete gig (auth) |
| GET | `/api/categories` | List categories |
| GET | `/api/categories/subcategories` | List subcategories |

---

## J. Workers & recommendation

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workers/find` | Find workers |
| GET | `/api/workers/top-rated-nearby` | Top rated nearby |
| POST | `/api/r` | Recommend workers (auth) |

---

## K. Chat & chatbot

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/send` | Send message (auth, optional attachment) |
| POST | `/api/chat/custom-offer` | Send custom offer |
| GET | `/api/chat/with/:otherUserId` | Conversation with user |
| GET | `/api/chat/list` | Chat list |
| POST | `/api/chatbot/chat` | Public chatbot |
| POST | `/api/chatbot/chat/ticket` | Create guest ticket |
| GET | `/api/chatbot/debug` | Bot debug |

---

## L. Uploads & files

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/files/:folder/:filename` | Serve uploaded file |
| POST | `/api/upload/profile-picture` | Profile picture (auth) |
| POST | `/api/upload/other-images` | Other images (auth) |
| POST | `/api/upload/portfolio` | Portfolio images (auth) |
| POST | `/api/upload/videos` | Videos (auth) |
| POST | `/api/upload/gig-image/:gigId` | Gig image (auth) |
| POST | `/api/upload/certificates` | Certificates (auth) |
| POST | `/api/upload/identity-document` | Identity document (auth) |
| POST | `/api/courses/upload/thumbnail` | Course thumbnail |
| POST | `/api/courses/upload/video` | Course video |
| POST | `/api/courses/upload/material` | Course material |

---

## M. Courses & enrollments

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/enrollments/enroll` | Enroll in course (auth, body: `courseId`) |
| GET | `/api/enrollments/my-courses` | My courses (auth) |
| GET | `/api/enrollments/:courseId/check` | Check enrollment (auth) |
| GET | `/api/enrollments/:courseId/progress` | Course progress (auth) |
| POST | `/api/enrollments/lectures/:lectureId/progress` | Update lecture progress (auth) |

---

## N. Config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Get system config |
| PUT | `/api/config` | Update system config (super_admin/supervisor) |

---

## O. Admin panel (all under `/api/admin`, auth + role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/me` | My admin profile |
| PUT | `/api/admin/me/profile` | Update my profile |
| PUT | `/api/admin/me/password` | Change my password |
| POST | `/api/admin/me/email/initiate` | Initiate email update |
| POST | `/api/admin/me/email/verify` | Verify email update |
| POST | `/api/admin/create-admin` | Create admin (super_admin) |
| PATCH | `/api/admin/users/:id/reset-password` | Reset user password (super_admin) |
| GET | `/api/admin/admins` | List admins |
| GET | `/api/admin/admins/:id` | Get admin by ID |
| PATCH | `/api/admin/admins/:id` | Update admin (super_admin) |
| DELETE | `/api/admin/admins/:id` | Delete admin (super_admin) |
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/activity-chart` | Activity chart |
| GET | `/api/admin/recent-actions` | Recent actions |
| GET | `/api/admin/quick-insights` | Quick insights |
| GET | `/api/admin/financial-logs` | Financial logs (super_admin) |
| GET | `/api/admin/users` | All users (support+) |
| GET | `/api/admin/user-activity/:userId` | User activity (support) |
| PATCH | `/api/admin/verify-user` | Verify user (supervisor+) |
| PATCH | `/api/admin/suspend-user` | Suspend user (supervisor+) |
| DELETE | `/api/admin/users/:id` | Delete user (super_admin) |
| POST | `/api/admin/categories` | Create category (super_admin) |
| GET | `/api/admin/categories` | List categories |
| PATCH | `/api/admin/categories/:id` | Update category |
| DELETE | `/api/admin/categories/:id` | Delete category |
| POST | `/api/admin/subcategories` | Create subcategory |
| GET | `/api/admin/subcategories` | List subcategories |
| PATCH | `/api/admin/subcategories/:id` | Update subcategory |
| DELETE | `/api/admin/subcategories/:id` | Delete subcategory |
| GET | `/api/admin/gigs` | All gigs |
| PATCH | `/api/admin/gigs/:id/status` | Update gig status (supervisor+) |
| DELETE | `/api/admin/gigs/:id` | Delete gig (super_admin) |
| GET | `/api/admin/orders` | All orders |
| GET | `/api/admin/orders/:id` | Order details |
| PATCH | `/api/admin/orders/:id/cancel` | Cancel order (supervisor+) |
| POST | `/api/admin/settings` | Update platform settings (super_admin) |
| GET | `/api/admin/tickets` | Support tickets |
| GET | `/api/admin/tickets/:id` | Ticket by ID |
| POST | `/api/admin/tickets/:id/reply` | Reply to ticket |
| PUT | `/api/admin/tickets/:id/status` | Update ticket status |
| PUT | `/api/admin/tickets/:id/assign` | Assign ticket |
| GET | `/api/admin/tickets/assigned` | My assigned tickets |
| POST | `/api/admin/tickets/:id/internal-note` | Add internal note |
| GET | `/api/admin/reports` | All reports (support) |
| GET | `/api/admin/reports/:id` | Report details |
| PATCH | `/api/admin/reports/:id` | Update report status (supervisor) |
| POST | `/api/admin/courses` | Create course (supervisor+) |
| GET | `/api/admin/courses` | All courses |
| GET | `/api/admin/courses/:id` | Course by ID |
| PUT | `/api/admin/courses/:id` | Update course |
| DELETE | `/api/admin/courses/:id` | Delete course (super_admin) |
| POST | `/api/admin/courses/:id/lectures` | Add lecture |
| PUT | `/api/admin/lectures/:id` | Update lecture |
| DELETE | `/api/admin/lectures/:id` | Delete lecture |
| POST | `/api/admin/course-categories` | Create course category |
| GET | `/api/admin/course-categories` | All course categories |
| PUT | `/api/admin/course-categories/:id` | Update course category |
| DELETE | `/api/admin/course-categories/:id` | Delete course category |

---

## P. Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/docs` | Swagger API docs |
| GET | `/` | API server health |
| GET | `/chat-interface` | Chat interface HTML |
| GET | `/api-docs` | Swagger UI (root) |
| GET | `/api-docs/courses` | Course Swagger UI (root) |
| GET | `/uploads/courses/*` | Course uploads (static) |
| GET | `/uploads/viral/*` | Viral uploads (static) |
| GET | `/api/images/*` | Legacy image route |
