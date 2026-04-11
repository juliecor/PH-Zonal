'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb' },   // Tailwind blue-600
    secondary: { main: '#0ea5e9' }, // Tailwind sky-500
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-outfit), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  },
});
