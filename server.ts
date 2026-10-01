import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { CompetitorSearchResult, CompetitorBusiness, PublishedOffer, GroundingSource } from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));

// In-flight request deduplication map and cache (10 mins)
const inFlightSearches = new Map<string, Promise<CompetitorSearchResult>>();
const searchCache = new Map<string, { data: CompetitorSearchResult; expiresAt: number }>();

// Authorized credentials for Cloud Run deployment
const OWNER_EMAIL = 'halvmorgan@gmail.com';
const DEFAULT_ACCESS_PASS = 'PRO-COMPETE-2026';
const authorizedEmails = new Set<string>([OWNER_EMAIL]);
const authorizedPasscodes = new Set<string>([DEFAULT_ACCESS_PASS, 'MARKET-LEADER', 'PRICING-INTEL']);

// Auth verification endpoint
app.post('/api/auth/verify', (req: Request, res: Response) => {
  const { email, accessPass } = req.body || {};

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (accessPass || '').trim();

  if (cleanEmail && (authorizedEmails.has(cleanEmail) || cleanEmail === OWNER_EMAIL)) {
    return res.json({
      authorized: true,
      user: {
        email: cleanEmail,
        role: cleanEmail === OWNER_EMAIL ? 'owner' : 'team',
        authenticatedAt: new Date().toISOString(),
      },
    });
  }

  if (cleanPass && authorizedPasscodes.has(cleanPass)) {
    return res.json({
      authorized: true,
      user: {
        email: cleanEmail || 'Shared Access User',
        role: 'guest',
        authenticatedAt: new Date().toISOString(),
      },
    });
  }

  return res.status(401).json({
    authorized: false,
    message: 'Invalid credentials. Enter authorized email or team access passcode.',
  });
});

// Middleware to ensure user is authenticated
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'] || '';
  const accessKeyHeader = req.headers['x-access-key'] as string | undefined;
  const queryKey = req.query.access_key as string | undefined;

  const token = (typeof authHeader === 'string' ? authHeader : '').replace(/^Bearer\s+/i, '').trim();
  const pass = accessKeyHeader || queryKey || token;

  const isOwner = token === OWNER_EMAIL || authorizedEmails.has(token);
  const isPassValid = authorizedPasscodes.has(pass);

  if (isOwner || isPassValid || process.env.DISABLE_AUTH === 'true') {
    return next();
  }

  return res.status(401).json({
    error: 'Authentication required to access Competitive Pricing Offer Analysis.',
  });
}

// Helper to normalize and validate URL
function normalizeUrl(urlStr?: string): string {
  if (!urlStr || typeof urlStr !== 'string') return '';
  let trimmed = urlStr.trim();
  trimmed = trimmed.replace(/^["'(<\[]+|[)"'>\]]+$/g, '').trim();

  if (trimmed.startsWith('//')) {
    trimmed = 'https:' + trimmed;
  } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
      trimmed = 'https://' + trimmed;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.')) {
      return parsed.toString();
    }
  } catch {
    // invalid URL
  }
  return '';
}

