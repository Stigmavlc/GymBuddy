import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Lock, CheckCircle } from 'lucide-react';
import type { UserBadge } from '@/services/badgeService';

interface BadgeCardProps {
  badge: UserBadge;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
}

export function BadgeCard({ badge, size = 'md', showProgress = true }: BadgeCardProps) {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const iconSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  };

  const titleSizes = {
    sm: 'text-sm font-medium',
    md: 'text-base font-semibold',
    lg: 'text-lg font-bold'
  };

  return (
    <Card className={`relative transition-all duration-200 hover:shadow-md ${
      badge.isUnlocked 
        ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300 shadow-sm' 
        : 'bg-muted/50 border-muted-foreground/20'
    }`}>
      <CardContent className={sizeClasses[size]}>
        {/* Badge Category */}
        <div className="flex items-center justify-between mb-2">
          <Badge 
            variant="secondary" 
            className={`text-xs ${
              badge.isUnlocked ? 'bg-orange-200 text-orange-800' : 'bg-muted text-muted-foreground'
            }`}
          >
            {badge.category}
          </Badge>
          
          {/* Lock/Unlock Status */}
          <div className="flex items-center">
            {badge.isUnlocked ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Badge Icon and Title */}
        <div className="text-center mb-3">
          <div className={`${iconSizes[size]} ${badge.isUnlocked ? 'brightness-110 drop-shadow-md' : 'grayscale opacity-50'} mb-2`}>
            {badge.icon}
          </div>
          <h3 className={`${titleSizes[size]} ${badge.isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
            {badge.name}
          </h3>
        </div>

        {/* Description */}
        <p className={`text-center text-sm mb-3 ${
          badge.isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/70'
        }`}>
          {badge.description}
        </p>

        {/* Progress Bar (only for unearned badges) */}
        {showProgress && !badge.isUnlocked && badge.progress !== undefined && (
          <div className="space-y-2">
            <Progress 
              value={badge.progress} 
              className="h-2"
            />
            <p className="text-xs text-center text-muted-foreground">
              {badge.progressText}
            </p>
          </div>
        )}

        {/* Unlock Date (for earned badges) */}
        {badge.isUnlocked && badge.unlockedAt && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Unlocked {badge.unlockedAt.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>
        )}

        {/* Criteria (shown on hover or for larger sizes) */}
        {size === 'lg' && (
          <div className="mt-3 pt-3 border-t border-muted-foreground/20">
            <p className="text-xs text-center text-muted-foreground">
              <strong>Criteria:</strong> {badge.criteria}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}