'use client';

import * as React from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';

function createEmotionCache() {
  return createCache({ key: 'mui', prepend: true });
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const cache = React.useMemo(() => createEmotionCache(), []);
  const prevInsert = React.useRef(cache.insert);

  React.useEffect(() => {
    cache.insert = (...args: any[]) => prevInsert.current(...args);
    return () => {
      cache.insert = prevInsert.current;
    };
  }, [cache]);

  useServerInsertedHTML(() => (
    <style
      data-emotion={`${cache.key} ${Object.keys(cache.inserted).join(' ')}`}
      // @ts-ignore
      dangerouslySetInnerHTML={{ __html: Object.values(cache.inserted).join(' ') as string }}
    />
  ));

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
