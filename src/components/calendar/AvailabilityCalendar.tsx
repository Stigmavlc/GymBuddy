import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimePicker, TimeRange } from '@/components/TimePicker';

type TimeSlotData = {
  [key: string]: Map<number, TimeRange | null>;
};

// Legacy support for old Set<number> format
type LegacyAvailabilityData = {
  [key: string]: Set<number>;
};

type AvailabilityData = TimeSlotData;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface AvailabilityCalendarProps {
  onSave: (availability: AvailabilityData) => void;
  initialAvailability?: AvailabilityData | LegacyAvailabilityData;
}

export function AvailabilityCalendar({ onSave, initialAvailability }: AvailabilityCalendarProps) {
  // Helper function to convert legacy Set<number> to Map<number, TimeRange | null>
  const convertLegacyData = (data: LegacyAvailabilityData | AvailabilityData): AvailabilityData => {
    const converted: AvailabilityData = {};
    DAYS.forEach(day => {
      const dayKey = day.toLowerCase();
      const dayData = data[dayKey];
      
      if (dayData instanceof Set) {
        // Legacy format - convert Set<number> to Map<number, null>
        const timeSlots = new Map<number, TimeRange | null>();
        dayData.forEach(hour => {
          timeSlots.set(hour, null); // null means full hour slot
        });
        converted[dayKey] = timeSlots;
      } else if (dayData instanceof Map) {
        // New format - already a Map
        converted[dayKey] = new Map(dayData);
      } else {
        // No data
        converted[dayKey] = new Map();
      }
    });
    return converted;
  };

  const [availability, setAvailability] = useState<AvailabilityData>(() => {
    // Initialize with empty maps
    const initial: AvailabilityData = {};
    DAYS.forEach(day => {
      initial[day.toLowerCase()] = new Map();
    });
    return initial;
  });
  
  const [isDirty, setIsDirty] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [openTimePickers, setOpenTimePickers] = useState<{[key: string]: boolean}>({});
  
  // Debug toggle for detailed logging
  const DEBUG_TIMEPICKER = process.env.NODE_ENV === 'development';
  const debugLog = (message: string, data?: any) => {
    if (DEBUG_TIMEPICKER) {
      console.log(`[AvailabilityCalendar] ${message}`, data || '');
    }
  };

  // Manage availability based on week - only show saved availability for current week
  useEffect(() => {
    console.log('AvailabilityCalendar: Week offset changed to:', currentWeekOffset);
    console.log('AvailabilityCalendar: Initial availability:', initialAvailability);
    
    if (currentWeekOffset === 0 && initialAvailability) {
      // Current week - show saved availability from initialAvailability
      const convertedAvailability = convertLegacyData(initialAvailability);
      console.log('AvailabilityCalendar: Setting current week availability:', convertedAvailability);
      setAvailability(convertedAvailability);
      setIsDirty(false);
    } else {
      // Future/past weeks or no initial data - clear all selections
      const clearedAvailability: AvailabilityData = {};
      DAYS.forEach(day => {
        clearedAvailability[day.toLowerCase()] = new Map();
      });
      console.log('AvailabilityCalendar: Clearing availability for non-current week');
      setAvailability(clearedAvailability);
      setIsDirty(false);
    }
  }, [currentWeekOffset, initialAvailability]);

  // Handle hour button click to toggle or show time picker
  const handleHourClick = (day: string, hour: number) => {
    const dayKey = day.toLowerCase();
    const timePickerKey = `${dayKey}-${hour}`;
    const currentTimeRange = availability[dayKey].get(hour);
    
    debugLog(`Hour click: ${timePickerKey}`, {
      currentTimeRange,
      currentOpenState: openTimePickers[timePickerKey],
      allOpenPickers: Object.keys(openTimePickers).filter(key => openTimePickers[key])
    });
    
    if (currentTimeRange === null) {
      // Full hour slot exists - show time picker to modify
      debugLog(`Opening picker for full hour slot: ${timePickerKey}`);
      setOpenTimePickers(prev => {
        const newState = { ...prev, [timePickerKey]: true };
        debugLog(`State after full hour click:`, newState);
        return newState;
      });
    } else if (currentTimeRange) {
      // Time range exists - show time picker to modify
      debugLog(`Opening picker for time range: ${timePickerKey}`);
      setOpenTimePickers(prev => {
        const newState = { ...prev, [timePickerKey]: true };
        debugLog(`State after time range click:`, newState);
        return newState;
      });
    } else {
      // No slot exists - show time picker to add one
      debugLog(`Opening picker for new slot: ${timePickerKey}`);
      setOpenTimePickers(prev => {
        const newState = { ...prev, [timePickerKey]: true };
        debugLog(`State after new slot click:`, newState);
        return newState;
      });
    }
  };

  // Handle time picker save
  const handleTimePickerSave = (day: string, hour: number, timeRange: TimeRange) => {
    const dayKey = day.toLowerCase();
    const timePickerKey = `${dayKey}-${hour}`;
    
    debugLog(`Save called: ${timePickerKey}`, { timeRange });
    
    setAvailability(prev => {
      const newAvailability = { ...prev };
      const daySlots = new Map(newAvailability[dayKey]);
      daySlots.set(hour, timeRange);
      newAvailability[dayKey] = daySlots;
      return newAvailability;
    });
    setIsDirty(true);
    
    // The TimePicker component will handle closing via onOpenChange
    debugLog(`Save completed, onOpenChange will be called by TimePicker component`);
  };

  // Handle time picker cancel
  const handleTimePickerCancel = (day: string, hour: number) => {
    const dayKey = day.toLowerCase();
    const timePickerKey = `${dayKey}-${hour}`;
    
    debugLog(`Cancel button clicked: ${timePickerKey}`, {
      currentOpenState: openTimePickers[timePickerKey],
      allOpenPickers: Object.keys(openTimePickers).filter(key => openTimePickers[key])
    });
    
    // Close the time picker - the TimePicker component will handle its own onOpenChange
    // We don't need to set state here as it will be handled by the onOpenChange callback
    debugLog(`Cancel handled, onOpenChange will be called by TimePicker component`);
  };

  // Handle removing a time slot
  const handleTimePickerRemove = (day: string, hour: number) => {
    const dayKey = day.toLowerCase();
    const timePickerKey = `${dayKey}-${hour}`;
    
    debugLog(`Remove called: ${timePickerKey}`);
    
    // Remove the time slot from availability
    setAvailability(prev => {
      const newAvailability = { ...prev };
      const daySlots = new Map(newAvailability[dayKey]);
      daySlots.delete(hour);
      newAvailability[dayKey] = daySlots;
      return newAvailability;
    });
    setIsDirty(true);
    
    // The TimePicker component will handle closing via onOpenChange
    debugLog(`Remove completed, onOpenChange will be called by TimePicker component`);
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  // Format time range display for buttons
  const formatTimeRange = (hour: number, timeRange: TimeRange | null) => {
    if (!timeRange) {
      // Full hour slot
      return formatTime(hour);
    }
    
    const startHour = hour;
    const startMin = timeRange.startMinute;
    const endHour = hour + Math.floor(timeRange.duration / 60);
    const endMin = timeRange.endMinute;
    
    const formatTimeWithMinutes = (h: number, m: number) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${displayHour}:${m.toString().padStart(2, '0')}${period}`;
    };
    
    return `${formatTimeWithMinutes(startHour, startMin)}-${formatTimeWithMinutes(endHour, endMin)}`;
  };

  const handleSave = () => {
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
    // Close all time pickers
    setOpenTimePickers({});
  };

  const getTotalSlots = () => {
    const total = Object.values(availability).reduce((total, daySlots) => {
      if (daySlots instanceof Map) {
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
                    {availability[dayKey].size} slots
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {HOURS.filter(hour => hour >= 6 && hour <= 23).map(hour => {
                    const timeRange = availability[dayKey].get(hour);
                    const isSelected = timeRange !== undefined;
                    const timePickerKey = `${dayKey}-${hour}`;
                    const isTimePickerOpen = openTimePickers[timePickerKey];
                    
                    return (
                      <TimePicker
                        key={`${day}-${hour}`}
                        hour={hour}
                        initialTimeRange={timeRange || undefined}
                        onSave={(range) => handleTimePickerSave(day, hour, range)}
                        onCancel={() => handleTimePickerCancel(day, hour)}
                        onRemove={() => handleTimePickerRemove(day, hour)}
                        open={isTimePickerOpen}
                        onOpenChange={(open) => {
                          debugLog(`Mobile onOpenChange: ${timePickerKey}`, {
                            newOpenState: open,
                            currentState: openTimePickers[timePickerKey],
                            trigger: 'popover-internal'
                          });
                          
                          // Only update state if it's actually changing to prevent redundant updates
                          if (openTimePickers[timePickerKey] !== open) {
                            setOpenTimePickers(prev => {
                              const newState = { ...prev, [timePickerKey]: open };
                              debugLog(`Mobile state after onOpenChange:`, newState);
                              return newState;
                            });
                          } else {
                            debugLog(`Mobile onOpenChange: no state change needed`);
                          }
                        }}
                      >
                        <button
                          className={cn(
                            "p-2 text-xs rounded border transition-all select-none min-h-[2.5rem] flex flex-col items-center justify-center",
                            isSelected 
                              ? "bg-primary border-primary text-primary-foreground font-medium" 
                              : "bg-background border-border hover:bg-muted active:bg-muted"
                          )}
                          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                          onClick={(e) => {
                            e.preventDefault();
                            handleHourClick(day, hour);
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {isSelected && timeRange && <Clock className="h-3 w-3" />}
                            <span>{formatTimeRange(hour, timeRange)}</span>
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

      {/* Desktop Calendar - Traditional Grid */}
      <Card className="hidden lg:block">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Click hour slots to set your availability. Click again to set precise times.
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
                    const dayKey = day.toLowerCase();
                    
                    return (
                      <React.Fragment key={day}>
                        <div className="font-medium text-sm py-2">
                          <div>{day}</div>
                        </div>
                        {HOURS.map(hour => {
                          const timeRange = availability[dayKey].get(hour);
                          const isSelected = timeRange !== undefined;
                          const timePickerKey = `${dayKey}-${hour}`;
                          const isTimePickerOpen = openTimePickers[timePickerKey];
                          
                          return (
                            <TimePicker
                              key={`${day}-${hour}`}
                              hour={hour}
                              initialTimeRange={timeRange || undefined}
                              onSave={(range) => handleTimePickerSave(day, hour, range)}
                              onCancel={() => handleTimePickerCancel(day, hour)}
                              onRemove={() => handleTimePickerRemove(day, hour)}
                              open={isTimePickerOpen}
                              onOpenChange={(open) => {
                                debugLog(`Desktop onOpenChange: ${timePickerKey}`, {
                                  newOpenState: open,
                                  currentState: openTimePickers[timePickerKey],
                                  trigger: 'popover-internal'
                                });
                                
                                // Only update state if it's actually changing to prevent redundant updates
                                if (openTimePickers[timePickerKey] !== open) {
                                  setOpenTimePickers(prev => {
                                    const newState = { ...prev, [timePickerKey]: open };
                                    debugLog(`Desktop state after onOpenChange:`, newState);
                                    return newState;
                                  });
                                } else {
                                  debugLog(`Desktop onOpenChange: no state change needed`);
                                }
                              }}
                            >
                              <div
                                className={cn(
                                  "h-10 border rounded cursor-pointer transition-all select-none flex items-center justify-center",
                                  isSelected 
                                    ? "bg-primary border-primary text-primary-foreground" 
                                    : "bg-background border-border hover:bg-muted"
                                )}
                                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                                onClick={() => handleHourClick(day, hour)}
                              >
                                {isSelected && timeRange && (
                                  <Clock className="h-3 w-3" />
                                )}
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