import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Users, Calendar, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { sessionMatchingService, type WeeklySessionPlan, formatSession } from '@/services/sessionMatching';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { GymSession } from '@/types';
import { whatsappService, WHATSAPP_TEMPLATES } from '@/services/whatsappService';
import { downloadICSFile } from '@/utils/calendarExport';

export function Sessions() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessionPlans, setSessionPlans] = useState<WeeklySessionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<WeeklySessionPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSessions, setConfirmedSessions] = useState<GymSession[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [view, setView] = useState<'suggestions' | 'confirmed'>('suggestions');

  useEffect(() => {
    if (user) {
      findSessionMatches();
      loadConfirmedSessions();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper function to send WhatsApp notifications
  const sendWhatsAppNotification = async (partnerData: { phone_number?: string; preferences?: { notifications?: { whatsapp?: boolean } } }, template: (...args: string[]) => string, templateData: string[]) => {
    try {
      // Check if current user has WhatsApp notifications enabled and phone number
      if (profile?.preferences?.notifications?.whatsapp && profile?.phoneNumber) {
        const message = template(...templateData);
        whatsappService.sendMessage(profile.phoneNumber, message);
      }

      // Check if partner has WhatsApp notifications enabled and phone number
      if (partnerData?.phone_number && partnerData?.preferences?.notifications?.whatsapp) {
        const message = template(...templateData);
        whatsappService.sendMessage(partnerData.phone_number, message);
      }
    } catch (error) {
      console.error('Error sending WhatsApp notification:', error);
      // Don't show error to user - notifications are optional
    }
  };

  const loadConfirmedSessions = async () => {
    if (!user) return;

    try {
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'confirmed')
        .contains('participants', [user.id])
        .order('date', { ascending: true });

      if (error) throw error;

      // Convert database format to GymSession type
      const formattedSessions: GymSession[] = sessions?.map(session => ({
        id: session.id,
        participants: session.participants,
        date: new Date(session.date),
        startTime: session.start_time,
        endTime: session.end_time,
        status: session.status as 'confirmed' | 'cancelled' | 'completed',
        createdAt: new Date(session.created_at)
      })) || [];

      setConfirmedSessions(formattedSessions);
      
      // If there are confirmed sessions, switch to that view
      if (formattedSessions.length > 0) {
        setView('confirmed');
      }

    } catch (error) {
      console.error('Error loading confirmed sessions:', error);
      toast.error('Failed to load confirmed sessions');
    }
  };

  const findSessionMatches = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Finding session matches...');

      // Get current user's availability from database
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', user.id);

      if (currentUserError) {
        console.error('Error loading current user availability:', currentUserError);
        throw currentUserError;
      }

      console.log('Current user availability data:', currentUserData);

      // Check if current user has set availability
      if (!currentUserData || currentUserData.length === 0) {
        console.log('Current user has not set availability');
        setSessionPlans([]);
        toast.info('Please set your availability first before finding sessions!');
        return;
      }

      // Check if there are any other users in the system (Youssef)
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, name')
        .neq('id', user.id);

      if (usersError) {
        console.error('Error loading other users:', usersError);
        throw usersError;
      }

      console.log('Other users found:', allUsers?.length || 0);

      if (!allUsers || allUsers.length === 0) {
        console.log('No partner has joined the app yet');
        setSessionPlans([]);
        toast.info('Youssef hasn\'t joined the app yet! Once he creates his account and sets his availability, you\'ll be able to find matching sessions.');
        return;
      }

      // For now, we'll still use mock data for Youssef since he hasn't set real availability
      // But we know he exists in the system
      const partnerId = allUsers[0].id;
      
      // Check if partner has set availability
      const { data: partnerData, error: partnerError } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', partnerId);

      if (partnerError) {
        console.error('Error loading partner availability:', partnerError);
        throw partnerError;
      }

      console.log('Partner availability data:', partnerData);

      if (!partnerData || partnerData.length === 0) {
        console.log('Partner has not set availability');
        setSessionPlans([]);
        toast.info('Youssef hasn\'t set his availability yet! Once he does, you\'ll be able to find matching sessions.');
        return;
      }

      // Convert current user's data to TimeSlot format
      const currentUserAvailability: Array<{ day: string; hour: number; dayIndex: number }> = [];
      currentUserData?.forEach(slot => {
        const dayIndex = getDayIndex(slot.day);
        for (let hour = slot.start_time; hour < slot.end_time; hour++) {
          currentUserAvailability.push({
            day: slot.day,
            hour,
            dayIndex
          });
        }
      });

      // Convert partner's data to TimeSlot format
      const partnerAvailability: Array<{ day: string; hour: number; dayIndex: number }> = [];
      partnerData?.forEach(slot => {
        const dayIndex = getDayIndex(slot.day);
        for (let hour = slot.start_time; hour < slot.end_time; hour++) {
          partnerAvailability.push({
            day: slot.day,
            hour,
            dayIndex
          });
        }
      });

      console.log('Current user slots:', currentUserAvailability.length);
      console.log('Partner slots:', partnerAvailability.length);

      // Find overlapping slots
      const overlappingSlots = sessionMatchingService.findOverlappingSlots(currentUserAvailability, partnerAvailability);
      
      if (overlappingSlots.length === 0) {
        console.log('No overlapping availability found');
        setSessionPlans([]);
        toast.info('No matching time slots found! Try updating your availability to overlap with your partner\'s schedule.');
        return;
      }

      // Generate session options
      const sessionOptions = sessionMatchingService.generateSessionOptions(overlappingSlots, [user.id, partnerId]);

      if (sessionOptions.length < 2) {
        console.log('Not enough session options for weekly plan');
        setSessionPlans([]);
        toast.info('Found some matching times, but not enough for a full weekly plan. Try adding more availability!');
        return;
      }

      // Create weekly plans
      const plans = sessionMatchingService.createWeeklyPlans(sessionOptions);
      setSessionPlans(plans);

      if (plans.length === 0) {
        toast.info('No optimal weekly plans found. Try adjusting your availability times.');
      } else {
        toast.success(`Found ${plans.length} workout schedule options!`);
        
        // Send WhatsApp notification that both users have set availability
        const { data: partnerFullData } = await supabase
          .from('users')
          .select('*')
          .eq('id', partnerId)
          .single();

        if (partnerFullData) {
          await sendWhatsAppNotification(
            partnerFullData,
            WHATSAPP_TEMPLATES.AVAILABILITY_READY,
            [partnerFullData.name || 'Your partner']
          );
        }
      }

    } catch (error) {
      console.error('Error finding session matches:', error);
      toast.error('Failed to find session matches');
    } finally {
      setLoading(false);
    }
  };


  const handleConfirmPlan = async (plan: WeeklySessionPlan) => {
    if (!user) return;

    setConfirming(true);
    try {
      // Get partner ID from database
      const { data: partnerData, error: partnerError } = await supabase
        .from('users')
        .select('id')
        .neq('id', user.id)
        .limit(1);

      if (partnerError || !partnerData || partnerData.length === 0) {
        toast.error('Cannot find your gym partner. Make sure they have created an account.');
        return;
      }

      const partnerId = partnerData[0].id;

      // Get partner's full data for notifications
      const { data: partnerFullData, error: partnerDataError } = await supabase
        .from('users')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (partnerDataError) {
        console.error('Error getting partner data:', partnerDataError);
      }

      // Create sessions in the database with confirmed status
      const sessions = [
        {
          participants: [user.id, partnerId],
          date: getNextDateForDay(plan.session1.dayIndex),
          start_time: plan.session1.hour,
          end_time: plan.session1.hour + plan.session1.duration,
          status: 'confirmed' as const
        },
        {
          participants: [user.id, partnerId],
          date: getNextDateForDay(plan.session2.dayIndex),
          start_time: plan.session2.hour,
          end_time: plan.session2.hour + plan.session2.duration,
          status: 'confirmed' as const
        }
      ];

      const { error } = await supabase
        .from('sessions')
        .insert(sessions);

      if (error) throw error;

      // Send WhatsApp notifications for both sessions
      const session1Date = new Date(getNextDateForDay(plan.session1.dayIndex));
      const session2Date = new Date(getNextDateForDay(plan.session2.dayIndex));
      
      const session1Day = session1Date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const session2Day = session2Date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      
      const session1Time = formatSessionTimeFromHour(plan.session1.hour, plan.session1.duration);
      const session2Time = formatSessionTimeFromHour(plan.session2.hour, plan.session2.duration);

      // Send notification for session 1
      await sendWhatsAppNotification(
        partnerFullData,
        WHATSAPP_TEMPLATES.SESSION_CONFIRMED,
        [partnerFullData?.name || 'Your partner', session1Day, session1Time]
      );

      // Send notification for session 2
      await sendWhatsAppNotification(
        partnerFullData,
        WHATSAPP_TEMPLATES.SESSION_CONFIRMED,
        [partnerFullData?.name || 'Your partner', session2Day, session2Time]
      );

      toast.success('Gym sessions confirmed! 💪 WhatsApp notifications sent!');
      
      // Reload confirmed sessions and switch to that view
      await loadConfirmedSessions();
      setView('confirmed');
      setSelectedPlan(null);

    } catch (error) {
      console.error('Error confirming sessions:', error);
      toast.error('Failed to confirm sessions');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    if (!user) return;

    setCancelling(sessionId);
    try {
      // Get session details for notification
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Get partner data
      const partnerId = sessionData.participants.find((id: string) => id !== user.id);
      const { data: partnerData, error: partnerError } = await supabase
        .from('users')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (partnerError) {
        console.error('Error getting partner data:', partnerError);
      }

      // Update session status
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      // Send WhatsApp notification
      if (sessionData && partnerData) {
        const sessionDate = new Date(sessionData.date);
        const sessionDay = sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const sessionTime = formatSessionTimeFromHour(sessionData.start_time, sessionData.end_time - sessionData.start_time);

        await sendWhatsAppNotification(
          partnerData,
          WHATSAPP_TEMPLATES.SESSION_CANCELLED,
          [profile?.name || 'Your partner', sessionDay, sessionTime]
        );
      }

      toast.success('Session cancelled. WhatsApp notification sent! 📱');
      
      // Reload confirmed sessions
      await loadConfirmedSessions();

    } catch (error) {
      console.error('Error cancelling session:', error);
      toast.error('Failed to cancel session');
    } finally {
      setCancelling(null);
    }
  };

  const getCustomMessage = () => {
    const isIvan = profile?.email === 'ivanaguilarmari@gmail.com';
    
    if (view === 'suggestions') {
      if (isIvan) {
        return "Here are the best matching times based on your and Youssef's availability. Pick your preferred schedule!";
      } else {
        return "Here are the best matching times based on your and Ivan's availability. Pick your preferred schedule!";
      }
    } else {
      return "Your confirmed gym sessions. You can cancel if something comes up.";
    }
  };

  const formatSessionTime = (session: GymSession) => {
    const startHour = Math.floor(session.startTime / 2);
    const startMin = (session.startTime % 2) * 30;
    const endHour = Math.floor(session.endTime / 2);
    const endMin = (session.endTime % 2) * 30;
    
    const formatTime = (hour: number, min: number) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
    };

    return `${formatTime(startHour, startMin)} - ${formatTime(endHour, endMin)}`;
  };

  const formatSessionDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Helper function to format session time from hour numbers
  const formatSessionTimeFromHour = (startHour: number, duration: number) => {
    const endHour = startHour + duration;
    
    const formatTime = (hour: number) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:00 ${period}`;
    };

    return `${formatTime(startHour)} - ${formatTime(endHour)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Finding the perfect workout times...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <h1 className="text-2xl sm:text-3xl font-bold">Workout Sessions</h1>
        <p className="text-muted-foreground mt-2">
          {getCustomMessage()}
        </p>

        {/* View Toggle */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant={view === 'suggestions' ? 'default' : 'outline'}
            onClick={() => setView('suggestions')}
            className="flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            <span>Find Sessions</span>
            {sessionPlans.length > 0 && (
              <Badge variant="secondary" className="ml-1">{sessionPlans.length}</Badge>
            )}
          </Button>
          <Button
            variant={view === 'confirmed' ? 'default' : 'outline'}
            onClick={() => setView('confirmed')}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Confirmed Sessions</span>
            {confirmedSessions.length > 0 && (
              <Badge variant="secondary" className="ml-1">{confirmedSessions.length}</Badge>
            )}
          </Button>
        </div>
      </div>

      {view === 'suggestions' ? (
        sessionPlans.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Matching Sessions Found</h3>
              <p className="text-muted-foreground mb-6">
                Make sure both you and your partner have set your availability with overlapping time slots.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/availability')} className="w-full sm:w-auto">
                  Update Availability
                </Button>
                <Button variant="outline" onClick={findSessionMatches} className="w-full sm:w-auto">
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Weekly Session Options</h2>
                <p className="text-sm text-muted-foreground">
                  Found {sessionPlans.length} optimal workout schedules
                </p>
              </div>
              <Badge variant="secondary">
                2 sessions per week
              </Badge>
            </div>

            <div className="grid gap-6">
              {sessionPlans.map((plan, index) => (
                <Card 
                  key={index} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPlan === plan ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Option {index + 1}
                      </CardTitle>
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        {index === 0 ? 'Recommended' : 'Alternative'}
                      </Badge>
                    </div>
                    <CardDescription>
                      Non-consecutive 2-hour workout sessions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Clock className="h-4 w-4 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">Session 1</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {formatSession(plan.session1)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Clock className="h-4 w-4 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">Session 2</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {formatSession(plan.session2)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {selectedPlan === plan && (
                      <div className="mt-4 pt-4 border-t">
                        <Button 
                          onClick={() => handleConfirmPlan(plan)}
                          disabled={confirming}
                          className="w-full"
                        >
                          {confirming ? 'Confirming...' : 'Confirm This Schedule 🔥'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      ) : (
        // Confirmed Sessions View
        confirmedSessions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Confirmed Sessions</h3>
              <p className="text-muted-foreground mb-6">
                You haven't confirmed any workout sessions yet. Check the "Find Sessions" tab to see available options.
              </p>
              <Button onClick={() => setView('suggestions')} className="w-full sm:w-auto">
                Find Sessions
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Confirmed Sessions</h2>
                <p className="text-sm text-muted-foreground">
                  {confirmedSessions.length} upcoming workout{confirmedSessions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {confirmedSessions.map((session) => {
                const isToday = session.date.toDateString() === new Date().toDateString();
                const isPast = session.date < new Date() && !isToday;
                
                return (
                  <Card key={session.id} className={isPast ? 'opacity-60' : ''}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full shrink-0">
                            <Clock className="h-6 w-6 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-lg">
                              {formatSessionDate(session.date)}
                              {isToday && <span className="text-primary ml-2">(Today!)</span>}
                            </h3>
                            <p className="text-muted-foreground">
                              {formatSessionTime(session)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit sm:w-auto justify-center">
                            <CheckCircle className="h-3 w-3" />
                            Confirmed
                          </Badge>
                          
                          {!isPast && (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const partnerName = profile?.email === 'ivanaguilarmari@gmail.com' ? 'Youssef' : 'Ivan';
                                  downloadICSFile(session, partnerName);
                                  toast.success('Calendar event downloaded! Open the file to add to your calendar.');
                                }}
                                className="w-full sm:w-auto"
                              >
                                <Download className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Add to Calendar</span>
                                <span className="sm:hidden">Calendar</span>
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelSession(session.id)}
                                disabled={cancelling === session.id}
                                className="text-destructive hover:text-destructive w-full sm:w-auto"
                              >
                                {cancelling === session.id ? (
                                  'Cancelling...'
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 sm:mr-1" />
                                    Cancel
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// Helper function to get day index
function getDayIndex(day: string): number {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.indexOf(day.toLowerCase());
}

// Helper function to get next date for a given day index
function getNextDateForDay(dayIndex: number): string {
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
  
  let daysToAdd = dayIndex - todayIndex;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Next week
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);
  
  return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
}