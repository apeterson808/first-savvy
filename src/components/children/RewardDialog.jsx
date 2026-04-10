import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsAPI } from '@/api/rewards';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AppearancePicker from '@/components/common/AppearancePicker';
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

export function RewardDialog({ isOpen, onClose, profileId, childId, onSuccess }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    star_cost: 10,
    icon: 'Gift',
    color: '#EFCE7B'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }

    if (formData.star_cost < 1 || !Number.isInteger(Number(formData.star_cost))) {
      newErrors.star_cost = 'Star cost must be a positive integer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await rewardsAPI.createReward(profileId, {
        title: formData.title,
        description: formData.description || null,
        star_cost: parseInt(formData.star_cost),
        icon: formData.icon,
        color: formData.color,
        assigned_to_child_id: childId,
        status: 'available',
        created_by_user_id: user.id
      });

      toast.success(`Reward "${formData.title}" created`);

      setFormData({
        title: '',
        description: '',
        star_cost: 10,
        icon: 'Gift',
        color: '#EFCE7B'
      });
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error('Error creating reward:', error);
      toast.error('Failed to create reward');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      star_cost: 10,
      icon: 'Gift',
      color: '#EFCE7B'
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Reward</DialogTitle>
          <DialogDescription>
            Add a new reward that your child can redeem with stars.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Extra screen time"
              maxLength={100}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details about the reward..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="star_cost">Star Cost</Label>
            <Input
              id="star_cost"
              type="number"
              min="1"
              step="1"
              value={formData.star_cost}
              onChange={(e) => setFormData({ ...formData, star_cost: e.target.value })}
            />
            {errors.star_cost && (
              <p className="text-sm text-destructive">{errors.star_cost}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Icon & Color</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-12 h-12 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm border border-slate-200"
                  style={{ backgroundColor: formData.color }}
                >
                  {(() => {
                    const IconComp = ICON_MAP[formData.icon] || Circle;
                    return <IconComp className="w-6 h-6 text-white" />;
                  })()}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <AppearancePicker
                  inline
                  useTabs
                  showPreview
                  color={formData.color}
                  icon={formData.icon}
                  onColorChange={(c) => setFormData({ ...formData, color: c })}
                  onIconChange={(i) => setFormData({ ...formData, icon: i })}
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Reward'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
