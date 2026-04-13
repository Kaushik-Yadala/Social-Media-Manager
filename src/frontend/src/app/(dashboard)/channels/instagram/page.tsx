'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    Bookmark,
    ExternalLink,
    Eye,
    Grid3X3,
    Heart,
    Instagram,
    List,
    MessageSquare,
    Plus,
    RefreshCw,
    Search,
    Share2,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    MetricKPI,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from '@/components/charts/ChartComponents';
import { cn } from '@/lib/utils';

const API_BASE =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
    'http://localhost:8000';
const INSTAGRAM_USER_ID = 'ClubArtizen';
const CHANNEL_METRICS = [
    'views',
    'reach',
    'content_interactions',
    'instagram_link_clicks',
    'instagram_profile_visits',
    'instagram_follows',
] as const;

const METRIC_LABELS: Record<string, string> = {
    views: 'Views',
    reach: 'Reach',
    content_interactions: 'Content Interactions',
    instagram_link_clicks: 'Link Clicks',
    instagram_profile_visits: 'Profile Visits',
    instagram_follows: 'Follows',
    likes: 'Likes',
    comments: 'Comments',
    shares: 'Shares',
    saved: 'Saved',
    total_interactions: 'Total Interactions',
};

const METRIC_COLORS: Record<string, string> = {
    views: '#7C3AED',
    reach: '#2563EB',
    content_interactions: '#059669',
    instagram_link_clicks: '#D97706',
    instagram_profile_visits: '#0EA5E9',
    instagram_follows: '#EC4899',
    total_interactions: '#16A34A',
};

const PIE_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#0EA5E9', '#EC4899', '#14B8A6'];

interface ManualInsightValue {
    value: number | string;
    end_time?: string;
}

interface ManualInsightEntry {
    name?: string;
    title?: string;
    description?: string;
    period?: string;
    values?: ManualInsightValue[];
}

interface ManualInsightsResponse {
    data?: ManualInsightEntry[];
}

interface ManualPostInsightItem {
    post_id?: string;
    ig_user_id?: string;
    account_id?: string;
    account_username?: string;
    account_name?: string;
    description?: string;
    post_type?: string;
    publish_time?: string;
    permalink?: string;
    insights?: ManualInsightEntry[];
}

interface ManualPostInsightsResponse {
    data?: ManualPostInsightItem[];
}

interface MetricPoint {
    dateKey: string;
    dateLabel: string;
    value: number;
    sortValue: number;
}

interface MetricSeries {
    key: string;
    label: string;
    title: string;
    description: string;
    points: MetricPoint[];
    total: number;
    latest: number;
}

interface InstagramPostRecord {
    postId: string;
    title: string;
    description: string | null;
    igUserId: string | null;
    accountId: string | null;
    accountUsername: string | null;
    accountName: string | null;
    postType: string;
    publishTime: string | null;
    permalink: string | null;
    metrics: Record<string, number>;
}

type WidgetKind =
    | 'channel-overview'
    | 'metric-line'
    | 'post-type-distribution'
    | 'top-posts'
    | 'post-engagement'
    | 'post-reach-vs-views';

interface DashboardWidget {
    id: string;
    title: string;
    description: string;
    kind: WidgetKind;
    metricKey?: string;
}

type PostTimeFilter =
    | 'all'
    | 'last_7_days'
    | 'last_30_days'
    | 'last_90_days'
    | 'last_180_days'
    | 'last_365_days';

function stringifyDetail(detail: unknown): string {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map(stringifyDetail).filter(Boolean).join(', ');
    }
    if (detail && typeof detail === 'object') return JSON.stringify(detail);
    return '';
}

function normalizeOffsetDate(dateText: string): string {
    return dateText.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
}

