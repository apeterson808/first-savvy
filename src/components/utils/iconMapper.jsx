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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle, Baby
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle, Baby
};

export const getIconComponent = (iconName) => {
  return ICON_MAP[iconName] || Circle;
};

// Auto-assign icons based on category/budget names
export const suggestIconForName = (name) => {
  if (!name) return 'Circle';
  
  const lowerName = name.toLowerCase();
  
  // Housing & Home
  if (/(home|house|housing|rent|mortgage|property)/i.test(lowerName)) return 'Home';
  if (/(furniture|decor)/i.test(lowerName)) return 'Home';
  
  // Transportation
  if (/(car|auto|vehicle|gas|fuel|parking)/i.test(lowerName)) return 'Car';
  if (/(uber|lyft|taxi|ride)/i.test(lowerName)) return 'Car';
  if (/(bus|subway|transit|metro)/i.test(lowerName)) return 'Bus';
  if (/(train|rail)/i.test(lowerName)) return 'Train';
  if (/(bike|bicycle|cycling)/i.test(lowerName)) return 'Bike';
  if (/(flight|airline|air travel)/i.test(lowerName)) return 'Plane';
  
  // Food & Dining
  if (/(food|grocery|groceries|supermarket)/i.test(lowerName)) return 'ShoppingCart';
  if (/(restaurant|dining|eat|meal)/i.test(lowerName)) return 'Utensils';
  if (/(coffee|cafe|starbucks)/i.test(lowerName)) return 'Coffee';
  if (/(pizza)/i.test(lowerName)) return 'Pizza';
  if (/(beer|alcohol|bar|drinks)/i.test(lowerName)) return 'Beer';
  if (/(dessert|sweet|ice cream)/i.test(lowerName)) return 'IceCream';
  if (/(cake|bakery)/i.test(lowerName)) return 'Cake';
  
  // Shopping & Retail
  if (/(shopping|retail|store|amazon)/i.test(lowerName)) return 'ShoppingBag';
  if (/(clothes|clothing|fashion|apparel)/i.test(lowerName)) return 'Shirt';
  if (/(shoes|footwear)/i.test(lowerName)) return 'Shirt';
  if (/(watch|jewelry|accessories)/i.test(lowerName)) return 'Watch';
  if (/(beauty|cosmetics|makeup|hair|salon)/i.test(lowerName)) return 'Scissors';
  if (/(art|craft|supplies)/i.test(lowerName)) return 'Paintbrush';
  if (/(gift|present)/i.test(lowerName)) return 'Gift';
  
  // Entertainment & Recreation
  if (/(entertainment|fun|recreation)/i.test(lowerName)) return 'Sparkles';
  if (/(movie|film|cinema)/i.test(lowerName)) return 'Film';
  if (/(music|spotify|apple music)/i.test(lowerName)) return 'Music';
  if (/(game|gaming|playstation|xbox)/i.test(lowerName)) return 'Gamepad';
  if (/(party|celebration|event)/i.test(lowerName)) return 'PartyPopper';
  if (/(hobby|hobbies)/i.test(lowerName)) return 'Star';
  if (/(vacation|travel|holiday|trip)/i.test(lowerName)) return 'Plane';
  if (/(hotel|accommodation|lodging)/i.test(lowerName)) return 'Hotel';
  if (/(camera|photo)/i.test(lowerName)) return 'Camera';
  if (/(video)/i.test(lowerName)) return 'Video';
  
  // Technology & Electronics
  if (/(phone|mobile|cell|smartphone)/i.test(lowerName)) return 'Smartphone';
  if (/(computer|laptop|pc)/i.test(lowerName)) return 'Laptop';
  if (/(tv|television|streaming|netflix)/i.test(lowerName)) return 'Tv';
  if (/(internet|wifi|broadband)/i.test(lowerName)) return 'Wifi';
  if (/(software|subscription|app)/i.test(lowerName)) return 'Package';
  if (/(headphone|audio|speaker)/i.test(lowerName)) return 'Headphones';
  if (/(microphone|mic|podcast)/i.test(lowerName)) return 'Mic';
  
  // Health & Fitness
  if (/(health|medical|doctor|hospital)/i.test(lowerName)) return 'Heart';
  if (/(gym|fitness|workout|exercise)/i.test(lowerName)) return 'Dumbbell';
  if (/(medicine|pharmacy|prescription|drug)/i.test(lowerName)) return 'Pill';
  if (/(insurance|health insurance)/i.test(lowerName)) return 'Stethoscope';
  if (/(wellness|spa|massage)/i.test(lowerName)) return 'Heart';
  if (/(nutrition|diet|healthy)/i.test(lowerName)) return 'Apple';
  
  // Education & Learning
  if (/(education|school|college|university)/i.test(lowerName)) return 'GraduationCap';
  if (/(book|reading|library)/i.test(lowerName)) return 'Book';
  if (/(course|class|training|tuition)/i.test(lowerName)) return 'GraduationCap';
  
  // Work & Business
  if (/(work|job|business|office)/i.test(lowerName)) return 'Briefcase';
  if (/(salary|income|paycheck|wage)/i.test(lowerName)) return 'DollarSign';
  if (/(tax|taxes|irs)/i.test(lowerName)) return 'Building';
  if (/(professional|service)/i.test(lowerName)) return 'Briefcase';
  
  // Finance & Money
  if (/(bank|banking|account)/i.test(lowerName)) return 'Building';
  if (/(credit|card|payment)/i.test(lowerName)) return 'CreditCard';
  if (/(wallet|cash|money)/i.test(lowerName)) return 'Wallet';
  if (/(saving|savings|save)/i.test(lowerName)) return 'PiggyBank';
  if (/(investment|invest|stock|trading)/i.test(lowerName)) return 'TrendingUp';
  if (/(loan|debt|mortgage)/i.test(lowerName)) return 'CreditCard';
  if (/(fee|charge)/i.test(lowerName)) return 'DollarSign';
  
  // Utilities & Bills
  if (/(electric|electricity|power)/i.test(lowerName)) return 'Zap';
  if (/(water|sewer)/i.test(lowerName)) return 'Droplet';
  if (/(gas|heating)/i.test(lowerName)) return 'Fuel';
  if (/(utility|utilities|bill)/i.test(lowerName)) return 'Lightbulb';
  if (/(phone|telephone)/i.test(lowerName)) return 'Phone';
  if (/(mail|postage|shipping)/i.test(lowerName)) return 'Mail';
  
  // Pets & Animals
  if (/(pet|dog|puppy)/i.test(lowerName)) return 'Dog';
  if (/(cat|kitten)/i.test(lowerName)) return 'Cat';
  if (/(fish|aquarium)/i.test(lowerName)) return 'Fish';
  if (/(bird)/i.test(lowerName)) return 'Bird';
  if (/(vet|veterinary)/i.test(lowerName)) return 'PawPrint';
  
  // Home Maintenance & Repairs
  if (/(maintenance|repair|fix)/i.test(lowerName)) return 'Wrench';
  if (/(tool|hardware)/i.test(lowerName)) return 'Hammer';
  if (/(garden|yard|lawn)/i.test(lowerName)) return 'Trees';
  if (/(plant|flower)/i.test(lowerName)) return 'Flower2';
  
  // Miscellaneous
  if (/(package|delivery|shipping)/i.test(lowerName)) return 'Package';
  if (/(tag|label)/i.test(lowerName)) return 'Tag';
  if (/(store|shop)/i.test(lowerName)) return 'Store';
  if (/(award|prize|achievement)/i.test(lowerName)) return 'Trophy';
  if (/(crown|premium|vip)/i.test(lowerName)) return 'Crown';
  
  // Default
  return 'Circle';
};