/**
 * useAllChannelsData — fetches combined channel stats for all platforms.
 *
 * For Meta channels (Instagram, Facebook) data comes from the manual
 * CSV-upload endpoints on the main backend (/manual/insta/insights and
 * /manual/facebook/insights).  LinkedIn, WhatsApp, and YouTube fall back
 * to the static stub values because they don't have manual CSV endpoints.
 *
 * Returns the same shape as the static `channelStats` and
 * `followerGrowthTrend` arrays from `@/lib/stub-data/statistics` so any
 * page can swap the import for this hook with zero structural changes.
 */

import { useState, useEffect } from 'react';
import { ChannelStats, TimeSeries } from '@/types';
import {
    channelStats as stubStats,
    followerGrowthTrend as stubGrowth,
} from '@/lib/stub-data/statistics';

const API_BASE =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
    'http://localhost:8000';

const INSTA_ACCOUNT_ID = 'ClubArtizen';
const FACEBOOK_USER_ID = 'ClubArtizen';
/* ── Shared response shapes (mirror the channel pages) ─────────────────────── */

interface ManualInsightValue {
    value: number | string;
    end_time?: string;
}

interface ManualInsightEntry {
    name?: string;
    values?: ManualInsightValue[];
}

interface ManualInsightsResponse {
    data?: ManualInsightEntry[];
}

