import React, { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Upload, Pencil, Search, X,
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
  School, BookOpen, Bookmark, Library, PenTool, NotebookPen,
  Repeat, RefreshCw, Calendar, Bell, Newspaper,
  MessageCircle, Send, Monitor,
  Rabbit, Squirrel,
  AlertCircle, CheckCircle, XCircle, HelpCircle, Info, Settings, Archive, Folder,
  Cigarette,
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
  School, BookOpen, Bookmark, Library, PenTool, NotebookPen,
  Repeat, RefreshCw, Calendar, Bell, Newspaper,
  MessageCircle, Send, Monitor,
  Rabbit, Squirrel,
  AlertCircle, CheckCircle, XCircle, HelpCircle, Info, Settings, Archive, Folder,
  Cigarette,
};

const ICON_NAMES = Object.keys(ICON_MAP);

// Shared color palette — single source of truth for both avatar bg and calendar color
export const PROFILE_COLORS = [
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#84cc16', label: 'Lime' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#64748b', label: 'Slate' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#f43f5e', label: 'Rose' },
];

function getInitials(firstName, lastName) {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (!f && !l) return '?';
  return `${f[0] || ''}${l[0] || ''}`.toUpperCase();
}

// ── Shared avatar preview ────────────────────────────────────────────────────

export function AvatarPreview({ imageUrl, iconName, color, firstName, lastName, size = 'md' }) {
  const sizeClass = { sm: 'w-16 h-16', md: 'w-20 h-20', lg: 'w-24 h-24' }[size] || 'w-20 h-20';
  const iconSize = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-10 w-10' }[size] || 'h-8 w-8';
  const textSize = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' }[size] || 'text-2xl';

  const IconComponent = iconName ? (ICON_MAP[iconName] || null) : null;

  if (imageUrl) {
    return (
      <div className={cn('rounded-full overflow-hidden shrink-0', sizeClass)}>
        <img src={imageUrl} alt="Avatar" className="w-full h-full object-cover" />
      </div>
    );
  }

  const bg = color || '#64748b';

  return (
    <div
      className={cn('rounded-full overflow-hidden shrink-0 flex items-center justify-center', sizeClass)}
      style={{ backgroundColor: bg }}
    >
      {IconComponent
        ? <IconComponent className={cn(iconSize, 'text-white')} />
        : <span className={cn(textSize, 'font-bold text-white')}>{getInitials(firstName, lastName)}</span>
      }
    </div>
  );
}

// ── Inline selector (used in SettingsTab) ────────────────────────────────────
// pending: { type: 'upload', file, previewUrl } | { type: 'icon', iconName } | { color: '#hex' } | null
// color is tracked separately in SettingsTab but passed in as currentColor

function InlineAvatarSelector({ pending, onPendingChange, firstName, lastName, currentAvatar, currentColor }) {
  const fileRef = useRef(null);
  const [iconSearch, setIconSearch] = useState('');

  const resolvedImageUrl = pending?.type === 'upload'
    ? pending.previewUrl
    : currentAvatar && !currentAvatar.startsWith('icon:')
      ? currentAvatar
      : null;

  const resolvedIcon = pending?.type === 'icon'
    ? pending.iconName
    : currentAvatar?.startsWith('icon:')
      ? currentAvatar.replace('icon:', '')
      : null;

  const filteredIcons = ICON_NAMES.filter(n => n.toLowerCase().includes(iconSearch.toLowerCase()));

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => onPendingChange({ type: 'upload', file, previewUrl: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex gap-6 items-start">
      <div className="shrink-0">
        <AvatarPreview
          imageUrl={resolvedImageUrl}
          iconName={resolvedIcon}
          color={currentColor}
          firstName={firstName}
          lastName={lastName}
          size="lg"
        />
      </div>

      <div className="flex-1 space-y-4">
        {/* Photo */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Photo</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg px-3 py-2 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {resolvedImageUrl ? 'Replace photo' : 'Upload photo'}
            </button>
            {resolvedImageUrl && (
              <button
                type="button"
                onClick={() => onPendingChange({ type: 'remove-photo' })}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Icon */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Icon
            {resolvedIcon && (
              <button
                type="button"
                onClick={() => onPendingChange({ type: 'remove-icon' })}
                className="ml-2 text-slate-400 hover:text-red-500 transition-colors font-normal normal-case"
              >
                (clear)
              </button>
            )}
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search icons..."
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto pr-1">
            {filteredIcons.map((name) => {
              const Icon = ICON_MAP[name];
              if (!Icon) return null;
              const selected = resolvedIcon === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => onPendingChange(selected ? { type: 'remove-icon' } : { type: 'icon', iconName: name })}
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-lg transition-all border',
                    selected
                      ? 'border-slate-900 bg-slate-100'
                      : 'border-transparent hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <Icon className="h-4 w-4 text-slate-600" />
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Shown over the profile color when no photo is set</p>
        </div>
      </div>
    </div>
  );
}

// ── Popover selector (legacy — EditChildProfileDialog, ProfileHeaderCard) ────

function PopoverAvatarSelector({ value, onChange, firstName, lastName, currentAvatar }) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const getCurrentColorHex = () => {
    if (value?.type === 'color') return value.value;
    return null;
  };

  const getImageUrl = () => {
    if (value?.type === 'upload') return value.value;
    if (currentAvatar && !currentAvatar.startsWith('color:') && !currentAvatar.startsWith('icon:')) return currentAvatar;
    return null;
  };

  const getIconName = () => {
    if (currentAvatar?.startsWith('icon:')) return currentAvatar.replace('icon:', '');
    return null;
  };

  const handleColorSelect = (hex) => {
    onChange({ type: 'color', value: hex });
    setPopoverOpen(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ type: 'upload', value: ev.target.result, file });
      setPopoverOpen(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative inline-block">
      <AvatarPreview
        imageUrl={getImageUrl()}
        iconName={getIconName()}
        color={getCurrentColorHex() || '#64748b'}
        firstName={firstName}
        lastName={lastName}
        size="lg"
      />
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="default"
            className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Profile Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {PROFILE_COLORS.map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onClick={() => handleColorSelect(hex)}
                  className="w-8 h-8 rounded-full transition-all hover:scale-110 border-2"
                  style={{
                    backgroundColor: hex,
                    borderColor: getCurrentColorHex() === hex ? 'white' : 'transparent',
                    boxShadow: getCurrentColorHex() === hex ? `0 0 0 2px ${hex}` : 'none',
                  }}
                />
              ))}
            </div>
            <Separator />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => document.getElementById('avatar-upload-popover')?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
            <input
              id="avatar-upload-popover"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Public export ────────────────────────────────────────────────────────────

export default function AvatarSelector(props) {
  if ('pending' in props || 'onPendingChange' in props) {
    return <InlineAvatarSelector {...props} />;
  }
  return <PopoverAvatarSelector {...props} />;
}
