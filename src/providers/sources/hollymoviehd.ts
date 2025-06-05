import CryptoJS from 'crypto-js';

import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';
import { convertPlaylistsToDataUrls } from '@/utils/playlist';

const VRF_SECRET_KEY = atob('c3VwZXJzZWNyZXRrZXk=');
const apiBase = 'https://reyna.bludclart.com/api/source/tomautoembed';

function generateVrf(tmdbId: string | number, season: string | number = '', episode: string | number = ''): string {
  const msg = `${tmdbId}:${season}:${episode}`;
  const hash = CryptoJS.HmacSHA256(msg, VRF_SECRET_KEY);
  return hash.toString(CryptoJS.enc.Hex);
}

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  let url = `${apiBase}/${ctx.media.tmdbId}`;
  let season = '';
  let episode = '';
  if (ctx.media.type === 'show') {
    season = ctx.media.season.number.toString();
    episode = ctx.media.episode.number.toString();
    url += `/${season}/${episode}`;
  }
  const vrf = generateVrf(ctx.media.tmdbId, season, episode);
  url += `?vrf=${vrf}&pow_nonce=1`;
  console.log('Calling URL:', url);

  const headers = {
    Referer: 'https://watch.bludclart.com/',
    Origin: 'https://watch.bludclart.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };

  const data = await ctx.proxiedFetcher(url, {
    headers
  });
  console.log('Received data:', JSON.stringify(data, null, 2));
  const firstUrl = data?.sources?.[0]?.file;
  if (!firstUrl) throw new NotFoundError('Sources not found.');
  ctx.progress(50);

  ctx.progress(90);
  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: await convertPlaylistsToDataUrls(ctx.proxiedFetcher, firstUrl, headers),
        proxyDepth: 2,
        flags: [flags.CORS_ALLOWED],
        captions: [],
      },
    ],
  };
}

export const hollymoviehdScraper = makeSourcerer({
  id: 'hollymoviehd',
  name: 'BludClart: HollyMovieHD 🤝',
  rank: 180,
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
