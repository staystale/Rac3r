// _withquery.mjs - RUN A BROWSER TOOL WITH MORE SWITCHES (scratch): a module hook that adds
// RAC3R_QUERY to every game link tools/lib/browser.mjs gotoGame opens, for a tool that builds its
// own link and does not read RAC3R_QUERY itself. The tool's own file is not changed.
// RAC3R_QUERY=onestart=1 node --import ./tools/scratch/_withquery.mjs tools/scratch/_loadmenu.mjs
import { register } from 'node:module';

const HOOKS = `
const QUERY = ${JSON.stringify((process.env.RAC3R_QUERY || '').replace(/^[?&]+/, ''))};
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!QUERY || !url.endsWith('/tools/lib/browser.mjs')) return result;
  const source = String(result.source).replace('await page.goto(url);',
    'await page.goto(url + "&" + ' + JSON.stringify(QUERY) + ');');
  if (!source.includes(QUERY)) throw new Error('_withquery: gotoGame not found');
  return { ...result, source };
}
`;
register('data:text/javascript,' + encodeURIComponent(HOOKS));
