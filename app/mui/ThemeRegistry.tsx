'use client';

import * as React from 'react';
import createCache from '@emotion/cache';
import type { EmotionCache } from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache: EmotionCache = createCache({ key: 'mui', prepend: true });
    cache.compat = true;

    const prevInsert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1] as { name: string };
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };

    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;

    let styles = '';
    for (const name of names) {
      styles += cache.inserted[name];
    }

    return (
      <style
        data-emotion={`${cache.key} ${names.join(' ')}`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
