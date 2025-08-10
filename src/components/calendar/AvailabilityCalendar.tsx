import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimePicker } from '@/components/TimePicker';
import type { TimeRange } from '@/components/TimePicker';

type AvailabilityData = {
  [key: string]: Map<number, TimeRange | null>;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM

interface AvailabilityCalendarProps {
  onSave: (availability: AvailabilityData) => void;
  initialAvailability?: AvailabilityData;
}

export function AvailabilityCalendar({ onSave, initialAvailability }: AvailabilityCalendarProps) {
  // Minimal state - only what we need
  const [availability, setAvailability] = useState<AvailabilityData>(() => {
    const initial: AvailabilityData = {};
    DAYS.forEach(day => {
      initial[day.toLowerCase()] = new Map();
    });
    return initial;
  });
  
  const [activeTimePicker, setActiveTimePicker] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // CRITICAL FIX: Handle initialAvailability prop changes
  useEffect(() => {
    if (initialAvailability) {
      console.log('AvailabilityCalendar: Loading initial data:', initialAvailability);
      
      // Validate that initialAvailability has the expected structure
      if (typeof initialAvailability === 'object' && initialAvailability !== null) {
        const totalSlots = Object.values(initialAvailability).reduce((sum: number, daySlots: any) => 
          sum + (daySlots instanceof Map ? daySlots.size : 0), 0
        );
        console.log('AvailabilityCalendar: Total slots to load:', totalSlots);
        
        // Update the availability state with the loaded data
        setAvailability(initialAvailability);
        // Reset dirty state since we're loading saved data
        setIsDirty(false);
        
        console.log('AvailabilityCalendar: Successfully loaded initial availability data');
      } else {
        console.warn('AvailabilityCalendar: initialAvailability prop has invalid structure:', initialAvailability);
      }
    } else {
      console.log('AvailabilityCalendar: No initial availability data provided');
    }
  }, [initialAvailability]);

  // Simple event handlers
  const handleHourClick = (day: string, hour: number) => {
    const dayKey = day.toLowerCase();
    const timePickerKey = `${dayKey}-${hour}`;
    setActiveTimePicker(timePickerKey);
  };

  const handleSave = (day: string, hour: number, timeRange: TimeRange) => {
    const dayKey = day.toLowerCase();
    setAvailability(prev => {
      const newAvailability = { ...prev };
      const daySlots = new Map(newAvailability[dayKey]);
      daySlots.set(hour, timeRange);
      newAvailability[dayKey] = daySlots;
      return newAvailability;
    });
    setIsDirty(true);
    setActiveTimePicker(null);
  };

  const handleCancel = () => {
    setActiveTimePicker(null);
  };

  const handleRemove = (day: string, hour: number) => {
    const dayKey = day.toLowerCase();
    setAvailability(prev => {
      const newAvailability = { ...prev };
      const daySlots = new Map(newAvailability[dayKey]);
      daySlots.delete(hour);
      newAvailability[dayKey] = daySlots;
      return newAvailability;
    });
    setIsDirty(true);
    setActiveTimePicker(null);
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  const handleSaveAll = () => {
    onSave(availability);
    setIsDirty(false);
  };

  const handleClear = () => {
    const cleared: AvailabilityData = {};
    DAYS.forEach(day => {
      cleared[day.toLowerCase()] = new Map();
    });
    setAvailability(cleared);
    setIsDirty(true);
    setActiveTimePicker(null);
  };

  const getTotalSlots = () => {
    return Object.values(availability).reduce((total, daySlots) => total + daySlots.size, 0);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Set Your Availability</CardTitle>
            </div>
            <Badge variant="secondary">
              {getTotalSlots()} slots selected
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Mobile Calendar */}
      <div className="block lg:hidden space-y-4">
        {DAYS.map((day) => {
          const dayKey = day.toLowerCase();
          
          return (
            <Card key={day}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{day}</h3>
                  <Badge variant="outline">
                    {availability[dayKey].size} slots
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {HOURS.map(hour => {
                    const timeRange = availability[dayKey].get(hour);
                    const isSelected = timeRange !== undefined;
                    const timePickerKey = `${dayKey}-${hour}`;
                    const isTimePickerOpen = activeTimePicker === timePickerKey;
                    
                    return (
                      <TimePicker
                        key={`${dayKey}-${hour}`}
                        hour={hour}
                        initialTimeRange={timeRange || undefined}
                        onSave={(range) => handleSave(day, hour, range)}
                        onCancel={handleCancel}
                        onRemove={() => handleRemove(day, hour)}
                        open={isTimePickerOpen}
                        onOpenChange={(open) => {
                          if (open) {
                            setActiveTimePicker(timePickerKey);
                          } else {
                            setActiveTimePicker(null);
                          }
                        }}
                      >
                        <button
                          className={cn(
                            "p-2 text-xs rounded border transition-all min-h-[2.5rem] flex items-center justify-center",
                            isSelected 
                              ? "bg-primary border-primary text-primary-foreground font-medium" 
                              : "bg-background border-border hover:bg-muted"
                          )}
                          onClick={() => handleHourClick(day, hour)}
                        >
                          <div className="flex items-center gap-1">
                            {isSelected && <Clock className="h-3 w-3" />}
                            <span>{formatTime(hour)}</span>
                          </div>
                        </button>
                      </TimePicker>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Calendar */}
      <Card className="hidden lg:block">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Click hour slots to set your availability.
            </div>
            
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-[80px_repeat(18,1fr)] gap-1">
                  <div className="h-8" />
                  {HOURS.map(hour => (
                    <div key={hour} className="text-xs text-center text-muted-foreground">
                      {formatTime(hour)}
                    </div>
                  ))}
                  
                  {DAYS.map((day) => {
                    const dayKey = day.toLowerCase();
                    
                    return (
                      <React.Fragment key={day}>
                        <div className="font-medium text-sm py-2">
                          {day}
                        </div>
                        {HOURS.map(hour => {
                          const timeRange = availability[dayKey].get(hour);
                          const isSelected = timeRange !== undefined;
                          const timePickerKey = `${dayKey}-${hour}`;
                          const isTimePickerOpen = activeTimePicker === timePickerKey;
                          
                          return (
                            <TimePicker
                              key={`${dayKey}-${hour}`}
                              hour={hour}
                              initialTimeRange={timeRange || undefined}
                              onSave={(range) => handleSave(day, hour, range)}
                              onCancel={handleCancel}
                              onRemove={() => handleRemove(day, hour)}
                              open={isTimePickerOpen}
                              onOpenChange={(open) => {
                                if (open) {
                                  setActiveTimePicker(timePickerKey);
                                } else {
                                  setActiveTimePicker(null);
                                }
                              }}
                            >
                              <div
                                className={cn(
                                  "h-10 border rounded cursor-pointer transition-all flex items-center justify-center",
                                  isSelected 
                                    ? "bg-primary border-primary text-primary-foreground" 
                                    : "bg-background border-border hover:bg-muted"
                                )}
                                onClick={() => handleHourClick(day, hour)}
                              >
                                {isSelected && <Clock className="h-3 w-3" />}
                              </div>
                            </TimePicker>
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
              onClick={handleSaveAll} 
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