import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { badgeService, type UserBadge } from '@/services/badgeService';
import { BadgeGrid } from '@/components/badges/BadgeGrid';

export function Badges() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadBadges = async () => {
      try {
        setLoading(true);
        const badgesWithProgress = await badgeService.getBadgesWithProgress(user.id);
        setBadges(badgesWithProgress);
      } catch (error) {
        console.error('Error loading badges:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBadges();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading badges...</p>
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
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Achievement Badges</h1>
          <p className="text-muted-foreground">
            Track your fitness journey and unlock achievements along the way
          </p>
        </div>
      </div>

      <BadgeGrid 
        badges={badges} 
        showProgress={true}
      />
    </div>
  );
}