import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { env } from './env';

export const gitConfig = {
  user: 'Solution-Inc',
  repo: 'mini-cms',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  const links: BaseLayoutProps['links'] = [];

  if (env.VITE_APP_URL) {
    links.push({
      text: 'Dashboard',
      url: `${env.VITE_APP_URL}/dashboard`,
      active: 'none',
    });
  }

  return {
    nav: {
      title: 'MiniCMS Docs',
    },
    links,
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
