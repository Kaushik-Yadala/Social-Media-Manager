'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    Bookmark,
    CalendarDays,
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
import { DayPicker, DateRange } from 'react-day-picker';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
    Legend,
    Line,
    LineChart,
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
const POST_TYPE_GROWTH_METRIC_OPTIONS = [
    { value: 'total_interactions', label: 'Interactions' },
    { value: 'views', label: 'Views' },
    { value: 'reach', label: 'Reach' },
    { value: 'likes', label: 'Likes' },
    { value: 'comments', label: 'Comments' },
    { value: 'shares', label: 'Shares' },
    { value: 'saved', label: 'Saved' },
    { value: 'follows', label: 'Follows' },
] as const;

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

interface DateRangeBounds {
    startMs: number;
    endMs: number;
    startDate: Date;
    endDate: Date;
}

interface PostTypeAggregate {
    type: string;
    count: number;
    totals: Record<string, number>;
}

interface TopPostTypeMetric {
    type: string;
    value: number;
    count: number;
}

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

function formatDateWithYear(date: Date): string {
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatDateRangeLabel(range: DateRange | undefined): string {
    if (!range?.from) return 'Select date range';
    if (!range.to) return `${formatDateWithYear(range.from)} - Select end date`;
    return `${formatDateWithYear(range.from)} - ${formatDateWithYear(range.to)}`;
}

function startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function endOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
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
                    ? formatDateWithYear(parsedDate)
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

function getMetricChange(
    allPoints: MetricPoint[],
    windowPoints: MetricPoint[],
    dateRange: DateRangeBounds | null,
): number | undefined {
    if (dateRange === null) {
        if (allPoints.length < 2) return undefined;
        const latest = allPoints[allPoints.length - 1].value;
        const previous = allPoints[allPoints.length - 2].value;
        if (previous === 0) return undefined;
        return Number((((latest - previous) / previous) * 100).toFixed(1));
    }

    const currentRangeTotal = windowPoints.reduce((sum, point) => sum + point.value, 0);
    const currentRangeDurationMs = dateRange.endMs - dateRange.startMs;
    const previousRangeEndMs = dateRange.startMs - 1;
    const previousRangeStartMs = previousRangeEndMs - currentRangeDurationMs;

    const previousRangeTotal = allPoints.reduce((sum, point) => {
        if (point.sortValue < previousRangeStartMs || point.sortValue > previousRangeEndMs) return sum;
        return sum + point.value;
    }, 0);

    if (previousRangeTotal === 0) return undefined;
    return Number((((currentRangeTotal - previousRangeTotal) / previousRangeTotal) * 100).toFixed(1));
}

function InstagramMetricCard({
    label,
    value,
    change,
    changeLabel,
    icon,
    showGlobalValue,
    globalValue,
}: {
    label: string;
    value: number;
    change?: number;
    changeLabel: string;
    icon: React.ReactNode;
    showGlobalValue: boolean;
    globalValue: number;
}) {
    const isPositive = (change ?? 0) >= 0;

    return (
        <Card className="card-hover border-stone-200">
            <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
                        <p className="mt-1 text-2xl font-semibold text-stone-900">{value.toLocaleString()}</p>
                        {showGlobalValue && (
                            <p className="mt-1 text-[11px] text-stone-500">Global: {globalValue.toLocaleString()}</p>
                        )}
                        {change !== undefined && (
                            <p className={`mt-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                {isPositive ? '↑' : '↓'} {Math.abs(change)}% {changeLabel}
                            </p>
                        )}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
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

function getTopPostTypeByMetric(
    aggregates: PostTypeAggregate[],
    metricKey: string,
): TopPostTypeMetric | null {
    if (aggregates.length === 0) return null;

    let winner: TopPostTypeMetric | null = null;
    for (const aggregate of aggregates) {
        const value = aggregate.totals[metricKey] || 0;
        if (!winner || value > winner.value) {
            winner = { type: aggregate.type, value, count: aggregate.count };
        }
    }

    return winner;
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
    const [selectedCalendarRange, setSelectedCalendarRange] = useState<DateRange | undefined>();

    const [postsMode, setPostsMode] = useState<'individual' | 'analytics'>('individual');
    const [searchQ, setSearchQ] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [timeFilter, setTimeFilter] = useState<PostTimeFilter>('all');
    const [sortBy, setSortBy] = useState<'publish_time' | 'total_interactions' | 'views' | 'reach'>(
        'publish_time',
    );
    const [postGrowthMetricKey, setPostGrowthMetricKey] =
        useState<(typeof POST_TYPE_GROWTH_METRIC_OPTIONS)[number]['value']>('total_interactions');
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

    const allSeriesByKey = useMemo(() => {
        const map = new Map<string, MetricSeries>();
        metricSeries.forEach((series) => map.set(series.key, series));
        return map;
    }, [metricSeries]);

    const isDateRangePending = Boolean(selectedCalendarRange?.from && !selectedCalendarRange?.to);
    const selectedDateRange = useMemo<DateRangeBounds | null>(() => {
        if (!selectedCalendarRange?.from || !selectedCalendarRange.to) return null;
        return {
            startMs: startOfDay(selectedCalendarRange.from).getTime(),
            endMs: endOfDay(selectedCalendarRange.to).getTime(),
            startDate: selectedCalendarRange.from,
            endDate: selectedCalendarRange.to,
        };
    }, [selectedCalendarRange]);
    const isDateRangeActive = selectedDateRange !== null;

    const seriesForDisplay = useMemo(() => {
        if (!isDateRangeActive || !selectedDateRange) return metricSeries;

        return metricSeries.map((series) => {
            const points = series.points.filter(
                (point) => point.sortValue >= selectedDateRange.startMs && point.sortValue <= selectedDateRange.endMs,
            );
            const total = points.reduce((sum, point) => sum + point.value, 0);
            const latest = points.length > 0 ? points[points.length - 1].value : 0;
            return {
                ...series,
                points,
                total,
                latest,
            };
        });
    }, [metricSeries, isDateRangeActive, selectedDateRange]);

    const seriesByKey = useMemo(() => {
        const map = new Map<string, MetricSeries>();
        seriesForDisplay.forEach((series) => map.set(series.key, series));
        return map;
    }, [seriesForDisplay]);

    const postsForDisplay = useMemo(() => {
        if (!isDateRangeActive || !selectedDateRange) return posts;

        return posts.filter((post) => {
            if (!post.publishTime) return false;
            const publishDate = parseDate(post.publishTime);
            if (!publishDate) return false;
            const timestamp = publishDate.getTime();
            return timestamp >= selectedDateRange.startMs && timestamp <= selectedDateRange.endMs;
        });
    }, [posts, isDateRangeActive, selectedDateRange]);

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

    const postTotalsForDisplay = useMemo(() => {
        const totals: Record<string, number> = {};
        for (const post of postsForDisplay) {
            Object.entries(post.metrics).forEach(([metricKey, metricValue]) => {
                totals[metricKey] = (totals[metricKey] || 0) + metricValue;
            });
        }
        totals.total_interactions = deriveTotalInteractions(totals);
        return totals;
    }, [postsForDisplay]);

    const widgetCatalog = useMemo(
        () => buildWidgetCatalog(seriesForDisplay, postsForDisplay),
        [seriesForDisplay, postsForDisplay],
    );

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
        postsForDisplay.forEach((post) => {
            const key = normalizePostTypeLabel(post.postType);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
    }, [postsForDisplay]);

    const postTypeAggregates = useMemo<PostTypeAggregate[]>(() => {
        const aggregateMap = new Map<string, PostTypeAggregate>();

        for (const post of postsForDisplay) {
            const type = normalizePostTypeLabel(post.postType);
            const existing =
                aggregateMap.get(type) ||
                ({
                    type,
                    count: 0,
                    totals: {},
                } satisfies PostTypeAggregate);

            existing.count += 1;
            Object.entries(post.metrics).forEach(([metricKey, metricValue]) => {
                existing.totals[metricKey] = (existing.totals[metricKey] || 0) + metricValue;
            });

            aggregateMap.set(type, existing);
        }

        return Array.from(aggregateMap.values()).sort((a, b) => {
            const interactionsA = a.totals.total_interactions || 0;
            const interactionsB = b.totals.total_interactions || 0;
            return interactionsB - interactionsA;
        });
    }, [postsForDisplay]);

    const bestPostTypeByInteractions = useMemo(
        () => getTopPostTypeByMetric(postTypeAggregates, 'total_interactions'),
        [postTypeAggregates],
    );
    const bestPostTypeByViews = useMemo(
        () => getTopPostTypeByMetric(postTypeAggregates, 'views'),
        [postTypeAggregates],
    );
    const bestPostTypeByReach = useMemo(
        () => getTopPostTypeByMetric(postTypeAggregates, 'reach'),
        [postTypeAggregates],
    );

    const postTypeMetricTotals = useMemo(
        () =>
            postTypeAggregates
                .map((aggregate) => ({
                    type: aggregate.type,
                    total: aggregate.totals[postGrowthMetricKey] || 0,
                    posts: aggregate.count,
                }))
                .sort((a, b) => b.total - a.total),
        [postTypeAggregates, postGrowthMetricKey],
    );

    const postTypeGrowthSeries = useMemo(() => {
        const rankedTypes = postTypeMetricTotals
            .filter((entry) => entry.total > 0)
            .slice(0, 5)
            .map((entry) => entry.type);
        if (rankedTypes.length === 0) {
            return { data: [] as Array<Record<string, number | string>>, types: [] as string[] };
        }

        const topTypeSet = new Set(rankedTypes);
        const dailyRows = new Map<
            string,
            {
                sortValue: number;
                dateLabel: string;
                totals: Record<string, number>;
            }
        >();

        for (const post of postsForDisplay) {
            if (!post.publishTime) continue;
            const publishDate = parseDate(post.publishTime);
            if (!publishDate) continue;

            const type = normalizePostTypeLabel(post.postType);
            if (!topTypeSet.has(type)) continue;

            const metricValue = post.metrics[postGrowthMetricKey] || 0;
            const dateKey = publishDate.toISOString().slice(0, 10);
            const row = dailyRows.get(dateKey) || {
                sortValue: publishDate.getTime(),
                dateLabel: formatDateWithYear(publishDate),
                totals: {},
            };
            row.totals[type] = (row.totals[type] || 0) + metricValue;
            dailyRows.set(dateKey, row);
        }

        const sortedRows = Array.from(dailyRows.values()).sort((a, b) => a.sortValue - b.sortValue);
        const runningTotals: Record<string, number> = {};
        rankedTypes.forEach((type) => {
            runningTotals[type] = 0;
        });

        const data = sortedRows.map((row) => {
            const chartEntry: Record<string, string | number> = {
                date: row.dateLabel,
            };

            rankedTypes.forEach((type) => {
                runningTotals[type] += row.totals[type] || 0;
                chartEntry[type] = Math.round(runningTotals[type]);
            });

            return chartEntry;
        });

        return { data, types: rankedTypes };
    }, [postsForDisplay, postGrowthMetricKey, postTypeMetricTotals]);

    const topPostsByInteractions = useMemo(
        () =>
            [...postsForDisplay]
                .sort(
                    (a, b) =>
                        (b.metrics.total_interactions || 0) - (a.metrics.total_interactions || 0),
                )
                .slice(0, 8),
        [postsForDisplay],
    );

    const postEngagementBreakdown = useMemo(
        () => [
            { metric: 'Likes', value: postTotalsForDisplay.likes || 0 },
            { metric: 'Comments', value: postTotalsForDisplay.comments || 0 },
            { metric: 'Shares', value: postTotalsForDisplay.shares || 0 },
            { metric: 'Saved', value: postTotalsForDisplay.saved || 0 },
        ],
        [postTotalsForDisplay],
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
            seriesForDisplay
                .filter((series) => series.points.length > 0)
                .map((series) => ({
                    metric: series.label,
                    total: Math.round(series.total),
                })),
        [seriesForDisplay],
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
        let result = [...postsForDisplay];
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
    }, [postsForDisplay, typeFilter, timeFilter, searchQ, sortBy]);

    const globalViewsSeries = allSeriesByKey.get('views');
    const globalReachSeries = allSeriesByKey.get('reach');
    const globalInteractionsSeries = allSeriesByKey.get('content_interactions');
    const globalFollowsSeries = allSeriesByKey.get('instagram_follows');

    const viewsSeries = seriesByKey.get('views');
    const reachSeries = seriesByKey.get('reach');
    const interactionsSeries = seriesByKey.get('content_interactions');
    const followsSeries = seriesByKey.get('instagram_follows');

    const globalTotalViews = globalViewsSeries ? Math.round(globalViewsSeries.total) : Math.round(postTotals.views || 0);
    const globalTotalReach = globalReachSeries ? Math.round(globalReachSeries.total) : Math.round(postTotals.reach || 0);
    const globalTotalInteractions = globalInteractionsSeries
        ? Math.round(globalInteractionsSeries.total)
        : Math.round(postTotals.total_interactions || 0);
    const globalTotalFollows = globalFollowsSeries
        ? Math.round(globalFollowsSeries.total)
        : Math.round(postTotals.follows || 0);

    const selectedRangeTotalViews = viewsSeries
        ? Math.round(viewsSeries.total)
        : Math.round(postTotalsForDisplay.views || 0);
    const selectedRangeTotalReach = reachSeries
        ? Math.round(reachSeries.total)
        : Math.round(postTotalsForDisplay.reach || 0);
    const selectedRangeTotalInteractions = interactionsSeries
        ? Math.round(interactionsSeries.total)
        : Math.round(postTotalsForDisplay.total_interactions || 0);
    const selectedRangeTotalFollows = followsSeries
        ? Math.round(followsSeries.total)
        : Math.round(postTotalsForDisplay.follows || 0);

    const totalViews = isDateRangeActive ? selectedRangeTotalViews : globalTotalViews;
    const totalReach = isDateRangeActive ? selectedRangeTotalReach : globalTotalReach;
    const totalInteractions = isDateRangeActive ? selectedRangeTotalInteractions : globalTotalInteractions;
    const totalFollows = isDateRangeActive ? selectedRangeTotalFollows : globalTotalFollows;

    const comparisonLabel = isDateRangeActive ? 'vs previous equal range' : 'vs previous day';

    const viewsChange = globalViewsSeries
        ? getMetricChange(globalViewsSeries.points, viewsSeries ? viewsSeries.points : [], selectedDateRange)
        : undefined;
    const reachChange = globalReachSeries
        ? getMetricChange(globalReachSeries.points, reachSeries ? reachSeries.points : [], selectedDateRange)
        : undefined;
    const interactionsChange = globalInteractionsSeries
        ? getMetricChange(
              globalInteractionsSeries.points,
              interactionsSeries ? interactionsSeries.points : [],
              selectedDateRange,
          )
        : undefined;
    const followsChange = globalFollowsSeries
        ? getMetricChange(globalFollowsSeries.points, followsSeries ? followsSeries.points : [], selectedDateRange)
        : undefined;
    const selectedPostGrowthMetricLabel =
        POST_TYPE_GROWTH_METRIC_OPTIONS.find((option) => option.value === postGrowthMetricKey)?.label ||
        formatMetricLabel(postGrowthMetricKey);

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

            <Card className="border-stone-200">
                <CardContent className="pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 min-w-[280px] justify-start text-left font-normal text-stone-700"
                                >
                                    <CalendarDays className="mr-2 h-4 w-4 text-violet-600" />
                                    {formatDateRangeLabel(selectedCalendarRange)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-0">
                                <DayPicker
                                    mode="range"
                                    selected={selectedCalendarRange}
                                    onSelect={setSelectedCalendarRange}
                                    numberOfMonths={2}
                                    className="p-3"
                                    classNames={{
                                        months: 'flex flex-col gap-4 sm:flex-row sm:gap-6',
                                        month: 'space-y-4',
                                        month_caption:
                                            'flex items-center justify-center px-1 pt-1 text-sm font-medium text-stone-700',
                                        nav: 'flex items-center gap-1',
                                        button_previous:
                                            'rounded-md border border-stone-200 p-1 text-stone-600 hover:bg-stone-100',
                                        button_next:
                                            'rounded-md border border-stone-200 p-1 text-stone-600 hover:bg-stone-100',
                                        month_grid: 'w-full border-collapse',
                                        weekdays: 'flex',
                                        weekday:
                                            'w-9 text-center text-[11px] font-medium uppercase text-stone-400',
                                        week: 'mt-1 flex w-full',
                                        day: 'h-9 w-9 p-0 text-center',
                                        day_button:
                                            'h-9 w-9 rounded-md text-sm text-stone-700 transition-colors hover:bg-violet-50',
                                        selected:
                                            'bg-violet-600 text-white hover:bg-violet-600 hover:text-white focus:bg-violet-600 focus:text-white',
                                        range_start:
                                            'bg-violet-600 text-white hover:bg-violet-600 hover:text-white',
                                        range_end:
                                            'bg-violet-600 text-white hover:bg-violet-600 hover:text-white',
                                        range_middle: 'bg-violet-100 text-violet-900',
                                        outside: 'text-stone-300',
                                        today: 'font-semibold text-violet-700',
                                        disabled: 'text-stone-300',
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCalendarRange(undefined)}
                            disabled={!selectedCalendarRange?.from && !selectedCalendarRange?.to}
                        >
                            Clear
                        </Button>
                        {isDateRangeActive && selectedDateRange && (
                            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                                {formatDateWithYear(selectedDateRange.startDate)} -{' '}
                                {formatDateWithYear(selectedDateRange.endDate)}
                            </Badge>
                        )}
                    </div>
                    {isDateRangePending ? (
                        <p className="mt-2 text-xs text-stone-500">
                            Select the check-out date to apply range filtering.
                        </p>
                    ) : (
                        <p className="mt-2 text-xs text-stone-500">
                            {isDateRangeActive
                                ? 'Dashboard metrics and widgets are filtered to the selected range.'
                                : 'Showing all dates. Select a start and end date to filter results.'}
                        </p>
                    )}
                </CardContent>
            </Card>

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
                <InstagramMetricCard
                    label="Views"
                    value={totalViews}
                    change={viewsChange}
                    changeLabel={comparisonLabel}
                    showGlobalValue={isDateRangeActive}
                    globalValue={globalTotalViews}
                    icon={<Eye className="h-5 w-5" />}
                />
                <InstagramMetricCard
                    label="Reach"
                    value={totalReach}
                    change={reachChange}
                    changeLabel={comparisonLabel}
                    showGlobalValue={isDateRangeActive}
                    globalValue={globalTotalReach}
                    icon={<TrendingUp className="h-5 w-5" />}
                />
                <InstagramMetricCard
                    label="Content Interactions"
                    value={totalInteractions}
                    change={interactionsChange}
                    changeLabel={comparisonLabel}
                    showGlobalValue={isDateRangeActive}
                    globalValue={globalTotalInteractions}
                    icon={<MessageSquare className="h-5 w-5" />}
                />
                <InstagramMetricCard
                    label="Follows"
                    value={totalFollows}
                    change={followsChange}
                    changeLabel={comparisonLabel}
                    showGlobalValue={isDateRangeActive}
                    globalValue={globalTotalFollows}
                    icon={<Users className="h-5 w-5" />}
                />
            </div>

            <Card className="border-stone-200">
                <CardContent className="pt-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                        <Badge variant="outline">
                            Channel metrics: {seriesForDisplay.filter((series) => series.points.length > 0).length}
                        </Badge>
                        <Badge variant="outline">Post rows: {postsForDisplay.length}</Badge>
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
                    <Tabs value={postsMode} onValueChange={(next) => setPostsMode(next as 'individual' | 'analytics')}>
                        <TabsList className="bg-stone-100">
                            <TabsTrigger value="individual" className="text-xs">
                                <Grid3X3 className="mr-1 h-3 w-3" />
                                Individual Post Analysis
                            </TabsTrigger>
                            <TabsTrigger value="analytics" className="text-xs">
                                <BarChart3 className="mr-1 h-3 w-3" />
                                Post Widgets & Graphs
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {postsMode === 'analytics' ? (
                        isLoading ? (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-stone-500">
                                    Loading Instagram post analytics...
                                </CardContent>
                            </Card>
                        ) : postsForDisplay.length === 0 ? (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-stone-500">
                                    No posts available for the selected date range.
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <Card className="border-stone-200">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-stone-800">Best by Interactions</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold text-violet-700">
                                                {bestPostTypeByInteractions?.type || 'No data'}
                                            </p>
                                            <p className="text-xs text-stone-500">
                                                {bestPostTypeByInteractions
                                                    ? `${Math.round(bestPostTypeByInteractions.value).toLocaleString()} interactions across ${bestPostTypeByInteractions.count} posts`
                                                    : 'No interaction metrics found.'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-stone-200">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-stone-800">Best by Views</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold text-violet-700">
                                                {bestPostTypeByViews?.type || 'No data'}
                                            </p>
                                            <p className="text-xs text-stone-500">
                                                {bestPostTypeByViews
                                                    ? `${Math.round(bestPostTypeByViews.value).toLocaleString()} views across ${bestPostTypeByViews.count} posts`
                                                    : 'No view metrics found.'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-stone-200">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-stone-800">Best by Reach</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold text-violet-700">
                                                {bestPostTypeByReach?.type || 'No data'}
                                            </p>
                                            <p className="text-xs text-stone-500">
                                                {bestPostTypeByReach
                                                    ? `${Math.round(bestPostTypeByReach.value).toLocaleString()} reach across ${bestPostTypeByReach.count} posts`
                                                    : 'No reach metrics found.'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-medium text-stone-600">Post-type comparison metric</p>
                                    <Select
                                        value={postGrowthMetricKey}
                                        onValueChange={(value) =>
                                            setPostGrowthMetricKey(
                                                value as (typeof POST_TYPE_GROWTH_METRIC_OPTIONS)[number]['value'],
                                            )
                                        }
                                    >
                                        <SelectTrigger className="w-[220px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {POST_TYPE_GROWTH_METRIC_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    <Card className="border-stone-200">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-stone-800">
                                                Post Type {selectedPostGrowthMetricLabel} Growth Over Time
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Cumulative {selectedPostGrowthMetricLabel.toLowerCase()} trend by top post types.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {postTypeGrowthSeries.data.length === 0 ? (
                                                <p className="text-xs text-stone-400">
                                                    Not enough publish-time data for post-type growth comparison.
                                                </p>
                                            ) : (
                                                <div className="h-[260px]">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={postTypeGrowthSeries.data}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#78716C' }} />
                                                            <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                                                            <Tooltip />
                                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                                            {postTypeGrowthSeries.types.map((type, index) => (
                                                                <Line
                                                                    key={type}
                                                                    type="monotone"
                                                                    dataKey={type}
                                                                    stroke={PIE_COLORS[index % PIE_COLORS.length]}
                                                                    strokeWidth={2}
                                                                    dot={false}
                                                                />
                                                            ))}
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card className="border-stone-200">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-stone-800">
                                                Post Type {selectedPostGrowthMetricLabel} Totals
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Ranking of post types for the selected metric in the active date window.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {postTypeMetricTotals.length === 0 ? (
                                                <p className="text-xs text-stone-400">No post-type totals available.</p>
                                            ) : (
                                                <div className="h-[260px]">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={postTypeMetricTotals.slice(0, 8)}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                                            <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#78716C' }} />
                                                            <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
                                                            <Tooltip />
                                                            <Bar dataKey="total" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card className="border-stone-200">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-stone-800">Post Type Distribution</CardTitle>
                                            <CardDescription className="text-xs">
                                                Imported post count split by post type.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {postTypeDistribution.length === 0 ? (
                                                <p className="text-xs text-stone-400">No post type distribution data available.</p>
                                            ) : (
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
                                                                    <Cell
                                                                        key={`${item.type}-${index}`}
                                                                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                                                                    />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card className="border-stone-200">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-stone-800">Top Posts by Interactions</CardTitle>
                                            <CardDescription className="text-xs">
                                                Highest performing individual posts in the active date window.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {topPostsByInteractions.length === 0 ? (
                                                <p className="text-xs text-stone-400">
                                                    No interaction data available for posts.
                                                </p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {topPostsByInteractions.slice(0, 6).map((post) => (
                                                        <div
                                                            key={post.postId}
                                                            className="rounded-md border border-stone-100 bg-stone-50 px-3 py-2"
                                                        >
                                                            <p className="truncate text-xs font-medium text-stone-800">
                                                                {post.title}
                                                            </p>
                                                            <p className="mt-0.5 text-[11px] text-stone-500">
                                                                {normalizePostTypeLabel(post.postType)} ·{' '}
                                                                {(post.metrics.total_interactions || 0).toLocaleString()}{' '}
                                                                interactions
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )
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
                                                            {post.publishTime
                                                                ? formatShortDate(post.publishTime)
                                                                : 'Unknown date'}
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
                                                        {post.publishTime
                                                            ? formatShortDate(post.publishTime)
                                                            : 'Unknown date'}
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
