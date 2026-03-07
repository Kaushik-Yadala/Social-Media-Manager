'use client';

import { ChannelDashboard } from '@/components/channel/ChannelDashboard';
import { Linkedin } from 'lucide-react';

export default function LinkedInPage() {
    return (
        <ChannelDashboard
            channel="linkedin"
            channelName="LinkedIn"
            channelColor="#0A66C2"
            channelIcon={<Linkedin className="h-5 w-5" />}
        />
    );
}
