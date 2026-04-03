'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartCard, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from '@/components/charts/ChartComponents';
import { trendingTopics, suggestedActions, trendGrowthTrajectory } from '@/lib/stub-data/predictive';
import { Lightbulb, TrendingUp, Zap, ArrowRight, Sparkles, Target, Instagram, Linkedin, MessageCircle, Youtube } from 'lucide-react';

const channelIcons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="h-3.5 w-3.5" />,
    linkedin: <Linkedin className="h-3.5 w-3.5" />,
    whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
    youtube: <Youtube className="h-3.5 w-3.5" />,
};

const signalColors: Record<string, string> = {
    rising: 'bg-red-100 text-red-700',
    steady: 'bg-blue-100 text-blue-700',
    emerging: 'bg-purple-100 text-purple-700',
};

const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700',
};

export default function PredictivePage() {
    const trajectoryData = trendGrowthTrajectory[0].data.map((_, i) => {
        const point: Record<string, string | number> = { month: trendGrowthTrajectory[0].data[i].date.slice(5) };
        trendGrowthTrajectory.forEach(t => { point[t.label] = t.data[i].value; });
        return point;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-heading font-bold text-stone-900 flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-amber-500" /> Predictive Insights
                </h1>
                <p className="text-sm text-stone-500 mt-1">AI-powered trends and actionable suggestions for your content strategy.</p>
            </div>

            {/* Trending Topics */}
            <div>
                <h2 className="text-sm font-medium text-stone-700 mb-3">🔥 Trending Now</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {trendingTopics.map(topic => (
                        <Card key={topic.id} className="card-hover">
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-start justify-between mb-2">
                                    <Badge variant="outline" className="text-[10px]">{topic.category}</Badge>
                                    <Badge className={`text-[10px] ${signalColors[topic.signal]}`}>
                                        {topic.signal === 'rising' ? '🚀' : topic.signal === 'steady' ? '📈' : '🌱'} {topic.signal}
                                    </Badge>
                                </div>
                                <h3 className="text-sm font-medium text-stone-800 mt-2">{topic.topic}</h3>
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-xs text-emerald-600 font-medium">+{topic.change}%</span>
                                    <span className="text-[10px] text-stone-400">{topic.confidence}% confidence</span>
                                </div>
                                <div className="mt-2 h-1 rounded-full bg-stone-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${topic.confidence}%` }} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Trend Growth Trajectory */}
            <ChartCard title="Trend Growth Trajectory" description="Projected interest curve over the next 5 months">
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trajectoryData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716C' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#78716C' }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E7E5E4', fontSize: 12 }} />
                            {trendGrowthTrajectory.map(t => (
                                <Area key={t.label} type="monotone" dataKey={t.label} stroke={t.color} fill={t.color} fillOpacity={0.1} strokeWidth={2} />
                            ))}
                            <Legend />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            {/* AI Suggested Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-stone-700 flex items-center gap-2">
                        <Target className="h-4 w-4 text-amber-500" /> AI-Suggested Actions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {suggestedActions.map(action => (
                            <div key={action.id} className="flex items-start gap-4 p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors">
                                <Badge className={`text-[10px] shrink-0 mt-0.5 ${priorityColors[action.priority]}`}>{action.priority}</Badge>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-medium text-stone-800">{action.title}</h4>
                                        <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                                            {channelIcons[action.channel]} {action.channel}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-stone-500">{action.description}</p>
                                    <p className="text-xs text-emerald-600 mt-1 font-medium">Expected: {action.expectedImpact}</p>
                                </div>
                                <Button variant="outline" size="sm" className="shrink-0 text-xs h-7">
                                    Take Action <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