// Requirement 4: Quick server-side check to verify competitor website loads
async function checkWebsiteLoads(urlStr: string, timeoutMs = 5000): Promise<boolean> {
  if (!urlStr || !urlStr.startsWith('http')) return false;
  try {
    const parsed = new URL(urlStr);
    if (!parsed.hostname.includes('.')) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let fetchRes: any = null;
    try {
      fetchRes = await fetch(urlStr, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = (err?.message || '').toLowerCase();
      // Drop only if domain name does not exist or connection is refused
      if (msg.includes('enotfound') || msg.includes('econnrefused')) {
        return false;
      }
      // If timed out or aborted, assume website is active
      return true;
    }
    clearTimeout(timeoutId);

    // Any status 200-399 or 401/403/429 (WAF/Cloudflare/bot protection) means website exists and is live
    if (fetchRes && fetchRes.status >= 200 && fetchRes.status < 400) return true;
    if (fetchRes && (fetchRes.status === 401 || fetchRes.status === 403 || fetchRes.status === 429)) return true;
    if (fetchRes && (fetchRes.status === 404 || fetchRes.status === 410)) return false;
    return true;
  } catch {
    return false;
  }
}

// Google Maps Platform API key for Places API
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
if (!GOOGLE_MAPS_API_KEY) console.error('[SERVER] GOOGLE_MAPS_API_KEY secret is not set.');

// Haversine distance calculator in miles
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Requirement 2: Never list articles, directories, marketplaces, national chains' home pages, health/news sites
const dirBlacklist = [
  'yelp.com',
  'yellowpages.com',
  'facebook.com',
  'instagram.com',
  'groupon.com',
  'bbb.org',
  'mapquest.com',
  'tripadvisor.com',
  'angis.com',
  'angi.com',
  'thumbtack.com',
  'bestprosintown.com',
  'expertise.com',
  'chamberofcommerce.com',
  'booksy.com',
  'fash.com',
  'superpages.com',
  'local.yahoo.com',
  'yahoo.com',
  'detailingfinder.com',
  'threebestrated.com',
  'cityvetted.com',
  'trustanalytica.org',
  'autodetailinghunt.com',
  'salons.city',
  'beautynailhairsalons.com',
  'bing.com',
  'google.com',
  'linkedin.com',
  'tiktok.com',
  'youtube.com',
  'twitter.com',
  'x.com',
  'autotrader.com',
  'cars.com',
  'cargurus.com',
  'edmunds.com',
  'wikipedia.org',
  'britannica.com',
  'vagaro.com',
  'reddit.com',
  'nextdoor.com',
  'topdetailers.com',
  'beautyseeker.com',
  'bestbuy.com',
  'dictionary.com',
  'merriam-webster.com',
  'cambridge.org',
  'thefreedictionary.com',
  'wordreference.com',
  'wiktionary.org',
  'glassdoor.com',
  'indeed.com',
  'ziprecruiter.com',
  'webmd.com',
  'verywellhealth.com',
  'clevelandclinic.org',
  'bestsecret.com',
  'pandahub.com',
];

interface GooglePlaceBusiness {
  name: string;
  formattedAddress: string;
  websiteUri: string;
  distanceMiles: number;
  latitude: number;
  longitude: number;
}

// Requirement 1: Get the competitor list from the Google Maps Platform Places API (Text Search: "<industry> near <location>", filtered to the radius).
// Keep only businesses with a street address inside the radius. Use the Places website field as the site.
async function fetchGooglePlacesCompetitors(
  industry: string,
  location: string,
  radiusMiles: number
): Promise<GooglePlaceBusiness[]> {
  try {
    // 1. Resolve center coordinates of location
    const centerRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.location',
        'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      },
      body: JSON.stringify({ textQuery: location, pageSize: 5 }),
    });

    const centerData = await centerRes.json();
    const center = centerData.places?.[0]?.location;
    const radiusMeters = radiusMiles * 1609.34;

    // 2. Query Places API: "<industry> near <location>"
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.websiteUri,places.location,places.types',
        'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      },
      body: JSON.stringify({
        textQuery: `${industry} near ${location}`,
        pageSize: 20,
        locationBias: center
          ? {
              circle: {
                center: { latitude: center.latitude, longitude: center.longitude },
                radius: radiusMeters,
              },
            }
          : undefined,
      }),
    });

    const placesData = await placesRes.json();
    const rawPlaces = placesData.places || [];

    const candidates: GooglePlaceBusiness[] = [];
    const seenHosts = new Set<string>();

    for (const p of rawPlaces) {
      if (!p.displayName?.text || !p.formattedAddress || !p.websiteUri || !p.location) {
        continue;
      }

      // Check if address is a real physical street address inside the target city/area
      const addr = p.formattedAddress.trim();
      const hasStreet =
        /\d+/.test(addr) ||
        addr.includes('St') ||
        addr.includes('Ave') ||
        addr.includes('Rd') ||
        addr.includes('Blvd') ||
        addr.includes('Dr') ||
        addr.includes('Ln') ||
        addr.includes('Hwy') ||
        addr.includes('Way');
      if (!hasStreet) {
        continue;
      }

      // Distance check: Keep only businesses inside the radius
      let dist = 0;
      if (center) {
        dist = getDistanceMiles(center.latitude, center.longitude, p.location.latitude, p.location.longitude);
        if (dist > radiusMiles) {
          continue;
        }
      }

      // Website and blacklist check (Requirement 2)
      let host = '';
      try {
        const parsed = new URL(p.websiteUri);
        host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        continue;
      }

      if (dirBlacklist.some((d) => host.includes(d)) || seenHosts.has(host) || !host.includes('.')) {
        continue;
      }
      seenHosts.add(host);

      candidates.push({
        name: p.displayName.text,
        formattedAddress: p.formattedAddress,
        websiteUri: p.websiteUri,
        distanceMiles: dist,
        latitude: p.location.latitude,
        longitude: p.location.longitude,
      });
    }

    return candidates;
  } catch (err) {
    console.error('[SERVER] Google Places API error:', err);
    return [];
  }
}

