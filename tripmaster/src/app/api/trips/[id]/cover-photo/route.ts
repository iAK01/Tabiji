import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const trip = await Trip.findOne({ _id: id, userId: user._id });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const query = `${trip.destination.city} ${trip.destination.country}`;
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=10&client_id=${process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY}`
  );
  const data = await res.json();

  if (!data.results?.length) return NextResponse.json({ error: 'No photos found' }, { status: 404 });

  const photo = data.results[Math.floor(Math.random() * data.results.length)];

  const updated = await Trip.findByIdAndUpdate(id, {
    coverPhotoUrl: photo.urls.regular,
    coverPhotoThumb: photo.urls.thumb,
    coverPhotoCredit: `${photo.user.name} on Unsplash`,
  }, { new: true });

  return NextResponse.json({ trip: updated });
}