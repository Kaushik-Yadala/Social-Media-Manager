'use client';

import { ChartCard, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from '@/components/charts/ChartComponents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { heatmapData } from '@/lib/stub-data/analytics';
import { useState } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Lightbulb, Clock, TrendingUp, Youtube, Facebook, Instagram, Wifi, WifiOff } from 'lucide-react';
import { useAllChannelsData } from '@/lib/hooks/useAllChannelsData';
import { useChannelAnalytics } from '@/lib/hooks/useChannelAnalytics';

// ── Static recommendations ────────────────────────────────────────────────────
// These are content-strategy recommendations that don't depend on live data.
// TODO: when a recommendations API is available, replace this with a hook call.
const RECOMMENDATIONS = [
    { icon: <Clock className="h-4 w-4" />,       text: 'Post Reels between 6–7 PM on Saturdays for maximum engagement (top day from current data).' },
    { icon: <TrendingUp className="h-4 w-4" />,   text: 'Carousel posts drive 2× more saves than single image posts. Increase carousel frequency.' },
    { icon: <Lightbulb className="h-4 w-4" />,   text: 'LinkedIn Articles outperform regular posts by 80% in CTR. Aim for 2 articles per month.' },
    { icon: <Youtube className="h-4 w-4" />,     text: 'YouTube Shorts drive 3× more subscriber growth than long-form. Publish 3–4 Shorts per week.' },
    { icon: <Facebook className="h-4 w-4" />,    text: 'Facebook Reels receive 58% more reach than static posts. Prioritise short video content.' },
    { icon: <Instagram className="h-4 w-4" />,   text: 'Stories with polls get 3× more profile visits. Add an interactive element to every story series.' },
];

// ── Heatmap config ────────────────────────────────────────────────────────────
const HEATMAP_DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_HOURS = Array.from({ length: 12 }, (_, i) => i * 2);

