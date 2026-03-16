import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'MiniCMS Docs' },
    { name: 'description', content: 'MiniCMS documentation' },
    { 'http-equiv': 'refresh', content: '0;url=/docs' },
  ];
}

export default function Home() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Redirecting to <a href="/docs">/docs</a>...</p>
    </div>
  );
}
