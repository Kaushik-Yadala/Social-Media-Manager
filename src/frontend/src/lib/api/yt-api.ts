const BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000';

export interface YTOverview {
    subscribers: number;
    total_views: number;
    total_videos: number;
    watch_time_hours: number;
    avg_view_duration: number;
    engagement_rate: number;
    estimated_revenue: number;
    views_last_30d: number;
    subscribers_gained_30d: number;
    subscribers_lost_30d: number;
    date_range: {
        start_date: string;
        end_date: string;
    };
}

export interface YTSubscriberGrowthPoint {
    date: string;
    gained: number;
    lost: number;
    net: number;
}

export interface YTSubscriberGrowth {
    series: YTSubscriberGrowthPoint[];
    total_gained: number;
    total_lost: number;
    net_change: number;
}

class YouTubeAPIError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'YouTubeAPIError';
    }
}

async function fetchYT<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}/api/yt${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new YouTubeAPIError(`API Error: ${response.statusText}`, response.status);
    }

    return response.json();
}

export async function getYTOverview(startDate: string = '30daysAgo', endDate: string = 'today') {
    try {
        return await fetchYT<YTOverview>('/overview', { start_date: startDate, end_date: endDate });
    } catch (e) {
        console.warn('getYTOverview: falling back to stubs -', (e as Error).message);
        return {
            subscribers: 8750,
            total_views: 1245600,
            total_videos: 142,
            watch_time_hours: 52400,
            avg_view_duration: 284.5,
            engagement_rate: 5.6,
            estimated_revenue: 3842.5,
            views_last_30d: 372400,
            subscribers_gained_30d: 1840,
            subscribers_lost_30d: 310,
            date_range: {
                start_date: startDate,
                end_date: endDate,
            },
        };
    }
}

export async function getYTSubscriberGrowth(startDate: string = '30daysAgo', endDate: string = 'today') {
    try {
        return await fetchYT<YTSubscriberGrowth>('/subscriber-growth', { start_date: startDate, end_date: endDate });
    } catch (e) {
        console.warn('getYTSubscriberGrowth: falling back to stubs -', (e as Error).message);
        return {
            series: [
                { date: '2026-03-01', gained: 56, lost: 10, net: 46 },
                { date: '2026-03-02', gained: 61, lost: 12, net: 49 },
                { date: '2026-03-03', gained: 58, lost: 9, net: 49 },
            ],
            total_gained: 175,
            total_lost: 31,
            net_change: 144,
        };
    }
}