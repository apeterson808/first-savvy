# Child Category Display Options

Currently showing: **Option 1 - Tree Connector Lines**

## Option 1: Tree Connector Lines ✓ (Current)
```jsx
{isChild && (
  <div className="flex items-center mr-2 text-slate-400">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 8 L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 8 L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </div>
)}
```
Visual: `└─ Electrical Bill`

## Option 2: Simple Indent with Arrow
```jsx
{isChild && (
  <div className="flex items-center mr-2 text-slate-400 ml-2">
    <span className="text-sm">↳</span>
  </div>
)}
```
Visual: `  ↳ Electrical Bill`

## Option 3: Subtle Left Border
```jsx
<div className={isChild ? 'ml-6 pl-2 border-l-2 border-slate-300' : ''}>
  <IconComponent />
  <span>{category.display_name}</span>
</div>
```
Visual: `| Electrical Bill` (with vertical line on left)

## Option 4: Simple Indent Only
```jsx
<div className={isChild ? 'ml-8' : ''}>
  <IconComponent />
  <span>{category.display_name}</span>
</div>
```
Visual: `        Electrical Bill` (just indented)

## Option 5: Badge/Chip Style
```jsx
{isChild && (
  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 mr-2">child</Badge>
)}
```
Visual: `[child] Electrical Bill`

Let me know which option you prefer and I'll implement it!
