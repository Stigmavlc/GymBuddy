import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Star, Trophy } from 'lucide-react';
import type { UserBadge } from '@/services/badgeService';

interface BadgeUnlockModalProps {
  badge: UserBadge | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BadgeUnlockModal({ badge, isOpen, onClose }: BadgeUnlockModalProps) {
  if (!badge) return null;

  // Different celebration styles based on badge category
  const isLongTerm = badge.category === 'long-term';
  const isMajorMilestone = ['century-club', 'double-century', 'triple-digits'].includes(badge.id);
  const isYearlyAchievement = ['yearly-legend', 'dedication-diamond'].includes(badge.id);

  const getCelebrationStyle = () => {
    if (isYearlyAchievement) {
      return {
        bgGradient: 'bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100',
        borderColor: 'border-purple-300',
        textColor: 'text-purple-800',
        icon: <Trophy className="h-8 w-8 text-purple-600" />,
        celebration: '🎉🏆✨'
      };
    }
    
    if (isLongTerm || isMajorMilestone) {
      return {
        bgGradient: 'bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100',
        borderColor: 'border-orange-300',
        textColor: 'text-orange-800',
        icon: <Star className="h-8 w-8 text-orange-600" />,
        celebration: '🌟💪🔥'
      };
    }
    
    return {
      bgGradient: 'bg-gradient-to-br from-green-100 via-blue-100 to-purple-100',
      borderColor: 'border-green-300',
      textColor: 'text-green-800',
      icon: <Sparkles className="h-8 w-8 text-green-600" />,
      celebration: '✨🎯⭐'
    };
  };

  const style = getCelebrationStyle();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`max-w-md ${style.bgGradient} ${style.borderColor} border-2`}>
        <DialogHeader className="text-center space-y-4">
          <div className="flex justify-center items-center gap-2 text-4xl animate-bounce">
            {style.celebration.split('').map((emoji, index) => (
              <span 
                key={index} 
                className="inline-block"
                style={{ 
                  animationDelay: `${index * 0.1}s`,
                  animationDuration: '1s',
                  animationIterationCount: '3'
                }}
              >
                {emoji}
              </span>
            ))}
          </div>
          
          <DialogTitle className={`text-2xl font-bold ${style.textColor}`}>
            Badge Unlocked!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Badge Display */}
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="text-6xl mb-4 transform animate-pulse">
                {badge.icon}
              </div>
              <div className="absolute -top-2 -right-2">
                {style.icon}
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                {badge.name}
              </h3>
              <p className="text-muted-foreground">
                {badge.description}
              </p>
              
              <Badge variant="secondary" className="mt-2">
                {badge.category === 'long-term' ? 'Long-term Achievement' : 
                 badge.category === 'milestone' ? 'Major Milestone' :
                 badge.category.charAt(0).toUpperCase() + badge.category.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Celebration Message */}
          <div className={`text-center p-4 rounded-lg bg-white/50 ${style.textColor}`}>
            {isYearlyAchievement ? (
              <p className="font-semibold">
                🎊 Incredible! You've achieved something truly special! This level of dedication is legendary! 🎊
              </p>
            ) : isLongTerm || isMajorMilestone ? (
              <p className="font-semibold">
                🔥 Amazing achievement! Your consistency and dedication are paying off! 🔥
              </p>
            ) : (
              <p className="font-semibold">
                🎉 Great job! You're building some serious momentum! 🎉
              </p>
            )}
          </div>

          {/* Criteria */}
          <div className="text-center text-sm text-muted-foreground bg-white/30 rounded-lg p-3">
            <strong>Achievement:</strong> {badge.criteria}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button onClick={onClose} className="px-8">
            Awesome! 🚀
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}