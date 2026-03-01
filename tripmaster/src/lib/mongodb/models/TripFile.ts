import mongoose, { Schema } from 'mongoose';

const TripFileSchema = new Schema({
  tripId:       { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },

  resourceType: { type: String, enum: ['file', 'link', 'contact', 'note'], default: 'file' },

  name:         { type: String, required: true },
  type: {
    type: String,
    enum: [
      // ── File types ──
      'boarding_pass',
      'train_ticket',
      'hotel_confirmation',
      'car_hire',
      'event_brief',
      'visa',
      'insurance',
      'passport',
      // ── Link types ──
      'primary',
      'hotel',
      'event_website',
      'artist_lineup',
      'venue',
      'booking_reference',
      'useful_info',
      // ── Contact types ──
      'artist',
      'venue_manager',
      'event_manager',
      'tour_manager',
      'production',
      'promoter',
      'accommodation_contact',
      'transport_contact',
      'emergency_contact',
      // ── Note types ──
      'general',
      'observation',
      'reminder',
      'recommendation',
      // ── Shared fallback ──
      'other',
    ],
    default: 'other',
  },

  // ── File-only ──────────────────────────────────────────
  gcsPath:  { type: String },
  gcsUrl:   { type: String },
  mimeType: { type: String },
  size:     { type: Number },

  // ── Link-only ──────────────────────────────────────────
  linkUrl:  { type: String },

  // ── Contact-only ───────────────────────────────────────
  phone:    { type: String },
  email:    { type: String },

  // ── Note-only ──────────────────────────────────────────
  body:     { type: String },   // the actual note content

  // ── Shared ─────────────────────────────────────────────
  notes: { type: String },      // annotation on files/links/contacts

  linkedTo: {
    collection: { type: String, enum: ['transport', 'accommodation', 'itinerary_stop', 'itinerary', 'venue'] },
    entryId:    { type: String },
    label:      { type: String },
  },

  // ── On-trip surfacing ───────────────────────────────────
  // Computed datetime at which this resource should surface in the on-trip feed.
  // Derived from linked entity's event time minus notification.minutesBefore.
  surfaceAt: { type: Date },

  // ── Notification preferences (per resource) ─────────────
  notification: {
    enabled:       { type: Boolean, default: false },
    minutesBefore: { type: Number, default: 120 },   // user-configurable
    lastSentAt:    { type: Date },
  },

}, { timestamps: true });

TripFileSchema.index({ tripId: 1, type: 1 });
TripFileSchema.index({ tripId: 1, surfaceAt: 1 });  // for on-trip feed queries

export default mongoose.models.TripFile || mongoose.model('TripFile', TripFileSchema);