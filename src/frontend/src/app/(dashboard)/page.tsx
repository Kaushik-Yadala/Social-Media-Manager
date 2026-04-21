'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MetricKPI, ChartCard, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from '@/components/charts/ChartComponents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { channels } from '@/lib/stub-data/channels';
import { mainDashboardWidgets } from '@/lib/stub-data/widgets';
import { WidgetDefinition } from '@/types';
import { useAllChannelsData } from '@/lib/hooks/useAllChannelsData';
import { Users, Eye, TrendingUp, MousePointerClick, Plus, Instagram, Linkedin, MessageCircle, Youtube, ArrowRight, X, Facebook } from 'lucide-react';


const channelIcons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="h-4 w-4" />,
    facebook: <Facebook className="h-4 w-4" />,
    linkedin: <Linkedin className="h-4 w-4" />,
    whatsapp: <MessageCircle className="h-4 w-4" />,
    youtube: <Youtube className="h-4 w-4" />,
};

// ---- Renders widget content based on widget definition ----
function DashboardWidgetContent({
    widget,
    channelStats,
    dashboardSummary,
}: {
    widget: WidgetDefinition;
    channelStats: ReturnType<typeof useAllChannelsData>['channelStats'];
    dashboardSummary: ReturnType<typeof useAllChannelsData>['dashboardSummary'];
}) {
    const totalFollowers = channelStats.reduce((sum, s) => sum + s.followers, 0);
    const totalReach = channelStats.reduce((sum, s) => sum + s.reach, 0);
    const followersChange = dashboardSummary.kpiChanges.followers ?? 0;
    const reachChange    = dashboardSummary.kpiChanges.impressions ?? 0;

    switch (widget.id) {
        case 'w-overview':
            return (
                <div className="p-4">
                    <div className="space-y-2.5">
                        {channels.map(ch => {
                            const score = dashboardSummary.channelHealth[ch.slug] ?? 0;
                            return (
                                <Link key={ch.id} href={`/channels/${ch.slug}`} className="flex items-center gap-3 p-2 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer group">
                                    <div className="flex items-center justify-center h-7 w-7 rounded-lg" style={{ backgroundColor: `${ch.color}15`, color: ch.color }}>
                                        {channelIcons[ch.slug]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-stone-700">{ch.name}</span>
                                            <Badge variant="outline" className={`text-[9px] ${score >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : score >= 60 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                                {score}%
                                            </Badge>
                                        </div>
                                        <div className="mt-1 h-1 rounded-full bg-stone-200 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444' }} />
                                        </div>
                                    </div>
                                    <ArrowRight className="h-3 w-3 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            );
                        })}
                    </div>
                </div>
            );
        case 'w-followers':
            return (
                <div className="p-4 flex flex-col justify-center h-full">
                    <p className="text-2xl font-semibold text-stone-900">{totalFollowers.toLocaleString()}</p>
                    <p className={`text-xs mt-1 ${followersChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {followersChange >= 0 ? '↑' : '↓'} {Math.abs(followersChange).toFixed(1)}% vs last month
                    </p>
                </div>
            );
        case 'w-engagement-trend':
            return (
                <div className="p-3 h-full">
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardSummary.engagementTrend.map(p => ({ date: p.date.slice(8), value: p.value }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                                <Area type="monotone" dataKey="value" stroke="#E5A100" fill="#E5A100" fillOpacity={0.15} strokeWidth={2} name="Engagement" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            );
        case 'w-reach-overview':
            return (
                <div className="p-4 flex flex-col justify-center h-full">
                    <p className="text-2xl font-semibold text-stone-900">{totalReach.toLocaleString()}</p>
                    <p className={`text-xs mt-1 ${reachChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {reachChange >= 0 ? '↑' : '↓'} {Math.abs(reachChange).toFixed(1)}% vs last month
                    </p>
                </div>
            );
        case 'w-top-posts': {
            return (
                <div className="p-3">
                    <div className="space-y-2">
                        {dashboardSummary.topPosts.map((post, i) => (
                            <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-stone-50">
                                <span className="text-[10px] font-bold text-amber-500 w-4">#{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-stone-700 truncate">{post.title}</p>
                                    <p className="text-[9px] text-stone-400">{post.engagement.toLocaleString()} interactions · {post.type}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        case 'w-channel-comparison':
            return (
                <div className="p-3 h-full">
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={channelStats.map(s => ({ channel: s.channel.charAt(0).toUpperCase() + s.channel.slice(1), Followers: s.followers, Engagement: s.engagement }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="channel" tick={{ fontSize: 10, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                                <Bar dataKey="Followers" fill="#E5A100" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Engagement" fill="#4A90D9" radius={[4, 4, 0, 0]} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            );
        default:
            return (
                <div className="p-4 flex flex-col justify-center h-full">
                    <p className="text-[11px] text-stone-400">{widget.description}</p>
                </div>
            );
    }
}

export default function DashboardPage() {
    const [activeWidgets, setActiveWidgets] = useState<WidgetDefinition[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);

    // Live data from backend, falls back to static stubs if unavailable
    const { channelStats, followerGrowthTrend, dashboardSummary, loading } = useAllChannelsData();

    // ── Derived KPIs ─────────────────────────────────────────────────────────
    const totalFollowers    = channelStats.reduce((sum, s) => sum + s.followers, 0);
    const avgEngagement     = (channelStats.reduce((sum, s) => sum + s.engagementRate, 0) / channelStats.length).toFixed(1);
    const totalImpressions  = channelStats.reduce((sum, s) => sum + s.impressions, 0);
    const avgCTR            = (channelStats.reduce((sum, s) => sum + s.ctr, 0) / channelStats.length).toFixed(1);

    // KPI change %s from backend (or stubs)
    const kpi = dashboardSummary.kpiChanges;
    const activeAlerts = dashboardSummary.alerts.filter(a => a.status === 'active').length;

    // Combined follower growth chart data
    const baseGrowthData = followerGrowthTrend[0]?.data ?? [];
    const growthChartData = baseGrowthData.map((point, i) => ({
        date: point.date.slice(5),
        Instagram: followerGrowthTrend[0]?.data[i]?.value ?? 0,
        LinkedIn:  followerGrowthTrend[1]?.data[i]?.value ?? 0,
        WhatsApp:  followerGrowthTrend[2]?.data[i]?.value ?? 0,
        YouTube:   followerGrowthTrend[3]?.data[i]?.value ?? 0,
        Facebook:  followerGrowthTrend[4]?.data[i]?.value ?? 0,
    }));

    const addWidget = (w: WidgetDefinition) => {
        if (!activeWidgets.find(aw => aw.id === w.id)) {
            setActiveWidgets(prev => [...prev, w]);
        }
        setSheetOpen(false);
    };

    const removeWidget = (id: string) => {
        setActiveWidgets(prev => prev.filter(w => w.id !== id));
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-stone-900">Dashboard</h1>
                    <p className="text-sm text-stone-500 mt-1">Welcome back! Here&apos;s your social media overview.</p>
                </div>
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md">
                            <Plus className="mr-2 h-4 w-4" /> Add Widget
                        </Button>
                    </SheetTrigger>
                    <SheetContent className="overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>Widget Catalog</SheetTitle>
                        </SheetHeader>
                        <p className="text-xs text-stone-400 mt-1 mb-4">Select a widget to add to your dashboard.</p>
                        <div className="space-y-2">
                            {mainDashboardWidgets.map(w => {
                                const isActive = !!activeWidgets.find(aw => aw.id === w.id);
                                return (
                                    <button
                                        key={w.id}
                                        onClick={() => addWidget(w)}
                                        disabled={isActive}
                                        className="w-full text-left p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-stone-800">{w.name}</p>
                                                <p className="text-[11px] text-stone-400 mt-0.5">{w.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[9px] shrink-0">{w.chartType}</Badge>
                                                {isActive && <Badge className="text-[9px] bg-emerald-100 text-emerald-700">Added</Badge>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricKPI label="Total Followers"    value={loading ? '…' : totalFollowers}          change={kpi.followers   ?? 0} changeLabel="vs last month" icon={<Users className="h-5 w-5" />} />
                <MetricKPI label="Avg Engagement Rate" value={loading ? '…' : `${avgEngagement}%`}   change={kpi.engagement  ?? 0} changeLabel="vs last month" icon={<TrendingUp className="h-5 w-5" />} />
                <MetricKPI label="Total Impressions"   value={loading ? '…' : totalImpressions}       change={kpi.impressions ?? 0} changeLabel="vs last month" icon={<Eye className="h-5 w-5" />} />
                <MetricKPI label="Avg CTR"             value={loading ? '…' : `${avgCTR}%`}           change={kpi.ctr        ?? 0} changeLabel="vs last month" icon={<MousePointerClick className="h-5 w-5" />} />
            </div>

            {/* Custom Widgets Section */}
            {activeWidgets.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-medium text-stone-700">Custom Widgets</h2>
                        <span className="text-xs text-stone-400">{activeWidgets.length} widget{activeWidgets.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeWidgets.map(w => (
                            <Card key={w.id} className="card-hover relative group min-h-[180px]">
                                <CardHeader className="pb-0 pt-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xs font-medium text-stone-600">{w.name}</CardTitle>
                                        <button
                                            onClick={() => removeWidget(w.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 shadow-sm text-stone-400 hover:text-red-500 hover:bg-red-50"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <DashboardWidgetContent widget={w} channelStats={channelStats} dashboardSummary={dashboardSummary} />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Follower Growth */}
                <ChartCard title="Follower Growth" description="Across all connected channels">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Area type="monotone" dataKey="Instagram" stroke="#E4405F" fill="#E4405F" fillOpacity={0.1} strokeWidth={2} />
                                <Area type="monotone" dataKey="LinkedIn"  stroke="#0A66C2" fill="#0A66C2" fillOpacity={0.1} strokeWidth={2} />
                                <Area type="monotone" dataKey="WhatsApp"  stroke="#25D366" fill="#25D366" fillOpacity={0.1} strokeWidth={2} />
                                <Area type="monotone" dataKey="YouTube"   stroke="#FF0000" fill="#FF0000" fillOpacity={0.1} strokeWidth={2} />
                                <Area type="monotone" dataKey="Facebook"  stroke="#1877F2" fill="#1877F2" fillOpacity={0.1} strokeWidth={2} />
                                <Legend />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Engagement Trend — from backend */}
                <ChartCard title="Engagement Trend" description="Last 30 days combined engagement">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardSummary.engagementTrend.map(p => ({ date: p.date.slice(8), value: p.value }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Area type="monotone" dataKey="value" stroke="#E5A100" fill="#E5A100" fillOpacity={0.15} strokeWidth={2} name="Engagement" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* Channel Health + Active Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Channel Health — computed scores from backend */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-stone-700">Channel Health Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {channels.map(ch => {
                                const liveStats = channelStats.find(s => s.channel === ch.slug);
                                const displayFollowers = liveStats ? liveStats.followers : ch.followers;
                                const score = dashboardSummary.channelHealth[ch.slug] ?? 0;

                                return (
                                    <Link key={ch.id} href={`/channels/${ch.slug}`} className="flex items-center gap-4 p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer group">
                                        <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ backgroundColor: `${ch.color}15`, color: ch.color }}>
                                            {channelIcons[ch.slug]}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-stone-800">{ch.name}</span>
                                                <Badge variant={score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive'} className={score >= 80 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}>
                                                    {score}%
                                                </Badge>
                                            </div>
                                            <div className="mt-1.5 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444' }} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-stone-400">
                                                {loading ? '...' : displayFollowers.toLocaleString()} followers
                                            </span>
                                            <ArrowRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-amber-500 transition-colors" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Active Alerts — from backend */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-stone-700">Active Alerts</CardTitle>
                        <Badge variant="destructive" className="text-xs">{activeAlerts}</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {dashboardSummary.alerts.filter(a => a.status === 'active').slice(0, 4).map(alert => (
                                <Link key={alert.id} href="/alerts" className="flex items-start gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer">
                                    <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                    <div>
                                        <p className="text-xs font-medium text-stone-800">{alert.title}</p>
                                        <p className="text-[10px] text-stone-400 mt-0.5">{alert.channel} · {alert.metric}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Channel Comparison Bar Chart */}
            <ChartCard title="Channel Comparison" description="Key metrics by channel">
                <div className="h-72">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-stone-400 text-sm animate-pulse">Loading live data…</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={channelStats.map(s => ({ channel: s.channel.charAt(0).toUpperCase() + s.channel.slice(1), Followers: s.followers, Engagement: s.engagement, 'Engagement Rate': s.engagementRate * 1000 }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="channel" tick={{ fontSize: 12, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Bar dataKey="Followers" fill="#E5A100" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Engagement" fill="#4A90D9" radius={[4, 4, 0, 0]} />
                                <Legend />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </ChartCard>
        </div>
    );
}
