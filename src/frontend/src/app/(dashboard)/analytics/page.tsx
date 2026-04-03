'use client';

import { ChartCard, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from '@/components/charts/ChartComponents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { postTypePerformance, optimalPostingTimes, spiderChartData, heatmapData } from '@/lib/stub-data/analytics';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Lightbulb, Clock, TrendingUp } from 'lucide-react';
import { getLIPostsPerformance, getLIDemographics, LIPostPerformance } from '@/lib/api/li-api';

const recommendations = [
    { icon: <Clock className="h-4 w-4" />, text: 'Post Reels between 6-7 PM on Saturdays for maximum engagement (7.2% avg).' },
    { icon: <TrendingUp className="h-4 w-4" />, text: 'Carousel posts drive 2x more saves than single image posts. Increase carousel frequency.' },
    { icon: <Lightbulb className="h-4 w-4" />, text: 'LinkedIn Articles outperform regular posts by 80% in CTR. Aim for 2 articles per month.' },
];

export default function AnalyticsPage() {
    const [metric, setMetric] = useState<string>('reach');
    const [liPosts, setLiPosts] = useState<LIPostPerformance[] | null>(null);

    useEffect(() => {
        const fetchLI = async () => {
            try {
                // Fetch default last 30 days
                const res = await getLIPostsPerformance('30daysAgo', 'today');
                setLiPosts(res.posts);
            } catch (err) {
                console.error("Failed to fetch LinkedIn posts", err);
            }
        };
        fetchLI();
    }, []);

    // Merge LinkedIn stats if they exist, else default to stub 
    const isLIAvailable = liPosts && liPosts.length > 0;

    // Using live API data if available for the Bar Chart
    const barData = isLIAvailable ?
        liPosts.map(p => ({
            type: p.post_type,
            value: metric === 'reach' ? p.reach : metric === 'comments' ? p.comments : metric === 'shares' ? p.shares : p.engagement_rate,
        })) :
        postTypePerformance.map(p => ({
            type: p.type,
            value: metric === 'reach' ? p.reach : metric === 'comments' ? p.comments : metric === 'shares' ? p.shares : p.engagement,
        }));

    // Heatmap: 7 days x 24 hours — simplified as a grid
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 12 }, (_, i) => i * 2); // show every 2 hours

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-heading font-bold text-stone-900">Analytics</h1>
                <p className="text-sm text-stone-500 mt-1">Deep-dive into your content performance and audience behavior.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Post Type Performance */}
                <ChartCard title="Content Performance by Type">
                    <div className="mb-3">
                        <Tabs value={metric} onValueChange={setMetric}>
                            <TabsList className="bg-stone-100 h-8">
                                <TabsTrigger value="reach" className="text-xs">Reach</TabsTrigger>
                                <TabsTrigger value="comments" className="text-xs">Comments</TabsTrigger>
                                <TabsTrigger value="shares" className="text-xs">Shares</TabsTrigger>
                                <TabsTrigger value="engagement" className="text-xs">Engagement</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Bar dataKey="value" fill="#E5A100" radius={[4, 4, 0, 0]} name={metric} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Optimal Posting Times */}
                <ChartCard title="Optimal Posting Times" description="Best performing posting times this quarter">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={optimalPostingTimes.map(t => ({ label: `${t.day.slice(0, 3)} ${t.hour}:00`, engagement: t.engagement }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} domain={[0, 10]} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Bar dataKey="engagement" fill="#4A90D9" radius={[4, 4, 0, 0]} name="Engagement %" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs text-amber-800 font-medium">🌟 Best Time: Saturday at 11:00 AM — 7.2% engagement rate</p>
                    </div>
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Channel Radar */}
                <ChartCard title="Multi-Channel Performance Radar" description="Comparing key dimensions across channels">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={spiderChartData}>
                                <PolarGrid stroke="#E7E5E4" />
                                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#78716C' }} />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#A8A29E' }} />
                                <Radar name="Instagram" dataKey="instagram" stroke="#E4405F" fill="#E4405F" fillOpacity={0.15} strokeWidth={2} />
                                <Radar name="LinkedIn" dataKey="linkedin" stroke="#0A66C2" fill="#0A66C2" fillOpacity={0.15} strokeWidth={2} />
                                <Radar name="WhatsApp" dataKey="whatsapp" stroke="#25D366" fill="#25D366" fillOpacity={0.15} strokeWidth={2} />
                                <Legend />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Heatmap */}
                <ChartCard title="Engagement Heatmap" description="Activity intensity by day and time">
                    <div className="overflow-x-auto">
                        <div className="min-w-[400px]">
                            <div className="grid grid-cols-[40px_repeat(12,1fr)] gap-0.5">
                                <div />
                                {hours.map(h => <div key={h} className="text-[9px] text-stone-400 text-center">{h}:00</div>)}
                                {days.map(day => (
                                    <>
                                        <div key={`label-${day}`} className="text-[10px] text-stone-500 flex items-center">{day}</div>
                                        {hours.map(h => {
                                            const val = heatmapData.find(c => c.day === day && c.hour === h)?.value || 0;
                                            const opacity = Math.max(0.08, val / 100);
                                            return <div key={`${day}-${h}`} className="h-6 rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-amber-400" style={{ backgroundColor: `rgba(229, 161, 0, ${opacity})` }} title={`${day} ${h}:00 — ${val}% engagement`} />;
                                        })}
                                    </>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-2 justify-end">
                                <span className="text-[9px] text-stone-400">Low</span>
                                <div className="flex gap-0.5">
                                    {[0.1, 0.25, 0.45, 0.65, 0.85].map(o => <div key={o} className="w-4 h-2 rounded-sm" style={{ backgroundColor: `rgba(229, 161, 0, ${o})` }} />)}
                                </div>
                                <span className="text-[9px] text-stone-400">High</span>
                            </div>
                        </div>
                    </div>
                </ChartCard>
            </div>

            {/* Recommendations */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-stone-700 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" /> Actionable Recommendations
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-stone-50">
                                <div className="mt-0.5 text-amber-600">{rec.icon}</div>
                                <p className="text-sm text-stone-700">{rec.text}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
