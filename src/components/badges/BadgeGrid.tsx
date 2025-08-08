import { BadgeCard } from './BadgeCard';
import { Badge } from '@/components/ui/badge';
import type { UserBadge } from '@/services/badgeService';

interface BadgeGridProps {
  badges: UserBadge[];
  title?: string;
  showProgress?: boolean;
  maxDisplay?: number;
}

export function BadgeGrid({ badges, title, showProgress = true, maxDisplay }: BadgeGridProps) {
  console.log('BadgeGrid: Rendering with props:', {
    badgeCount: badges?.length || 0,
    title,
    showProgress,
    maxDisplay,
    firstBadge: badges?.[0] ? { id: badges[0].id, name: badges[0].name } : null
  });

  // Group badges by category
  const badgesByCategory = badges.reduce((acc, badge) => {
    const category = badge.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(badge);
    return acc;
  }, {} as Record<string, UserBadge[]>);

  // Sort categories by priority
  const categoryOrder = ['progress', 'consistency', 'milestone', 'long-term', 'achievement', 'time', 'general'];
  const sortedCategories = Object.keys(badgesByCategory).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  const displayBadges = maxDisplay ? badges.slice(0, maxDisplay) : badges;
  const unlockedCount = badges.filter(b => b.isUnlocked).length;
  
  console.log('BadgeGrid: Processing badges:', {
    totalBadges: badges.length,
    displayBadges: displayBadges.length,
    unlockedCount,
    maxDisplay,
    willShowPlaceholder: maxDisplay && displayBadges.length === 0
  });

  return (
    <div className="space-y-6">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{title}</h2>
          <Badge variant="secondary" className="text-sm">
            {unlockedCount}/{badges.length} Unlocked
          </Badge>
        </div>
      )}

      {maxDisplay ? (
        // Simple grid view for dashboard - always show badges or placeholder
        displayBadges.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayBadges.map((badge) => (
              <BadgeCard 
                key={badge.id} 
                badge={badge} 
                size="sm" 
                showProgress={showProgress}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <p className="text-lg font-medium text-muted-foreground mb-2">
              Complete gym sessions to start earning achievement badges!
            </p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• Complete your first workout session</p>
              <p>• Build a consistent workout streak</p>
              <p>• Achieve milestone session counts</p>
            </div>
          </div>
        )
      ) : (
        // Categorized view for full badge page
        <div className="space-y-8">
          {sortedCategories.map((category) => {
            const categoryBadges = badgesByCategory[category];
            const categoryUnlocked = categoryBadges.filter(b => b.isUnlocked).length;
            
            return (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold capitalize">
                    {category === 'long-term' ? 'Long-term Achievements' : 
                     category === 'time' ? 'Time-based' : 
                     category}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {categoryUnlocked}/{categoryBadges.length}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categoryBadges
                    .sort((a, b) => {
                      // Sort by unlocked status first, then by progress
                      if (a.isUnlocked && !b.isUnlocked) return -1;
                      if (!a.isUnlocked && b.isUnlocked) return 1;
                      if (!a.isUnlocked && !b.isUnlocked) {
                        return (b.progress || 0) - (a.progress || 0);
                      }
                      return 0;
                    })
                    .map((badge) => (
                      <BadgeCard 
                        key={badge.id} 
                        badge={badge} 
                        size="md" 
                        showProgress={showProgress}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}