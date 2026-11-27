// Stands in for GIPHY in browser tests: answers searches with a few sample
// results (including ones the app must filter out) and serves the sample
// animations in scripts/fixtures for every media link.
import fs from 'node:fs'

const gif = fs.readFileSync(new URL('./fixtures/gif-sample.webp', import.meta.url))
const sticker = fs.readFileSync(new URL('./fixtures/sticker-sample.webp', import.meta.url))

export async function mockGiphy(ctx, log = []) {
  await ctx.route('https://api.giphy.com/**', (route) => {
    const url = new URL(route.request().url())
    const q = url.searchParams.get('q') ?? ''
    log.push({ path: url.pathname, q, rating: url.searchParams.get('rating'), bundle: url.searchParams.get('bundle'), key: url.searchParams.get('api_key'), cid: url.searchParams.get('customer_id') })
    if (q === 'limit test') return route.fulfill({ status: 429, body: '{"meta":{"status":429}}', contentType: 'application/json' })
    const sticker = url.pathname.includes('/stickers/')
    const item = (id, title, rating = 'g') => {
      const media = (r) => `https://media${id.length % 4}.giphy.com/media/v1.test/${id}/${r}.webp?cid=test`
      const [w, h] = sticker ? ['200', '200'] : ['356', '200']
      const ping = (t) => ({ url: `https://giphy-analytics.giphy.com/v2/pingback_simple?analytics_response_payload=${id}&action_type=${t}` })
      return { id, title, slug: title.toLowerCase().replace(/\W+/g, '-'), rating, analytics: { onload: ping('SEEN'), onclick: ping('CLICK'), onsent: ping('SENT') }, images: { fixed_height: { url: media('200').replace('.webp', '.gif'), webp: media('200'), width: w, height: h }, fixed_height_small: { url: media('100').replace('.webp', '.gif'), webp: media('100'), width: w, height: h } } }
    }
    const data = [item(`${q.replace(/\W/g, '')}One`, `${q} one`), item(`${q.replace(/\W/g, '')}Two`, `${q} two`), item('apeSideEye', 'Monkey side eye'), item('pgOne', 'Rated PG thing', 'pg'), item(`${q.replace(/\W/g, '')}Three`, `${q} three`)]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, meta: { status: 200 } }) })
  })
  await ctx.route('https://giphy-analytics.giphy.com/**', (route) => {
    const url = new URL(route.request().url())
    log.pings = log.pings ?? []
    log.pings.push({ type: url.searchParams.get('action_type'), id: url.searchParams.get('analytics_response_payload'), cid: url.searchParams.get('customer_id'), ts: url.searchParams.get('ts') })
    return route.fulfill({ status: 200, body: '' })
  })
  await ctx.route(/https:\/\/media\d?\.giphy\.com\/.*/, (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: route.request().url().includes('/stickers') || /Sticker/i.test(route.request().url()) ? sticker : gif }))
  return log
}
