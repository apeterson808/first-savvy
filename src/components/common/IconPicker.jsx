import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle
} from 'lucide-react';

// Map icon names to components
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle
};

const ICON_NAMES = Object.keys(ICON_MAP);

export default function IconPicker({ value, onValueChange, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = ICON_NAMES.filter(iconName =>
    iconName.toLowerCase().includes(search.toLowerCase())
  );

  const SelectedIcon = value && ICON_MAP[value] ? ICON_MAP[value] : Circle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-6 h-6 rounded-full border-2 border-slate-200 hover:border-slate-300 transition-colors ml-2 mt-2 flex items-center justify-center bg-white"
        >
          <SelectedIcon className="w-3.5 h-3.5 text-slate-600" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 flex flex-col max-h-96" align="start">
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-3 flex-shrink-0"
        />
        <div className="grid grid-cols-8 gap-1 overflow-y-auto flex-1 pr-1">
            {filteredIcons.map((iconName) => {
              const Icon = ICON_MAP[iconName];
              if (!Icon) return null;
              
              return (
                <button
                  key={iconName}
                  onClick={() => {
                    onValueChange(iconName);
                    setOpen(false);
                  }}
                  className={`w-9 h-9 flex items-center justify-center rounded hover:bg-slate-100 transition-colors ${
                    value === iconName ? 'bg-blue-100 text-blue-600' : 'text-slate-600'
                  }`}
                  title={iconName}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
      </PopoverContent>
    </Popover>
  );
}