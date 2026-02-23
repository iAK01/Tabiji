'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, TextField, Paper, Typography } from '@mui/material';
import airlinesData from '@/lib/data/airlines.json';

interface Airline {
  name: string;
  iata: string;
  country: string;
  active: string;
}

const airlines: Airline[] = (airlinesData as any[])
  .filter(a => a.active === 'Y' && a.iata && a.iata !== '');

function searchAirlines(query: string): Airline[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return airlines
    .filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.iata.toLowerCase().startsWith(q)
    )
    .slice(0, 8);
}

interface AirlineSearchProps {
  label: string;
  value: string;
  onChange: (airline: Airline) => void;
}

export default function AirlineSearch({ label, value, onChange }: AirlineSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Airline[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (q: string) => {
    setQuery(q);
    const found = searchAirlines(q);
    setResults(found);
    setOpen(found.length > 0);
  };

  const handleSelect = (airline: Airline) => {
    setQuery(airline.name);
    setResults([]);
    setOpen(false);
    onChange(airline);
  };

  return (
    <Box ref={ref} sx={{ position: 'relative', flex: 1 }}>
      <TextField
        label={label}
        value={query}
        onChange={e => handleChange(e.target.value)}
        fullWidth
        autoComplete="off"
      />
      {open && (
        <Paper sx={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          zIndex: 50, maxHeight: 280, overflow: 'auto',
          border: '1px solid', borderColor: 'divider'
        }}>
          {results.map(a => (
            <Box
              key={a.iata}
              onClick={() => handleSelect(a)}
              sx={{
                px: 2, py: 1.5, cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' },
                borderBottom: '1px solid', borderColor: 'divider',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
                <Typography variant="caption" color="text.secondary">{a.country}</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} color="primary.main">{a.iata}</Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}