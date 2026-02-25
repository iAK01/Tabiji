import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ user });
}

export async function PUT(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const body = await req.json();

  const user = await User.findOneAndUpdate(
    { email: session.user.email },
    {
      $set: {
        name: body.name,
        homeLocation: body.homeLocation,       // coordinates included from client-side geocoding
        preferredAirport: body.preferredAirport ?? null,
        passport: body.passport,
        travelInsurance: body.travelInsurance,
        preferences: body.preferences,
      },
    },
    { new: true }
  );

  return NextResponse.json({ user });
}