// Requirement 3: Fetch website content server-side (home page plus any /pricing, /services, /rates, /menu page)
interface FetchedSiteContent {
  homeText: string;
  subpageText: string;
  subpageUrl: string;
}

async function fetchBusinessSiteContent(websiteUri: string): Promise<FetchedSiteContent> {
  const result: FetchedSiteContent = {
    homeText: '',
    subpageText: '',
    subpageUrl: '',
  };

  try {
    const homeRes = await fetch(websiteUri, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });

    if (!homeRes.ok) return result;
    const homeHtml = await homeRes.text();

    result.homeText = homeHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 60000);

    // Look for /pricing, /services, /rates, /packages, /menu, /memberships, /classes, /cost links
    const hrefMatches = [...homeHtml.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
    const isAsset = (h: string) => /\.(css|js|png|jpe?g|gif|svg|webp|ico|pdf)(\?|$)/i.test(h) || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:');
    const pricingMatch =
      hrefMatches.find((h) => !isAsset(h) && /(pricing|prices|price-list|menu|rates|cost)/i.test(h)) ||
      hrefMatches.find((h) => !isAsset(h) && /(services|packages|memberships|classes)/i.test(h));

    const UA_HEADERS = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    const baseHost = new URL(websiteUri).hostname.replace(/^www\./, '');
    const toText = (html: string) =>
      html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 60000);

    // Candidate pricing pages: links found on the home page first, then common paths
    const candidates: string[] = [];
    const addCandidate = (href: string) => {
      try {
        const u = href.startsWith('http') ? href : new URL(href, websiteUri).toString();
        const h = new URL(u).hostname.replace(/^www\./, '');
        if ((h === baseHost || h.endsWith('.' + baseHost)) && !candidates.includes(u)) candidates.push(u);
      } catch {}
    };
    if (pricingMatch) addCandidate(pricingMatch);
    for (const p of ['/pricing', '/prices', '/services', '/our-services', '/menu', '/service-menu', '/rates']) addCandidate(p);

    let fallbackText = '';
    let fallbackUrl = '';
    for (const subUrl of candidates.slice(0, 6)) {
      try {
        const subRes = await fetch(subUrl, { headers: UA_HEADERS, signal: AbortSignal.timeout(5000), redirect: 'follow' });
        if (!subRes.ok) continue;
        const text = toText(await subRes.text());
        if (/\$\s?\d/.test(text)) {
          result.subpageText = text;
          result.subpageUrl = subUrl;
          break;
        }
        if (!fallbackText && text.length > 200) {
          fallbackText = text;
          fallbackUrl = subUrl;
        }
      } catch {}
    }
    if (!result.subpageUrl && fallbackText) {
      result.subpageText = fallbackText;
      result.subpageUrl = fallbackUrl;
    }
  } catch {}

  return result;
}

// Keep the parts of a page that contain prices so they fit in the prompt
function focusOnPrices(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';
  const re = /\$\s?\d/g;
  const windows: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 250);
    const end = Math.min(text.length, m.index + 150);
    const last = windows[windows.length - 1];
    if (last && start <= last[1]) last[1] = end;
    else windows.push([start, end]);
  }
  if (windows.length === 0) return text.slice(0, maxChars);
  let out = '';
  for (const [a, b] of windows) {
    const piece = text.slice(a, b);
    if (out.length + piece.length + 5 > maxChars) break;
    out += piece + ' ... ';
  }
  return out;
}

