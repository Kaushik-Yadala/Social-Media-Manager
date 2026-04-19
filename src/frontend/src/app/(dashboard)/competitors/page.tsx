'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartCard, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from '@/components/charts/ChartComponents';
import { competitors, CLUB_ARTIZEN_STUB } from '@/lib/stub-data/competitors';
import { useAllChannelsData } from '@/lib/hooks/useAllChannelsData';
import { Plus, Award, Wifi, WifiOff } from 'lucide-react';
import { Competitor } from '@/types';

const trendColors = ['#E4405F', '#0A66C2', '#9B6AD4', '#50B88C'];

export default function CompetitorsPage() {
    const [selected, setSelected] = useState<string[]>(competitors.map(c => c.id));
    const [compList, setCompList] = useState<Competitor[]>(competitors);

    // ── Live data for Club Artizen's own row ─────────────────────────────────
    // channelStats is initialised with stub data and updated with CSV data when available.
    const { channelStats, followerGrowthTrend, loading } = useAllChannelsData();

    // Derive Club Artizen's metrics from live data (falls back gracefully to stubs)
    const igStats  = channelStats.find(s => s.channel === 'instagram');
    const fbStats  = channelStats.find(s => s.channel === 'facebook');
    const liStats  = channelStats.find(s => s.channel === 'linkedin');
    const ytStats  = channelStats.find(s => s.channel === 'youtube');

    const artizenInstagram  = igStats?.followers   ?? CLUB_ARTIZEN_STUB.instagram;
    const artizenFacebook   = fbStats?.followers   ?? CLUB_ARTIZEN_STUB.facebook;
    const artizenLinkedIn   = liStats?.followers   ?? CLUB_ARTIZEN_STUB.linkedin;
    const artizenYouTube    = ytStats?.followers   ?? CLUB_ARTIZEN_STUB.youtube;

    // Average engagement rate across all channels that have data
    const engRates = [igStats, fbStats, liStats, ytStats]
        .filter(Boolean)
        .map(s => s!.engagementRate);
    const artizenEngagement = engRates.length > 0
        ? Number((engRates.reduce((a, b) => a + b, 0) / engRates.length).toFixed(1))
        : CLUB_ARTIZEN_STUB.engagement;

    // Average follower growth rate
    const growthRates = [igStats, fbStats, liStats]
        .filter(Boolean)
        .map(s => s!.followerGrowth);
    const artizenGrowth = growthRates.length > 0
        ? Number((growthRates.reduce((a, b) => a + b, 0) / growthRates.length).toFixed(1))
        : CLUB_ARTIZEN_STUB.growth;

    // Club Artizen's IG follower growth series (from CSV if available, else stub)
    // followerGrowthTrend[0] = Instagram series (matches CHANNEL_TAB_ORDER in hook)
    const artizenIgGrowthSeries = (followerGrowthTrend[0]?.data ?? []).map(p => p.value);

    // Whether any live data is present
    const hasLiveData = !loading && (igStats || fbStats || liStats) !== undefined;

    const filtered = compList.filter(c => selected.includes(c.id));

    const growthData = filtered[0]?.growthTrend.map((_, i) => {
        const point: Record<string, string | number> = {
            date: filtered[0].growthTrend[i].date.slice(5),
        };
        filtered.forEach(c => { point[c.name] = c.growthTrend[i]?.value ?? 0; });
        // Club Artizen: use live Instagram follower growth series, or stub
        const stubArtizenValues = [24200, 25400, 26800, 27600, 28400];
        point['Club Artizen'] = artizenIgGrowthSeries[i] ?? stubArtizenValues[i] ?? 0;
        return point;
    }) ?? [];

    const toggleCompetitor = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // Determine the best competitor by engagement for the insight callout
    const bestComp = [...filtered].sort((a, b) => b.metrics.engagement - a.metrics.engagement)[0];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-stone-900">Competitors</h1>
                    <p className="text-sm text-stone-500 mt-1">Track and compare against your competitors.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Live data indicator */}
                    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${hasLiveData
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-stone-100 text-stone-500 border border-stone-200'
                    }`}>
                        {hasLiveData
                            ? <><Wifi className="h-3 w-3" /> Your data is live</>
                            : <><WifiOff className="h-3 w-3" /> Using stub data</>
                        }
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                                <Plus className="mr-2 h-4 w-4" /> Add Competitor
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add Competitor</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                                <div><Label>Company Name</Label><Input placeholder="e.g. ArtHouse Studios" className="mt-1" /></div>
                                <div><Label>Social Handle</Label><Input placeholder="e.g. @arthousestudios" className="mt-1" /></div>
                                <Button className="w-full bg-amber-500 text-white">Add Competitor</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Competitor Chips */}
            <div className="flex flex-wrap gap-2">
                {compList.map(c => (
                    <Badge
                        key={c.id}
                        variant={selected.includes(c.id) ? 'default' : 'outline'}
                        className={`cursor-pointer transition-all text-sm py-1 px-3 ${selected.includes(c.id) ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'hover:bg-stone-100'}`}
                        onClick={() => toggleCompetitor(c.id)}
                    >
                        {c.name}
                    </Badge>
                ))}
            </div>

            {/* Comparison Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-stone-700">Comparison Data</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead className="text-right">Instagram</TableHead>
                                <TableHead className="text-right">Facebook</TableHead>
                                <TableHead className="text-right">LinkedIn</TableHead>
                                <TableHead className="text-right">YouTube</TableHead>
                                <TableHead className="text-right">Avg Engagement</TableHead>
                                <TableHead className="text-right">Posts/Week</TableHead>
                                <TableHead className="text-right">Avg Growth</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Club Artizen row — sourced from live data */}
                            <TableRow className="bg-amber-50/50">
                                <TableCell className="font-medium text-amber-800">
                                    Club Artizen (You)
                                    {hasLiveData && (
                                        <Badge className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 py-0">Live</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {loading ? '…' : artizenInstagram.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {loading ? '…' : artizenFacebook.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {loading ? '…' : artizenLinkedIn.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {loading ? '…' : artizenYouTube.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {loading ? '…' : `${artizenEngagement}%`}
                                </TableCell>
                                <TableCell className="text-right">
                                    {CLUB_ARTIZEN_STUB.postsPerWeek}
                                    <span className="text-[10px] text-stone-400 ml-1">(est.)</span>
                                </TableCell>
                                <TableCell className="text-right text-emerald-600 font-medium">
                                    {loading ? '…' : `+${artizenGrowth}%`}
                                </TableCell>
                            </TableRow>

                            {/* Competitor rows */}
                            {filtered.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell className="text-right">{c.metrics.instagram.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{c.metrics.facebook.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{c.metrics.linkedin.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{c.metrics.youtube.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{c.metrics.engagement}%</TableCell>
                                    <TableCell className="text-right">{c.metrics.postsPerWeek}</TableCell>
                                    <TableCell className="text-right text-emerald-600">+{c.metrics.growth}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Growth Trends */}
            <ChartCard title="Instagram Follower Growth Comparison" description="Club Artizen vs competitors — sourced from live CSV data when available">
                <div className="h-72">
                    {growthData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                            No growth data available — select at least one competitor.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={growthData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716C' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                                <Line type="monotone" dataKey="Club Artizen" stroke="#E5A100" strokeWidth={2.5} dot={{ r: 3 }} />
                                {filtered.map((c, i) => (
                                    <Line
                                        key={c.id}
                                        type="monotone"
                                        dataKey={c.name}
                                        stroke={trendColors[i % trendColors.length]}
                                        strokeWidth={1.5}
                                        strokeDasharray="5 5"
                                        dot={{ r: 2 }}
                                    />
                                ))}
                                <Legend />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </ChartCard>

            {/* Dynamic Insight Callout */}
            {bestComp && (
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                            <Award className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-amber-900">Competitive Insight</p>
                                <p className="text-xs text-amber-700 mt-1">
                                    <strong>{bestComp.name}</strong> leads with {bestComp.metrics.engagement}% engagement
                                    — {bestComp.metrics.postsPerWeek} posts/week vs your {CLUB_ARTIZEN_STUB.postsPerWeek}.
                                    {bestComp.metrics.engagement > artizenEngagement
                                        ? ` They outperform your current ${artizenEngagement}% avg engagement rate by ${(bestComp.metrics.engagement - artizenEngagement).toFixed(1)}pp. Consider increasing video content frequency to close the gap.`
                                        : ` You are outperforming them on engagement (${artizenEngagement}% vs ${bestComp.metrics.engagement}%). Keep up the content quality.`
                                    }
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
