import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, required: true },
  name: String,
  avatarUrl: String,

  homeLocation: {
    city: String,
    country: String,
    countryCode: String,
    coordinates: { lat: Number, lng: Number },
    timezone: String,
    currency: String,
    currencySymbol: String,
    electricalPlug: String,
    language: String,
    emergency: String,
  },

  passport: {
    country: String,
    countryCode: String,
    expiry: Date,
    number: String,
  },
  pushSubscriptions: [{ type: Schema.Types.Mixed }],

  preferences: {
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    language: { type: String, default: 'en' },
    defaultTripType: { type: String, enum: ['work', 'leisure', 'mixed'] },

    // ── Navigation app preferences per travel mode ──────────────────────────
    // 'apple_maps' is only meaningful on iOS — the UI filters it by platform
    navigationApps: {
      walking: {
        type: String,
        enum: ['apple_maps', 'google_maps', 'waze'],
        default: 'google_maps',
      },
      driving: {
        type: String,
        enum: ['apple_maps', 'google_maps', 'waze'],
        default: 'google_maps',
      },
      transit: {
        type: String,
        enum: ['apple_maps', 'google_maps', 'waze'],
        default: 'google_maps',
      },
      // Set to true once user has explicitly configured their preferences
      setupComplete: { type: Boolean, default: false },
    },
  },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);