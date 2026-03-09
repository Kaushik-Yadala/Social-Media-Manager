import { TrendingTopic, SuggestedAction, TimeSeries } from '@/types';

export const trendingTopics: TrendingTopic[] = [
    { id: 'tr-1', category: 'Design', topic: 'AI-Generated Art Collaborations', change: 280, confidence: 92, signal: 'rising' },
    { id: 'tr-2', category: 'Community', topic: 'Artist Residency Programs', change: 145, confidence: 85, signal: 'rising' },
    { id: 'tr-3', category: 'Content', topic: 'Behind-the-Scenes Studio Tours', change: 89, confidence: 78, signal: 'steady' },
    { id: 'tr-4', category: 'Marketing', topic: 'Sustainable Art Materials', change: 67, confidence: 71, signal: 'emerging' },
    { id: 'tr-5', category: 'Events', topic: 'Virtual Gallery Openings', change: 52, confidence: 65, signal: 'steady' },
    { id: 'tr-6', category: 'Tech', topic: 'NFT Art Marketplace Updates', change: 34, confidence: 58, signal: 'emerging' },
];

export const suggestedActions: SuggestedAction[] = [
    { id: 'sa-1', priority: 'high', title: 'Launch AI Art Collaboration Series', description: 'Create a weekly Instagram Reel series showcasing AI-art collaborations. Trending topic with 280% growth.', channel: 'instagram', expectedImpact: '+45% Reel engagement' },
    { id: 'sa-2', priority: 'high', title: 'Promote Residency Program on LinkedIn', description: 'Publish an article about your artist residency program. High professional interest detected.', channel: 'linkedin', expectedImpact: '+30% article reach' },
    { id: 'sa-3', priority: 'medium', title: 'BTS Studio Tour Campaign', description: 'Send a WhatsApp broadcast template with studio tour highlights and booking link.', channel: 'whatsapp', expectedImpact: '+25% open rate' },
    { id: 'sa-4', priority: 'medium', title: 'Sustainable Materials Spotlight', description: 'Feature sustainable art materials in Instagram Stories with polls.', channel: 'instagram', expectedImpact: '+20% story engagement' },
    { id: 'sa-5', priority: 'low', title: 'Virtual Gallery LinkedIn Event', description: 'Create a LinkedIn Event for your next virtual gallery opening.', channel: 'linkedin', expectedImpact: '+15% event registrations' },
    { id: 'sa-6', priority: 'high', title: 'Launch YouTube Shorts Series', description: 'Start a weekly YouTube Shorts series showcasing 60-second art tutorials. Shorts are driving 3x subscriber growth.', channel: 'youtube', expectedImpact: '+60% subscriber growth' },
    { id: 'sa-7', priority: 'medium', title: 'YouTube Community Post Poll', description: 'Use YouTube Community posts to poll your audience on next video topics. Boosts engagement and retention.', channel: 'youtube', expectedImpact: '+20% avg view duration' },
];

export const trendGrowthTrajectory: TimeSeries[] = [
    { label: 'AI Art Collaborations', color: '#E5A100', data: [{ date: '2026-01', value: 12 }, { date: '2026-02', value: 28 }, { date: '2026-03', value: 45 }, { date: '2026-04', value: 72 }, { date: '2026-05', value: 95 }] },
    { label: 'Artist Residencies', color: '#C75B39', data: [{ date: '2026-01', value: 18 }, { date: '2026-02', value: 25 }, { date: '2026-03', value: 38 }, { date: '2026-04', value: 52 }, { date: '2026-05', value: 68 }] },
    { label: 'Studio Tours', color: '#4A90D9', data: [{ date: '2026-01', value: 22 }, { date: '2026-02', value: 30 }, { date: '2026-03', value: 35 }, { date: '2026-04', value: 42 }, { date: '2026-05', value: 48 }] },
];
