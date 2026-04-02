import { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { differenceInYears } from 'date-fns';
import { Circle, Upload, X } from 'lucide-react';
import {
  Home, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
  Smartphone, Laptop, Tv, Music, Gamepad, Book, GraduationCap,
  Briefcase, DollarSign, CreditCard, Wallet, PiggyBank, TrendingUp,
  Heart, Activity, Pill, Stethoscope, Dumbbell, Apple,
  Shirt, Watch, Scissors, Paintbrush, Palette,
  Gift, PartyPopper, Beer, Pizza, IceCream, Cake,
  Bus, Train, Bike, Fuel, Wrench, Hammer,
  Lightbulb, Zap, Droplet, Wifi, Phone, Mail,
  ShoppingBag, Package, Tag, Store, Building, Factory,
  Trees, Flower2, Leaf, Umbrella, CloudRain, Sun,
  Moon, Star, Sparkles, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint, Baby,
  Sandwich, Salad, Soup, Wine, CupSoda, Cherry, Carrot, Croissant, Milk,
  ChefHat, UtensilsCrossed, CookingPot, ConciergeBell,
  Truck, Ship, Sailboat, Rocket, Ambulance,
  Navigation, MapPin, Compass,
  Sofa, Bed, Bath, Refrigerator, WashingMachine, AirVent, Heater, Fan,
  Drill, PaintRoller, Ruler, Shovel, Key,
  Flame, Thermometer, BatteryCharging,
  ShoppingBasket, Ticket, Receipt, Banknote, Coins, HandCoins,
  Barcode, QrCode, Percent, BadgeDollarSign,
  Syringe, Glasses, Bandage,
  Droplets, Wind, TreePine,
  Popcorn, Guitar, Piano,
  Mountain, Tent, Footprints,
  TrendingDown, Calculator, FileText, ChartBar, ChartLine, ChartPie,
  Globe, Handshake, Users, UserPlus, Building2,
  Smile, Flower,
  School, BookOpen, Bookmark, Library, Pencil, PenTool, NotebookPen,
  Repeat, RefreshCw, Calendar, Bell, Newspaper,
  MessageCircle, Send, Monitor,
  Rabbit, Squirrel,
  AlertCircle, CheckCircle, XCircle, HelpCircle, Info, Settings, Archive, Folder,
  Cigarette
} from 'lucide-react';

const ICON_MAP = {
  Home, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
  Smartphone, Laptop, Tv, Music, Gamepad, Book, GraduationCap,
  Briefcase, DollarSign, CreditCard, Wallet, PiggyBank, TrendingUp,
  Heart, Activity, Pill, Stethoscope, Dumbbell, Apple,
  Shirt, Watch, Scissors, Paintbrush, Palette,
  Gift, PartyPopper, Beer, Pizza, IceCream, Cake,
  Bus, Train, Bike, Fuel, Wrench, Hammer,
  Lightbulb, Zap, Droplet, Wifi, Phone, Mail,
  ShoppingBag, Package, Tag, Store, Building, Factory,
  Trees, Flower2, Leaf, Umbrella, CloudRain, Sun,
  Moon, Star, Sparkles, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle, Baby,
  Sandwich, Salad, Soup, Wine, CupSoda, Cherry, Carrot, Croissant, Milk,
  ChefHat, UtensilsCrossed, CookingPot, ConciergeBell,
  Truck, Ship, Sailboat, Rocket, Ambulance,
  Navigation, MapPin, Compass,
  Sofa, Bed, Bath, Refrigerator, WashingMachine, AirVent, Heater, Fan,
  Drill, PaintRoller, Ruler, Shovel, Key,
  Flame, Thermometer, BatteryCharging,
  ShoppingBasket, Ticket, Receipt, Banknote, Coins, HandCoins,
  Barcode, QrCode, Percent, BadgeDollarSign,
  Syringe, Glasses, Bandage,
  Droplets, Wind, TreePine,
  Popcorn, Guitar, Piano,
  Mountain, Tent, Footprints,
  TrendingDown, Calculator, FileText, ChartBar, ChartLine, ChartPie,
  Globe, Handshake, Users, UserPlus, Building2,
  Smile, Flower,
  School, BookOpen, Bookmark, Library, Pencil, PenTool, NotebookPen,
  Repeat, RefreshCw, Calendar, Bell, Newspaper,
  MessageCircle, Send, Monitor,
  Rabbit, Squirrel,
  AlertCircle, CheckCircle, XCircle, HelpCircle, Info, Settings, Archive, Folder,
  Cigarette
};

const ICON_NAMES = Object.keys(ICON_MAP);

const CUSTOM_COLOR_PALETTE = [
  { name: 'Tea Green', hex: '#AACC96' },
  { name: 'Forest', hex: '#25533F' },
  { name: 'Peach Frost', hex: '#F4BEAE' },
  { name: 'Blueberry', hex: '#52A5CE' },
  { name: 'Bubblegum', hex: '#FF7BAC' },
  { name: 'Dry Earth', hex: '#876029' },
  { name: 'Grape Juice', hex: '#6D1F42' },
  { name: 'Lilacs', hex: '#D3B6D3' },
  { name: 'Butter Yellow', hex: '#EFCE7B' },
  { name: 'Iced Blue', hex: '#B8CEE8' },
  { name: 'Blood Orange', hex: '#EF6F3C' },
  { name: 'Olive Green', hex: '#AFAB23' },
  { name: 'Coral', hex: '#FF9B82' },
  { name: 'Teal', hex: '#4DB8A8' },
  { name: 'Soft Lavender', hex: '#C8B6E2' },
  { name: 'Terracotta', hex: '#D67F5E' },
  { name: 'Sage', hex: '#88B69D' },
  { name: 'Dusty Rose', hex: '#D4A5A5' }
];

export function CreateChildProfileSheet({ open, onOpenChange, onChildCreated, profileId }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    avatar: { icon: 'Circle', color: '#52A5CE' },
    current_permission_level: 1,
    daily_spending_limit: '',
    weekly_spending_limit: '',
    monthly_spending_limit: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('icon');
  const [iconSearch, setIconSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const filteredIcons = ICON_NAMES.filter(iconName =>
    iconName.toLowerCase().includes(iconSearch.toLowerCase())
  );

  const SelectedIcon = formData.avatar?.icon && ICON_MAP[formData.avatar.icon]
    ? ICON_MAP[formData.avatar.icon]
    : Circle;

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${profileId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { supabase } = await import('@/api/supabaseClient');

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({
        ...formData,
        avatar: { ...formData.avatar, imageUrl: publicUrl, icon: null }
      });

      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (formData.date_of_birth) {
      const birthDate = new Date(formData.date_of_birth);
      const calculatedAge = differenceInYears(new Date(), birthDate);
      setAge(calculatedAge);

      let suggestedLevel = 1;
      if (calculatedAge >= 15) {
        suggestedLevel = 3;
      } else if (calculatedAge >= 11) {
        suggestedLevel = 2;
      }

      if (formData.current_permission_level !== suggestedLevel) {
        setFormData(prev => ({ ...prev, current_permission_level: suggestedLevel }));
      }
    } else {
      setAge(null);
    }
  }, [formData.date_of_birth]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.first_name.trim()) {
      toast.error('Please enter first name');
      return;
    }

    if (!formData.last_name.trim()) {
      toast.error('Please enter last name');
      return;
    }

    if (formData.first_name.length < 2 || formData.first_name.length > 50) {
      toast.error('First name must be between 2 and 50 characters');
      return;
    }

    if (formData.last_name.length < 2 || formData.last_name.length > 50) {
      toast.error('Last name must be between 2 and 50 characters');
      return;
    }

    try {
      setLoading(true);
      await childProfilesAPI.createChildProfile(profileId, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        child_name: `${formData.first_name} ${formData.last_name}`,
        date_of_birth: formData.date_of_birth || null,
        sex: formData.sex || null,
        avatar: formData.avatar,
        current_permission_level: formData.current_permission_level,
        daily_spending_limit: formData.daily_spending_limit ? parseFloat(formData.daily_spending_limit) : null,
        weekly_spending_limit: formData.weekly_spending_limit ? parseFloat(formData.weekly_spending_limit) : null,
        monthly_spending_limit: formData.monthly_spending_limit ? parseFloat(formData.monthly_spending_limit) : null,
        notes: formData.notes || null,
      });

      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        sex: '',
        avatar: { icon: 'Circle', color: '#52A5CE' },
        current_permission_level: 1,
        daily_spending_limit: '',
        weekly_spending_limit: '',
        monthly_spending_limit: '',
        notes: '',
      });

      toast.success('Child profile created successfully');
      onOpenChange(false);
      if (onChildCreated) {
        onChildCreated();
      }
    } catch (error) {
      console.error('Error creating child profile:', error);
      toast.error(error.message || 'Failed to create child profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Child Profile</SheetTitle>
          <SheetDescription>
            Create a child profile to teach financial responsibility
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Avatar</Label>
              <div className="flex items-center gap-4">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="relative w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                      style={{ backgroundColor: formData.avatar?.color || '#52A5CE' }}
                    >
                      {formData.avatar?.imageUrl ? (
                        <>
                          <img
                            src={formData.avatar.imageUrl}
                            alt="Avatar"
                            className="w-full h-full rounded-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData({ ...formData, avatar: { ...formData.avatar, imageUrl: null, icon: 'Circle' } });
                            }}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <SelectedIcon className="w-12 h-12 text-white" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="start">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="w-full grid grid-cols-2">
                        <TabsTrigger value="icon">Icon</TabsTrigger>
                        <TabsTrigger value="color">Color</TabsTrigger>
                      </TabsList>

                      <TabsContent value="icon" className="mt-4 space-y-3">
                        <Input
                          placeholder="Search icons..."
                          value={iconSearch}
                          onChange={(e) => setIconSearch(e.target.value)}
                          className="h-9 text-sm"
                        />
                        <div className="grid grid-cols-6 gap-1 max-h-64 overflow-y-auto pr-1">
                          {filteredIcons.map((iconName) => {
                            const Icon = ICON_MAP[iconName];
                            if (!Icon) return null;

                            return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, avatar: { ...formData.avatar, icon: iconName, imageUrl: null } });
                                }}
                                className={`w-10 h-10 flex items-center justify-center rounded hover:bg-slate-100 transition-all ${
                                  formData.avatar?.icon === iconName ? 'bg-slate-800 text-white' : 'text-slate-600'
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </button>
                            );
                          })}
                        </div>
                      </TabsContent>

                      <TabsContent value="color" className="mt-4">
                        <div className="grid grid-cols-6 gap-2">
                          {CUSTOM_COLOR_PALETTE.map((colorOption) => (
                            <button
                              key={colorOption.hex}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, avatar: { ...formData.avatar, color: colorOption.hex } });
                              }}
                              className={`w-10 h-10 rounded-full border-2 transition-all ${
                                formData.avatar?.color === colorOption.hex
                                  ? 'border-slate-800 scale-110'
                                  : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                              }`}
                              style={{ backgroundColor: colorOption.hex }}
                            />
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </PopoverContent>
                </Popover>

                <div className="flex-1">
                  <label htmlFor="avatar-upload">
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      disabled={uploading}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Image'}
                    </Button>
                  </label>
                  <p className="text-xs text-slate-500 mt-2">
                    Or click the avatar to choose an icon and color
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first-name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Enter first name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last-name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-of-birth">Date of Birth</Label>
                <Input
                  id="date-of-birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
                {age !== null && (
                  <p className="text-sm text-slate-500">Age: {age} years old</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select
                  value={formData.sex}
                  onValueChange={(value) => setFormData({ ...formData, sex: value })}
                >
                  <SelectTrigger id="sex">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Permission Tier</h3>
              <div className="space-y-2">
                <Select
                  value={String(formData.current_permission_level)}
                  onValueChange={(value) => setFormData({ ...formData, current_permission_level: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1 - Basic Access</SelectItem>
                    <SelectItem value="2">Tier 2 - Rewards</SelectItem>
                    <SelectItem value="3">Tier 3 - Money</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-500">
                  {formData.current_permission_level === 1 && 'Basic access to view chores and points'}
                  {formData.current_permission_level === 2 && 'Can earn and redeem rewards'}
                  {formData.current_permission_level === 3 && 'Full access including money management'}
                </p>
              </div>
            </div>

            {formData.current_permission_level > 1 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Spending Limits (Optional)</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="daily-limit">Daily Limit</Label>
                    <Input
                      id="daily-limit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.daily_spending_limit}
                      onChange={(e) => setFormData({ ...formData, daily_spending_limit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weekly-limit">Weekly Limit</Label>
                    <Input
                      id="weekly-limit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.weekly_spending_limit}
                      onChange={(e) => setFormData({ ...formData, weekly_spending_limit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthly-limit">Monthly Limit</Label>
                    <Input
                      id="monthly-limit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthly_spending_limit}
                      onChange={(e) => setFormData({ ...formData, monthly_spending_limit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this child's profile..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creating...' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
