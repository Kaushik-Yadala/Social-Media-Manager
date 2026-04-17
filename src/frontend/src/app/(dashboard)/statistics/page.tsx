'use client';

import { useState } from 'react';
import { MetricKPI, ChartCard, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from '@/components/charts/ChartComponents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { geographyData, ageData } from '@/lib/stub-data/statistics';
import { useAllChannelsData } from '@/lib/hooks/useAllChannelsData';
import { PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Eye, MousePointerClick } from 'lucide-react';

const COLORS = ['#E5A100', '#4A90D9', '#50B88C', '#9B6AD4', '#C75B39', '#3AAFA9'];

export default function StatisticsPage() {
    const [selectedChannel, setSelectedChannel] = useState<string>('all');
    const [dataType, setDataType] = useState<'all' | 'paid' | 'organic'>('all');

    // Live data from stub server, falls back to static stubs if unavailable
    const { channelStats, followerGrowthTrend, loading } = useAllChannelsData();

    const stats = selectedChannel === 'all'
        ? {
            followers: channelStats.reduce((s, c) => s + c.followers, 0),
            followerGrowth: (channelStats.reduce((s, c) => s + c.followerGrowth, 0) / channelStats.length),
            engagement: channelStats.reduce((s, c) => s + c.engagement, 0),
            engagementRate: (channelStats.reduce((s, c) => s + c.engagementRate, 0) / channelStats.length),
            impressions: channelStats.reduce((s, c) => s + c.impressions, 0),
            reach: channelStats.reduce((s, c) => s + c.reach, 0),
            ctr: (channelStats.reduce((s, c) => s + c.ctr, 0) / channelStats.length),
        }
        : channelStats.find(c => c.channel === selectedChannel)!;

    const growthIdx = selectedChannel === 'all' ? -1 : ['instagram', 'linkedin', 'whatsapp', 'youtube'].indexOf(selectedChannel);
    const growthData = selectedChannel === 'all'
        ? followerGrowthTrend[0].data.map((p, i) => ({ date: p.date.slice(5), Instagram: followerGrowthTrend[0].data[i].value, LinkedIn: followerGrowthTrend[1].data[i].value, WhatsApp: followerGrowthTrend[2].data[i].value, YouTube: followerGrowthTrend[3].data[i].value }))
        : followerGrowthTrend[growthIdx].data.map(p => ({ date: p.date.slice(5), [followerGrowthTrend[growthIdx].label]: p.value }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-stone-900">Statistics</h1>
                    <p className="text-sm text-stone-500 mt-1">Detailed performance metrics across your channels.</p>
                </div>
                <div className="flex gap-2">
                    <Tabs value={selectedChannel} onValueChange={setSelectedChannel}>
                        <TabsList className="bg-stone-100">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="instagram">Instagram</TabsTrigger>
                            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                            <TabsTrigger value="youtube">YouTube</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Tabs value={dataType} onValueChange={(v) => setDataType(v as 'all' | 'paid' | 'organic')}>
                        <TabsList className="bg-stone-100">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="paid">Paid</TabsTrigger>
                            <TabsTrigger value="organic">Organic</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricKPI label="Followers" value={loading ? '…' : stats.followers} change={stats.followerGrowth} changeLabel="growth" icon={<Users className="h-5 w-5" />} />
                <MetricKPI label="Engagement Rate" value={loading ? '…' : `${stats.engagementRate.toFixed(1)}%`} change={1.2} icon={<TrendingUp className="h-5 w-5" />} />
                <MetricKPI label="Total Impressions" value={loading ? '…' : stats.impressions} change={8.5} icon={<Eye className="h-5 w-5" />} />
                <MetricKPI label="CTR" value={loading ? '…' : `${stats.ctr.toFixed(1)}%`} change={-0.2} icon={<MousePointerClick className="h-5 w-5" />} />
            </div>

            {/* Follower Growth Chart */}
            <ChartCard title="Follower Growth" description="Growth trend over the past 3 months">
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={growthData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716C' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                            {selectedChannel === 'all' ? (
                                <>
                                    <Area type="monotone" dataKey="Instagram" stroke="#E4405F" fill="#E4405F" fillOpacity={0.1} strokeWidth={2} />
                                    <Area type="monotone" dataKey="LinkedIn" stroke="#0A66C2" fill="#0A66C2" fillOpacity={0.1} strokeWidth={2} />
                                    <Area type="monotone" dataKey="WhatsApp" stroke="#25D366" fill="#25D366" fillOpacity={0.1} strokeWidth={2} />
                                    <Area type="monotone" dataKey="YouTube" stroke="#FF0000" fill="#FF0000" fillOpacity={0.1} strokeWidth={2} />
                                </>
                            ) : (
                                <Area type="monotone" dataKey={followerGrowthTrend[growthIdx].label} stroke={followerGrowthTrend[growthIdx].color} fill={followerGrowthTrend[growthIdx].color} fillOpacity={0.15} strokeWidth={2} />
                            )}
                            <Legend />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            {/* Demographics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Geography */}
                <ChartCard title="Audience by Country" description="Top countries by follower count">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={geographyData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#78716C' }} />
                                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#78716C' }} width={80} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Bar dataKey="value" fill="#E5A100" radius={[0, 4, 4, 0]} name="Followers" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Age Distribution */}
                <ChartCard title="Age Distribution" description="Follower age groups">
                    <div className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                <Pie data={ageData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="label" label={(props: any) => `${props.name || ''} (${((props.percent || 0) * 100).toFixed(0)}%)`} labelLine={{ stroke: '#A8A29E', strokeWidth: 1 }}>
                                    {ageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>
        </div>
    );
}
