import mongoose, { Schema } from 'mongoose';

// A walking or driving route between two points, as Google gave it — shared by
// every trip, so a leg two itineraries have in common is looked up once.
// _id: "<walk|drive>:<lat,lng>><lat,lng>" (5 decimal places). minutes null =
// Google has no route. Kept a month: streets barely change, and driving is
// asked for without live traffic.
const RouteCacheSchema = new Schema({
  _id:     { type: String },
  minutes: { type: Number, default: null },
  metres:  { type: Number, default: null },
  line:    { type: String, default: null },   // Google's encoded polyline
  at:      { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
}, { versionKey: false });

export default mongoose.models.RouteCache || mongoose.model('RouteCache', RouteCacheSchema);
