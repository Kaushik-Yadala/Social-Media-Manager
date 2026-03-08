/**
 * Typed fetch helpers for the FastAPI Google Analytics backend.
 *
 * Usage:
 *   import { getGAOverview } from '@/lib/api/ga-api';
 *   const data = await getGAOverview(); // uses last 30 days
 *
 * Configure NEXT_PUBLIC_API_BASE_URL in .env.local (defaults to http://localhost:8000).
 */

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  'http://localhost:8000';

// ── Shared types ─────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface DemographicItem {
  label: string;
  value: number;
  percentage: number;
}

// ── Response types ────────────────────────────────────────────────────────────

export interface GAOverview {
  sessions: number;
  users: number;
  new_users: number;
  bounce_rate: number;       // 0-100 percentage
  avg_session_duration: number; // seconds
  pageviews: number;
  date_range: { start_date: string; end_date: string };
}

export interface GAPageviews {
  series: TimeSeriesPoint[];
  total: number;
  granularity: 'day' | 'week' | 'month';
}

export interface TrafficSource {
  channel: string;
  sessions: number;
  percentage: number;
}

export interface GATrafficSources {
  sources: TrafficSource[];
  total_sessions: number;
}

export interface TopPage {
  page_path: string;
  page_title: string;
  sessions: number;
  pageviews: number;
  avg_time_on_page: number; // seconds
}

export interface GATopPages {
  pages: TopPage[];
}

export interface GADemographics {
  by_country: DemographicItem[];
  by_age: DemographicItem[];
}

export interface DeviceItem {
  device: string;
  sessions: number;
  percentage: number;
}

export interface GADeviceBreakdown {
  devices: DeviceItem[];
  total_sessions: number;
}

export interface GAEngagement {
  engaged_sessions: number;
  engagement_rate: number;     // 0-100 percentage
  events_per_session: number;
  avg_engagement_time: number; // seconds
}

export interface ConversionEvent {
  event_name: string;
  count: number;
}

export interface GAConversions {
  events: ConversionEvent[];
  total: number;
}

export interface RealtimeActivePage {
  page_path: string;
  active_users: number;
}

export interface GARealtimeReport {
  active_users: number;
  top_pages: RealtimeActivePage[];
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
    // Disable Next.js static cache for analytics data — always fetch fresh
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`GA API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * KPI summary — sessions, users, bounce rate, avg duration, pageviews.
 * Defaults to last 30 days.
 */
export function getGAOverview(startDate = '30daysAgo', endDate = 'today'): Promise<GAOverview> {
  return apiFetch<GAOverview>('/api/ga/overview', { start_date: startDate, end_date: endDate });
}

/**
 * Page views time series for trend charts.
 * granularity: 'day' (default) | 'week' | 'month'
 */
export function getGAPageviews(
  granularity: 'day' | 'week' | 'month' = 'day',
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<GAPageviews> {
  return apiFetch<GAPageviews>('/api/ga/pageviews', { start_date: startDate, end_date: endDate, granularity });
}

/**
 * Sessions by traffic source (Organic Search, Direct, Social, Paid, Referral…).
 * Use for pie/donut charts showing acquisition mix.
 */
export function getGATrafficSources(startDate = '30daysAgo', endDate = 'today'): Promise<GATrafficSources> {
  return apiFetch<GATrafficSources>('/api/ga/traffic-sources', { start_date: startDate, end_date: endDate });
}

/**
 * Top N pages by session count.
 * limit: 1-50 (default 10)
 */
export function getGATopPages(
  limit = 10,
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<GATopPages> {
  return apiFetch<GATopPages>('/api/ga/top-pages', {
    start_date: startDate,
    end_date: endDate,
    limit: String(limit),
  });
}

/**
 * Audience demographics — by country and by age bracket.
 */
export function getGADemographics(startDate = '30daysAgo', endDate = 'today'): Promise<GADemographics> {
  return apiFetch<GADemographics>('/api/ga/demographics', { start_date: startDate, end_date: endDate });
}

/**
 * Sessions split by device category (Mobile / Desktop / Tablet).
 */
export function getGADeviceBreakdown(startDate = '30daysAgo', endDate = 'today'): Promise<GADeviceBreakdown> {
  return apiFetch<GADeviceBreakdown>('/api/ga/device-breakdown', { start_date: startDate, end_date: endDate });
}

/**
 * Engagement quality — engaged sessions, engagement rate, events/session, avg engagement time.
 */
export function getGAEngagement(startDate = '30daysAgo', endDate = 'today'): Promise<GAEngagement> {
  return apiFetch<GAEngagement>('/api/ga/engagement', { start_date: startDate, end_date: endDate });
}

/**
 * Conversion / key-event counts (membership signups, bookings, newsletter subs…).
 */
export function getGAConversions(startDate = '30daysAgo', endDate = 'today'): Promise<GAConversions> {
  return apiFetch<GAConversions>('/api/ga/conversions', { start_date: startDate, end_date: endDate });
}

/**
 * Real-time: currently active users and top pages they are viewing.
 * Refreshes every time this is called — no server-side caching.
 */
export function getGARealtime(): Promise<GARealtimeReport> {
  return apiFetch<GARealtimeReport>('/api/ga/realtime');
}
