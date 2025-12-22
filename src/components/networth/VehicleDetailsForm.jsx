import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';

const VEHICLE_TYPES = [
  'Car',
  'Truck',
  'SUV',
  'Motorcycle',
  'RV',
  'Boat',
  'Other',
];

const currentYear = new Date().getFullYear();

export function VehicleDetailsForm({ onNext, onCancel, initialData = {} }) {
  const [formData, setFormData] = useState({
    year: initialData.year || '',
    make: initialData.make || '',
    model: initialData.model || '',
    vehicleType: initialData.vehicleType || '',
    vin: initialData.vin || '',
    estimatedValue: initialData.estimatedValue || '',
    isFinanced: initialData.isFinanced || false,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.year || formData.year < 1900 || formData.year > currentYear + 1) {
      newErrors.year = 'Please enter a valid year';
    }

    if (!formData.make || formData.make.trim().length === 0) {
      newErrors.make = 'Make is required';
    }

    if (!formData.model || formData.model.trim().length === 0) {
      newErrors.model = 'Model is required';
    }

    if (!formData.vehicleType) {
      newErrors.vehicleType = 'Vehicle type is required';
    }

    if (!formData.estimatedValue || parseFloat(formData.estimatedValue) <= 0) {
      newErrors.estimatedValue = 'Please enter a valid estimated value';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      const vehicleData = {
        name: `${formData.year} ${formData.make} ${formData.model}`,
        year: parseInt(formData.year),
        make: formData.make.trim(),
        model: formData.model.trim(),
        vehicleType: formData.vehicleType,
        vin: formData.vin.trim() || null,
        estimatedValue: parseFloat(formData.estimatedValue),
        isFinanced: formData.isFinanced,
      };
      onNext(vehicleData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="year">Year *</Label>
            <Input
              id="year"
              type="number"
              placeholder="2024"
              value={formData.year}
              onChange={(e) => handleChange('year', e.target.value)}
              min="1900"
              max={currentYear + 1}
            />
            {errors.year && (
              <p className="text-sm text-destructive">{errors.year}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="make">Make *</Label>
            <Input
              id="make"
              placeholder="Toyota"
              value={formData.make}
              onChange={(e) => handleChange('make', e.target.value)}
            />
            {errors.make && (
              <p className="text-sm text-destructive">{errors.make}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model *</Label>
          <Input
            id="model"
            placeholder="Camry"
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
          />
          {errors.model && (
            <p className="text-sm text-destructive">{errors.model}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vehicleType">Vehicle Type *</Label>
          <Select
            value={formData.vehicleType}
            onValueChange={(value) => handleChange('vehicleType', value)}
          >
            <SelectTrigger id="vehicleType">
              <SelectValue placeholder="Select vehicle type" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.vehicleType && (
            <p className="text-sm text-destructive">{errors.vehicleType}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vin">VIN (Optional)</Label>
          <Input
            id="vin"
            placeholder="1HGBH41JXMN109186"
            value={formData.vin}
            onChange={(e) => handleChange('vin', e.target.value)}
            maxLength={17}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimatedValue">Estimated Value *</Label>
          <Input
            id="estimatedValue"
            type="number"
            placeholder="25000"
            value={formData.estimatedValue}
            onChange={(e) => handleChange('estimatedValue', e.target.value)}
            min="0"
            step="0.01"
          />
          {errors.estimatedValue && (
            <p className="text-sm text-destructive">{errors.estimatedValue}</p>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="isFinanced" className="text-base">
              Is this vehicle financed?
            </Label>
            <p className="text-sm text-muted-foreground">
              Toggle on if you have an auto loan for this vehicle
            </p>
          </div>
          <Switch
            id="isFinanced"
            checked={formData.isFinanced}
            onCheckedChange={(checked) => handleChange('isFinanced', checked)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {formData.isFinanced ? 'Next' : 'Finish'}
        </Button>
      </div>
    </form>
  );
}
