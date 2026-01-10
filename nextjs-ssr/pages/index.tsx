/**
 * Home Page
 */
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Head>
        <title>Next.js SSR AI Content Generator</title>
        <meta name="description" content="Server-side rendered AI content generation for SEO" />
        <meta name="robots" content="index, follow" />
      </Head>
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Next.js SSR AI Content Generator</h1>
        <p>This is a Next.js SSR implementation for AI-generated content with SEO optimization.</p>
        <p>
          Visit any keyword route to see AI-generated content:
        </p>
        <ul>
          <li>
            <Link href="/makan-enak">/makan-enak</Link>
          </li>
          <li>
            <Link href="/video-content">/video-content</Link>
          </li>
          <li>
            <Link href="/test-keyword">/test-keyword</Link>
          </li>
        </ul>
      </main>
    </>
  );
}

