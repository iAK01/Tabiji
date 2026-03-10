'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

interface Coordinates {
  lat: number;
  lng: number;
}

interface Props {
  coordinates?: Coordinates | null;
  address?: string;
}

export default function DestinationMap({ coordinates, address }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(coordinates ?? null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

  useEffect(() => {
    if (coords || !address || !token) return;

    const geocode = async () => {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&access_token=${token}`
      );

      const data = await res.json();
      const [lng, lat] = data?.features?.[0]?.center ?? [];
      if (lng && lat) setCoords({ lat, lng });
    };

    geocode();
  }, [coords, address, token]);

  useEffect(() => {
    if (!coords || !container.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [coords.lng, coords.lat],
      zoom: 14,
    });

    new mapboxgl.Marker()
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    mapRef.current = map;

    return () => {
  map.remove();
  mapRef.current = null;
};
  }, [coords, token]);

  if (!coords) return null;

  return <div ref={container} style={{ height: 200, width: '100%', marginTop: 12 }} />;
}