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
    country: String,       // Country that issued the passport
    countryCode: String,
    expiry: Date,
    number: String,        // Optional — useful for pre-fill on forms
  },

  preferences: {
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    language: { type: String, default: 'en' },
    defaultTripType: { type: String, enum: ['work', 'leisure', 'mixed'] },
  },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);