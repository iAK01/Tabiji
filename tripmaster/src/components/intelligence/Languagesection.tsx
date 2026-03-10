'use client';

import { useState } from 'react';
import { Box, Typography, Alert, Grid } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Intelligence } from './Intelligence.types';
import { D, PhraseCard, PHRASE_CATEGORIES, SectionHeading } from './Intelligence.shared';

interface Props { language: Intelligence['language']; }

export default function Languagesection({ language }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);

  const cat = PHRASE_CATEGORIES[activeCategory];
  const displayedPhrases = cat.ids === null
    ? language.allPhrases
    : language.allPhrases.filter(p => (cat.ids as readonly string[]).includes(p.id));

  return (
    <Box>
      <SectionHeading id="language">
        {language.destinationLanguage}
      </SectionHeading>

      {language.sameLanguage ? (
        <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ py: 1 }}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>{language.message}</Typography>
        </Alert>
      ) : language.phrasesAvailable ? (
        <Box>
          {/* Category tabs */}
          <Box sx={{ display: 'flex', gap: 0, mb: 3, borderBottom: `1px solid ${D.rule}` }}>
            {PHRASE_CATEGORIES.map((cat, i) => (
              <Box
                key={cat.label}
                onClick={() => setActiveCategory(i)}
                sx={{
                  px: 1.75, py: 1,
                  cursor: 'pointer',
                  borderBottom: activeCategory === i ? `2px solid ${D.navy}` : '2px solid transparent',
                  mb: '-1px',
                }}
              >
                <Typography sx={{
                  fontSize: '0.82rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: activeCategory === i ? D.navy : D.muted,
                  fontFamily: D.body,
                  transition: 'color 0.15s',
                }}>
                  {cat.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Phrase grid */}
          <Grid container spacing={1.5}>
            {displayedPhrases.length === 0 ? (
              <Grid size={12}>
                <Typography sx={{ fontSize: '0.97rem', color: D.muted }}>
                  No phrases in this category.
                </Typography>
              </Grid>
            ) : (
              displayedPhrases.map(phrase => (
                <Grid size={{ xs: 12, sm: 6 }} key={phrase.id}>
                  <PhraseCard phrase={phrase} />
                </Grid>
              ))
            )}
          </Grid>
        </Box>
      ) : (
        <Alert severity="info" sx={{ py: 1 }}>
          <Typography sx={{ fontSize: '0.97rem' }}>
            {language.destinationLanguage} spoken. No phrase guide available for this destination yet.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}