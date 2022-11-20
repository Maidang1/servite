import path from 'upath';
import fs from 'fs-extra';
import { build as viteBuild, InlineConfig, ResolvedConfig } from 'vite';
import {
  build as nitroBuild,
  copyPublicAssets,
  Nitro,
  prepare,
  prerender as nitroPrerender,
} from 'nitropack';
import mm from 'micromatch';
import ora from 'ora';
import colors from 'picocolors';
import { gzipSizeSync } from 'gzip-size';
import { RollupOutput } from 'rollup';
import { Page } from '../../shared/types.js';
import { unwrapViteId } from '../../shared/utils.js';
import { initNitro } from '../nitro/init.js';
import { FS_PREFIX_CLIENT_ENTRY, SSR_ENTRY_FILE } from '../constants.js';
import { ServiteConfig } from '../types.js';

export async function build(inlineConfig: InlineConfig) {
  return new Builder(inlineConfig).build();
}

class Builder {
  constructor(private inlineConfig?: InlineConfig) {}

  baseBuild = async (extraConfig?: InlineConfig) => {
    let viteConfig = {} as ResolvedConfig;
    let serviteConfig = {} as ServiteConfig;
    let outDir = 'dist';
    let pages: Page[] = [];

    const { outDir: extraOutDir } = extraConfig?.build || {};

    delete extraConfig?.build?.outDir;

    const getPlugin = (name: string) => {
      const plugin = viteConfig.plugins.find(p => p.name === name);
      if (!plugin) {
        throw new Error(`vite plugin "${name}" not found`);
      }
      return plugin;
    };

    const rollupOutput = (await viteBuild({
      ...this.inlineConfig,
      plugins: [
        ...(this.inlineConfig?.plugins || []),
        ...(extraConfig?.plugins || []),
        {
          name: 'servite:build:base',
          enforce: 'post',
          config() {
            return extraConfig;
          },
          async configResolved(config) {
            viteConfig = config;

            // Save servite config
            serviteConfig = (
              getPlugin('servite').api as any
            ).getServiteConfig();

            // Save some config for generate bootstrap code and ssg
            ({ outDir } = config.build);

            // Append extraOutDir
            if (extraOutDir) {
              config.build.outDir = path.join(outDir, extraOutDir);
            }

            // Save pages to prerender
            pages = await (getPlugin('servite:pages').api as any).getPages();
          },
        },
      ],
    })) as RollupOutput;

    return {
      rollupOutput,
      viteConfig,
      serviteConfig,
      outDir,
      pages,
    };
  };

  clientBuild = async () => {
    return this.baseBuild({
      build: {
        ssrManifest: true, // generate ssr manifest while client bundle
      },
      plugins: [
        {
          name: 'servite:build:client',
          enforce: 'post',
          async config(config) {
            const root = path.resolve(config.root || '');

            return {
              build: {
                rollupOptions: {
                  input: path.resolve(root, 'node_modules/.servite/index.html'),
                },
              },
            };
          },
          transformIndexHtml: {
            enforce: 'pre',
            transform() {
              // inject client entry
              return [
                {
                  tag: 'script',
                  attrs: {
                    type: 'module',
                    src: FS_PREFIX_CLIENT_ENTRY,
                  },
                  injectTo: 'head',
                },
              ];
            },
          },
          async generateBundle(_options, bundle) {
            Object.values(bundle).forEach(chunk => {
              if (
                chunk.type === 'asset' &&
                path.normalize(chunk.fileName) ===
                  'node_modules/.servite/index.html'
              ) {
                chunk.fileName = 'index.html';
              }
            });
          },
        },
      ],
    });
  };

  ssrBuild = async () => {
    return this.baseBuild({
      ssr: {
        noExternal: ['servite'],
      },
      build: {
        outDir: 'ssr',
        ssr: SSR_ENTRY_FILE,
      },
    });
  };

  islandsBuild = async (nitro: Nitro, input: string) => {
    return this.baseBuild({
      logLevel: 'warn',
      build: {
        emptyOutDir: false,
        rollupOptions: {
          input: {
            islands: input,
          },
        },
      },
      plugins: [
        {
          name: 'servite:build:islands',
          config(config) {
            return {
              build: {
                outDir: path.relative(
                  config.root || '',
                  nitro.options.output.publicDir
                ),
              },
            };
          },
          generateBundle(_options, bundle) {
            for (const name in bundle) {
              if (bundle[name].type === 'asset') {
                delete bundle[name];
              }
            }
          },
        },
      ],
    });
  };