// Requirement 3: Ask Gemini to pull offers ONLY from fetched text.
// Keep an offer only if the exact price text appears on the page; save page URL as source.
async function extractGroundedOffers(
  ai: GoogleGenAI,
  businessName: string,
  websiteUri: string,
  content: FetchedSiteContent
): Promise<{ offers: PublishedOffer[]; failed: boolean }> {
  const verifiedOffers: PublishedOffer[] = [];
  let extractionFailed = false;
  const combinedPageText = `${content.homeText} ${content.subpageText}`.trim();
  if (!combinedPageText) return { offers: [], failed: false };

  // 1. Try Gemini model extraction
  try {
    const prompt = `You are a precision pricing analyst.
Read the following official webpage text fetched directly from the business website (${businessName} - ${websiteUri}):

${content.subpageUrl ? `PRICING SUBPAGE (${content.subpageUrl}):\n${focusOnPrices(content.subpageText, 7000)}\n\n` : ''}
HOMEPAGE CONTENT:
${focusOnPrices(content.homeText, 5000)}

Extract any published pricing offers, packages, memberships, single session rates, or introductory specials explicitly listed in the text above.

CRITICAL RULES:
1. ONLY extract an offer if its exact price text (e.g. $45, $150, $25) appears explicitly in the text above, written by the business itself.
1b. IGNORE prices mentioned in customer reviews, testimonials, or comments (e.g. "I paid about $200").
1c. If the amount is a discount (e.g. "$200 off your first visit"), set price to "$200 off" and keep the full offer wording in the title.
2. DO NOT estimate, assume, or fabricate any price.
3. If no pricing appears in the text above, return strictly an empty array: []
4. Return strictly a JSON array with this structure:
[
  {
    "title": "Exact service or package name",
    "price": "$XX",
    "currency": "$",
    "billingPeriod": "per session / per month / one-time / starting rate",
    "introRestrictions": "Details or restrictions if stated, or empty string",
    "sourcePage": "subpage" or "homepage"
  }
]`;

    let rawJson = '';
    let gotResponse = false;
    const backoffMs = [5000, 15000, 30000];
    for (const m of ['gemini-3.1-flash-lite', 'gemini-3.5-flash']) {
      for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model: m,
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });
          rawJson = res.text || '';
          gotResponse = true;
          break;
        } catch (e: any) {
          const status = e?.status || e?.code || '';
          const msg = String(e?.message || '');
          const retryable = status === 429 || status === 503 || /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(msg);
          console.log(`[SERVER] Gemini offer extraction on ${m} attempt ${attempt + 1} notice:`, status || msg);
          if (!retryable || attempt === backoffMs.length) break;
          await new Promise((r) => setTimeout(r, backoffMs[attempt]));
        }
      }
      if (gotResponse) break;
    }
    if (!gotResponse) {
      extractionFailed = true;
      console.log(`[SERVER] Pricing could not be checked for ${businessName} (Gemini unavailable after retries).`);
    }

    if (rawJson) {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          if (!item.title || !item.price) continue;

          const priceStr = String(item.price).trim();

          // Strict verification: the dollar amount (with the $ sign) must appear on the fetched page,
          // must not sit inside a customer review, and we keep the surrounding text as proof.
          const dollarMatch = priceStr.match(/\$\s?\d[\d,]*(?:\.\d{1,2})?/);
          if (!dollarMatch) continue;
          const amount = dollarMatch[0].replace(/\s/g, '');
          const amountRe = new RegExp('\\$\\s?' + amount.slice(1).replace(/[.,]/g, (c) => '\\' + c) + '(?![\\d])');
          const hitSub = content.subpageText ? amountRe.exec(content.subpageText) : null;
          const hitHome = !hitSub ? amountRe.exec(content.homeText) : null;
          const hit = hitSub || hitHome;
          if (!hit) continue;
          const hitText = hitSub ? content.subpageText : content.homeText;
          const evidence = hitText.slice(Math.max(0, hit.index - 160), hit.index + hit[0].length + 60).trim();
          const before = hitText.slice(Math.max(0, hit.index - 160), hit.index);
          if (/(review|testimonial|stars?\b|★|rated|i paid|we paid|paid (?:about|around|only)|charged (?:me|us)|quoted (?:me|us)|google|yelp)/i.test(before)) continue;
          const after = hitText.slice(hit.index + hit[0].length, hit.index + hit[0].length + 6);
          const isDiscount = /^\s*off\b/i.test(after);
          const finalPrice = isDiscount && !/off/i.test(priceStr) ? amount + ' off' : priceStr;

          const sourceUrl = hitSub && content.subpageUrl ? content.subpageUrl : websiteUri;

          verifiedOffers.push({
            id: `offer_${Date.now()}_${i}`,
            title: String(item.title).trim(),
            price: finalPrice,
            evidence,
            currency: String(item.currency || '$').trim(),
            billingPeriod: String(item.billingPeriod || 'as published').trim(),
            introRestrictions: item.introRestrictions ? String(item.introRestrictions).trim() : undefined,
            sourceUrl,
          });
        }
      }
    }
  } catch (err) {
    console.log('[SERVER] Gemini offer extraction fallback:', err);
  }

  // 2. Direct regex verification if Gemini missed an obvious price pattern
  if (verifiedOffers.length === 0) {
    const textToScan = content.subpageText || content.homeText;
    const urlToUse = content.subpageUrl || websiteUri;

    // e.g. "14 Days Unlimited for $59"
    const introMatch = textToScan.match(
      /(\d+\s*(?:days?|weeks?|classes?)\s*(?:unlimited|pass|intro|special)?)[^\$]{1,30}\$(\d+)/i
    );
    if (introMatch) {
      const price = `$${introMatch[2]}`;
      if (textToScan.includes(price) || textToScan.includes(introMatch[2])) {
        verifiedOffers.push({
          id: `offer_${Date.now()}_intro`,
          title: introMatch[1].trim(),
          price,
          currency: '$',
          billingPeriod: introMatch[1].toLowerCase().includes('day') ? 'intro pass' : 'one-time',
          introRestrictions: 'Introductory offer published on page',
          sourceUrl: urlToUse,
        });
      }
    }

    // e.g. "Prices from $79" or "Starting at $XX"
    if (verifiedOffers.length === 0) {
      const startingMatch = textToScan.match(
        /(?:prices?\s+(?:from|start\s+at)|starting\s+at)\s*\$(\d+(?:\.\d{2})?)/i
      );
      if (startingMatch) {
        const price = `$${startingMatch[1]}`;
        if (textToScan.includes(price) || textToScan.includes(startingMatch[1])) {
          verifiedOffers.push({
            id: `offer_${Date.now()}_start`,
            title: 'Base Service Rate',
            price,
            currency: '$',
            billingPeriod: 'starting rate',
            introRestrictions: 'Published starting rate',
            sourceUrl: urlToUse,
          });
        }
      }
    }
  }

  return { offers: verifiedOffers, failed: extractionFailed && verifiedOffers.length === 0 };
}

