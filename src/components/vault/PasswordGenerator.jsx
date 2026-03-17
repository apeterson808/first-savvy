import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Slider } from '../ui/slider';
import { Card, CardContent } from '../ui/card';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { vaultService } from '../../api/vaultService';
import { toast } from 'sonner';

export default function PasswordGenerator({ onPasswordGenerated }) {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [options, setOptions] = useState({
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generatePassword();
  }, []);

  const generatePassword = () => {
    const newPassword = vaultService.generatePassword(length, options);
    setPassword(newPassword);
    setCopied(false);
  };

  useEffect(() => {
    generatePassword();
  }, [length, options]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy password');
    }
  };

  const usePassword = () => {
    if (onPasswordGenerated) {
      onPasswordGenerated(password);
    }
  };

  const strength = vaultService.calculatePasswordStrength(password);

  const strengthColors = {
    gray: 'bg-gray-200',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label>Generated Password</Label>
          <div className="flex items-center gap-2">
            <Input value={password} readOnly className="font-mono" />
            <Button variant="outline" size="icon" onClick={copyToClipboard}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={generatePassword}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Password Strength</Label>
            <span className={`text-sm font-medium text-${strength.color}-600`}>
              {strength.label}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${strengthColors[strength.color]}`}
              style={{ width: `${(strength.score / 7) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Length: {length}</Label>
          <Slider
            value={[length]}
            onValueChange={(value) => setLength(value[0])}
            min={8}
            max={32}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-3">
          <Label>Options</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="uppercase"
                checked={options.includeUppercase}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, includeUppercase: checked })
                }
              />
              <label htmlFor="uppercase" className="text-sm cursor-pointer">
                Uppercase Letters (A-Z)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="lowercase"
                checked={options.includeLowercase}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, includeLowercase: checked })
                }
              />
              <label htmlFor="lowercase" className="text-sm cursor-pointer">
                Lowercase Letters (a-z)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="numbers"
                checked={options.includeNumbers}
                onCheckedChange={(checked) => setOptions({ ...options, includeNumbers: checked })}
              />
              <label htmlFor="numbers" className="text-sm cursor-pointer">
                Numbers (0-9)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="symbols"
                checked={options.includeSymbols}
                onCheckedChange={(checked) => setOptions({ ...options, includeSymbols: checked })}
              />
              <label htmlFor="symbols" className="text-sm cursor-pointer">
                Symbols (!@#$%^&*)
              </label>
            </div>
          </div>
        </div>

        {onPasswordGenerated && (
          <Button onClick={usePassword} className="w-full">
            Use This Password
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