  prerender = async (nitro: Nitro, clientEntryUrl: string) => {
    const prerenderRoutes = nitro.options.prerender.routes;

    if (!prerenderRoutes.length) {
      return;
    }

    await nitroPrerender(nitro);

    const spinner = ora('Building islands scripts');
    const islandsFileNames: string[] = [];
    let viteConfig = {} as ResolvedConfig;

    await Promise.all(
      nitro.options.prerender.routes.map(async routePath => {
        const htmlPath = path.join(
          nitro.options.output.publicDir,
          routePath,
          'index.html'
        );

        if (!fs.existsSync(htmlPath)) {
          return;
        }

        const htmlCode = await fs.readFile(htmlPath, 'utf-8');

        const [, islandsUrl] =
          htmlCode.match(
            /<script.*?src="(\/@id\/virtual:servite\/islands\/.*?)"/
          ) || [];

        if (!islandsUrl) {
          return;
        }

        if (!spinner.isSpinning) {
          emptyLine();
          spinner.start();
        }

        // Build islands
        const { rollupOutput, viteConfig: _viteConfig } =
          await this.islandsBuild(nitro, unwrapViteId(islandsUrl));

        viteConfig = _viteConfig;

        const newIslandsUrl = getEntryUrl(rollupOutput, viteConfig);

        islandsFileNames.push(rollupOutput.output[0].fileName);

        // Modify prerender html file
        await fs.outputFile(
          htmlPath,
          htmlCode
            .replace(
              new RegExp(`<script.*?src="${clientEntryUrl}".*?</script>`), // Remove client entry
              ''
            )
            .replace(islandsUrl, newIslandsUrl),
          'utf-8'
        );
      })
    );

    if (spinner.isSpinning) {
      const maxLength = Math.max(...islandsFileNames.map(name => name.length));

      spinner.succeed(`${islandsFileNames.length} islands scripts built.`);

      islandsFileNames.forEach((name, index) => {
        printAsset(
          viteConfig,
          maxLength,
          name,
          index === islandsFileNames.length - 1
        );
      });
    }
  };

  build = async () => {
    // Client bundle
    const { rollupOutput, viteConfig: clientViteConfig } =
      await this.clientBuild();
    const clientEntryUrl = getEntryUrl(rollupOutput, clientViteConfig);

    emptyLine();

    // SSR bundle
    const { viteConfig, serviteConfig, outDir, pages } = await this.ssrBuild();

    emptyLine();

    const nitro = await initNitro({
      serviteConfig,
      viteConfig: {
        ...viteConfig,
        build: {
          ...viteConfig.build,
          // SSR bundle will overwrite outDir, here we need to restore the original outDir
          outDir,
        },
      },
      nitroConfig: {
        dev: false,
        prerender: {
          routes: getPrerenderRoutes(pages, serviteConfig.ssg),
        },
      },
    });

    await prepare(nitro);
    await copyServerAssets(viteConfig, outDir);
    await copyPublicAssets(nitro);

    // Prerender
    await this.prerender(nitro, clientEntryUrl);

    emptyLine();

    // Build nitro output
    await nitroBuild(nitro);
    await nitro.close();
  };
}

function emptyLine() {
  // eslint-disable-next-line no-console
  console.log('');
}

function getEntryUrl(rollupOutput: RollupOutput, viteConfig: ResolvedConfig) {
  return path.join(viteConfig.base || '/', rollupOutput.output[0].fileName);
}

function getPrerenderRoutes(pages: Page[], ssg: ServiteConfig['ssg']) {
  if (!ssg || (Array.isArray(ssg) && !ssg.length)) {
    return [];
  }

  const allRoutes = pages.filter(p => !p.isLayout).map(p => p.routePath);

  if (ssg === true) {
    return allRoutes;
  }

  return mm(allRoutes, ssg);
}

/**
 * Copy some client bundle result to '.output/server-assets'.
 * Renderer will read server-assets by useStorage().getItem('/assets/servite/...')
 */
async function copyServerAssets(viteConfig: ResolvedConfig, outDir: string) {
  await Promise.all(
    ['index.html', 'ssr-manifest.json'].map(filePath =>
      fs.copy(
        path.resolve(viteConfig.root, outDir, filePath),
        path.resolve(viteConfig.root, outDir, '.output/server-assets', filePath)
      )
    )
  );
}

function printAsset(
  viteConfig: ResolvedConfig,
  maxLength: number,
  fileName: string,
  isLast: boolean
) {
  const {
    root,
    build: { outDir, chunkSizeWarningLimit },
  } = viteConfig;
  const prefixChar = isLast ? '└─' : '├─';
  const filePath = path.resolve(root, outDir, fileName);
  const content = fs.readFileSync(filePath);
  const kb = content.length / 1024;
  const gzipKb = gzipSizeSync(content) / 1024;
  const sizeColor = kb > chunkSizeWarningLimit ? colors.yellow : colors.dim;

  process.stdout.write(
    `  ${colors.gray(`${prefixChar} ${path.join(outDir, '/')}`)}${colors.cyan(
      fileName.padEnd(maxLength + 3)
    )}${sizeColor(`${kb.toFixed(2)} KiB / gzip: ${gzipKb.toFixed(2)} KiB`)}\n`
  );
}
