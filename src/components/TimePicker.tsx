import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Clock } from 'lucide-react'

export interface TimeRange {
  startHour: number   // starting hour (0-23)
  startMinute: number // 0-59
  endHour: number     // ending hour (0-23) 
  endMinute: number   // 0-59
  duration: number    // calculated duration in minutes
}

// Export type for easier importing
export type { TimeRange };

interface TimePickerProps {
  hour: number // 0-23 (24-hour format)  
  initialTimeRange?: TimeRange | null
  onSave: (timeRange: TimeRange) => void
  onRemove?: () => void
  children: React.ReactNode
}

export function TimePicker({ 
  hour, 
  initialTimeRange, 
  onSave, 
  onRemove,
  children
}: TimePickerProps) {
  // Internal popover state
  const [open, setOpen] = useState(false);
  
  // Simplified debug logging
  const debugLog = (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TimePicker-${hour}] ${message}`, data || '');
    }
  };
  
  const [startMinute, setStartMinute] = useState<number>(
    initialTimeRange?.startMinute ?? 0
  )
  const [endMinute, setEndMinute] = useState<number>(
    initialTimeRange?.endMinute ?? 0
  )
  const [endHour, setEndHour] = useState<number>(
    initialTimeRange?.endHour ?? hour + 1
  )

  // Generate time options in 15-minute increments
  const generateMinuteOptions = () => {
    const options = []
    for (let i = 0; i < 60; i += 15) {
      const timeString = i.toString().padStart(2, '0')
      options.push({ value: i, label: timeString })
    }
    return options
  }

  // Generate hour options (current hour to 23)
  const generateEndHourOptions = () => {
    const options = []
    for (let i = hour; i <= 23; i++) {
      options.push({ value: i, label: i.toString() })
    }
    return options
  }

  // Calculate duration whenever times change
  const calculateDuration = () => {
    const startTotalMinutes = hour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute
    return Math.max(0, endTotalMinutes - startTotalMinutes)
  }

  const duration = calculateDuration()

  // Format time display
  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  }

  // Format duration display
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) {
      return `${mins}m`
    } else if (mins === 0) {
      return `${hours}h`
    } else {
      return `${hours}h ${mins}m`
    }
  }

  
  // This useEffect was moved up - removed duplicate

  // Validation: end time must be after start time
  const isValid = duration > 0

  const handleSave = () => {
    if (!isValid) {
      debugLog('Save attempted but time range invalid', { duration });
      return;
    }

    const timeRange: TimeRange = {
      startHour: hour,
      startMinute,
      endHour,
      endMinute,
      duration
    };
    
    debugLog('Save button clicked', { timeRange });
    onSave(timeRange);
    setOpen(false); // Close popover after save
  }

  const handleCancel = () => {
    debugLog('Cancel button clicked');
    setOpen(false); // Close popover on cancel
  }

  const handleRemoveClick = () => {
    debugLog('Remove button clicked');
    if (onRemove) {
      onRemove();
      setOpen(false); // Close popover after remove
    }
  }


  // Reset form when popover opens
  useEffect(() => {
    if (open) {
      if (initialTimeRange) {
        debugLog('Resetting time picker with existing values', {
          startMinute: initialTimeRange.startMinute,
          endMinute: initialTimeRange.endMinute,
          endHour: initialTimeRange.endHour
        });
        setStartMinute(initialTimeRange.startMinute);
        setEndMinute(initialTimeRange.endMinute);
        setEndHour(initialTimeRange.endHour);
      } else {
        debugLog('Resetting time picker with default 1-hour slot');
        // Default to 1-hour slot starting from this hour
        setStartMinute(0);
        setEndMinute(0); 
        setEndHour(Math.min(23, hour + 1));
      }
    }
  }, [open, initialTimeRange, hour]);

  return (
    <Popover 
      open={open} 
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <Card className="border-0 shadow-none">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <Label className="text-base font-semibold">Select Time Range</Label>
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Time */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Start Time</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {hour.toString().padStart(2, '0')}:
                  </span>
                  <Select
                    value={startMinute.toString()}
                    onValueChange={(value) => setStartMinute(parseInt(value))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMinuteOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(hour, startMinute)}
                </div>
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">End Time</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={endHour.toString()}
                    onValueChange={(value) => setEndHour(parseInt(value))}
                  >
                    <SelectTrigger className="w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateEndHourOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-mono">:</span>
                  <Select
                    value={endMinute.toString()}
                    onValueChange={(value) => setEndMinute(parseInt(value))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMinuteOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(endHour, endMinute)}
                </div>
              </div>
            </div>

            {/* Duration Display */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Duration:</Label>
                <span className={`text-sm font-semibold ${
                  isValid ? 'text-foreground' : 'text-destructive'
                }`}>
                  {isValid ? formatDuration(duration) : 'Invalid time range'}
                </span>
              </div>
              {isValid && (
                <div className="text-xs text-muted-foreground mt-1">
                  {formatTime(hour, startMinute)} → {formatTime(endHour, endMinute)}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {initialTimeRange && onRemove && (
                <Button 
                  onClick={handleRemoveClick}
                  variant="destructive" 
                  size="sm"
                  className="flex-1"
                >
                  Remove
                </Button>
              )}
              <Button 
                onClick={handleCancel} 
                variant="outline" 
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!isValid}
                size="sm"
                className="flex-1"
              >
                Save Time
              </Button>
            </div>
          </div>
        </Card>
      </PopoverContent>
    </Popover>
  )
}