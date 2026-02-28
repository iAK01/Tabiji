import mongoose, { Schema } from 'mongoose';

// Records every push notification that has been sent.
// Used for de-duplication — before sending, check this collection.
// A notification is uniquely identified by tripId + key + notificationType.
// key is the stop _id, transport index, or accommodation index.

const PushNotificationLogSchema = new Schema({
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId:           { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  key:              { type: String, required: true },   // stopId, "transport-{index}", "accom-{index}"
  notificationType: { type: String, required: true },   // "flight_3h", "train_45m", "ferry_3h", "hotel_45m", "stop_30m" etc
  sentAt:           { type: Date, default: Date.now },
}, { timestamps: false });

// Compound index — the trio that makes a notification unique
PushNotificationLogSchema.index({ userId: 1, tripId: 1, key: 1, notificationType: 1 }, { unique: true });

export default mongoose.models.PushNotificationLog ||
  mongoose.model('PushNotificationLog', PushNotificationLogSchema);