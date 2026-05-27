import { ImageResponse } from 'next/og';
import { decodeShareState } from './utils/shareState';

export const runtime = 'edge';
export const alt = 'RepoGraph - Agentic Repository Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const encodedState = searchParams.get('s');
  let repoName = 'RepoGraph';
  let subText = 'Agentic Repository Intelligence UI';

  if (encodedState) {
    const decoded = decodeShareState(encodedState);
    if (decoded?.repoUrl) {
      repoName = decoded.repoUrl.split('/').pop() || repoName;
      subText = decoded.repoUrl;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom right, #111, #000)',
          fontFamily: 'sans-serif',
          color: 'white',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 2px, transparent 2px)',
            backgroundSize: '40px 40px',
            opacity: 0.5,
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '60px 80px',
            boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
          }}
        >
          <h1 style={{ fontSize: '80px', fontWeight: 800, margin: 0, letterSpacing: '-0.05em', color: '#fff' }}>
            {repoName}
          </h1>
          <p style={{ fontSize: '32px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '20px' }}>
            {subText}
          </p>
          <div style={{ display: 'flex', marginTop: '40px', gap: '20px' }}>
            <div style={{ padding: '12px 24px', background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', borderRadius: '12px', fontSize: '24px' }}>
              Architecture
            </div>
            <div style={{ padding: '12px 24px', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', borderRadius: '12px', fontSize: '24px' }}>
              Dependencies
            </div>
            <div style={{ padding: '12px 24px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', borderRadius: '12px', fontSize: '24px' }}>
              Commits
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
