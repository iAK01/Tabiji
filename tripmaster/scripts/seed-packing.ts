/**
 * Master Packing Catalogue Seed Script
 * Derived from trip-config.js
 *
 * Run with: npx tsx scripts/seed-packing.ts
 * (install tsx if needed: npm i -D tsx)
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MasterPackingItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  essential: { type: Boolean, default: false },
  tripTypes: [{ type: String }],   // always | business | leisure | camping | winter-sports | beach | city-break
  transportTypes: [{ type: String }], // plane | car | train | ferry | bus
  accommodationTypes: [{ type: String }], // hotel | airbnb | camping | hostel | family
  activities: [{ type: String }],  // business | sightseeing | hiking | beach | workout | photography | watersports | entertainment | shopping | family | relaxation
  quantityType: { type: String, enum: ['fixed', 'per_night'], default: 'fixed' },
  quantity: { type: Number, default: 1 },
  quantityMin: Number,
  quantityMax: Number,
  preTravelAction: { type: Boolean, default: false },
  preTravelNote: String,
  advisoryNote: String,
  photoUrl: String,
}, { timestamps: true });

const MasterPackingItem = mongoose.models.MasterPackingItem ||
  mongoose.model('MasterPackingItem', MasterPackingItemSchema);

const items = [

  // ─── DOCUMENTS ────────────────────────────────────────────────────────────
  { name: 'Passport', category: 'Documents', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Check expiry — must be valid 6+ months beyond return date' },
  { name: 'Travel insurance documents', category: 'Documents', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Flight tickets / boarding passes', category: 'Documents', essential: true, tripTypes: ['always'], transportTypes: ['plane'], quantityType: 'fixed', quantity: 1 },
  { name: 'Train tickets', category: 'Documents', essential: true, tripTypes: ['always'], transportTypes: ['train'], quantityType: 'fixed', quantity: 1 },
  { name: 'Hotel / accommodation confirmation', category: 'Documents', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Visa documents', category: 'Documents', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Check if required for destination country' },
  { name: 'Emergency contact list', category: 'Documents', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Business cards', category: 'Documents', essential: true, tripTypes: ['business'], activities: ['business'], quantityType: 'fixed', quantity: 1 },
  { name: 'Work documents / contracts', category: 'Documents', essential: false, tripTypes: ['business'], activities: ['business'], quantityType: 'fixed', quantity: 1 },
  { name: 'Driver\'s licence', category: 'Documents', essential: false, tripTypes: ['always'], transportTypes: ['car'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Required if hiring or driving a car' },
  { name: 'Car insurance documents', category: 'Documents', essential: true, tripTypes: ['always'], transportTypes: ['car'], quantityType: 'fixed', quantity: 1 },

  // ─── ELECTRONICS ──────────────────────────────────────────────────────────
  { name: 'Laptop', category: 'Electronics', essential: true, tripTypes: ['business'], activities: ['business'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Charge fully before packing' },
  { name: 'Laptop charger', category: 'Electronics', essential: true, tripTypes: ['business'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Don\'t forget the charger' },
  { name: 'Laptop in accessible bag for security', category: 'Electronics', essential: true, tripTypes: ['always'], transportTypes: ['plane'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Must be easily removed at airport security' },
  { name: 'Phone charger', category: 'Electronics', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'USB-C cable', category: 'Electronics', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 2 },
  { name: 'Universal travel adapter', category: 'Electronics', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Check destination plug type' },
  { name: 'Phone car charger', category: 'Electronics', essential: true, tripTypes: ['always'], transportTypes: ['car'], quantityType: 'fixed', quantity: 1 },
  { name: 'Portable power bank', category: 'Electronics', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Charge fully before travel' },
  { name: 'Noise-cancelling headphones', category: 'Electronics', essential: false, tripTypes: ['always'], transportTypes: ['plane', 'train'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Charge before packing' },
  { name: 'Camera', category: 'Electronics', essential: false, tripTypes: ['leisure', 'beach', 'city-break'], activities: ['photography', 'sightseeing'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Charge battery, clear memory card' },
  { name: 'Camera memory cards', category: 'Electronics', essential: false, tripTypes: ['leisure', 'beach', 'city-break'], activities: ['photography'], quantityType: 'fixed', quantity: 2 },
  { name: 'Extra camera batteries', category: 'Electronics', essential: false, activities: ['photography'], quantityType: 'fixed', quantity: 2 },
  { name: 'Tablet / e-reader', category: 'Electronics', essential: false, tripTypes: ['always'], activities: ['relaxation'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Charge and download content before travel' },
  { name: 'Mouse / keyboard', category: 'Electronics', essential: false, tripTypes: ['business'], quantityType: 'fixed', quantity: 1 },
  { name: 'HDMI / display adapter', category: 'Electronics', essential: false, tripTypes: ['business'], activities: ['business'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Useful for presentations' },
  { name: 'USB hub', category: 'Electronics', essential: false, tripTypes: ['business'], quantityType: 'fixed', quantity: 1 },
  { name: 'Presentation clicker', category: 'Electronics', essential: false, tripTypes: ['business'], activities: ['business'], quantityType: 'fixed', quantity: 1 },
  { name: 'Laptop stand', category: 'Electronics', essential: false, tripTypes: ['business'], quantityType: 'fixed', quantity: 1 },
  { name: 'Headlamp / flashlight', category: 'Electronics', essential: true, tripTypes: ['camping'], accommodationTypes: ['camping'], quantityType: 'fixed', quantity: 1 },

  // ─── CLOTHES ──────────────────────────────────────────────────────────────
  { name: 'Underwear', category: 'Clothes', essential: true, tripTypes: ['always'], quantityType: 'per_night', quantity: 1, quantityMin: 3, quantityMax: 10 },
  { name: 'Socks', category: 'Clothes', essential: true, tripTypes: ['always'], quantityType: 'per_night', quantity: 1, quantityMin: 3, quantityMax: 10 },
  { name: 'T-shirts', category: 'Clothes', essential: true, tripTypes: ['always'], quantityType: 'per_night', quantity: 1, quantityMin: 2, quantityMax: 7 },
  { name: 'Trousers / jeans', category: 'Clothes', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 2 },
  { name: 'Smart trousers', category: 'Clothes', essential: true, tripTypes: ['business'], activities: ['business', 'entertainment'], quantityType: 'fixed', quantity: 2 },
  { name: 'Business shirts', category: 'Clothes', essential: true, tripTypes: ['business'], activities: ['business'], quantityType: 'per_night', quantity: 1, quantityMin: 2, quantityMax: 7 },
  { name: 'Suit jacket / blazer', category: 'Clothes', essential: false, tripTypes: ['business'], activities: ['business', 'entertainment'], quantityType: 'fixed', quantity: 1 },
  { name: 'Dress shoes', category: 'Clothes', essential: false, tripTypes: ['business'], activities: ['business', 'entertainment'], quantityType: 'fixed', quantity: 1 },
  { name: 'Evening attire', category: 'Clothes', essential: false, tripTypes: ['leisure', 'business'], activities: ['entertainment'], quantityType: 'fixed', quantity: 1 },
  { name: 'Comfortable walking shoes', category: 'Clothes', essential: true, tripTypes: ['always'], activities: ['sightseeing', 'shopping', 'city-break'], quantityType: 'fixed', quantity: 1 },
  { name: 'Trainers / casual shoes', category: 'Clothes', essential: false, tripTypes: ['leisure', 'city-break'], quantityType: 'fixed', quantity: 1 },
  { name: 'Jacket / coat', category: 'Clothes', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Check destination weather' },
  { name: 'Pyjamas / sleepwear', category: 'Clothes', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Workout clothes', category: 'Clothes', essential: false, tripTypes: ['always'], activities: ['workout'], quantityType: 'fixed', quantity: 2 },
  { name: 'Sports shoes', category: 'Clothes', essential: false, activities: ['workout'], quantityType: 'fixed', quantity: 1 },
  { name: 'Gym towel', category: 'Clothes', essential: false, activities: ['workout'], quantityType: 'fixed', quantity: 1 },
  { name: 'Swimwear', category: 'Clothes', essential: true, tripTypes: ['beach'], activities: ['beach', 'watersports'], quantityType: 'fixed', quantity: 2, quantityMin: 2 },
  { name: 'Water shoes', category: 'Clothes', essential: false, activities: ['watersports'], quantityType: 'fixed', quantity: 1 },
  { name: 'Belt', category: 'Clothes', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Thermal underwear', category: 'Clothes', essential: true, tripTypes: ['winter-sports'], quantityType: 'per_night', quantity: 1, quantityMin: 2 },
  { name: 'Ski / snowboard jacket', category: 'Clothes', essential: true, tripTypes: ['winter-sports'], quantityType: 'fixed', quantity: 1 },
  { name: 'Snow pants', category: 'Clothes', essential: true, tripTypes: ['winter-sports'], quantityType: 'fixed', quantity: 1 },
  { name: 'Gloves', category: 'Clothes', essential: true, tripTypes: ['winter-sports'], quantityType: 'fixed', quantity: 1 },
  { name: 'Hiking boots', category: 'Clothes', essential: true, tripTypes: ['camping'], activities: ['hiking'], quantityType: 'fixed', quantity: 1 },
  { name: 'Layers for temperature', category: 'Clothes', essential: true, transportTypes: ['bus'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Bus air con can be unpredictable' },
  { name: 'Deck appropriate clothing', category: 'Clothes', essential: true, transportTypes: ['ferry'], quantityType: 'fixed', quantity: 1 },
  { name: 'Warm layer for ferry deck', category: 'Clothes', essential: true, transportTypes: ['ferry'], quantityType: 'fixed', quantity: 1 },

  // ─── TOILETRIES ───────────────────────────────────────────────────────────
  { name: 'Toiletry bag', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Clear liquids bag (100ml)', category: 'Toiletries', essential: true, tripTypes: ['always'], transportTypes: ['plane'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Required for airport security — all liquids under 100ml' },
  { name: 'Toothbrush', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Toothpaste', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Deodorant', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Shampoo (travel size)', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, advisoryNote: '100ml or less for carry-on' },
  { name: 'Shower gel / soap', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Razor / electric shaver', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Charge electric shaver fully before travel' },
  { name: 'Moisturiser', category: 'Toiletries', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Sunscreen', category: 'Toiletries', essential: true, tripTypes: ['beach', 'leisure'], activities: ['beach', 'sightseeing', 'watersports'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Check UV index at destination' },
  { name: 'Waterproof sunscreen', category: 'Toiletries', essential: true, activities: ['watersports', 'beach'], quantityType: 'fixed', quantity: 1 },
  { name: 'Lip balm', category: 'Toiletries', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Hairbrush / comb', category: 'Toiletries', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Nail clippers', category: 'Toiletries', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Flip flops (for hostel showers)', category: 'Toiletries', essential: true, accommodationTypes: ['hostel'], quantityType: 'fixed', quantity: 1 },
  { name: 'Personal towel', category: 'Toiletries', essential: false, accommodationTypes: ['family'], quantityType: 'fixed', quantity: 1 },
  { name: 'Quick-dry towel', category: 'Toiletries', essential: true, accommodationTypes: ['hostel', 'camping'], tripTypes: ['camping', 'leisure'], quantityType: 'fixed', quantity: 1 },
  { name: 'Beach towel', category: 'Toiletries', essential: true, tripTypes: ['beach'], activities: ['beach', 'watersports'], quantityType: 'fixed', quantity: 1 },
  { name: 'Dish soap', category: 'Toiletries', essential: true, accommodationTypes: ['airbnb'], quantityType: 'fixed', quantity: 1 },
  { name: 'Cleaning wipes', category: 'Toiletries', essential: true, accommodationTypes: ['airbnb'], quantityType: 'fixed', quantity: 1 },

  // ─── MEDICINES ────────────────────────────────────────────────────────────
  { name: 'Prescription medication', category: 'Medicines', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Carry in original packaging with prescription letter' },
  { name: 'Paracetamol / ibuprofen', category: 'Medicines', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Antihistamines', category: 'Medicines', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Immodium / stomach tablets', category: 'Medicines', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Motion sickness medication', category: 'Medicines', essential: false, transportTypes: ['ferry', 'bus'], quantityType: 'fixed', quantity: 1 },
  { name: 'Ginger supplements (seasickness)', category: 'Medicines', essential: false, transportTypes: ['ferry'], quantityType: 'fixed', quantity: 1 },
  { name: 'First aid kit', category: 'Medicines', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Insect repellent', category: 'Medicines', essential: false, tripTypes: ['leisure', 'camping', 'beach'], activities: ['hiking', 'beach'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Check if required for destination' },
  { name: 'Rehydration sachets', category: 'Medicines', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 3 },
  { name: 'Vitamins / supplements', category: 'Medicines', essential: false, tripTypes: ['always'], quantityType: 'per_night', quantity: 1 },

  // ─── LUGGAGE ──────────────────────────────────────────────────────────────
  { name: 'Main suitcase / trolley bag', category: 'Luggage', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Carry-on cabin bag', category: 'Luggage', essential: true, tripTypes: ['always'], transportTypes: ['plane'], quantityType: 'fixed', quantity: 1 },
  { name: 'Day backpack', category: 'Luggage', essential: false, tripTypes: ['always'], activities: ['sightseeing', 'hiking', 'city-break'], quantityType: 'fixed', quantity: 1 },
  { name: 'Light daypack', category: 'Luggage', essential: true, tripTypes: ['city-break'], quantityType: 'fixed', quantity: 1 },
  { name: 'Hiking backpack', category: 'Luggage', essential: true, tripTypes: ['camping'], activities: ['hiking'], quantityType: 'fixed', quantity: 1 },
  { name: 'Luggage locks', category: 'Luggage', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 2 },
  { name: 'Luggage tags', category: 'Luggage', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 2 },
  { name: 'Packing cubes', category: 'Luggage', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Waterproof bag / dry bag', category: 'Luggage', essential: true, tripTypes: ['beach', 'camping'], activities: ['watersports'], transportTypes: ['ferry'], quantityType: 'fixed', quantity: 1 },
  { name: 'Laundry bag', category: 'Luggage', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Cooler / cool bag', category: 'Luggage', essential: false, tripTypes: ['camping'], quantityType: 'fixed', quantity: 1 },

  // ─── ACCESSORIES ──────────────────────────────────────────────────────────
  { name: 'Wallet', category: 'Accessories', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Cash (local currency)', category: 'Accessories', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, preTravelAction: true, preTravelNote: 'Get local currency before departure or at airport' },
  { name: 'Money belt / travel wallet', category: 'Accessories', essential: true, accommodationTypes: ['hostel'], activities: ['sightseeing', 'shopping'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Useful in busy tourist areas' },
  { name: 'Sunglasses', category: 'Accessories', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Goggles', category: 'Accessories', essential: true, tripTypes: ['winter-sports'], quantityType: 'fixed', quantity: 1 },
  { name: 'Watch', category: 'Accessories', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Neck pillow', category: 'Accessories', essential: false, transportTypes: ['plane', 'train', 'bus'], quantityType: 'fixed', quantity: 1 },
  { name: 'Eye mask', category: 'Accessories', essential: false, transportTypes: ['plane'], accommodationTypes: ['hostel'], activities: ['relaxation'], quantityType: 'fixed', quantity: 1 },
  { name: 'Earplugs', category: 'Accessories', essential: false, accommodationTypes: ['hostel'], transportTypes: ['plane', 'bus'], quantityType: 'fixed', quantity: 2 },
  { name: 'Compression socks', category: 'Accessories', essential: false, transportTypes: ['plane'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Recommended for long-haul flights' },
  { name: 'Reusable water bottle', category: 'Accessories', essential: true, tripTypes: ['always'], quantityType: 'fixed', quantity: 1 },
  { name: 'Umbrella', category: 'Accessories', essential: false, tripTypes: ['always'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Check destination weather' },
  { name: 'Padlock for lockers', category: 'Accessories', essential: true, accommodationTypes: ['hostel'], quantityType: 'fixed', quantity: 1 },
  { name: 'Reusable shopping bags', category: 'Accessories', essential: false, activities: ['shopping'], quantityType: 'fixed', quantity: 2 },
  { name: 'Small evening bag', category: 'Accessories', essential: false, activities: ['entertainment'], quantityType: 'fixed', quantity: 1 },
  { name: 'Journal', category: 'Accessories', essential: false, activities: ['relaxation'], quantityType: 'fixed', quantity: 1 },
  { name: 'Books', category: 'Accessories', essential: false, activities: ['relaxation'], quantityType: 'fixed', quantity: 1 },
  { name: 'Snorkelling gear', category: 'Accessories', essential: false, activities: ['watersports'], quantityType: 'fixed', quantity: 1 },
  { name: 'Beach bag', category: 'Accessories', essential: false, tripTypes: ['beach'], activities: ['beach'], quantityType: 'fixed', quantity: 1 },

  // ─── WORK GEAR ────────────────────────────────────────────────────────────
  { name: 'Notebook & pens', category: 'Work Gear', essential: true, tripTypes: ['business'], activities: ['business'], quantityType: 'fixed', quantity: 1 },

  // ─── CAMPING GEAR ─────────────────────────────────────────────────────────
  { name: 'Tent', category: 'Other', essential: true, tripTypes: ['camping'], accommodationTypes: ['camping'], quantityType: 'fixed', quantity: 1 },
  { name: 'Sleeping bag', category: 'Other', essential: true, tripTypes: ['camping'], accommodationTypes: ['camping'], quantityType: 'fixed', quantity: 1 },
  { name: 'Sleeping pad / mat', category: 'Other', essential: true, tripTypes: ['camping'], accommodationTypes: ['camping'], quantityType: 'fixed', quantity: 1 },
  { name: 'Camping pillow', category: 'Other', essential: true, tripTypes: ['camping'], accommodationTypes: ['camping'], quantityType: 'fixed', quantity: 1 },
  { name: 'Camping stove', category: 'Other', essential: true, tripTypes: ['camping'], accommodationTypes: ['camping'], quantityType: 'fixed', quantity: 1 },
  { name: 'Camping chair', category: 'Other', essential: false, tripTypes: ['camping'], accommodationTypes: ['camping'], quantityType: 'fixed', quantity: 1 },

  // ─── COURTESY / HOST GIFTS ────────────────────────────────────────────────
  { name: 'Host gift', category: 'Other', essential: true, accommodationTypes: ['family'], quantityType: 'fixed', quantity: 1, advisoryNote: 'Bring a gift for your hosts' },
  { name: 'Thank you card', category: 'Other', essential: true, accommodationTypes: ['family'], quantityType: 'fixed', quantity: 1 },
  { name: 'Contribution to groceries (cash)', category: 'Other', essential: true, accommodationTypes: ['family'], quantityType: 'fixed', quantity: 1 },

  // ─── ROAD TRIP ────────────────────────────────────────────────────────────
  { name: 'Emergency car kit', category: 'Other', essential: true, transportTypes: ['car'], quantityType: 'fixed', quantity: 1 },
  { name: 'Road maps / GPS', category: 'Other', essential: true, transportTypes: ['car'], quantityType: 'fixed', quantity: 1 },
  { name: 'Snacks for journey', category: 'Other', essential: false, transportTypes: ['car', 'train', 'bus', 'ferry'], quantityType: 'fixed', quantity: 1 },
  { name: 'Cash for tolls', category: 'Other', essential: false, transportTypes: ['car'], quantityType: 'fixed', quantity: 1 },

  // ─── FAMILY TRAVEL ────────────────────────────────────────────────────────
  { name: 'Baby supplies', category: 'Other', essential: false, activities: ['family'], quantityType: 'fixed', quantity: 1 },
  { name: 'Entertainment for kids', category: 'Other', essential: false, activities: ['family'], quantityType: 'fixed', quantity: 1 },
  { name: 'Snacks for kids', category: 'Other', essential: false, activities: ['family'], quantityType: 'fixed', quantity: 1 },
  { name: 'Extra clothes for kids', category: 'Other', essential: false, activities: ['family'], quantityType: 'fixed', quantity: 1 },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected');

  console.log('🗑️  Clearing existing catalogue...');
  await MasterPackingItem.deleteMany({});

  console.log(`📦 Seeding ${items.length} items...`);
  await MasterPackingItem.insertMany(items);

  const counts = await MasterPackingItem.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  console.log('\n✅ Seed complete!\n');
  console.log('Items by category:');
  counts.forEach((c: { _id: string; count: number }) =>
    console.log(`  ${c._id}: ${c.count}`)
  );
  console.log(`\nTotal: ${items.length} items`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});