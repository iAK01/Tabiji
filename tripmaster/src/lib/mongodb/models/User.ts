import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, required: true },
  name: String,
  avatarUrl: String,

  homeLocation: {
    addressLine1: String,
    addressLine2: String,
    city: String,
    postcode: String,
    country: String,
    countryCode: String,
    coordinates: { lat: Number, lng: Number }, // Geocoded server-side when needed for routing
    timezone: String,
    currency: String,
    currencySymbol: String,
    electricalPlug: String,
    language: String,
    emergency: String,
  },

  preferredAirport: {
    iata: String,
    name: String,
    city: String,
    country: String,
  },

  passport: {
    country: String,
    countryCode: String,
    expiry: Date,
    number: String,
  },

  travelInsurance: {
    provider: String,
    policyNumber: String,
    emergencyPhone: String,
    expiry: Date,
  },

  preferences: {
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    language: { type: String, default: 'en' },
    defaultTripType: { type: String, enum: ['work', 'leisure', 'mixed'] },
  },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);