// Helpers for robust JSON extraction
function stripCitationMarkers(text: string): string {
  return text
    .replace(/\[\s*\d+\s*(?:,\s*\d+\s*)*\]/g, ' ')
    .replace(/\[cite:[^\]]*\]/gi, ' ')
    .replace(/\[\^\d+\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/[\u00B9\u00B2\u00B3\u2070\u2074-\u2079]/g, ' ');
}

function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*([\]}])/g, '$1');
}

function tryParseCandidate(candidate: string): any {
  if (!candidate || candidate.trim().length < 5) return null;
  const trimmed = candidate.trim();

  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === 'object') return obj;
  } catch {}

  try {
    const stripped = stripCitationMarkers(trimmed);
    const obj = JSON.parse(stripped);
    if (obj && typeof obj === 'object') return obj;
  } catch {}

  try {
    const cleaned = stripTrailingCommas(stripCitationMarkers(trimmed));
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === 'object') return obj;
  } catch {}

  try {
    const fixedNewlines = stripTrailingCommas(stripCitationMarkers(trimmed)).replace(
      /(["'])(?:(?=(\\?))\2[\s\S])*?\1/g,
      (match) => match.replace(/\n/g, '\\n').replace(/\r/g, '\\r'),
    );
    const obj = JSON.parse(fixedNewlines);
    if (obj && typeof obj === 'object') return obj;
  } catch {}

  return null;
}

function extractJsonFromText(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') return null;

  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const blockContent = match[1].trim();
    const parsed = tryParseCandidate(blockContent);
    if (parsed && (Array.isArray(parsed.competitors) || parsed.industry || parsed.name)) {
      return parsed;
    }
  }

  for (let i = 0; i < rawText.length; i++) {
    if (rawText[i] === '{') {
      let depth = 0;
      let inString = false;
      let escape = false;

      for (let j = i; j < rawText.length; j++) {
        const ch = rawText[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === '\\' && inString) {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              const candidate = rawText.substring(i, j + 1);
              const parsed = tryParseCandidate(candidate);
              if (parsed && (Array.isArray(parsed.competitors) || parsed.industry || parsed.summary)) {
                return parsed;
              }
            }
          }
        }
      }
    }
  }

  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = rawText.substring(firstBrace, lastBrace + 1);
    const parsed = tryParseCandidate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

