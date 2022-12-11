import { DocSearchProps } from '@docsearch/react';
import { DocsRepoInfo, LocaleConfig, NavItem, SidebarItem } from './types';
import IconGitHub from '~icons/uiw/github';

export const IN_BROWSER = typeof window !== 'undefined';
export const THEME_MODE_STORAGE_KEY = 'servite:themeMode';

export const SITE_TITLE = 'Servite';
export const SITE_DESCRIPTION = 'A vite plugin for React SSR / SSG';

export const LOCALES: LocaleConfig[] = [
  {
    locale: 'en',
    localePath: '/',
    localeText: 'English',
  },
  {
    locale: 'zh',
    localePath: '/zh',
    localeText: '中文',
  },
].sort((a, b) => b.localePath.length - a.localePath.length);

export const LOCALE_TO_NAV: Record<string, NavItem[]> = {
  zh: [
    {
      text: '文档',
      link: '/zh/guide',
    },
    {
      icon: IconGitHub,
      link: 'https://github.com/codpoe/servite',
    },
  ],
};

export const LOCALE_TO_SIDEBAR: Record<string, SidebarItem[]> = {
  zh: [
    {
      text: '开始上手',
      link: '/zh/guide',
    },
    {
      text: '配置',
      link: '/zh/guide/config',
    },
    {
      text: '目录结构',
      link: '/zh/guide/directory-structure',
    },
    {
      text: '路由',
      link: '/zh/guide/routes',
    },
    {
      text: 'SSR 服务端渲染',
      link: '/zh/guide/ssr',
    },
    {
      text: 'SSG 静态生成',
      link: '/zh/guide/ssg',
    },
    {
      text: 'Islands 孤岛架构',
      link: '/zh/guide/islands',
    },
    {
      text: 'CSR 客户端渲染',
      link: '/zh/guide/csr',
    },
    {
      text: '部署',
      link: '/zh/guide/deploy',
    },
    {
      text: '进阶',
      items: [
        {
          text: '自定义 HTML',
          link: '/zh/guide/custom-html',
        },
        {
          text: '自定义服务端渲染',
          link: '/zh/guide/custom-server-render',
        },
        {
          text: 'SPA vs MPA',
          link: '/zh/guide/spa-vs-mpa',
        },
      ],
    },
  ],
};

export const DOCS_REPO_INFO: DocsRepoInfo = {
  repo: 'codpoe/servite',
  branch: 'master',
  dir: 'docs',
};

export const ALGOLIA_CONFIG: DocSearchProps = {
  appId: 'P8DCJAPIC4',
  apiKey: '1983eee4fd011adb67085f1f5c4ed255',
  indexName: 'servite',
};