interface MetricSeries {
    key: string;
    total: number;
    latest: number;
    points: { date: string; value: number }[];
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function parseManualSeries(payload: ManualInsightsResponse): Map<string, MetricSeries> {
    const map = new Map<string, MetricSeries>();
    const entries = Array.isArray(payload.data) ? payload.data : [];

    for (const entry of entries) {
        if (!entry || typeof entry.name !== 'string') continue;
        const values = Array.isArray(entry.values) ? entry.values : [];
        const points: { date: string; value: number }[] = [];

        for (const v of values) {
            const num = toNumber(v?.value);
            const rawTime = typeof v?.end_time === 'string' ? v.end_time : '';
            // Normalise timezone offset like "+0530" → "+05:30"
            const normalised = rawTime.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
            const d = normalised ? new Date(normalised) : null;
            const dateStr = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
            points.push({ date: dateStr, value: num });
        }

        const total = points.reduce((s, p) => s + p.value, 0);
        const latest = points.length > 0 ? points[points.length - 1].value : 0;

        map.set(entry.name, { key: entry.name, total, latest, points });
    }

    return map;
}

async function fetchManualInsights(
    platform: 'insta' | 'facebook',
    metrics: string[],
): Promise<Map<string, MetricSeries>> {
    const params = new URLSearchParams({ metric: metrics.join(','), period: 'day' });
    let url = '';
    if(platform==='insta'){
    url = `${API_BASE}/manual/insta/insights/${encodeURIComponent(INSTA_ACCOUNT_ID)}?${params}`;
    }
    else{
        url = `${API_BASE}/manual/facebook/insights/${encodeURIComponent(FACEBOOK_USER_ID)}?${params}`;
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${platform} insights ${res.status}`);
    const payload: ManualInsightsResponse = await res.json();
    return parseManualSeries(payload);
}

/* ── Hook ───────────────────────────────────────────────────────────────────── */

export interface AllChannelsData {
    channelStats: ChannelStats[];
    followerGrowthTrend: TimeSeries[];
    loading: boolean;
}

export function useAllChannelsData(): AllChannelsData {
    const [channelStats, setChannelStats] = useState<ChannelStats[]>(stubStats);
    const [followerGrowthTrend, setFollowerGrowthTrend] = useState<TimeSeries[]>(stubGrowth);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            // Instagram metrics
            const igMetrics = [
                'views', 'reach', 'content_interactions',
                'instagram_link_clicks', 'instagram_profile_visits', 'instagram_follows',
            ];
            // Facebook metrics
            const fbMetrics = [
                'views', 'viewers', 'content_interactions',
                'facebook_link_clicks', 'facebook_visits', 'facebook_follows',
            ];

            const [igData, fbData] = await Promise.all([
                fetchManualInsights('insta', igMetrics).catch(() => null),
                fetchManualInsights('facebook', fbMetrics).catch(() => null),
            ]);

            if (cancelled) return;

            // Stub fallbacks for channels without manual endpoints
            const liStub = stubStats.find(s => s.channel === 'linkedin')!;
            const waStub = stubStats.find(s => s.channel === 'whatsapp')!;
            const ytStub = stubStats.find(s => s.channel === 'youtube')!;

            // ── Instagram ──────────────────────────────────────────────────
            const igStub = stubStats.find(s => s.channel === 'instagram')!;
            const igStats: ChannelStats = igData
                ? {
                    channel: 'instagram',
                    followers: Math.round(igData.get('instagram_follows')?.total ?? igStub.followers),
                    followerGrowth: igData.get('instagram_follows')?.latest ?? igStub.followerGrowth,
                    engagement: Math.round(igData.get('content_interactions')?.total ?? igStub.engagement),
                    engagementRate:
                        igData.get('content_interactions') && igData.get('views')
                            ? Number(
                                (
                                    ((igData.get('content_interactions')!.total /
                                        Math.max(igData.get('views')!.total, 1)) *
                                        100
                                    ).toFixed(2)
                                ),
                            )
                            : igStub.engagementRate,
                    impressions: Math.round(igData.get('views')?.total ?? igStub.impressions),
                    reach: Math.round(igData.get('reach')?.total ?? igStub.reach),
                    ctr:
                        igData.get('instagram_link_clicks') && igData.get('views')
                            ? Number(
                                (
                                    ((igData.get('instagram_link_clicks')!.total /
                                        Math.max(igData.get('views')!.total, 1)) *
                                        100
                                    ).toFixed(2)
                                ),
                            )
                            : igStub.ctr,
                }
                : igStub;

            // ── Facebook (mapped to equivalent KPI fields) ───────────────
            // 'facebook' is not a valid ChannelSlug; data is merged into
            // the 'instagram' slot (both are Meta / CSV-sourced).
            const fbStats: ChannelStats = fbData
                ? {
                    channel: 'facebook', // Changed from 'instagram'
                    followers: Math.round(fbData.get('facebook_follows')?.total ?? 0),
                    followerGrowth: fbData.get('facebook_follows')?.latest ?? 0,
                    engagement: Math.round(fbData.get('content_interactions')?.total ?? 0),
                    engagementRate:
                        fbData.get('content_interactions') && fbData.get('views')
                            ? Number(
                                (
                                    ((fbData.get('content_interactions')!.total /
                                        Math.max(fbData.get('views')!.total, 1)) *
                                        100
                                    ).toFixed(2)
                                ),
                            )
                            : 0,
                    impressions: Math.round(fbData.get('views')?.total ?? 0),
                    reach: Math.round(fbData.get('viewers')?.total ?? 0),
                    ctr:
                        fbData.get('facebook_link_clicks') && fbData.get('views')
                            ? Number(
                                (
                                    ((fbData.get('facebook_link_clicks')!.total /
                                        Math.max(fbData.get('views')!.total, 1)) *
                                        100
                                    ).toFixed(2)
                                ),
                            )
                            : 0,
                }
                : {
                    channel: 'facebook', 
                    followers: 0, followerGrowth: 0, engagement: 0,
                    engagementRate: 0, impressions: 0, reach: 0, ctr: 0,
                };

            // ── Merged channel stats: IG + FB combined as "instagram" slot ─
            // The main dashboard only shows 4 channels. We merge IG + FB
            // into the instagram slot (summed) so the KPIs reflect both Meta
            // channels without changing the UI structure.
            const mergedIG: ChannelStats = {
                channel: 'instagram',
                followers: igStats.followers + fbStats.followers,
                followerGrowth: igStats.followerGrowth + fbStats.followerGrowth,
                engagement: igStats.engagement + fbStats.engagement,
                engagementRate: (igStats.engagementRate + fbStats.engagementRate) / 2,
                impressions: igStats.impressions + fbStats.impressions,
                reach: igStats.reach + fbStats.reach,
                ctr: (igStats.ctr + fbStats.ctr) / 2,
            };

            const merged: ChannelStats[] = [
                igStats, // Use individual IG stats now
                fbStats, // Add Facebook as its own entry
                liStub,
                waStub,
                ytStub,
            ];

            // ── Follower growth trend: derive from IG daily points ─────────
            const igFollowsSeries = igData?.get('instagram_follows');
            const igGrowthPoints =
                igFollowsSeries && igFollowsSeries.points.length > 0
                    ? igFollowsSeries.points
                        .filter(p => p.date)
                        .map(p => ({ date: p.date, value: p.value }))
                    : null;
            const fallbackFbData = stubGrowth[0].data.map(p => ({ date: p.date, value: 0 }));
            const fbFollowsSeries = fbData?.get('facebook_follows');
            const fbGrowthPoints =
                fbFollowsSeries && fbFollowsSeries.points.length > 0
                    ? fbFollowsSeries.points
                        .filter(p => p.date)
                        .map(p => ({ date: p.date, value: p.value }))
                    : null;

            const mergedGrowth: TimeSeries[] = [
                igGrowthPoints
                    ? { label: 'Instagram', color: '#E4405F', data: igGrowthPoints }
                    : stubGrowth[0],
                stubGrowth[1], // LinkedIn — no manual endpoint
                stubGrowth[2], // WhatsApp — no manual endpoint
                stubGrowth[3], // YouTube  — no manual endpoint
                { 
                    label: 'Facebook', 
                    color: '#1877F2', 
                    data: fbGrowthPoints || fallbackFbData 
                }
            ];

            setChannelStats(merged);
            setFollowerGrowthTrend(mergedGrowth);
            setLoading(false);
        }

        load();
        return () => { cancelled = true; };
    }, []);

    return { channelStats, followerGrowthTrend, loading };
}
