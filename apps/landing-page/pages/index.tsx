import Link from 'next/link';
import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Duxi - Developer Tools</title>
        <meta name="description" content="Duxi - Tools for founders and developers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
        color: '#ffffff',
        padding: '2rem',
      }}>
        <h1 style={{
          fontSize: '4rem',
          fontWeight: 800,
          marginBottom: '1rem',
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Duxi
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: '#a0a0a0',
          marginBottom: '3rem',
          textAlign: 'center',
          maxWidth: '500px',
        }}>
          Tools for startup founders and developers. Built with precision.
        </p>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <Link href="/captable" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1rem 2rem',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
            📊 Cap Table Timeline
            <span style={{ fontSize: '1.2rem' }}>→</span>
          </Link>
        </div>

        <div style={{
          marginTop: '4rem',
          padding: '2rem',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: '600px',
          width: '100%',
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            marginBottom: '1rem',
            color: '#ffffff',
          }}>
            🚀 Cap Table Timeline
          </h2>
          <p style={{
            color: '#a0a0a0',
            lineHeight: 1.6,
            marginBottom: '1rem',
          }}>
            Track your startup's ownership evolution with precision. Event-driven cap table 
            management with support for priced rounds, SAFEs, option pools, and exit scenarios.
          </p>
          <ul style={{
            color: '#888',
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.5rem',
          }}>
            <li>✓ Legal & Fully Diluted Cap Tables</li>
            <li>✓ SAFE & Priced Round Modeling</li>
            <li>✓ Exit Scenario Planning</li>
            <li>✓ Team Collaboration</li>
          </ul>
        </div>

        <footer style={{
          marginTop: '4rem',
          color: '#666',
          fontSize: '0.875rem',
        }}>
          © 2024 Duxi. All rights reserved.
        </footer>
      </main>
    </>
  );
}