function parseDate(dateText: string): Date | null {
    const parsed = new Date(normalizeOffsetDate(dateText));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function toNumber(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return numeric;
}

function formatShortDate(dateText: string): string {
    const date = parseDate(dateText);
    if (!date) return dateText;
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

function formatMetricLabel(metricKey: string): string {
    return METRIC_LABELS[metricKey] || metricKey.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
}

function metricColor(metricKey: string): string {
    return METRIC_COLORS[metricKey] || '#7C3AED';
}

function sortByPublishTimeDescending(a: InstagramPostRecord, b: InstagramPostRecord): number {
    const aDate = a.publishTime ? parseDate(a.publishTime) : null;
    const bDate = b.publishTime ? parseDate(b.publishTime) : null;
    const aValue = aDate ? aDate.getTime() : 0;
    const bValue = bDate ? bDate.getTime() : 0;
    return bValue - aValue;
}

function deriveTotalInteractions(metrics: Record<string, number>): number {
    if (typeof metrics.total_interactions === 'number') return metrics.total_interactions;
    const likes = metrics.likes || 0;
    const comments = metrics.comments || 0;
    const shares = metrics.shares || 0;
    const saved = metrics.saved || 0;
    return likes + comments + shares + saved;
}

async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const detail =
            payload && typeof payload === 'object' && payload && 'detail' in payload
                ? (payload as { detail: unknown }).detail
                : payload;
        throw new Error(stringifyDetail(detail) || `Request failed (${response.status}).`);
    }

    return payload as T;
}

function parseChannelMetricSeries(payload: ManualInsightsResponse): MetricSeries[] {
    const entries = Array.isArray(payload.data) ? payload.data : [];
    const parsed: MetricSeries[] = [];

    for (const entry of entries) {
        if (!entry || typeof entry.name !== 'string') continue;
        const values = Array.isArray(entry.values) ? entry.values : [];
        const points: MetricPoint[] = [];

        values.forEach((value, index) => {
            const numericValue = toNumber(value?.value);
            if (numericValue === null) return;

            const rawEndTime = typeof value?.end_time === 'string' ? value.end_time : '';
            const parsedDate = rawEndTime ? parseDate(rawEndTime) : null;
            const fallbackSort = index + 1;
            const dateKey =
                parsedDate !== null
                    ? parsedDate.toISOString().slice(0, 10)
                    : `point-${fallbackSort.toString().padStart(4, '0')}`;
            const dateLabel =
                parsedDate !== null
                    ? parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : `Point ${fallbackSort}`;

            points.push({
                dateKey,
                dateLabel,
                value: numericValue,
                sortValue: parsedDate !== null ? parsedDate.getTime() : fallbackSort,
            });
        });

        points.sort((a, b) => a.sortValue - b.sortValue);

        const total = points.reduce((sum, point) => sum + point.value, 0);
        const latest = points.length > 0 ? points[points.length - 1].value : 0;

        parsed.push({
            key: entry.name,
            label: formatMetricLabel(entry.name),
            title: typeof entry.title === 'string' ? entry.title : formatMetricLabel(entry.name),
            description:
                typeof entry.description === 'string'
                    ? entry.description
                    : `Daily trend for ${formatMetricLabel(entry.name)}.`,
            points,
            total,
            latest,
        });
    }

    return parsed;
}

function parsePostRecords(payload: ManualPostInsightsResponse): InstagramPostRecord[] {
    const data = Array.isArray(payload.data) ? payload.data : [];
    const records: InstagramPostRecord[] = [];

    for (const item of data) {
        if (!item || typeof item.post_id !== 'string') continue;
        const insights = Array.isArray(item.insights) ? item.insights : [];
        const metrics: Record<string, number> = {};
        const description = normalizeDescriptionText(
            typeof item.description === 'string' ? item.description : null,
        );
        const title = derivePostTitle(description, item.post_id);

        for (const insight of insights) {
            if (!insight || typeof insight.name !== 'string') continue;
            const values = Array.isArray(insight.values) ? insight.values : [];
            const numeric = values.length > 0 ? toNumber(values[0].value) : null;
            if (numeric === null) continue;
            metrics[insight.name] = numeric;
        }

        metrics.total_interactions = deriveTotalInteractions(metrics);

        records.push({
            postId: item.post_id,
            title,
            description,
            igUserId: typeof item.ig_user_id === 'string' ? item.ig_user_id : null,
            accountId: typeof item.account_id === 'string' ? item.account_id : null,
            accountUsername: typeof item.account_username === 'string' ? item.account_username : null,
            accountName: typeof item.account_name === 'string' ? item.account_name : null,
            postType: typeof item.post_type === 'string' ? item.post_type : 'Unknown',
            publishTime: typeof item.publish_time === 'string' ? item.publish_time : null,
            permalink: typeof item.permalink === 'string' ? item.permalink : null,
            metrics,
        });
    }

    return records.sort(sortByPublishTimeDescending);
}

