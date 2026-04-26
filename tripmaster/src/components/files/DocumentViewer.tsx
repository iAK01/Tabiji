'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Dialog, DialogContent, IconButton, Box, Typography, Chip,
} from '@mui/material';
import CloseIcon   from '@mui/icons-material/Close';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { getFileUrl } from '@/lib/offline/fileCache';

export interface ViewableFile {
  _id:      string;
  name:     string;
  mimeType?: string;
  gcsUrl?:  string;
}

interface Props {
  file:    ViewableFile | null;
  onClose: () => void;
}

export default function DocumentViewer({ file, onClose }: Props) {
  const [url,       setUrl]       = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!file?.gcsUrl) { setUrl(null); return; }

    getFileUrl(file._id, file.gcsUrl).then(({ url: resolved, isOffline: offline }) => {
      if (offline) blobUrlRef.current = resolved;
      setUrl(resolved);
      setIsOffline(offline);
    });

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setUrl(null);
      setIsOffline(false);
    };
  }, [file?._id, file?.gcsUrl]);

  const isPdf   = file?.mimeType === 'application/pdf';
  const isImage = !!file?.mimeType?.startsWith('image/');

  return (
    <Dialog
      open={!!file}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            backgroundColor: '#000',
            m:          { xs: 0,       sm: 1 },
            borderRadius: { xs: 0,     sm: 2 },
            width:      { xs: '100dvw', sm: 'min(900px, calc(100vw - 16px))' },
            maxWidth:   { xs: '100dvw', sm: 'min(900px, calc(100vw - 16px))' },
            height:     { xs: '100dvh', sm: 'calc(100dvh - 16px)' },
            maxHeight:  { xs: '100dvh', sm: 'calc(100dvh - 16px)' },
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top bar ── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1.25,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Typography sx={{
            flexGrow: 1,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: '"Archivo", sans-serif',
            fontSize: '0.9rem',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {file?.name}
          </Typography>

          {isOffline && (
            <Chip
              icon={<WifiOffIcon sx={{ fontSize: '0.75rem !important', color: '#4ade80 !important' }} />}
              label="Offline ready"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.68rem',
                fontWeight: 700,
                fontFamily: '"Archivo", sans-serif',
                backgroundColor: 'rgba(74,222,128,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.3)',
                flexShrink: 0,
                '& .MuiChip-icon': { ml: '6px' },
              }}
            />
          )}

          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'white',
              p: 0.75,
              flexShrink: 0,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── Content ── */}
        <Box sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPdf ? '#525659' : '#000',
        }}>
          {url ? (
            isPdf ? (
              <Box
                component="iframe"
                src={url}
                title={file?.name}
                sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            ) : isImage ? (
              <Box
                component="img"
                src={url}
                alt={file?.name}
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', px: 3 }}>
                <Typography sx={{ fontFamily: '"Archivo", sans-serif', mb: 2, fontSize: '0.9rem' }}>
                  Preview not available for this file type
                </Typography>
                <Typography
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: '#60a5fa', fontFamily: '"Archivo", sans-serif', fontSize: '0.88rem' }}
                >
                  Open file in new tab
                </Typography>
              </Box>
            )
          ) : (
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontFamily: '"Archivo", sans-serif', fontSize: '0.85rem' }}>
              Loading…
            </Typography>
          )}
        </Box>

      </DialogContent>
    </Dialog>
  );
}
