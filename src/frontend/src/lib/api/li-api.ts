const BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000';

export interface LIDemographicData {
    category: string;
    value: string;
    follower_count: number;
    percentage: number;
}

export interface LIFollowerDemographics {
    total_followers: number;
    demographics: LIDemographicData[];
}

export interface LIPostPerformance {
    date: string;
    post_id: string;
    post_type: string;
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    engagement_rate: number;
}

export interface LIPostResponse {
    posts: LIPostPerformance[];
}

export interface LIPageTraffic {
    date: string;
    page_views: number;
    unique_visitors: number;
    custom_button_clicks: number;
}

export interface LIPageTrafficResponse {
    traffic_data: LIPageTraffic[];
}

export interface LIOverview {
    total_followers: number;
    new_followers: number;
    total_page_views: number;
    total_post_impressions: number;
    avg_engagement_rate: number;
}

class LinkedInAPIError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'LinkedInAPIError';
    }
}

async function fetchLI<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}/api/li${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new LinkedInAPIError(`API Error: ${response.statusText}`, response.status);
    }

    return response.json();
}

/** Get LinkedIn Follower Demographics */
export async function getLIDemographics() {
    try {
        return await fetchLI<LIFollowerDemographics>('/demographics');
    } catch (e) {
        console.warn('getLIDemographics: falling back to stubs —', (e as Error).message);
        return {
            total_followers: 12300,
            demographics: [
                { category: 'Geography', value: 'North America', follower_count: 5000, percentage: 40.6 },
                { category: 'Industry', value: 'Tech', follower_count: 8000, percentage: 65.0 },
            ],
        };
    }
}

/** Get LinkedIn Post Performance */
export async function getLIPostsPerformance(startDate: string, endDate: string) {
    try {
        return await fetchLI<LIPostResponse>('/posts', { start_date: startDate, end_date: endDate });
    } catch (e) {
        console.warn('getLIPostsPerformance: falling back to stubs —', (e as Error).message);
        return {
            posts: [
                {
                    date: '2026-03-01', post_id: 'li-1', post_type: 'Article', reach: 45000,
                    impressions: 55000, likes: 800, comments: 120, shares: 350, clicks: 1200, engagement_rate: 5.2,
                },
            ],
        };
    }
}

/** Get LinkedIn Page Traffic */
export async function getLIPageTraffic(startDate: string, endDate: string) {
    try {
        return await fetchLI<LIPageTrafficResponse>('/page-traffic', { start_date: startDate, end_date: endDate });
    } catch (e) {
        console.warn('getLIPageTraffic: falling back to stubs —', (e as Error).message);
        return {
            traffic_data: [
                { date: '2026-03-01', page_views: 4500, unique_visitors: 3200, custom_button_clicks: 15 },
            ],
        };
    }
}

/** Get LinkedIn Header Overview */
export async function getLIOverview(startDate: string, endDate: string) {
    try {
        return await fetchLI<LIOverview>('/overview', { start_date: startDate, end_date: endDate });
    } catch (e) {
        console.warn('getLIOverview: falling back to stubs —', (e as Error).message);
        return {
            total_followers: 12300, new_followers: 350,
            total_page_views: 4500, total_post_impressions: 87000,
            avg_engagement_rate: 3.2,
        };
    }
}