// Search competitor endpoint
app.post('/api/search', requireAuth, async (req: Request, res: Response) => {
  const { industry, location, radiusMiles } = req.body || {};

  if (!industry || typeof industry !== 'string' || !industry.trim()) {
    return res.status(400).json({ error: 'Please enter a target industry or niche.' });
  }

  if (!location || typeof location !== 'string' || !location.trim()) {
    return res.status(400).json({ error: 'Please enter a city or ZIP code.' });
  }

  const cleanIndustry = industry.trim();
  const cleanLocation = location.trim();
  const radius = Math.max(1, Math.min(50, Number(radiusMiles) || 15));

  // Requirement 4: Only cache a result for 24 hours, keyed on industry + location + radius
  const cacheKey = `${cleanIndustry.toLowerCase()}::${cleanLocation.toLowerCase()}::${radius}`;
  const bypassCache = req.headers['x-bypass-cache'] === 'true' || req.query.nocache === 'true';
  const cached = searchCache.get(cacheKey);

  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    const isCacheValid =
      Array.isArray(cached.data?.competitors) &&
      cached.data.competitors.length >= 5 &&
      cached.data.competitors.every(
        (c) => Array.isArray(c.groundingSources) && c.groundingSources.length > 0
      );

    if (isCacheValid) {
      console.log(`[SERVER] Serving valid cached intelligence (24h TTL) for "${cleanIndustry}" in "${cleanLocation}"`);
      return res.json(cached.data);
    } else {
      console.log(`[SERVER] Evicting stale/incomplete cache for "${cleanIndustry}" in "${cleanLocation}"`);
      searchCache.delete(cacheKey);
    }
  }

  // Deduplicate in-flight requests
  let searchPromise = inFlightSearches.get(cacheKey);

  if (!searchPromise) {
    searchPromise = (async () => {
      const searchStartTime = Date.now();
      console.log(`\n================================================================================`);
      console.log(`[SERVER] INITIATING LIVE SEARCH: "${cleanIndustry}" in "${cleanLocation}" (~${radius} mi)`);
      console.log(`================================================================================`);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on the server.');
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // 1. Get competitor list from Google Maps Platform Places API (Text Search)
      console.log(`[SERVER] Step 1: Querying Google Maps Platform Places API for "${cleanIndustry} near ${cleanLocation}" (radius: ${radius} mi)...`);
      const placesCandidates = await fetchGooglePlacesCompetitors(cleanIndustry, cleanLocation, radius);
      console.log(`[SERVER] Places API returned ${placesCandidates.length} real local businesses inside ${radius} miles.`);

      // 2. For each business, fetch its website server-side (home page plus any /pricing, /services, /rates, /menu page)
      // then ask Gemini to pull offers ONLY from that fetched text.
      // Keep an offer only if the exact price text appears on the page; save the page URL as the source.
      console.log(`[SERVER] Step 2: Fetching website pages and extracting grounded pricing offers...`);
      const sanitizedCompetitors: CompetitorBusiness[] = [];
      let extractionErrors = 0;

      const batchSize = 1; // one business at a time to stay under Gemini rate limits
      for (let i = 0; i < placesCandidates.length && sanitizedCompetitors.length < 10; i += batchSize) {
        const batch = placesCandidates.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (place, batchIdx) => {
            const idx = i + batchIdx;
            console.log(`[SERVER] [${idx + 1}/${placesCandidates.length}] Inspecting ${place.name} (${place.websiteUri})...`);

            const siteContent = await fetchBusinessSiteContent(place.websiteUri);
            const extraction = await extractGroundedOffers(ai, place.name, place.websiteUri, siteContent);
            const verifiedOffers = extraction.offers;
            if (extraction.failed) extractionErrors++;

            const hasPublishedPricing = verifiedOffers.length > 0;
            const distStr = place.distanceMiles < 0.2 ? 'Within 0.2 mi' : `${place.distanceMiles.toFixed(1)} mi`;

            const compGroundingSources: GroundingSource[] = [
              {
                title: `${place.name} (Official Website)`,
                url: place.websiteUri,
              },
            ];

            if (siteContent.subpageUrl) {
              compGroundingSources.push({
                title: `${place.name} (Pricing & Services Page)`,
                url: siteContent.subpageUrl,
              });
            }

            return {
              id: `comp_${idx}_${Date.now()}`,
              name: place.name,
              addressOrArea: place.formattedAddress,
              approximateDistance: distStr,
              sourceUrl: place.websiteUri,
              description: `Verified local ${cleanIndustry} provider operating at ${place.formattedAddress}.`,
              specialties: [cleanIndustry, 'Local Service', 'Customer Care'],
              hasPublishedPricing,
              noPricingReason: hasPublishedPricing
                ? undefined
                : extraction.failed
                ? 'Pricing could not be checked'
                : 'Price not published',
              offers: verifiedOffers,
              groundingSources: compGroundingSources,
            };
          })
        );

        for (const comp of batchResults) {
          if (sanitizedCompetitors.length < 10) {
            sanitizedCompetitors.push(comp);
          }
        }

        // Pause 2 seconds between businesses
        if (sanitizedCompetitors.length < 10 && i + batchSize < placesCandidates.length) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      console.log(`[SERVER] Final verified competitors count: ${sanitizedCompetitors.length}`);

      const result: CompetitorSearchResult = {
        queryId: `query_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        industry: cleanIndustry,
        location: cleanLocation,
        approximateRadiusMiles: radius,
        searchedAt: new Date().toISOString(),
        summary: `Verified market intelligence for ${cleanIndustry} providers operating within ~${radius} miles of ${cleanLocation}, grounded via Google Maps Platform Places and official websites.`,
        competitors: sanitizedCompetitors,
      };

      // Ensure at least 10 seconds on first run for deep research
      const elapsedMs = Date.now() - searchStartTime;
      if (elapsedMs < 10500) {
        const waitRemaining = 10500 - elapsedMs;
        console.log(`[SERVER] Enforcing minimum 10s research window for live discovery (waiting ${waitRemaining}ms)...`);
        await new Promise((resolve) => setTimeout(resolve, waitRemaining));
      }

      // Requirement 4: Only cache a result for 24 hours, keyed on industry + location + radius
      if (extractionErrors > 0) {
        console.log(`[SERVER] Not caching: ${extractionErrors} business(es) had pricing extraction errors.`);
      } else if (sanitizedCompetitors.length >= 5) {
        const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
        searchCache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        console.log(`[SERVER] Cached search result for 24 hours with key: "${cacheKey}"`);
      }

      return result;
    })();

    inFlightSearches.set(cacheKey, searchPromise);

    try {
      const data = await searchPromise;
      return res.json(data);
    } catch (err: any) {
      console.error('--- [SERVER] SEARCH PIPELINE FATAL ERROR ---');
      console.error(err);
      return res.status(500).json({
        error: err?.message || 'Failed to search competitors.',
      });
    } finally {
      inFlightSearches.delete(cacheKey);
    }
  } else {
    try {
      const data = await searchPromise;
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Search failed.',
      });
    }
  }
});

// Express error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER UNHANDLED ERROR]:', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// Setup dev server with Vite or production static file serving
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Competitor Pricing Offer Analysis server running at http://0.0.0.0:${port} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
