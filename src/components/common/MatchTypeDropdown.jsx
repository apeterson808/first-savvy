import {
  ClickThroughSelect,
  ClickThroughSelectItem,
} from '../ui/ClickThroughSelect';

const matchTypes = [
  { value: 'transfer', label: 'Transfer' },
  { value: 'credit_card_payment', label: 'Credit Card Payment' },
];

export default function MatchTypeDropdown({ value, onValueChange, triggerClassName, disabled = false }) {
  return (
    <ClickThroughSelect
      value={value || ''}
      onValueChange={onValueChange}
      placeholder="Select match type"
      triggerClassName={triggerClassName}
      disabled={disabled}
    >
      {matchTypes.map((type) => (
        <ClickThroughSelectItem key={type.value} value={type.value}>
          {type.label}
        </ClickThroughSelectItem>
      ))}
    </ClickThroughSelect>
  );
}
