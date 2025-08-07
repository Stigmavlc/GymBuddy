import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, TrendingUp, Target, Award, BarChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { sessionService } from '@/services/sessionService';
import type { GymSession } from '@/types';

export function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    currentStreak: 0,
    bestStreak: 0,
    averagePerWeek: 0,
    completionRate: 0,
    favoriteDay: '',
    favoriteTime: ''
  });

  useEffect(() => {
    if (!user) return;

    const loadAnalytics = async () => {
      try {
        setLoading(true);

        // Get all sessions
        const allSessions = await sessionService.getUserSessions(user.id);
        setSessions(allSessions);

        // Calculate stats
        const completedSessions = allSessions.filter(s => s.status === 'completed');
        const totalCompleted = completedSessions.length;
        const totalScheduled = allSessions.filter(s => s.status !== 'cancelled').length;
        
        // Calculate current streak
        const currentStreak = await sessionService.calculateStreak(user.id);

        // Calculate average per week
        const weeks = new Set<string>();
        completedSessions.forEach(session => {
          const weekStart = getWeekStart(session.date);
          weeks.add(weekStart);
        });
        const averagePerWeek = weeks.size > 0 ? (totalCompleted / weeks.size).toFixed(1) : '0';

        // Find favorite day
        const dayCounts: Record<string, number> = {};
        completedSessions.forEach(session => {
          const day = session.date.toLocaleDateString('en-US', { weekday: 'long' });
          dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
        const favoriteDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        // Find favorite time
        const timeCounts: Record<string, number> = {};
        completedSessions.forEach(session => {
          const timeRange = getTimeRange(session.startTime);
          timeCounts[timeRange] = (timeCounts[timeRange] || 0) + 1;
        });
        const favoriteTime = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        setStats({
          totalSessions: totalCompleted,
          currentStreak,
          bestStreak: currentStreak, // TODO: Track historical best streak
          averagePerWeek: parseFloat(averagePerWeek),
          completionRate: totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0,
          favoriteDay,
          favoriteTime
        });

      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [user]);

  const getWeekStart = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  };

  const getTimeRange = (hour: number): string => {
    if (hour < 6) return 'Early Morning';
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    if (hour < 21) return 'Evening';
    return 'Night';
  };

  const formatSessionTime = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <h1 className="text-3xl font-bold">Workout Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Track your progress and see your workout patterns
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workouts</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-muted-foreground">Sessions completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">🔥 {stats.currentStreak}</div>
            <p className="text-xs text-muted-foreground">Consecutive weeks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground">Of scheduled sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Per Week</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averagePerWeek}</div>
            <p className="text-xs text-muted-foreground">Sessions per week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorite Day</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.favoriteDay}</div>
            <p className="text-xs text-muted-foreground">Most workouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorite Time</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.favoriteTime}</div>
            <p className="text-xs text-muted-foreground">Preferred workout time</p>
          </CardContent>
        </Card>
      </div>

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>Your recent workout sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sessions yet. Start scheduling workouts to see your history!
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.slice(0, 10).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">
                        {session.date.toLocaleDateString('en-US', { 
                          weekday: 'long',
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatSessionTime(session.startTime)} - {formatSessionTime(session.endTime)}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      session.status === 'completed' ? 'default' : 
                      session.status === 'confirmed' ? 'secondary' : 
                      'outline'
                    }
                  >
                    {session.status}
                  </Badge>
                </div>
              ))}
              {sessions.length > 10 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Showing 10 of {sessions.length} sessions
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}