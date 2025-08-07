import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Settings as SettingsIcon, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function Settings() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    browserNotifications: true,
    emailNotifications: true,
    reminderTime: 30
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        browserNotifications: profile.preferences?.notifications?.browser ?? true,
        emailNotifications: profile.preferences?.notifications?.email ?? true,
        reminderTime: profile.preferences?.notifications?.reminderTime ?? 30
      });
    }
  }, [profile]);

  const handleSaveSettings = async () => {
    if (!user || !profile) return;

    setLoading(true);
    try {
      const updates = {
        preferences: {
          notifications: {
            sms: profile.preferences?.notifications?.sms ?? true,
            push: profile.preferences?.notifications?.push ?? true,
            browser: formData.browserNotifications,
            email: formData.emailNotifications,
            reminderTime: formData.reminderTime
          }
        }
      };

      await updateProfile(updates);
      toast.success('Settings saved successfully! 💾');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };



  const reminderOptions = [
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 120, label: '2 hours before' }
  ];

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage your account and notification preferences</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Choose how you want to be notified about gym sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <Label className="text-sm font-medium">Browser Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get instant desktop/mobile notifications (FREE!)
                  </p>
                </div>
                <Switch
                  checked={formData.browserNotifications}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, browserNotifications: checked }))
                  }
                  className="shrink-0"
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <Label className="text-sm font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get email alerts about sessions and updates (FREE!)
                  </p>
                </div>
                <Switch
                  checked={formData.emailNotifications}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, emailNotifications: checked }))
                  }
                  className="shrink-0"
                />
              </div>


              <div className="space-y-3">
                <Label className="text-sm font-medium">Reminder Timing</Label>
                <select
                  value={formData.reminderTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, reminderTime: Number(e.target.value) }))}
                  className="w-full p-3 border border-input rounded-md bg-background text-sm min-h-[44px]"
                >
                  {reminderOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  When to send session reminders
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Card>
          <CardContent className="p-4">
            <Button 
              onClick={handleSaveSettings} 
              disabled={loading}
              className="w-full min-h-[44px]"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}