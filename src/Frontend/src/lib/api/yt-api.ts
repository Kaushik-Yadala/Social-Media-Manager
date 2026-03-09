/**
 * Typed fetch helpers for the FastAPI YouTube backend.
 *
 * Usage:
 *   import { getYTOverview } from '@/lib/api/yt-api';
 *   const data = await getYTOverview(); // uses last 30 days
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

// ── Response types ────────────────────────────────────────────────────────────

export interface YTOverview {
  subscribers: number;
  total_views: number;
  total_videos: number;
  watch_time_hours: number;
  avg_view_duration: number;       // seconds
  engagement_rate: number;         // 0-100
  estimated_revenue: number;
  subscriber_delta_30d: number;
  views_delta_30d: number;
  date_range: { start_date: string; end_date: string };
}

export interface YTViewsTimeSeries {
  series: TimeSeriesPoint[];
  total: number;
  granularity: 'day' | 'week' | 'month';
}

export interface SubscriberGrowthPoint {
  date: string;
  gained: number;
  lost: number;
  net: number;
}

export interface YTSubscriberGrowth {
  series: SubscriberGrowthPoint[];
  total_gained: number;
  total_lost: number;
  net_change: number;
}

export interface YTWatchTime {
  series: TimeSeriesPoint[];
  total_hours: number;
  avg_view_duration: number;       // seconds
  granularity: 'day' | 'week' | 'month';
}

export interface TopVideo {
  video_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watch_time_hours: number;
  impressions: number;
  impression_ctr: number;          // 0-100
  video_type: 'video' | 'short' | 'live' | 'premiere';
}

export interface YTTopVideos {
  videos: TopVideo[];
}

export interface DemographicItem {
  label: string;
  value: number;
  percentage: number;
}

export interface YTDemographics {
  by_country: DemographicItem[];
  by_age: DemographicItem[];
  by_gender: DemographicItem[];
}

export interface TrafficSourceItem {
  source: string;
  views: number;
  watch_time_hours: number;
  percentage: number;
}

export interface YTTrafficSources {
  sources: TrafficSourceItem[];
  total_views: number;
}

export interface YTEngagement {
  total_likes: number;
  total_comments: number;
  total_shares: number;
  likes_per_view: number;
  comments_per_view: number;
  shares_per_view: number;
  avg_engagement_rate: number;     // 0-100
}

export interface RevenuePoint {
  date: string;
  amount: number;
}

export interface YTRevenue {
  series: RevenuePoint[];
  total_revenue: number;
  rpm: number;                     // revenue per mille
  cpm: number;                     // cost per mille
  currency: string;
}

export interface ContentTypeMetrics {
  video_type: 'video' | 'short' | 'live' | 'premiere';
  count: number;
  total_views: number;
  avg_views: number;
  total_watch_time_hours: number;
  engagement_rate: number;
}

export interface YTContentPerformance {
  types: ContentTypeMetrics[];
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`YT API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Channel KPI overview — subscribers, total views, total videos, watch time,
 * engagement rate, estimated revenue, 30-day deltas.
 */
export function getYTOverview(startDate = '30daysAgo', endDate = 'today'): Promise<YTOverview> {
  return apiFetch<YTOverview>('/api/yt/overview', { start_date: startDate, end_date: endDate });
}

/**
 * Views time series for trend charts.
 * granularity: 'day' (default) | 'week' | 'month'
 */
export function getYTViews(
  granularity: 'day' | 'week' | 'month' = 'day',
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTViewsTimeSeries> {
  return apiFetch<YTViewsTimeSeries>('/api/yt/views', {
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
}

/**
 * Subscriber growth — daily gained, lost, and net.
 */
export function getYTSubscriberGrowth(
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTSubscriberGrowth> {
  return apiFetch<YTSubscriberGrowth>('/api/yt/subscriber-growth', {
    start_date: startDate,
    end_date: endDate,
  });
}

/**
 * Watch time time series in hours + average view duration.
 */
export function getYTWatchTime(
  granularity: 'day' | 'week' | 'month' = 'day',
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTWatchTime> {
  return apiFetch<YTWatchTime>('/api/yt/watch-time', {
    start_date: startDate,
    end_date: endDate,
    granularity,
  });
}

/**
 * Top N performing videos with per-video metrics.
 * limit: 1-50 (default 10)
 */
export function getYTTopVideos(
  limit = 10,
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTTopVideos> {
  return apiFetch<YTTopVideos>('/api/yt/top-videos', {
    start_date: startDate,
    end_date: endDate,
    limit: String(limit),
  });
}

/**
 * Viewer demographics — by country, age bracket, and gender.
 */
export function getYTDemographics(
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTDemographics> {
  return apiFetch<YTDemographics>('/api/yt/demographics', {
    start_date: startDate,
    end_date: endDate,
  });
}

/**
 * Traffic sources — views and watch time grouped by source.
 */
export function getYTTrafficSources(
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTTrafficSources> {
  return apiFetch<YTTrafficSources>('/api/yt/traffic-sources', {
    start_date: startDate,
    end_date: endDate,
  });
}

/**
 * Engagement — likes, comments, shares, per-view ratios, avg rate.
 */
export function getYTEngagement(
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTEngagement> {
  return apiFetch<YTEngagement>('/api/yt/engagement', {
    start_date: startDate,
    end_date: endDate,
  });
}

/**
 * Estimated ad revenue time series, RPM, CPM.
 */
export function getYTRevenue(
  startDate = '30daysAgo',
  endDate = 'today',
): Promise<YTRevenue> {
  return apiFetch<YTRevenue>('/api/yt/revenue', {
    start_date: startDate,
    end_date: endDate,
  });
}

/**
 * Content performance — metrics broken down by video type
 * (regular, Short, live, premiere).
 */
export function getYTContentPerformance(): Promise<YTContentPerformance> {
  return apiFetch<YTContentPerformance>('/api/yt/content-performance');
}
