import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
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

export default function AppearancePicker({ color, icon, onColorChange, onIconChange, inline = false }) {
  const [colorOpen, setColorOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedColor = color || DEFAULT_COLOR;
  const SelectedIcon = icon && ICON_MAP[icon] ? ICON_MAP[icon] : Circle;

  const filteredIcons = ICON_NAMES.filter(iconName =>
    iconName.toLowerCase().includes(search.toLowerCase())
  );

  if (inline) {
    return (
      <div className="p-4 border border-slate-200 rounded-md bg-slate-50 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: selectedColor }}
          >
            <SelectedIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm text-slate-600">Preview</span>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Color</h4>
          <div className="grid grid-cols-6 gap-2">
            {CUSTOM_COLOR_PALETTE.map((colorOption) => (
              <button
                key={colorOption.hex}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onColorChange?.(colorOption.hex);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  selectedColor === colorOption.hex
                    ? 'border-slate-800 scale-110'
                    : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                }`}
                style={{ backgroundColor: colorOption.hex }}
                title={colorOption.name}
              />
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Icon</h4>
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm mb-2"
          />
          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto overflow-x-hidden pr-1" onWheel={(e) => e.stopPropagation()}>
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
                    onIconChange?.(iconName);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-9 h-9 flex items-center justify-center rounded hover:bg-slate-100 transition-colors ${
                    icon === iconName ? 'bg-blue-100 text-blue-600' : 'text-slate-600'
                  }`}
                  title={iconName}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: selectedColor }}
      >
        <SelectedIcon className="w-5 h-5 text-white" />
      </div>

      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="link" className="text-sm text-slate-600 hover:text-slate-900 p-0 h-auto">
            Color
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="start">
          <div className="grid grid-cols-6 gap-2">
            {CUSTOM_COLOR_PALETTE.map((colorOption) => (
              <button
                key={colorOption.hex}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onColorChange?.(colorOption.hex);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  selectedColor === colorOption.hex
                    ? 'border-slate-800 scale-110'
                    : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                }`}
                style={{ backgroundColor: colorOption.hex }}
                title={colorOption.name}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={iconOpen} onOpenChange={setIconOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="link" className="text-sm text-slate-600 hover:text-slate-900 p-0 h-auto">
            Icon
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="start">
          <div className="space-y-2">
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto overflow-x-hidden pr-1" onWheel={(e) => e.stopPropagation()}>
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
                      onIconChange?.(iconName);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-9 h-9 flex items-center justify-center rounded hover:bg-slate-100 transition-colors ${
                      icon === iconName ? 'bg-blue-100 text-blue-600' : 'text-slate-600'
                    }`}
                    title={iconName}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}