import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { sessionService } from '@/services/sessionService';
import { badgeService, type UserBadge } from '@/services/badgeService';
import { BadgeGrid } from '@/components/badges/BadgeGrid';
import { BadgeUnlockModal } from '@/components/badges/BadgeUnlockModal';
import { Calendar, Clock, Award } from 'lucide-react';
import { toast } from 'sonner';
import type { GymSession } from '@/types';

export function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [weekSessions, setWeekSessions] = useState({ completed: 0, total: 0 });
  const [upcomingSessions, setUpcomingSessions] = useState<GymSession[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [newBadgeUnlock, setNewBadgeUnlock] = useState<UserBadge | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSetAvailability = () => {
    navigate('/availability');
  };

  const handleFindSessions = () => {
    navigate('/sessions');
  };


  const handleViewStats = () => {
    navigate('/analytics');
  };


  // Load real session data
  useEffect(() => {
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // First, update any completed sessions
        await sessionService.updateCompletedSessions(user.id);
        
        // Then update user stats
        await sessionService.updateUserStats(user.id);

        // Load current week sessions
        const weekData = await sessionService.getCurrentWeekSessions(user.id);
        setWeekSessions({ completed: weekData.completed, total: weekData.total });

        // Load upcoming sessions
        const upcoming = await sessionService.getUpcomingSessions(user.id);
        setUpcomingSessions(upcoming);

        // Calculate streak
        const streak = await sessionService.calculateStreak(user.id);
        setCurrentStreak(streak);

        // Get total completed sessions
        const allSessions = await sessionService.getUserSessions(user.id, 'completed');
        setTotalSessions(allSessions.length);

        // Check for new badge unlocks
        const badgeUnlocks = await badgeService.checkAndAwardBadges(user.id);
        if (badgeUnlocks.length > 0) {
          // Show the first new badge unlock
          setNewBadgeUnlock(badgeUnlocks[0].badge);
          toast.success(`🏆 New badge unlocked: ${badgeUnlocks[0].badge.name}!`);
        }

        // Load user badges with progress
        const userBadges = await badgeService.getBadgesWithProgress(user.id);
        setBadges(userBadges);

      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  // Determine if user is Ivan (creator) or Youssef
  const isIvan = profile?.email === 'ivanaguilarmari@gmail.com';
  const isYoussef = !isIvan && profile?.email; // Youssef is anyone else who isn't Ivan

  // Custom messages based on user
  const getWelcomeMessage = () => {
    if (isIvan) {
      return `Welcome back, ${profile?.name}! Time to coordinate with Youssef for this week's gym sessions.`;
    } else if (isYoussef) {
      return `Hey Youssef! Ivan built this app just for us. Ready to crush some workouts this week? 💪`;
    }
    return `Welcome, ${profile?.name}!`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <Badge variant="secondary">Week 1</Badge>
      </div>
      
      {profile && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-orange-800">
            {getWelcomeMessage()}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Current Week Progress */}
        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
            <CardDescription>Your workout progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `${weekSessions.completed}/${weekSessions.total || 2}`}
            </div>
            <p className="text-muted-foreground">Sessions completed</p>
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card>
          <CardHeader>
            <CardTitle>Current Streak</CardTitle>
            <CardDescription>Consecutive weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `🔥 ${currentStreak}`}
            </div>
            <p className="text-muted-foreground">Keep it up!</p>
          </CardContent>
        </Card>

        {/* Total Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Total Sessions</CardTitle>
            <CardDescription>All time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : totalSessions}
            </div>
            <p className="text-muted-foreground">Workouts completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with GymBuddy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleSetAvailability} 
              className="flex-1 min-w-[200px] sm:flex-none justify-start"
            >
              📅 Set Availability
            </Button>
            <Button 
              onClick={handleFindSessions} 
              variant="secondary"
              className="flex-1 min-w-[200px] sm:flex-none justify-start"
            >
              🔍 Find Sessions
            </Button>
            <Button 
              variant="outline" 
              onClick={handleViewStats}
              className="flex-1 min-w-[200px] sm:flex-none justify-start"
            >
              📊 View Stats
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/badges')}
              className="flex-1 min-w-[200px] sm:flex-none justify-start"
            >
              <Award className="mr-2 h-4 w-4" />
              Badges
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Sessions</CardTitle>
          <CardDescription>Your scheduled workouts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : upcomingSessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No sessions scheduled yet. Set your availability to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.slice(0, 3).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">
                        {session.date.toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatSessionTime(session.startTime)} - {formatSessionTime(session.endTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.date.toDateString() === new Date().toDateString() && (
                      <Badge variant="secondary">Today</Badge>
                    )}
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {upcomingSessions.length > 3 && (
                <Button 
                  variant="ghost" 
                  className="w-full mt-2"
                  onClick={() => navigate('/sessions')}
                >
                  View all {upcomingSessions.length} sessions →
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Badges */}
      {badges.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Achievement Badges</CardTitle>
                <CardDescription>Your latest accomplishments</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => navigate('/badges')}>
                View All →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <BadgeGrid 
              badges={badges} 
              maxDisplay={4}
              showProgress={true}
            />
          </CardContent>
        </Card>
      )}


      {/* Badge Unlock Modal */}
      <BadgeUnlockModal
        badge={newBadgeUnlock}
        isOpen={!!newBadgeUnlock}
        onClose={() => setNewBadgeUnlock(null)}
      />
    </div>
  );
}

// Helper function to format time
function formatSessionTime(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}