function buildWidgetCatalog(series: MetricSeries[], posts: InstagramPostRecord[]): DashboardWidget[] {
    const widgets: DashboardWidget[] = [];
    const metricSeriesWithData = series.filter((metricSeries) => metricSeries.points.length > 0);

    if (metricSeriesWithData.length > 0) {
        widgets.push({
            id: 'channel-overview',
            title: 'Channel Metrics Overview',
            description: 'Total values by available channelwise metrics from MongoDB.',
            kind: 'channel-overview',
        });
    }

    for (const metricSeries of metricSeriesWithData) {
        widgets.push({
            id: `metric-${metricSeries.key}`,
            title: `${metricSeries.label} Trend`,
            description: `Daily ${metricSeries.label.toLowerCase()} values for ${INSTAGRAM_USER_ID}.`,
            kind: 'metric-line',
            metricKey: metricSeries.key,
        });
    }

    if (posts.length > 0) {
        widgets.push({
            id: 'post-type-distribution',
            title: 'Post Type Distribution',
            description: 'Count of imported posts by post type.',
            kind: 'post-type-distribution',
        });

        widgets.push({
            id: 'top-posts',
            title: 'Top Posts by Interactions',
            description: 'Posts ranked by total interactions.',
            kind: 'top-posts',
        });

        const hasEngagementBreakdown = posts.some(
            (post) =>
                post.metrics.likes ||
                post.metrics.comments ||
                post.metrics.shares ||
                post.metrics.saved,
        );
        if (hasEngagementBreakdown) {
            widgets.push({
                id: 'post-engagement',
                title: 'Post Engagement Breakdown',
                description: 'Aggregate likes, comments, shares, and saved from post insights.',
                kind: 'post-engagement',
            });
        }

        const hasViewsOrReach = posts.some((post) => post.metrics.views || post.metrics.reach);
        if (hasViewsOrReach) {
            widgets.push({
                id: 'post-reach-vs-views',
                title: 'Post Views vs Reach',
                description: 'Top posts comparison for views and reach.',
                kind: 'post-reach-vs-views',
            });
        }
    }

    return widgets;
}

function getLatestChange(points: MetricPoint[]): number | undefined {
    if (points.length < 2) return undefined;
    const latest = points[points.length - 1].value;
    const previous = points[points.length - 2].value;
    if (previous === 0) return undefined;
    return Number((((latest - previous) / previous) * 100).toFixed(1));
}

function normalizePostTypeLabel(postType: string): string {
    return postType.trim() || 'Unknown';
}

function normalizeDescriptionText(description: string | null): string | null {
    if (!description) return null;
    const normalized = description.replace(/\s+/g, ' ').trim();
    return normalized || null;
}

function derivePostTitle(description: string | null, postId: string): string {
    const normalizedDescription = normalizeDescriptionText(description);
    if (!normalizedDescription) {
        return `Post ${postId.slice(-8)}`;
    }

    const firstSentence = normalizedDescription.split(/(?<=[.!?])\s+/)[0] || normalizedDescription;
    const titleCandidate = firstSentence.length > 90 ? `${firstSentence.slice(0, 87)}...` : firstSentence;
    return titleCandidate.trim();
}

function normalizeFuzzyText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSubsequence(query: string, target: string): boolean {
    if (!query) return true;
    let queryIndex = 0;
    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
        if (target[targetIndex] === query[queryIndex]) {
            queryIndex += 1;
            if (queryIndex === query.length) return true;
        }
    }
    return false;
}

function levenshteinDistance(a: string, b: string, maxDistance = 2): number {
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = new Array<number>(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        let rowMin = current[0];
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + cost,
            );
            rowMin = Math.min(rowMin, current[j]);
        }
        if (rowMin > maxDistance) return maxDistance + 1;
        for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
    }

    return previous[b.length];
}

function fuzzyMatchesPostQuery(post: InstagramPostRecord, query: string): boolean {
    const normalizedQuery = normalizeFuzzyText(query);
    if (!normalizedQuery) return true;

    const searchableText = normalizeFuzzyText(
        [
            post.postId,
            post.title,
            post.description || '',
            post.postType,
            post.accountUsername || '',
            post.accountName || '',
        ].join(' '),
    );

    if (!searchableText) return false;
    if (searchableText.includes(normalizedQuery)) return true;

    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const words = searchableText.split(' ').filter(Boolean);

    return queryTokens.every((token) => {
        if (searchableText.includes(token)) return true;

        return words.some((word) => {
            if (word.includes(token) || word.startsWith(token) || token.startsWith(word)) return true;
            if (token.length >= 4 && word.length >= 4 && levenshteinDistance(token, word, 1) <= 1) return true;
            return isSubsequence(token, word);
        });
    });
}

