'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartCard, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from '@/components/charts/ChartComponents';
import { getCompetitors, refreshCompetitors } from '@/lib/api/competitors-api';
import { Plus, TrendingUp, Award, BarChart3, RefreshCw, Loader2 } from 'lucide-react';
import { Competitor } from '@/types';

const sourceStyles: Record<string, { label: string; className: string }> = {
    live: { label: '🟢 Live Data', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    cache: { label: '⚡ Cached', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    fallback: { label: '📊 Sample Data', className: 'bg-stone-100 text-stone-600 border-stone-200' },
};

export default function CompetitorsPage() {
    const [compList, setCompList] = useState<Competitor[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dataSource, setDataSource] = useState<string>('fallback');
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getCompetitors();
            setCompList(result.competitors);
            setSelected(result.competitors.map(c => c.id));
            setDataSource(result.source);
            setLastUpdated(result.lastUpdated);
        } catch {
            setCompList([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshCompetitors();
            await fetchData();
        } catch {
            // Refresh failed — data stays as-is
        } finally {
            setRefreshing(false);
        }
    };

    const filtered = compList.filter(c => selected.includes(c.id));

    const growthData = filtered[0]?.growthTrend.map((_, i) => {
        const point: Record<string, string | number> = { date: filtered[0].growthTrend[i].date.slice(5) };
        filtered.forEach(c => { point[c.name] = c.growthTrend[i]?.value || 0; });
        point['Club Artizen'] = [24200, 25400, 26800, 27600, 28400][i] || 0;
        return point;
    }) || [];

    const toggleCompetitor = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const trendColors = ['#E4405F', '#0A66C2', '#9B6AD4', '#50B88C', '#E5A100', '#C75B39'];
    const sourceInfo = sourceStyles[dataSource] || sourceStyles.fallback;

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-stone-900">Competitors</h1>
                    <p className="text-sm text-stone-500 mt-1">Loading competitor data…</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="pt-4 pb-3">
                                <div className="h-4 bg-stone-200 rounded w-1/3 mb-3" />
                                <div className="h-5 bg-stone-200 rounded w-2/3 mb-2" />
                                <div className="h-3 bg-stone-100 rounded w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-stone-900">Competitors</h1>
                    <p className="text-sm text-stone-500 mt-1">Track and compare against your competitors.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${sourceInfo.className}`}>
                        {sourceInfo.label}
                    </Badge>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="text-xs"
                    >
                        {refreshing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                        Refresh
                    </Button>
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
                                <TableHead className="text-right">LinkedIn</TableHead>
                                <TableHead className="text-right">Engagement</TableHead>
                                <TableHead className="text-right">Posts/Week</TableHead>
                                <TableHead className="text-right">Growth</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-amber-50/50">
                                <TableCell className="font-medium text-amber-800">Club Artizen (You)</TableCell>
                                <TableCell className="text-right">28,400</TableCell>
                                <TableCell className="text-right">12,300</TableCell>
                                <TableCell className="text-right">4.8%</TableCell>
                                <TableCell className="text-right">10</TableCell>
                                <TableCell className="text-right text-emerald-600">+5.2%</TableCell>
                            </TableRow>
                            {filtered.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell className="text-right">{c.metrics.instagram.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{c.metrics.linkedin.toLocaleString()}</TableCell>
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
            <ChartCard title="Growth Trend Comparison" description="Instagram follower growth over time">
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={growthData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716C' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                            <Line type="monotone" dataKey="Club Artizen" stroke="#E5A100" strokeWidth={2.5} dot={{ r: 3 }} />
                            {filtered.map((c, i) => (
                                <Line key={c.id} type="monotone" dataKey={c.name} stroke={trendColors[i % trendColors.length]} strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                            ))}
                            <Legend />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            {/* Insights Callout */}
            <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <Award className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-900">Competitive Insight</p>
                            <p className="text-xs text-amber-700 mt-1">
                                {(() => {
                                    if (filtered.length === 0) return 'No competitors selected.';
                                    const fastest = [...filtered].sort((a, b) => b.metrics.growth - a.metrics.growth)[0];
                                    const mostEngaged = [...filtered].sort((a, b) => b.metrics.engagement - a.metrics.engagement)[0];
                                    return `${fastest.name} is growing fastest at +${fastest.metrics.growth}% • ${mostEngaged.name} leads engagement at ${mostEngaged.metrics.engagement}%`;
                                })()}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Last updated */}
            {lastUpdated && (
                <p className="text-[10px] text-stone-400 text-right">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
            )}
        </div>
    );
}
