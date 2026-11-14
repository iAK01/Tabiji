import mongoose, { Schema } from 'mongoose';

// A task on an itinerary day — done and ticked off, no time block (lib/itinerary/tasks.ts).
const TripTaskSchema = new Schema({
  // Made on the device (newTaskId), so a task added offline can be changed before it syncs
  _id:      { type: String, required: true },
  tripId:   { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date:     { type: String, required: true },     // YYYY-MM-DD, the itinerary day
  text:     { type: String, required: true },
  done:     { type: Boolean, default: false },
  doneAt:   { type: Date },
  // HH:MM on its date, read where you are then (the planner, lib/push/plan.ts). Unset = none.
  remindAt: { type: String },
}, { timestamps: true });

TripTaskSchema.index({ tripId: 1, date: 1, createdAt: 1 });

export default mongoose.models.TripTask || mongoose.model('TripTask', TripTaskSchema);
