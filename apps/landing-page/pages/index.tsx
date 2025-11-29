import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Duxi</title>
        <meta name="description" content="Personal projects" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={styles.container}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={styles.themeToggle}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          )}
        </button>

        <main style={styles.main}>
          {/* Header */}
          <header style={styles.header}>
            <h1 style={styles.logo}>Duxi</h1>
            <p style={styles.tagline}>Personal projects</p>
          </header>

          {/* Divider */}
          <div style={styles.divider} />

          {/* Product */}
          <section style={styles.product}>
            <div style={styles.productHeader}>
              <span style={styles.productLabel}>01</span>
              <h2 style={styles.productTitle}>Cap Table</h2>
            </div>
            <p style={styles.productDescription}>
              Track ownership evolution with precision. Model rounds, SAFEs, 
              option pools, and exit scenarios—all in one timeline.
            </p>
            <a href="https://captable.duxi.codes" style={styles.productLink}>
              Open Cap Table
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginLeft: 8 }}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </section>
        </main>

        {/* Footer */}
        <footer style={styles.footer}>
          <span>© 2025 Duxi</span>
        </footer>
      </div>
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem',
    maxWidth: '720px',
    margin: '0 auto',
    position: 'relative',
  },
  themeToggle: {
    position: 'absolute',
    top: '2rem',
    right: '2rem',
    padding: '0.75rem',
    color: 'var(--text-secondary)',
    transition: 'color var(--transition)',
    borderRadius: '50%',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingTop: '4rem',
    paddingBottom: '4rem',
  },
  header: {
    marginBottom: '3rem',
  },
  logo: {
    fontFamily: 'var(--font-serif)',
    fontSize: '3.5rem',
    fontWeight: 400,
    letterSpacing: '-0.02em',
    marginBottom: '0.75rem',
    color: 'var(--text)',
  },
  tagline: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    fontWeight: 400,
  },
  divider: {
    width: '48px',
    height: '1px',
    backgroundColor: 'var(--border)',
    marginBottom: '3rem',
  },
  product: {
    marginBottom: '3rem',
  },
  productHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '1rem',
    marginBottom: '1rem',
  },
  productLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.05em',
  },
  productTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.75rem',
    fontWeight: 400,
    color: 'var(--text)',
  },
  productDescription: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    marginBottom: '1.5rem',
    maxWidth: '480px',
  },
  productLink: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text)',
    padding: '0.75rem 1.5rem',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    transition: 'all var(--transition)',
    backgroundColor: 'transparent',
  },
  footer: {
    paddingTop: '2rem',
    borderTop: '1px solid var(--border)',
    fontSize: '0.8125rem',
    color: 'var(--text-tertiary)',
  },
};
