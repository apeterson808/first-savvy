import React, { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle,
  Baby, Bed, Sofa, Armchair, Lamp, UtensilsCrossed, ChefHat,
  Bitcoin, Coins, Banknote, Calculator, ChartBar, ChartPie,
  Clock, Timer, Calendar, Glasses, Wine, Cigarette,
  Flame, Wind, Snowflake, Key, Lock, Shield,
  Newspaper, BookOpen, Library, Rocket, Mountain, Tent,
  Compass, Users, UserPlus, BadgeDollarSign, Receipt, FileText
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle,
  Baby, Bed, Sofa, Armchair, Lamp, UtensilsCrossed, ChefHat,
  Bitcoin, Coins, Banknote, Calculator, ChartBar, ChartPie,
  Clock, Timer, Calendar, Glasses, Wine, Cigarette,
  Flame, Wind, Snowflake, Key, Lock, Shield,
  Newspaper, BookOpen, Library, Rocket, Mountain, Tent,
  Compass, Users, UserPlus, BadgeDollarSign, Receipt, FileText
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

export default function AppearancePicker({ color, icon, onColorChange, onIconChange, inline = false, showPreview = false, useTabs = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('color');
  const [hasSelectedColor, setHasSelectedColor] = useState(false);
  const [hasSelectedIcon, setHasSelectedIcon] = useState(false);
  const closeTimeoutRef = useRef(null);

  const selectedColor = color || DEFAULT_COLOR;
  const SelectedIcon = icon && ICON_MAP[icon] ? ICON_MAP[icon] : Circle;

  const filteredIcons = ICON_NAMES.filter(iconName =>
    iconName.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!open) {
      setHasSelectedColor(false);
      setHasSelectedIcon(false);
      setSearch('');
      setActiveTab('color');
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
    setHasSelectedColor(true);

    if (!inline && hasSelectedIcon) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, 300);
    }
  };

  const handleIconSelect = (newIcon) => {
    onIconChange?.(newIcon);
    setHasSelectedIcon(true);

    if (!inline && hasSelectedColor) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, 300);
    }
  };

  const pickerContent = inline ? (
    useTabs ? (
      <div className="space-y-4">
        {showPreview && (
          <div className="flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: selectedColor }}
            >
              <SelectedIcon className="w-8 h-8 text-white" />
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

          <TabsContent value="icon" className="mt-4">
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

      <TabsContent value="icon" className="mt-4">
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
      </TabsContent>
    </Tabs>
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