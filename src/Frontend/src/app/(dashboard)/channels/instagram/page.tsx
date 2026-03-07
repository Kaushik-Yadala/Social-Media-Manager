'use client';

import { ChannelDashboard } from '@/components/channel/ChannelDashboard';
import { Instagram } from 'lucide-react';

export default function InstagramPage() {
    return (
        <ChannelDashboard
            channel="instagram"
            channelName="Instagram"
            channelColor="#E4405F"
            channelIcon={<Instagram className="h-5 w-5" />}
        />
    );
}