function isPostWithinTimeRange(post: InstagramPostRecord, timeFilter: PostTimeFilter): boolean {
    if (timeFilter === 'all') return true;
    if (!post.publishTime) return false;
    const publishDate = parseDate(post.publishTime);
    if (!publishDate) return false;

    const now = new Date();
    const daysMap: Record<Exclude<PostTimeFilter, 'all'>, number> = {
        last_7_days: 7,
        last_30_days: 30,
        last_90_days: 90,
        last_180_days: 180,
        last_365_days: 365,
    };
    const dayWindow = daysMap[timeFilter];
    const threshold = new Date(now);
    threshold.setDate(now.getDate() - dayWindow);
    return publishDate >= threshold;
}

export default function InstagramPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

    const [metricSeries, setMetricSeries] = useState<MetricSeries[]>([]);
    const [posts, setPosts] = useState<InstagramPostRecord[]>([]);

    const [view, setView] = useState<'dashboard' | 'posts'>('dashboard');
    const [widgetSheetOpen, setWidgetSheetOpen] = useState(false);
    const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>([]);

    const [searchQ, setSearchQ] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [timeFilter, setTimeFilter] = useState<PostTimeFilter>('all');
    const [sortBy, setSortBy] = useState<'publish_time' | 'total_interactions' | 'views' | 'reach'>(
        'publish_time',
    );
    const [postView, setPostView] = useState<'grid' | 'list'>('grid');
    const [selectedPost, setSelectedPost] = useState<InstagramPostRecord | null>(null);

    const loadDashboardData = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const metricParams = new URLSearchParams({
                metric: CHANNEL_METRICS.join(','),
                period: 'day',
            });

            const [insightsPayload, postInsightsPayload] = await Promise.all([
                fetchJson<ManualInsightsResponse>(
                    `/manual/insta/insights/${encodeURIComponent(INSTAGRAM_USER_ID)}?${metricParams.toString()}`,
                ),
                fetchJson<ManualPostInsightsResponse>(
                    `/manual/insta/posts/${encodeURIComponent(INSTAGRAM_USER_ID)}/insights?period=lifetime`,
                ),
            ]);

            setMetricSeries(parseChannelMetricSeries(insightsPayload));
            setPosts(parsePostRecords(postInsightsPayload));
            setLastSyncedAt(new Date().toLocaleString());
        } catch (error) {
            setErrorMessage((error as Error).message || 'Failed to load Instagram insights.');
            setMetricSeries([]);
            setPosts([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboardData();
    }, [loadDashboardData]);

    const seriesByKey = useMemo(() => {
        const map = new Map<string, MetricSeries>();
        metricSeries.forEach((series) => map.set(series.key, series));
        return map;
    }, [metricSeries]);

    const postTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        for (const post of posts) {
            Object.entries(post.metrics).forEach(([metricKey, metricValue]) => {
                totals[metricKey] = (totals[metricKey] || 0) + metricValue;
            });
        }
        totals.total_interactions = deriveTotalInteractions(totals);
        return totals;
    }, [posts]);

    const widgetCatalog = useMemo(() => buildWidgetCatalog(metricSeries, posts), [metricSeries, posts]);

    useEffect(() => {
        const validIds = new Set(widgetCatalog.map((widget) => widget.id));
        setActiveWidgetIds((previousIds) => {
            const stillValid = previousIds.filter((id) => validIds.has(id));
            if (stillValid.length > 0) return stillValid;
            return widgetCatalog.slice(0, 6).map((widget) => widget.id);
        });
    }, [widgetCatalog]);

    const widgetById = useMemo(() => {
        const map = new Map<string, DashboardWidget>();
        widgetCatalog.forEach((widget) => map.set(widget.id, widget));
        return map;
    }, [widgetCatalog]);

    const activeWidgets = useMemo(
        () =>
            activeWidgetIds
                .map((id) => widgetById.get(id))
                .filter((widget): widget is DashboardWidget => widget !== undefined),
        [activeWidgetIds, widgetById],
    );

    const availableWidgets = useMemo(
        () => widgetCatalog.filter((widget) => !activeWidgetIds.includes(widget.id)),
        [widgetCatalog, activeWidgetIds],
    );

    const postTypeDistribution = useMemo(() => {
        const counts = new Map<string, number>();
        posts.forEach((post) => {
            const key = normalizePostTypeLabel(post.postType);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
    }, [posts]);

    const topPostsByInteractions = useMemo(
        () =>
            [...posts]
                .sort(
                    (a, b) =>
                        (b.metrics.total_interactions || 0) - (a.metrics.total_interactions || 0),
                )
                .slice(0, 8),
        [posts],
    );

    const postEngagementBreakdown = useMemo(
        () => [
            { metric: 'Likes', value: postTotals.likes || 0 },
            { metric: 'Comments', value: postTotals.comments || 0 },
            { metric: 'Shares', value: postTotals.shares || 0 },
            { metric: 'Saved', value: postTotals.saved || 0 },
        ],
        [postTotals],
    );

    const postViewsVsReach = useMemo(
        () =>
            topPostsByInteractions.slice(0, 8).map((post) => ({
                postId: post.postId.slice(-6),
                views: post.metrics.views || 0,
                reach: post.metrics.reach || 0,
            })),
        [topPostsByInteractions],
    );

    const metricOverviewData = useMemo(
        () =>
            metricSeries
                .filter((series) => series.points.length > 0)
                .map((series) => ({
                    metric: series.label,
                    total: Math.round(series.total),
                })),
        [metricSeries],
    );

    const typeOptions = useMemo(
        () => ['all', ...postTypeDistribution.map((item) => item.type)],
        [postTypeDistribution],
    );

    const postTimeFilterOptions: Array<{ value: PostTimeFilter; label: string }> = [
        { value: 'all', label: 'All time' },
        { value: 'last_7_days', label: 'Last 7 days' },
        { value: 'last_30_days', label: 'Last 30 days' },
        { value: 'last_90_days', label: 'Last 90 days' },
        { value: 'last_180_days', label: 'Last 180 days' },
        { value: 'last_365_days', label: 'Last 365 days' },
    ];

    const filteredPosts = useMemo(() => {
        let result = [...posts];
        if (typeFilter !== 'all') {
            result = result.filter((post) => normalizePostTypeLabel(post.postType) === typeFilter);
        }
        result = result.filter((post) => isPostWithinTimeRange(post, timeFilter));
        if (searchQ.trim()) {
            result = result.filter((post) => fuzzyMatchesPostQuery(post, searchQ));
        }

        result.sort((a, b) => {
            if (sortBy === 'publish_time') return sortByPublishTimeDescending(a, b);
            return (b.metrics[sortBy] || 0) - (a.metrics[sortBy] || 0);
        });

        return result;
    }, [posts, typeFilter, timeFilter, searchQ, sortBy]);

    const viewsSeries = seriesByKey.get('views');
    const reachSeries = seriesByKey.get('reach');
    const interactionsSeries = seriesByKey.get('content_interactions');
    const followsSeries = seriesByKey.get('instagram_follows');

    const totalViews = viewsSeries ? Math.round(viewsSeries.total) : Math.round(postTotals.views || 0);
    const totalReach = reachSeries ? Math.round(reachSeries.total) : Math.round(postTotals.reach || 0);
    const totalInteractions = interactionsSeries
        ? Math.round(interactionsSeries.total)
        : Math.round(postTotals.total_interactions || 0);
    const totalFollows = followsSeries
        ? Math.round(followsSeries.total)
        : Math.round(postTotals.follows || 0);

    const renderWidget = (widget: DashboardWidget) => {
        if (widget.kind === 'channel-overview') {
            if (metricOverviewData.length === 0) {
                return (
                    <p className="text-xs text-stone-400">
                        No channelwise metric rows available in MongoDB for {INSTAGRAM_USER_ID}.
                    </p>
                );
            }

            return (
                <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metricOverviewData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                            <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#78716C' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                            <Tooltip />
                            <Bar dataKey="total" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (widget.kind === 'metric-line' && widget.metricKey) {
            const series = seriesByKey.get(widget.metricKey);
            if (!series || series.points.length === 0) {
                return <p className="text-xs text-stone-400">No data points available for this metric.</p>;
            }

            const chartData = series.points.map((point) => ({
                date: point.dateLabel,
                value: point.value,
            }));

            return (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                        <span>Total: {Math.round(series.total).toLocaleString()}</span>
                        <span>Latest: {Math.round(series.latest).toLocaleString()}</span>
                    </div>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                                <Tooltip />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={metricColor(series.key)}
                                    fill={metricColor(series.key)}
                                    fillOpacity={0.14}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            );
        }

        if (widget.kind === 'post-type-distribution') {
            if (postTypeDistribution.length === 0) {
                return <p className="text-xs text-stone-400">No post rows available in MongoDB.</p>;
            }

            return (
                <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={postTypeDistribution}
                                dataKey="count"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={85}
                                labelLine={false}
                            >
                                {postTypeDistribution.map((item, index) => (
                                    <Cell key={`${item.type}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (widget.kind === 'top-posts') {
            if (topPostsByInteractions.length === 0) {
                return <p className="text-xs text-stone-400">No post interaction data available.</p>;
            }

            return (
                <div className="space-y-2">
                    {topPostsByInteractions.slice(0, 6).map((post) => (
                        <div
                            key={post.postId}
                            className="flex items-center justify-between rounded-md border border-stone-100 bg-stone-50 px-3 py-2"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-stone-800">{post.title}</p>
                                <p className="text-[11px] text-stone-500">{normalizePostTypeLabel(post.postType)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-stone-800">
                                    {(post.metrics.total_interactions || 0).toLocaleString()}
                                </p>
                                <p className="text-[11px] text-stone-500">interactions</p>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        if (widget.kind === 'post-engagement') {
            if (postEngagementBreakdown.every((item) => item.value === 0)) {
                return <p className="text-xs text-stone-400">No likes/comments/shares/saved data available.</p>;
            }

            return (
                <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={postEngagementBreakdown}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                            <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#78716C' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#16A34A" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (widget.kind === 'post-reach-vs-views') {
            if (postViewsVsReach.length === 0) {
                return <p className="text-xs text-stone-400">No views/reach data available for posts.</p>;
            }

            return (
                <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={postViewsVsReach}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                            <XAxis dataKey="postId" tick={{ fontSize: 10, fill: '#78716C' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                            <Tooltip />
                            <Bar dataKey="views" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="reach" fill="#2563EB" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        return <p className="text-xs text-stone-400">Unsupported widget type.</p>;
    };

    const addWidget = (widgetId: string) => {
        setActiveWidgetIds((previousIds) => {
            if (previousIds.includes(widgetId)) return previousIds;
            return [...previousIds, widgetId];
        });
        setWidgetSheetOpen(false);
    };

    const removeWidget = (widgetId: string) => {
        setActiveWidgetIds((previousIds) => previousIds.filter((id) => id !== widgetId));
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <Instagram className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-stone-900">Instagram</h1>
                        <p className="text-sm text-stone-500">
                            Live from MongoDB via manual APIs · user_id:{' '}
                            <span className="font-semibold">{INSTAGRAM_USER_ID}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Tabs value={view} onValueChange={(next) => setView(next as 'dashboard' | 'posts')}>
                        <TabsList className="bg-stone-100">
                            <TabsTrigger value="dashboard" className="text-xs">
                                <BarChart3 className="mr-1 h-3 w-3" />
                                Dashboard
                            </TabsTrigger>
                            <TabsTrigger value="posts" className="text-xs">
                                <Grid3X3 className="mr-1 h-3 w-3" />
                                Posts
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <Button variant="outline" size="sm" onClick={() => void loadDashboardData()} disabled={isLoading}>
                        <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                        Refresh
                    </Button>
                </div>
            </div>

            {errorMessage && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                        <p className="text-sm text-red-700">{errorMessage}</p>
                        <Button size="sm" variant="outline" onClick={() => void loadDashboardData()}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <MetricKPI
                    label="Views"
                    value={totalViews}
                    change={viewsSeries ? getLatestChange(viewsSeries.points) : undefined}
                    icon={<Eye className="h-5 w-5" />}
                />
                <MetricKPI
                    label="Reach"
                    value={totalReach}
                    change={reachSeries ? getLatestChange(reachSeries.points) : undefined}
                    icon={<TrendingUp className="h-5 w-5" />}
                />
                <MetricKPI
                    label="Content Interactions"
                    value={totalInteractions}
                    change={interactionsSeries ? getLatestChange(interactionsSeries.points) : undefined}
                    icon={<MessageSquare className="h-5 w-5" />}
                />
                <MetricKPI
                    label="Follows"
                    value={totalFollows}
                    change={followsSeries ? getLatestChange(followsSeries.points) : undefined}
                    icon={<Users className="h-5 w-5" />}
                />
            </div>

            <Card className="border-stone-200">
                <CardContent className="pt-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                        <Badge variant="outline">Channel metrics: {metricSeries.length}</Badge>
                        <Badge variant="outline">Post rows: {posts.length}</Badge>
                        {lastSyncedAt && <span>Last synced: {lastSyncedAt}</span>}
                    </div>
                </CardContent>
            </Card>

            {view === 'dashboard' ? (
                <>
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-medium text-stone-700">Widget Dashboard</h2>
                        <Sheet open={widgetSheetOpen} onOpenChange={setWidgetSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs">
                                    <Plus className="mr-1 h-3 w-3" />
                                    Add Widget
                                </Button>
                            </SheetTrigger>
                            <SheetContent>
                                <SheetHeader>
                                    <SheetTitle>Instagram Widgets (MongoDB-backed)</SheetTitle>
                                </SheetHeader>
                                <div className="mt-4 space-y-2">
                                    {availableWidgets.length === 0 ? (
                                        <p className="text-sm text-stone-500">
                                            All available widgets are already added.
                                        </p>
                                    ) : (
                                        availableWidgets.map((widget) => (
                                            <button
                                                key={widget.id}
                                                type="button"
                                                onClick={() => addWidget(widget.id)}
                                                className="w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-left transition-colors hover:bg-stone-100"
                                            >
                                                <p className="text-sm font-medium text-stone-800">{widget.title}</p>
                                                <p className="mt-1 text-xs text-stone-500">{widget.description}</p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {isLoading ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-stone-500">
                                Loading Instagram insights from backend...
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {activeWidgets.length === 0 ? (
                                <Card className="col-span-full">
                                    <CardContent className="py-10 text-center text-sm text-stone-500">
                                        No widgets added. Use &ldquo;Add Widget&rdquo; to customize the dashboard.
                                    </CardContent>
                                </Card>
                            ) : (
                                activeWidgets.map((widget) => (
                                    <Card key={widget.id} className="relative border-stone-200">
                                        <button
                                            type="button"
                                            onClick={() => removeWidget(widget.id)}
                                            className="absolute right-2 top-2 rounded-full p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                            aria-label={`Remove ${widget.title}`}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                        <CardHeader className="pb-2 pr-10">
                                            <CardTitle className="text-sm text-stone-800">{widget.title}</CardTitle>
                                            <CardDescription className="text-xs">{widget.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent>{renderWidget(widget)}</CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[220px] flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                            <Input
                                value={searchQ}
                                onChange={(event) => setSearchQ(event.target.value)}
                                placeholder="Fuzzy search by post title, description, ID, type, or account..."
                                className="pl-9"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[190px]">
                                <SelectValue placeholder="Filter post type" />
                            </SelectTrigger>
                            <SelectContent>
                                {typeOptions.map((typeOption) => (
                                    <SelectItem key={typeOption} value={typeOption}>
                                        {typeOption === 'all' ? 'All post types' : typeOption}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={timeFilter}
                            onValueChange={(value) => setTimeFilter(value as PostTimeFilter)}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter time period" />
                            </SelectTrigger>
                            <SelectContent>
                                {postTimeFilterOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={sortBy}
                            onValueChange={(value) =>
                                setSortBy(value as 'publish_time' | 'total_interactions' | 'views' | 'reach')
                            }
                        >
                            <SelectTrigger className="w-[190px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="publish_time">Sort by publish time</SelectItem>
                                <SelectItem value="total_interactions">Sort by interactions</SelectItem>
                                <SelectItem value="views">Sort by views</SelectItem>
                                <SelectItem value="reach">Sort by reach</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                            <Button
                                variant={postView === 'grid' ? 'default' : 'outline'}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPostView('grid')}
                            >
                                <Grid3X3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant={postView === 'list' ? 'default' : 'outline'}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPostView('list')}
                            >
                                <List className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    {isLoading ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-stone-500">
                                Loading Instagram post insights...
                            </CardContent>
                        </Card>
                    ) : filteredPosts.length === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-stone-500">
                                No posts found for the current filters.
                            </CardContent>
                        </Card>
                    ) : postView === 'grid' ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {filteredPosts.map((post) => (
                                <Card
                                    key={post.postId}
                                    className="cursor-pointer border-stone-200 transition-shadow hover:shadow-md"
                                    onClick={() => setSelectedPost(post)}
                                >
                                    <CardContent className="space-y-3 pt-5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-stone-800">
                                                    {post.title}
                                                </p>
                                                <p className="text-[11px] text-stone-500">
                                                    {post.publishTime ? formatShortDate(post.publishTime) : 'Unknown date'}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px]">
                                                {normalizePostTypeLabel(post.postType)}
                                            </Badge>
                                        </div>
                                        <p className="line-clamp-3 text-xs text-stone-600">
                                            {post.description || `Post ID: ${post.postId}`}
                                        </p>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="rounded-md bg-stone-50 px-2 py-1">
                                                <p className="text-[10px] text-stone-500">Views</p>
                                                <p className="font-semibold text-stone-800">
                                                    {(post.metrics.views || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-stone-50 px-2 py-1">
                                                <p className="text-[10px] text-stone-500">Reach</p>
                                                <p className="font-semibold text-stone-800">
                                                    {(post.metrics.reach || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-stone-50 px-2 py-1">
                                                <p className="text-[10px] text-stone-500">Interactions</p>
                                                <p className="font-semibold text-stone-800">
                                                    {(post.metrics.total_interactions || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-stone-50 px-2 py-1">
                                                <p className="text-[10px] text-stone-500">Follows</p>
                                                <p className="font-semibold text-stone-800">
                                                    {(post.metrics.follows || 0).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        {post.permalink && (
                                            <a
                                                href={post.permalink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800"
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                Open permalink
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredPosts.map((post) => (
                                <Card
                                    key={post.postId}
                                    className="cursor-pointer border-stone-200 transition-shadow hover:shadow-md"
                                    onClick={() => setSelectedPost(post)}
                                >
                                    <CardContent className="py-3">
                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                            <Badge variant="outline" className="text-[10px]">
                                                {normalizePostTypeLabel(post.postType)}
                                            </Badge>
                                            <span className="font-medium text-stone-800">{post.title}</span>
                                            <span className="text-xs text-stone-500">
                                                {post.publishTime ? formatShortDate(post.publishTime) : 'Unknown date'}
                                            </span>
                                            <span className="ml-auto text-xs text-stone-600">
                                                {(post.metrics.total_interactions || 0).toLocaleString()} interactions
                                            </span>
                                        </div>
                                        <p className="mt-2 line-clamp-2 text-xs text-stone-600">
                                            {post.description || `Post ID: ${post.postId}`}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            <Dialog open={selectedPost !== null} onOpenChange={(open) => !open && setSelectedPost(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            {selectedPost ? selectedPost.title : 'Post Details'}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedPost && (
                        <div className="space-y-4">
                            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{normalizePostTypeLabel(selectedPost.postType)}</Badge>
                                    <span className="text-xs text-stone-500">
                                        {selectedPost.publishTime
                                            ? formatShortDate(selectedPost.publishTime)
                                            : 'Unknown date'}
                                    </span>
                                    <span className="text-xs text-stone-400">ID: {selectedPost.postId}</span>
                                </div>
                                <p className="mt-2 text-sm text-stone-700">
                                    {selectedPost.description || 'No description available for this post.'}
                                </p>
                                {selectedPost.permalink && (
                                    <a
                                        href={selectedPost.permalink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800"
                                    >
                                        Open permalink
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                {Object.entries(selectedPost.metrics)
                                    .sort(([metricA], [metricB]) => metricA.localeCompare(metricB))
                                    .map(([metricKey, metricValue]) => {
                                        const icon =
                                            metricKey === 'likes' ? (
                                                <Heart className="h-3.5 w-3.5 text-pink-600" />
                                            ) : metricKey === 'comments' ? (
                                                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                                            ) : metricKey === 'shares' ? (
                                                <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : metricKey === 'saved' ? (
                                                <Bookmark className="h-3.5 w-3.5 text-violet-600" />
                                            ) : metricKey === 'views' ? (
                                                <Eye className="h-3.5 w-3.5 text-indigo-600" />
                                            ) : null;

                                        return (
                                            <div
                                                key={metricKey}
                                                className="rounded-md border border-stone-200 bg-white px-2 py-2"
                                            >
                                                <div className="mb-1 flex items-center gap-1 text-[11px] text-stone-500">
                                                    {icon}
                                                    <span>{formatMetricLabel(metricKey)}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-stone-800">
                                                    {metricValue.toLocaleString()}
                                                </p>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
