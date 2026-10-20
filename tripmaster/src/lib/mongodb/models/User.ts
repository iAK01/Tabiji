import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, required: true },
  name: String,
  avatarUrl: String,
  // Default "who's paying" company name — seeds new trips' companyName so it doesn't
  // need re-entering every time; still overridable per trip via Edit Trip for users
  // who invoice through more than one entity.
  companyName: String,

  homeLocation: {
    addressLine1: String,
    addressLine2: String,
    postcode: String,
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

  // Monthly average highs at home — "days like Ballina in July" on the Weather
  // tab. Cached per home location by src/lib/weather.ts; climate barely moves.
  homeClimate: { type: Schema.Types.Mixed },

  preferredAirport: {
    iata:    String,
    name:    String,
    city:    String,
    country: String,
  },

  fallbackAirport: {
    iata:    String,
    name:    String,
    city:    String,
    country: String,
  },

  passport: {
    country: String,
    countryCode: String,
    expiry: Date,
    number: String,
  },
  pushSubscriptions: [{ type: Schema.Types.Mixed }],

  // Notification settings — shape and defaults in src/lib/push/prefs.ts. Kept
  // out of `preferences` because the profile save replaces that whole object.
  notificationPrefs: { type: Schema.Types.Mixed },

  preferences: {
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    language: { type: String, default: 'en' },
    defaultTripType: { type: String, enum: ['work', 'leisure', 'mixed'] },

    // Minutes before a flight the traveller wants to be at the airport. Drives the
    // auto-generated "Airport check-in" itinerary stop. 30–300; default 120.
    airportBufferMins: { type: Number, default: 120 },

    // App IDs from MY_APPS_CATALOG the user has toggled on
    myApps: { type: [String], default: [] },
  },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);