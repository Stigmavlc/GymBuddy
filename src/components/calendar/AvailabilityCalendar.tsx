import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type AvailabilityData = {
  [key: string]: Set<number>;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface AvailabilityCalendarProps {
  onSave: (availability: AvailabilityData) => void;
  initialAvailability?: AvailabilityData;
}

export function AvailabilityCalendar({ onSave, initialAvailability }: AvailabilityCalendarProps) {
  const [availability, setAvailability] = useState<AvailabilityData>(() => {
    // Initialize with empty sets to prevent phantom selections
    const initial: AvailabilityData = {};
    DAYS.forEach(day => {
      initial[day.toLowerCase()] = new Set();
    });
    return initial;
  });
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'add' | 'remove'>('add');
  const [isDirty, setIsDirty] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Manage availability based on week - only show saved availability for current week
  useEffect(() => {
    console.log('AvailabilityCalendar: Week offset changed to:', currentWeekOffset);
    console.log('AvailabilityCalendar: Initial availability:', initialAvailability);
    
    if (currentWeekOffset === 0 && initialAvailability) {
      // Current week - show saved availability from initialAvailability
      const currentWeekAvailability: AvailabilityData = {};
      DAYS.forEach(day => {
        const dayKey = day.toLowerCase();
        const daySlots = initialAvailability[dayKey];
        // Ensure we create a new Set from the initial data to prevent reference issues
        currentWeekAvailability[dayKey] = daySlots ? new Set(daySlots) : new Set();
      });
      console.log('AvailabilityCalendar: Setting current week availability:', currentWeekAvailability);
      setAvailability(currentWeekAvailability);
      setIsDirty(false);
    } else {
      // Future/past weeks or no initial data - clear all selections
      const clearedAvailability: AvailabilityData = {};
      DAYS.forEach(day => {
        clearedAvailability[day.toLowerCase()] = new Set();
      });
      console.log('AvailabilityCalendar: Clearing availability for non-current week');
      setAvailability(clearedAvailability);
      setIsDirty(false);
    }
  }, [currentWeekOffset, initialAvailability]);

  const handleMouseDown = (day: string, slotIndex: number, e?: React.MouseEvent | React.TouchEvent) => {
    // Prevent default touch behavior to avoid delays
    if (e && 'touches' in e) {
      e.preventDefault();
    }
    
    setIsSelecting(true);
    setIsDirty(true);
    const dayKey = day.toLowerCase();
    const isSelected = availability[dayKey].has(slotIndex);
    setSelectionMode(isSelected ? 'remove' : 'add');
    
    setAvailability(prev => {
      const newAvailability = { ...prev };
      const daySlots = new Set(newAvailability[dayKey]);
      if (isSelected) {
        daySlots.delete(slotIndex);
      } else {
        daySlots.add(slotIndex);
      }
      newAvailability[dayKey] = daySlots;
      return newAvailability;
    });
  };

  const handleMouseEnter = (day: string, slotIndex: number) => {
    if (!isSelecting) return;
    
    const dayKey = day.toLowerCase();
    setAvailability(prev => {
      const newAvailability = { ...prev };
      const daySlots = new Set(newAvailability[dayKey]);
      if (selectionMode === 'add') {
        daySlots.add(slotIndex);
      } else {
        daySlots.delete(slotIndex);
      }
      newAvailability[dayKey] = daySlots;
      return newAvailability;
    });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  const handleSave = () => {
    onSave(availability);
    setIsDirty(false);
  };

  const handleClear = () => {
    const cleared: AvailabilityData = {};
    DAYS.forEach(day => {
      cleared[day.toLowerCase()] = new Set();
    });
    setAvailability(cleared);
    setIsDirty(true);
  };

  const getTotalSlots = () => {
    const total = Object.values(availability).reduce((total, daySlots) => {
      // Ensure daySlots is a Set and has a size property
      if (daySlots instanceof Set) {
        return total + daySlots.size;
      }
      console.warn('AvailabilityCalendar: Invalid daySlots detected:', daySlots);
      return total;
    }, 0);
    console.log('AvailabilityCalendar: Total slots calculated:', total);
    return total;
  };

  const getWeekDates = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(today.getDate() + mondayOffset + (currentWeekOffset * 7));
    
    return DAYS.map((_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      return date;
    });
  };

  const formatWeekRange = () => {
    const dates = getWeekDates();
    const startDate = dates[0];
    const endDate = dates[6];
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    };

    if (startDate.getMonth() === endDate.getMonth()) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Set Your Availability</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Week of {formatWeekRange()}
                </p>
              </div>
            </div>
            <Badge variant="secondary">
              {getTotalSlots()} slots selected
            </Badge>
          </div>
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
              disabled={currentWeekOffset <= 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekOffset(0)}
              disabled={currentWeekOffset === 0}
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
            >
              Next Week
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Mobile Calendar - Day by Day */}
      <div className="block lg:hidden space-y-4">
        {DAYS.map((day, dayIndex) => {
          const weekDates = getWeekDates();
          const dayDate = weekDates[dayIndex];
          const dayKey = day.toLowerCase();
          
          return (
            <Card key={day}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{day}</h3>
                    <p className="text-sm text-muted-foreground">
                      {dayDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {availability[dayKey].size} hours
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {HOURS.filter(hour => hour >= 6 && hour <= 23).map(hour => {
                    const isSelected = availability[dayKey].has(hour);
                    return (
                      <button
                        key={`${day}-${hour}`}
                        className={cn(
                          "p-2 text-xs rounded border transition-all select-none",
                          isSelected 
                            ? "bg-primary border-primary text-primary-foreground font-medium" 
                            : "bg-background border-border hover:bg-muted active:bg-muted"
                        )}
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                        onClick={(e) => {
                          e.preventDefault();
                          handleMouseDown(day, hour, e);
                        }}
                      >
                        {formatTime(hour)}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Calendar - Traditional Grid */}
      <Card className="hidden lg:block" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Click and drag to select your available time slots. Each slot represents 1 hour.
            </div>
            
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-1">
                  <div className="h-8" />
                  {HOURS.map(hour => (
                    <div key={hour} className="text-xs text-center text-muted-foreground">
                      {formatTime(hour)}
                    </div>
                  ))}
                  
                  {DAYS.map((day) => {
                    
                    return (
                      <React.Fragment key={day}>
                        <div className="font-medium text-sm py-2">
                          <div>{day}</div>
                        </div>
                        {HOURS.map(hour => {
                          const dayKey = day.toLowerCase();
                          const isSelected = availability[dayKey].has(hour);
                          return (
                            <div
                              key={`${day}-${hour}`}
                              className={cn(
                                "h-10 border rounded cursor-pointer transition-all select-none",
                                isSelected 
                                  ? "bg-primary border-primary text-primary-foreground" 
                                  : "bg-background border-border hover:bg-muted"
                              )}
                              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                              onMouseDown={(e) => handleMouseDown(day, hour, e)}
                              onMouseEnter={() => handleMouseEnter(day, hour)}
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={handleClear}
              className="w-full sm:w-auto"
            >
              Clear All
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!isDirty}
              className="w-full sm:w-auto"
            >
              Save Availability
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}