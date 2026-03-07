import { Competitor } from '@/types';

export const competitors: Competitor[] = [
    {
        id: 'comp-1',
        name: 'ArtHouse Studios',
        handle: '@arthousestudios',
        metrics: {
            facebook: 45200,
            instagram: 38900,
            linkedin: 15400,
            youtube: 8700,
            engagement: 4.2,
            postsPerWeek: 12,
            growth: 6.1,
        },
        growthTrend: [
            { date: '2026-01-01', value: 35800 },
            { date: '2026-01-15', value: 36400 },
            { date: '2026-02-01', value: 37200 },
            { date: '2026-02-15', value: 38000 },
            { date: '2026-03-01', value: 38900 },
        ],
    },
    {
        id: 'comp-2',
        name: 'Creative Collective',
        handle: '@creativecollective',
        metrics: {
            facebook: 32100,
            instagram: 26500,
            linkedin: 9800,
            youtube: 5200,
            engagement: 3.8,
            postsPerWeek: 8,
            growth: 4.5,
        },
        growthTrend: [
            { date: '2026-01-01', value: 24500 },
            { date: '2026-01-15', value: 25000 },
            { date: '2026-02-01', value: 25400 },
            { date: '2026-02-15', value: 25900 },
            { date: '2026-03-01', value: 26500 },
        ],
    },
    {
        id: 'comp-3',
        name: 'Design & Beyond',
        handle: '@designandbeyond',
        metrics: {
            facebook: 52800,
            instagram: 44300,
            linkedin: 22100,
            youtube: 14600,
            engagement: 5.1,
            postsPerWeek: 15,
            growth: 7.3,
        },
        growthTrend: [
            { date: '2026-01-01', value: 40200 },
            { date: '2026-01-15', value: 41100 },
            { date: '2026-02-01', value: 42300 },
            { date: '2026-02-15', value: 43200 },
            { date: '2026-03-01', value: 44300 },
        ],
    },
];
