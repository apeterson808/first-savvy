import { useState } from 'react';
import { Globe, DollarSign, Calendar, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { updateUserProfile } from '../../api/userSettings';
import { useTheme } from 'next-themes';

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
  { value: 'CNY', label: 'Chinese Yuan (CNY)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
  { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY (Dec 31, 2024)' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

export default function PreferencesTab({ profile, onUpdate }) {
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    currency: profile?.currency || 'USD',
    date_format: profile?.date_format || 'MM/DD/YYYY',
    timezone: profile?.timezone || 'UTC',
    language: profile?.language || 'en',
    theme: profile?.theme || 'system',
  });

  const handleChange = (field, value) => {
    setPreferences(prev => ({ ...prev, [field]: value }));

    if (field === 'theme') {
      setTheme(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (profile?.id === 'demo') {
      toast.info('Demo mode: Changes are not saved');
      onUpdate({ ...profile, ...preferences });
      return;
    }

    setLoading(true);

    try {
      const updatedProfile = await updateUserProfile(profile.id, preferences);
      onUpdate(updatedProfile);
      toast.success('Preferences updated successfully');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Customize your application experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Theme
              </Label>
              <Select
                value={preferences.theme}
                onValueChange={(value) => handleChange('theme', value)}
              >
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color theme
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Currency
              </Label>
              <Select
                value={preferences.currency}
                onValueChange={(value) => handleChange('currency', value)}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(currency => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default currency for displaying amounts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_format" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Format
              </Label>
              <Select
                value={preferences.date_format}
                onValueChange={(value) => handleChange('date_format', value)}
              >
                <SelectTrigger id="date_format">
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How dates will be displayed throughout the app
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Timezone
              </Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => handleChange('timezone', value)}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Your local timezone for accurate time display
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Language
              </Label>
              <Select
                value={preferences.language}
                onValueChange={(value) => handleChange('language', value)}
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Preferred language for the application interface
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
