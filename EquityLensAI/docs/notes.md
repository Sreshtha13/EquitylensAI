1. when i am clicking on the chart - iut should open the exact stoxck- not need to search it inside \
2. light theme is still pending
3. if all the apssword condityions are not matched than correct error message is not visible



What remains on my/code side
You can start testing the core in-app flow now. Before calling Phase 9 fully complete for production, I’d address or explicitly defer these gaps:

Email delivery is not implemented. Email preferences and a delivery table exist, but there’s no email provider/sender; alerts currently create in-app notifications only.
Alert preferences are only partly applied. The evaluator checks whether in-app notifications are enabled, but not the individual price/news/etc. preference flags. Preference hooks exist, but I found no settings UI using them.
Scheduler environment settings aren’t wired in. The sample environment advertises scheduler enablement and interval settings, but the server starts it with a fixed 60-second interval.
Persistence needs production verification and hardening. The repositories fall back to in-memory data when Supabase requests fail, and some write paths don’t surface those failures. A live deployment check should confirm rules and notifications persist in Supabase.
Documentation needs reconciliation. The Phase 9 doc lists /api/v1/alerts/status; the router exposes /api/v1/alerts/scheduler-status. The API overview should also be updated to include Phase 9 endpoints. See the alert routes and API documentation.
These are follow-up code/documentation tasks—not blockers to running the existing automated tests or trying the in-app path.