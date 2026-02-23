'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, TextField, Paper, Typography } from '@mui/material';
import { searchAirports, Airport } from '@/lib/data/airports';

interface AirportSearchProps {
  label: string;
  value: string;
  onChange: (airport: Airport) => void;
  placeholder?: string;
}

export default function AirportSearch({ label, value, onChange, placeholder }: AirportSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (q: string) => {
    setQuery(q);
    const found = searchAirports(q);
    setResults(found);
    setOpen(found.length > 0);
  };

  const handleSelect = (airport: Airport) => {
    setQuery(`${airport.iata} — ${airport.city}`);
    setResults([]);
    setOpen(false);
    onChange(airport);
  };

  return (
    <Box ref={ref} sx={{ position: 'relative', flex: 1 }}>
      <TextField
        label={label}
        value={query}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder || 'Search city or IATA code...'}
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
                <Typography variant="body2" fontWeight={600}>
                  {a.city}, {a.country}
                </Typography>
                <Typography variant="caption" color="text.secondary">{a.name}</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} color="primary.main">{a.iata}</Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}