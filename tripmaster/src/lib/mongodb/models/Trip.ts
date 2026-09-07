import mongoose, { Schema } from 'mongoose';

const LocationSchema = new Schema({
  city:          String,
  country:       String,
  countryCode:   String,
  coordinates:   { lat: Number, lng: Number },
  timezone:      String,
  currency:      String,
  currencySymbol: String,
  electricalPlug: String,
  iataCode:      String,
}, { _id: false });

const TripSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:   { type: String, required: true },
  origin:      LocationSchema,
  destination: LocationSchema,
  additionalDestinations: [{ ...LocationSchema.obj, arrivalDate: Date, departureDate: Date, nights: Number }],
  startDate: Date,
  endDate:   Date,
  nights:    Number,
  tripType:  { type: String, enum: ['work', 'leisure', 'mixed'] },
  purpose:   String,
  // Real names for who's on the other end of a reimbursable expense on this trip —
  // often unknown when the trip is first created, filled in once known via Edit Trip.
  // Surfaced in Expenses so "Promoter" reads as "Blue Note Festival" instead. Company
  // is here too — not assumed constant across trips, some users invoice through
  // different entities depending on the trip.
  companyName:    String,
  promoterName:   String,
  clientName:     String,
  thirdPartyName: String,
  coverPhotoUrl:    String,
  coverPhotoThumb:  String,
  coverPhotoCredit: String,
  weather: { type: Schema.Types.Mixed },
  culture: {
    briefing:    { type: Object, default: null },
    generatedAt: { type: Date,   default: null },
  },
  groundTransport: { type: Schema.Types.Mixed, default: null },
  status: {
    type: String,
    enum: ['idea', 'planning', 'confirmed', 'active', 'completed', 'cancelled'],
    default: 'idea',
  },
  collaborators: [{ userId: Schema.Types.ObjectId, role: { type: String, enum: ['viewer', 'editor'] }, addedAt: Date }],
  dismissedChecks: { type: [String], default: [] },
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

TripSchema.index({ userId: 1, status: 1 });
TripSchema.index({ startDate: 1 });

export default mongoose.models.Trip || mongoose.model('Trip', TripSchema);