import mongoose, { Schema } from 'mongoose';

// One parsed Wikivoyage article per destination, shared by every trip that goes there.
const WikivoyageGuideSchema = new Schema({
  title:     { type: String, required: true, unique: true },
  guide:     { type: Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.models.WikivoyageGuide || mongoose.model('WikivoyageGuide', WikivoyageGuideSchema);
