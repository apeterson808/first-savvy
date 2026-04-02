import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { getIconComponent } from '@/components/utils/iconMapper';
import { Circle } from 'lucide-react';
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

export function AddChildSheet({ open, onOpenChange, onChildAdded, profileId }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    avatar_icon: 'User',
    avatar_color: '#52A5CE',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('icon');
  const [iconSearch, setIconSearch] = useState('');

  const filteredIcons = ICON_NAMES.filter(iconName =>
    iconName.toLowerCase().includes(iconSearch.toLowerCase())
  );

  const SelectedIcon = formData.avatar_icon && ICON_MAP[formData.avatar_icon]
    ? ICON_MAP[formData.avatar_icon]
    : Circle;

  useEffect(() => {
    if (formData.date_of_birth) {
      const birthDate = new Date(formData.date_of_birth);
      const calculatedAge = differenceInYears(new Date(), birthDate);
      setAge(calculatedAge);
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
        avatar_icon: formData.avatar_icon,
        avatar_color: formData.avatar_color,
        notes: formData.notes || null,
      });

      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        sex: '',
        avatar_icon: 'User',
        avatar_color: '#52A5CE',
        notes: '',
      });
      setAge(null);

      onChildAdded();
    } catch (error) {
      console.error('Error creating child:', error);
      toast.error('Failed to create child profile');
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
            Create a new child profile to start teaching financial responsibility
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Basic Information</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Enter first name"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-slate-500">{formData.first_name.length}/50</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Enter last name"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-slate-500">{formData.last_name.length}/50</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
              />
              {age !== null && (
                <p className="text-xs text-slate-600">Age: {age} years old</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sex">Sex (Optional)</Label>
              <Select
                value={formData.sex}
                onValueChange={(value) => setFormData({ ...formData, sex: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Avatar</h3>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                    style={{ backgroundColor: formData.avatar_color }}
                  >
                    <SelectedIcon className="w-12 h-12 text-white" />
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
                                setFormData({ ...formData, avatar_icon: iconName });
                              }}
                              className={`w-10 h-10 flex items-center justify-center rounded hover:bg-slate-100 transition-all ${
                                formData.avatar_icon === iconName ? 'bg-slate-800 text-white' : 'text-slate-600'
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
                              setFormData({ ...formData, avatar_color: colorOption.hex });
                            }}
                            className={`w-10 h-10 rounded-full border-2 transition-all ${
                              formData.avatar_color === colorOption.hex
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
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Notes (Optional)</h3>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about your child's financial learning journey..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Child Profile'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
