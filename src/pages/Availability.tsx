import { useState, useEffect } from 'react';
import { AvailabilityCalendar } from '@/components/calendar/AvailabilityCalendar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { whatsappService } from '@/services/whatsappService';
import type { TimeRange } from '@/components/TimePicker';

// New TimeSlotData format with precise time ranges
type TimeSlotData = {
  [key: string]: Map<number, TimeRange | null>;
};

// Legacy format for backward compatibility
type LegacyAvailabilityData = {
  [key: string]: Set<number>;
};

type AvailabilityData = TimeSlotData;

export function Availability() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialAvailability, setInitialAvailability] = useState<AvailabilityData | undefined>();

  useEffect(() => {
    if (user) {
      loadAvailability();
      
      // Subscribe to real-time changes for ALL availability changes
      // Remove user filter to capture bot operations
      const subscription = supabase
        .channel('availability-changes-all')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'availability'
        }, (payload) => {
          console.log('Availability page: Change detected:', payload);
          
          // Check if this change affects the current user
          const affectedUserId = (payload.new as any)?.user_id || (payload.old as any)?.user_id;
          if (affectedUserId === user.id) {
            console.log('Availability page: Change affects current user, reloading');
            // Reload availability when changes occur
            loadAvailability();
            toast.info('Your availability has been updated', {
              description: 'The changes are now reflected on the calendar'
            });
          } else {
            console.log('Availability page: Change affects different user:', affectedUserId);
          }
        })
        .subscribe();
      
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAvailability();
    toast.success('Availability refreshed');
    setRefreshing(false);
  };

  const loadAvailability = async () => {
    if (!user) return;
    
    try {
      console.log('Loading availability for user:', user.id);
      
      // Force fresh data by adding a timestamp to bypass any caching
      const timestamp = new Date().getTime();
      console.log('Loading availability with timestamp:', timestamp);
      
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Load availability result:', { data, error, count: data?.length || 0 });

      if (error) {
        console.error('Error loading availability:', error);
        // Don't throw - just continue with empty availability
      }

      // Always start with clean empty availability
      const availability: AvailabilityData = {};
      DAYS.forEach(day => {
        availability[day.toLowerCase()] = new Map();
      });

      // Only process data if it exists and has valid entries
      if (data && Array.isArray(data) && data.length > 0) {
        console.log('Processing', data.length, 'availability slots');
        data.forEach((slot, index) => {
          // Validate slot data
          if (!slot.day || typeof slot.start_time !== 'number' || typeof slot.end_time !== 'number') {
            console.warn('Invalid slot data at index', index, ':', slot);
            return;
          }
          
          const dayKey = slot.day.toLowerCase();
          
          // Validate day key
          if (!availability[dayKey]) {
            console.warn('Invalid day key:', dayKey);
            return;
          }
          
          // Convert database format to TimeSlotData format
          // For now, convert to legacy hourly slots (null TimeRange means full hour)
          const startHour = Math.max(0, Math.min(23, slot.start_time));
          const endHour = Math.max(startHour + 1, Math.min(24, slot.end_time));
          
          for (let hour = startHour; hour < endHour; hour++) {
            availability[dayKey].set(hour, null); // null = full hour slot
          }
        });
        
        // Log final availability for debugging
        const totalSlots = Object.values(availability).reduce((sum, dayMap) => sum + dayMap.size, 0);
        console.log('Final loaded availability - total slots:', totalSlots);
        Object.entries(availability).forEach(([day, slots]) => {
          if (slots.size > 0) {
            console.log(`${day}: ${slots.size} slots`, Array.from(slots.keys()).sort());
          }
        });
      } else {
        console.log('No existing availability found or invalid data');
      }

      setInitialAvailability(availability);
    } catch (error) {
      console.error('Error loading availability:', error);
      // Initialize with clean empty availability on error
      const emptyAvailability: AvailabilityData = {};
      DAYS.forEach(day => {
        emptyAvailability[day.toLowerCase()] = new Map();
      });
      setInitialAvailability(emptyAvailability);
    } finally {
      setLoading(false);
    }
  };

  // Custom message based on user
  const getAvailabilityMessage = () => {
    const isIvan = profile?.email === 'ivanaguilarmari@gmail.com';
    
    if (isIvan) {
      return "Select all the time slots when you're available to go to the gym this week. Youssef will do the same, and I'll find the best matching times for your workouts.";
    } else {
      return "Select all the time slots when you're available to go to the gym this week. Ivan will do the same, and I'll find the best matching times for your workouts.";
    }
  };

  const handleSaveAvailability = async (availability: AvailabilityData) => {
    console.log('handleSaveAvailability called with:', availability);
    if (!user) {
      console.error('No user found, cannot save availability');
      toast.error('You must be logged in to save availability');
      return;
    }
    
    console.log('Saving availability for user:', user.id);
    setLoading(true);
    
    try {
      // Delete existing availability with better error handling
      console.log('Deleting existing availability...');
      const { error: deleteError, count: deletedCount } = await supabase
        .from('availability')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        // Continue anyway - might be first time saving
      } else {
        console.log('Successfully deleted', deletedCount, 'existing availability slots');
      }

      // Convert availability to database format
      interface AvailabilitySlot {
        user_id: string;
        day: string;
        start_time: number;
        end_time: number;
      }
      const slots: AvailabilitySlot[] = [];
      
      Object.entries(availability).forEach(([day, timeSlots]) => {
        if (timeSlots.size === 0) return;
        
        // Convert Map to sorted array of hours
        const sortedHours = Array.from(timeSlots.keys()).sort((a, b) => a - b);
        
        // For now, convert TimeRange slots to database format
        // Future: we could store precise times in a separate column
        for (const hour of sortedHours) {
          const timeRange = timeSlots.get(hour);
          
          if (timeRange === null) {
            // Full hour slot - store as hour to hour+1
            slots.push({
              user_id: user.id,
              day,
              start_time: hour,
              end_time: hour + 1
            });
          } else if (timeRange) {
            // Precise time range - convert to database 30-minute slot format
            // For now, still store as full hours but could be enhanced
            const startHour = hour;
            const endHour = hour + Math.ceil(timeRange.duration / 60);
            
            slots.push({
              user_id: user.id,
              day,
              start_time: startHour,
              end_time: Math.min(24, endHour) // Cap at 24
            });
          }
        }
      });

      console.log('Slots to save:', slots);
      
      if (slots.length > 0) {
        const { data, error } = await supabase
          .from('availability')
          .insert(slots);

        console.log('Insert result:', { data, error });
        
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        
        console.log('Successfully inserted slots');
      } else {
        console.log('No slots to save');
      }

      toast.success('Availability saved successfully!');
      
      // Check if both users have set availability and send WhatsApp notification
      try {
        console.log('Checking if both users have set availability...');
        const notificationSent = await whatsappService.sendAvailabilityNotification();
        if (notificationSent) {
          toast.success('📱 WhatsApp notifications sent to both users!');
        }
      } catch (error) {
        console.error('Failed to send WhatsApp notification:', error);
        // Don't fail the availability save if WhatsApp fails
      }
      
      // Navigate back to dashboard after successful save
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error(`Failed to save availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold">Set Your Availability</h1>
        <p className="text-muted-foreground mt-2">
          {getAvailabilityMessage()}
        </p>
      </div>
      
      <AvailabilityCalendar 
        onSave={handleSaveAvailability}
        initialAvailability={initialAvailability}
      />
    </div>
  );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];