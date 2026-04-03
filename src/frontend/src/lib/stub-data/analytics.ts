import { PostTypePerformance, OptimalPostingTime, HeatmapCell } from '@/types';

export const postTypePerformance: PostTypePerformance[] = [
    { type: 'Reel', reach: 45000, comments: 890, shares: 1200, engagement: 5.2 },
    { type: 'Carousel', reach: 32000, comments: 620, shares: 450, engagement: 4.1 },
    { type: 'Feed Post', reach: 28000, comments: 340, shares: 280, engagement: 3.5 },
    { type: 'Story', reach: 18000, comments: 0, shares: 120, engagement: 2.8 },
    { type: 'Article', reach: 12000, comments: 180, shares: 340, engagement: 3.9 },
];

export const optimalPostingTimes: OptimalPostingTime[] = [
    { hour: 9, day: 'Monday', engagement: 4.2 },
    { hour: 12, day: 'Tuesday', engagement: 5.1 },
    { hour: 18, day: 'Wednesday', engagement: 6.3 },
    { hour: 10, day: 'Thursday', engagement: 4.8 },
    { hour: 14, day: 'Friday', engagement: 5.5 },
    { hour: 11, day: 'Saturday', engagement: 7.2 },
    { hour: 16, day: 'Sunday', engagement: 4.0 },
];

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const heatmapData: HeatmapCell[] = days.flatMap(day =>
    Array.from({ length: 24 }, (_, hour) => ({
        day,
        hour,
        value: Math.floor(Math.random() * 100),
    }))
);

export const spiderChartData = [
    { metric: 'Reach', instagram: 85, linkedin: 60, whatsapp: 40 },
    { metric: 'Engagement', instagram: 78, linkedin: 55, whatsapp: 92 },
    { metric: 'Growth', instagram: 65, linkedin: 48, whatsapp: 88 },
    { metric: 'Content Quality', instagram: 90, linkedin: 75, whatsapp: 60 },
    { metric: 'Response Time', instagram: 45, linkedin: 50, whatsapp: 95 },
    { metric: 'Conversion', instagram: 55, linkedin: 70, whatsapp: 82 },
];