export default function AnalyticsPage() {
    const [metric, setMetric] = useState<'reach' | 'comments' | 'shares' | 'engagement'>('reach');

    // ── Live channel-level data (CSV-backed for IG/FB/LI) ────────────────────
    const { channelStats, loading: channelLoading } = useAllChannelsData();

    // ── Analytics data: post types, posting times, spider chart ──────────────
    // useChannelAnalytics accepts live channelStats so spider scores are always
    // computed from the freshest data available.
    const {
        postTypePerformance,
        optimalPostingTimes,
        spiderChartData,
        loading: analyticsLoading,
        livePostTypes,
        livePostingTimes,
        liveSpider,
    } = useChannelAnalytics(channelStats);

    const loading = channelLoading || analyticsLoading;

    // ── Bar chart data ────────────────────────────────────────────────────────
    const barData = postTypePerformance.map(p => ({
        type: p.type,
        value: metric === 'reach'      ? p.reach
             : metric === 'comments'  ? p.comments
             : metric === 'shares'    ? p.shares
             : p.engagement,
    }));

    // ── Source chip helper ────────────────────────────────────────────────────
    function SourceChip({ live, label }: { live: boolean; label: string }) {
        return (
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                live
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-stone-100 text-stone-500 border-stone-200'
            }`}>
                {live ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
                {live ? `Live${label ? ' · ' + label : ''}` : 'Stub data'}
            </span>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-stone-900">Analytics</h1>
                    <p className="text-sm text-stone-500 mt-1">Deep-dive into your content performance and audience behaviour.</p>
                </div>
                {loading && (
                    <span className="text-xs text-stone-400 animate-pulse">Loading live data…</span>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Post / Content Type Performance ───────────────────────── */}
                <ChartCard
                    title="Content Performance by Type"
                    description={
                        <span className="flex items-center gap-2">
                            Reach, engagement, comments & shares per content type
                            <SourceChip live={livePostTypes} label={livePostTypes ? 'IG API + LI API' : ''} />
                        </span>
                    }
                >
                    <div className="mb-3">
                        <Tabs value={metric} onValueChange={v => setMetric(v as typeof metric)}>
                            <TabsList className="bg-stone-100 h-8">
                                <TabsTrigger value="reach"      className="text-xs">Reach</TabsTrigger>
                                <TabsTrigger value="comments"   className="text-xs">Comments</TabsTrigger>
                                <TabsTrigger value="shares"     className="text-xs">Shares</TabsTrigger>
                                <TabsTrigger value="engagement" className="text-xs">Engagement %</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="type" tick={{ fontSize: 9, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Bar dataKey="value" fill="#E5A100" radius={[4, 4, 0, 0]} name={metric} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* ── Optimal Posting Times ──────────────────────────────────── */}
                <ChartCard
                    title="Optimal Posting Times"
                    description={
                        <span className="flex items-center gap-2">
                            Best performing posting days this period
                            <SourceChip live={livePostingTimes} label={livePostingTimes ? 'IG engagement series' : ''} />
                        </span>
                    }
                >
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={optimalPostingTimes.map(t => ({
                                label: `${t.day.slice(0, 3)} ${String(t.hour).padStart(2, '0')}:00`,
                                engagement: t.engagement,
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} domain={[0, 'auto']} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Bar dataKey="engagement" fill="#4A90D9" radius={[4, 4, 0, 0]} name="Engagement %" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {(() => {
                        const best = [...optimalPostingTimes].sort((a, b) => b.engagement - a.engagement)[0];
                        return best ? (
                            <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                                <p className="text-xs text-amber-800 font-medium">
                                    🌟 Best time: {best.day} at {String(best.hour).padStart(2, '0')}:00
                                    — {best.engagement}% engagement {livePostingTimes ? '(from your live data)' : '(estimated)'}
                                </p>
                            </div>
                        ) : null;
                    })()}
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Multi-Channel Radar ────────────────────────────────────── */}
                <ChartCard
                    title="Multi-Channel Performance Radar"
                    description={
                        <span className="flex items-center gap-2">
                            Scores computed relative to each channel&apos;s own live metrics (0 = lowest, 100 = highest across your channels)
                            <SourceChip live={liveSpider} label={liveSpider ? 'live channelStats' : ''} />
                        </span>
                    }
                >
                    {spiderChartData.length === 0 ? (
                        <div className="h-72 flex items-center justify-center text-stone-400 text-sm animate-pulse">
                            Computing scores from live data…
                        </div>
                    ) : (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={spiderChartData}>
                                    <PolarGrid stroke="#E7E5E4" />
                                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#78716C' }} />
                                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#A8A29E' }} />
                                    <Radar name="Instagram" dataKey="instagram" stroke="#E4405F" fill="#E4405F" fillOpacity={0.15} strokeWidth={2} />
                                    <Radar name="Facebook"  dataKey="facebook"  stroke="#1877F2" fill="#1877F2" fillOpacity={0.12} strokeWidth={2} />
                                    <Radar name="LinkedIn"  dataKey="linkedin"  stroke="#0A66C2" fill="#0A66C2" fillOpacity={0.15} strokeWidth={2} />
                                    <Radar name="WhatsApp"  dataKey="whatsapp"  stroke="#25D366" fill="#25D366" fillOpacity={0.15} strokeWidth={2} />
                                    <Radar name="YouTube"   dataKey="youtube"   stroke="#FF0000" fill="#FF0000" fillOpacity={0.15} strokeWidth={2} />
                                    <Legend />
                                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    {liveSpider && (
                        <p className="mt-2 text-[10px] text-stone-400 text-center">
                            Scores are relative — 100 = your best-performing channel on that dimension.
                        </p>
                    )}
                </ChartCard>

                {/* ── Engagement Heatmap ─────────────────────────────────────── */}
                <ChartCard
                    title="Engagement Heatmap"
                    description={
                        <span className="flex items-center gap-2">
                            Activity intensity by day and time
                            <SourceChip live={false} label="" />
                        </span>
                    }
                >
                    <div className="overflow-x-auto">
                        <div className="min-w-[400px]">
                            <div className="grid grid-cols-[40px_repeat(12,1fr)] gap-0.5">
                                <div />
                                {HEATMAP_HOURS.map(h => (
                                    <div key={h} className="text-[9px] text-stone-400 text-center">{h}:00</div>
                                ))}
                                {HEATMAP_DAYS.map(day => (
                                    <div key={day} className="contents">
                                        <div className="text-[10px] text-stone-500 flex items-center">{day}</div>
                                        {HEATMAP_HOURS.map(h => {
                                            const val = heatmapData.find(c => c.day === day && c.hour === h)?.value ?? 0;
                                            const opacity = Math.max(0.08, val / 100);
                                            return (
                                                <div
                                                    key={`${day}-${h}`}
                                                    className="h-6 rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-amber-400"
                                                    style={{ backgroundColor: `rgba(229, 161, 0, ${opacity})` }}
                                                    title={`${day} ${h}:00 — ${val}% engagement`}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-2 justify-end">
                                <span className="text-[9px] text-stone-400">Low</span>
                                <div className="flex gap-0.5">
                                    {[0.1, 0.25, 0.45, 0.65, 0.85].map(o => (
                                        <div key={o} className="w-4 h-2 rounded-sm" style={{ backgroundColor: `rgba(229, 161, 0, ${o})` }} />
                                    ))}
                                </div>
                                <span className="text-[9px] text-stone-400">High</span>
                            </div>
                        </div>
                    </div>
                </ChartCard>

            </div>

            {/* ── Recommendations ───────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-stone-700 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Actionable Recommendations
                        <Badge className="text-[9px] bg-stone-100 text-stone-500 font-normal">Strategy-based · updated as APIs provide more signals</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {RECOMMENDATIONS.map((rec, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-stone-50">
                                <div className="mt-0.5 text-amber-600 shrink-0">{rec.icon}</div>
                                <p className="text-sm text-stone-700">{rec.text}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
