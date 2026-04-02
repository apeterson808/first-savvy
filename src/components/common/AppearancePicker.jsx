import React, { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
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

const DEFAULT_COLOR = '#52A5CE';

export default function AppearancePicker({ color, icon, onColorChange, onIconChange, imageUrl, onImageUpload, inline = false, showPreview = false, useTabs = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('icon');
  const [currentStep, setCurrentStep] = useState('icon');
  const closeTimeoutRef = useRef(null);

  const selectedColor = color || DEFAULT_COLOR;
  const SelectedIcon = icon && ICON_MAP[icon] ? ICON_MAP[icon] : Circle;

  const filteredIcons = ICON_NAMES.filter(iconName =>
    iconName.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setActiveTab('icon');
      setCurrentStep('icon');
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleColorSelect = (newColor) => {
    onColorChange?.(newColor);

    if (!inline) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, 200);
    }
  };

  const handleIconSelect = (newIcon) => {
    onIconChange?.(newIcon);

    if (!inline) {
      setCurrentStep('color');
      setSearch('');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      onImageUpload?.(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const pickerContent = inline ? (
    useTabs ? (
      <div className="space-y-4">
        {showPreview && (
          <div className="flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-md overflow-hidden"
              style={{ backgroundColor: imageUrl ? 'transparent' : selectedColor }}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <SelectedIcon className="w-8 h-8 text-white" />
              )}
            </div>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="color">Color</TabsTrigger>
            <TabsTrigger value="icon">Icon</TabsTrigger>
          </TabsList>

          <TabsContent value="color" className="mt-4">
            <div className="grid grid-cols-6 gap-2">
              {CUSTOM_COLOR_PALETTE.map((colorOption) => (
                <button
                  key={colorOption.hex}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleColorSelect(colorOption.hex);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    selectedColor === colorOption.hex
                      ? 'border-slate-800 scale-110'
                      : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: colorOption.hex }}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="icon" className="mt-4 space-y-3">
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-sm"
            />
            <div className="grid grid-cols-6 gap-1 max-h-56 overflow-y-auto overflow-x-hidden pr-1" onWheel={(e) => e.stopPropagation()}>
              {filteredIcons.map((iconName) => {
                const Icon = ICON_MAP[iconName];
                if (!Icon) return null;

                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleIconSelect(iconName);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-10 h-10 flex items-center justify-center rounded hover:bg-slate-100 transition-all ${
                      icon === iconName ? 'bg-slate-800 text-white' : 'text-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
            {onImageUpload && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('appearance-picker-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </Button>
                  {imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onImageUpload(null)}
                    >
                      Clear
                    </Button>
                  )}
                  <input
                    id="appearance-picker-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center shadow-md"
            style={{ backgroundColor: selectedColor }}
          >
            <SelectedIcon className="w-8 h-8 text-white" />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Color</h4>
          <div className="grid grid-cols-6 gap-2">
            {CUSTOM_COLOR_PALETTE.map((colorOption) => (
              <button
                key={colorOption.hex}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleColorSelect(colorOption.hex);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  selectedColor === colorOption.hex
                    ? 'border-slate-800 scale-110'
                    : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                }`}
                style={{ backgroundColor: colorOption.hex }}
              />
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Icon</h4>
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm mb-3"
          />
          <div className="grid grid-cols-6 gap-1 max-h-56 overflow-y-auto overflow-x-hidden pr-1" onWheel={(e) => e.stopPropagation()}>
            {filteredIcons.map((iconName) => {
              const Icon = ICON_MAP[iconName];
              if (!Icon) return null;

              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleIconSelect(iconName);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-10 h-10 flex items-center justify-center rounded hover:bg-slate-100 transition-all ${
                    icon === iconName ? 'bg-slate-800 text-white' : 'text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )
  ) : (
    <div className="w-full">
      {currentStep === 'icon' ? (
        <>
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm mb-3"
          />
          <div className="grid grid-cols-6 gap-1 max-h-56 overflow-y-auto overflow-x-hidden pr-1" onWheel={(e) => e.stopPropagation()}>
            {filteredIcons.map((iconName) => {
              const Icon = ICON_MAP[iconName];
              if (!Icon) return null;

              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleIconSelect(iconName);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-10 h-10 flex items-center justify-center rounded hover:bg-slate-100 transition-all ${
                    icon === iconName ? 'bg-slate-800 text-white' : 'text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          {CUSTOM_COLOR_PALETTE.map((colorOption) => (
            <button
              key={colorOption.hex}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleColorSelect(colorOption.hex);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`w-10 h-10 rounded-full border-2 transition-all ${
                selectedColor === colorOption.hex
                  ? 'border-slate-800 scale-110'
                  : 'border-slate-300 hover:scale-105 hover:border-slate-400'
              }`}
              style={{ backgroundColor: colorOption.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
        {pickerContent}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
          style={{ backgroundColor: selectedColor }}
        >
          <SelectedIcon className="w-5 h-5 text-white" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start" onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
        }
      }}>
        {pickerContent}
      </PopoverContent>
    </Popover>
  );
}