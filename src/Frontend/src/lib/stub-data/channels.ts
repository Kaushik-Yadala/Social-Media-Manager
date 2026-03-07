import { Channel } from '@/types';

export const channels: Channel[] = [
    {
        id: 'ch-ig',
        slug: 'instagram',
        name: 'Instagram',
        icon: 'Instagram',
        color: '#E4405F',
        isConnected: true,
        followers: 28400,
        healthScore: 87,
        lastSynced: '2026-03-04T18:30:00Z',
    },
    {
        id: 'ch-li',
        slug: 'linkedin',
        name: 'LinkedIn',
        icon: 'Linkedin',
        color: '#0A66C2',
        isConnected: true,
        followers: 12300,
        healthScore: 74,
        lastSynced: '2026-03-04T18:25:00Z',
    },
    {
        id: 'ch-wa',
        slug: 'whatsapp',
        name: 'WhatsApp',
        icon: 'MessageCircle',
        color: '#25D366',
        isConnected: true,
        followers: 5200,
        healthScore: 92,
        lastSynced: '2026-03-04T18:28:00Z',
    },
];
