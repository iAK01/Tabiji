import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import TripLogistics from '@/lib/mongodb/models/TripLogistics';
import TripPacking from '@/lib/mongodb/models/TripPacking';
import MasterPackingItem from '@/lib/mongodb/models/MasterPackingItem';
import User from '@/lib/mongodb/models/User';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const logistics = await TripLogistics.findOne({ tripId: id });

  // Determine transport types from logistics
  const transportTypes: string[] = [];
  if (logistics?.transport?.length) {
    logistics.transport.forEach((t: { type: string }) => {
      if (t.type === 'flight' && !transportTypes.includes('plane')) transportTypes.push('plane');
      if (t.type === 'train' && !transportTypes.includes('train')) transportTypes.push('train');
      if (t.type === 'car' && !transportTypes.includes('car')) transportTypes.push('car');
      if (t.type === 'ferry' && !transportTypes.includes('ferry')) transportTypes.push('ferry');
      if (t.type === 'bus' && !transportTypes.includes('bus')) transportTypes.push('bus');
    });
  }

  // Determine accommodation types from logistics
  const accommodationTypes: string[] = [];
  if (logistics?.accommodation?.length) {
    logistics.accommodation.forEach((a: { type: string }) => {
      if (!accommodationTypes.includes(a.type)) accommodationTypes.push(a.type);
    });
  }

  const nights = trip.nights || 1;
  const tripType = trip.tripType; // leisure | work | mixed

  // Map app tripType to master catalogue tripTypes
  const tripTypeFilters = ['always'];
  if (tripType === 'work') tripTypeFilters.push('work', 'business');
  if (tripType === 'leisure') tripTypeFilters.push('leisure');
  if (tripType === 'mixed') tripTypeFilters.push('work', 'business', 'leisure', 'mixed');

  // Fetch all master items that match
  const allItems = await MasterPackingItem.find({});

  const selectedItems = allItems.filter((item: any) => {
    // Include if tripTypes contains 'always' or matches trip type
    const tripTypeMatch =
      item.tripTypes?.includes('always') ||
      item.tripTypes?.some((t: string) => tripTypeFilters.includes(t));

    // Include if transportTypes matches any of the trip's transport
    const transportMatch =
      !item.transportTypes?.length ||
      item.transportTypes.some((t: string) => transportTypes.includes(t));

    // Include if accommodationTypes matches any of the trip's accommodation
    const accommodationMatch =
      !item.accommodationTypes?.length ||
      item.accommodationTypes.some((t: string) => accommodationTypes.includes(t));

    return tripTypeMatch && transportMatch && accommodationMatch;
  });

  // Build packing items with calculated quantities
  const packingItems = selectedItems.map((item: any) => {
    let quantity = item.quantity || 1;

    if (item.quantityType === 'per_night') {
      quantity = Math.round(item.quantity * nights);
      if (item.quantityMin) quantity = Math.max(quantity, item.quantityMin);
      if (item.quantityMax) quantity = Math.min(quantity, item.quantityMax);
    }

    return {
      masterItemId: item._id,
      name: item.name,
      category: item.category,
      quantity,
      quantityType: item.quantityType,
      essential: item.essential,
      packed: false,
      packedAt: null,
      preTravelAction: item.preTravelAction,
      preTravelNote: item.preTravelNote,
      advisoryNote: item.advisoryNote,
      photoUrl: item.photoUrl,
      source: 'auto',
    };
  });

  // Upsert TripPacking document
  const packing = await TripPacking.findOneAndUpdate(
    { tripId: id },
    {
      tripId: id,
      items: packingItems,
      totalItems: packingItems.length,
      packedItems: 0,
      packingProgress: 0,
      generatedAt: new Date(),
      generationParams: {
        nights,
        tripType,
        transportTypes,
        accommodationTypes,
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ packing });
}