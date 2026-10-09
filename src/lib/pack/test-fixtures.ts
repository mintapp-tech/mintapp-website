import type { PackResponse } from "./schema";

// A valid Pre-meeting Pack for the synthetic clinic brief (SYNTHETIC_BRIEFS[0]),
// for tests only. Synthetic content; no real client.
export const clinicPack = (over: Partial<PackResponse> = {}): PackResponse => ({
  language: "en",
  client_facts: [
    { text: "Bookings happen by phone.", evidence: "Patients book by phone" },
    { text: "Schedules are kept in Google Sheets.", evidence: "We already use Google Sheets for schedules." },
  ],
  assumptions: [{ text: "Receptionists will manage the schedule.", reason: "They see the day's schedule today." }],
  missing_information: ["How cancellations are handled today"],
  design_blueprint: {
    pattern: "scheduling_app",
    audience: "Patients booking a session and the receptionists running each clinic's day.",
    primary_goal: "Let patients book a therapist and time without calling.",
    hierarchy: ["Available times first", "Therapist choice second", "Clinic information last"],
    responsive_notes: "Patients book on phones; receptionists use a desktop schedule.",
    brand_context: "No brand material is mentioned in the brief.",
  },
  screens: [
    { id: "s1", template: "booking_form", title: "Book a session", purpose: "A patient picks a therapist and a time.", headline: "Book your next session", items: [{ title: "Therapist", text: "Choose who you will see." }, { title: "Time", text: "Pick an open slot." }], primary_action: "Confirm booking" },
    { id: "s2", template: "schedule_calendar", title: "Today's schedule", purpose: "Receptionists see and adjust the day.", headline: "Today across the clinics", items: [{ title: "Morning", text: "Booked and open sessions." }], primary_action: "Add a booking" },
  ],
  user_flow: [
    { step: "A patient chooses a therapist and a time.", screen: "s1" },
    { step: "The receptionist sees the booking on the day's schedule.", screen: "s2" },
  ],
  proposal: {
    understanding: "Three clinics lose track of phone bookings and cancellations.",
    recommended_solution: "An online booking system for patients with a shared schedule for receptionists.",
    first_release_scope: ["Patient booking by therapist and time", "A daily schedule for receptionists", "Arabic interface"],
    phases: [{ name: "First release", summary: "Booking and the daily schedule." }],
    deliverables: ["Designs for the booking and schedule screens", "A working web application"],
    assumptions: ["The three clinics share one schedule system."],
    exclusions: ["Payments", "Medical records"],
    cost_schedule_factors: ["How cancellations and reminders should work", "Whether the Google Sheets data must be imported"],
    next_step: "Confirm the booking rules in the first meeting.",
  },
  discovery_questions: [
    { question: "How are cancellations handled today?", purpose: "Design the cancellation flow." },
    { question: "Should therapists see their own schedules?", purpose: "Decide the roles." },
    { question: "Is the Google Sheets data needed in the new system?", purpose: "Scope any import." },
  ],
  risks: [{ risk: "Receptionists may keep the spreadsheet in parallel.", why: "The current habit is the spreadsheet." }],
  client_decisions: ["Who can cancel a booking"],
  meeting_agenda: [
    { item: "How booking works today", purpose: "Confirm the problem." },
    { item: "The first release", purpose: "Agree the next step." },
  ],
  confirm_before_pricing: ["The booking and cancellation rules", "Whether data must be imported"],
  ...over,
});
